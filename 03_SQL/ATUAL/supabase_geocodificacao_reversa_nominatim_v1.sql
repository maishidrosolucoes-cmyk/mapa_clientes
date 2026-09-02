-- ============================================================
-- MAPA DE CLIENTES MHS - GEOCODIFICACAO REVERSA NOMINATIM V1
--
-- Execute depois de supabase_operacao_feira_v1.sql.
-- Uso previsto: consultas pontuais acionadas pelo operador ao
-- confirmar um ponto no mapa. Nao use para geocodificacao em lote.
-- ============================================================

begin;

create table if not exists mapa_clientes.cache_enderecos_reversos (
    provedor          text not null,
    latitude_chave    numeric(8, 5) not null,
    longitude_chave   numeric(8, 5) not null,
    encontrado        boolean not null,
    resultado         jsonb,
    consultado_em     timestamptz not null default now(),
    expira_em         timestamptz not null,
    constraint cache_enderecos_reversos_pkey
        primary key (provedor, latitude_chave, longitude_chave),
    constraint cache_enderecos_reversos_latitude_check
        check (latitude_chave between -34.2 and 5.4),
    constraint cache_enderecos_reversos_longitude_check
        check (longitude_chave between -74.1 and -32.2),
    constraint cache_enderecos_reversos_resultado_check
        check (
            (encontrado and resultado is not null)
            or
            (not encontrado and resultado is null)
        )
);

comment on table mapa_clientes.cache_enderecos_reversos is
'Cache interno de sugestoes de endereco por coordenada. Usado somente pela Edge Function para evitar consultas repetidas ao Nominatim.';

create index if not exists cache_enderecos_reversos_expira_em_idx
    on mapa_clientes.cache_enderecos_reversos (expira_em);

create table if not exists mapa_clientes.controle_geocodificacao_reversa (
    provedor                    text primary key,
    proxima_consulta_permitida  timestamptz not null default now(),
    atualizado_em               timestamptz not null default now()
);

comment on table mapa_clientes.controle_geocodificacao_reversa is
'Controle global de intervalo entre chamadas externas de geocodificacao reversa.';

create or replace function mapa_clientes.reservar_consulta_reversa(
    p_provedor text,
    p_intervalo_ms integer default 1100
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, mapa_clientes
as $$
declare
    v_agora timestamptz := clock_timestamp();
    v_proxima timestamptz;
begin
    if nullif(trim(p_provedor), '') is null then
        raise exception 'Provedor obrigatorio.';
    end if;

    if p_intervalo_ms < 1000 or p_intervalo_ms > 10000 then
        raise exception 'Intervalo de geocodificacao invalido.';
    end if;

    insert into mapa_clientes.controle_geocodificacao_reversa (provedor)
    values (upper(trim(p_provedor)))
    on conflict (provedor) do nothing;

    select proxima_consulta_permitida
      into v_proxima
      from mapa_clientes.controle_geocodificacao_reversa
     where provedor = upper(trim(p_provedor))
     for update;

    if v_proxima > v_agora then
        return ceil(extract(epoch from (v_proxima - v_agora)) * 1000)::integer;
    end if;

    update mapa_clientes.controle_geocodificacao_reversa
       set proxima_consulta_permitida = v_agora + make_interval(secs => p_intervalo_ms / 1000.0),
           atualizado_em = v_agora
     where provedor = upper(trim(p_provedor));

    return 0;
end;
$$;

alter table mapa_clientes.cache_enderecos_reversos enable row level security;
alter table mapa_clientes.controle_geocodificacao_reversa enable row level security;

revoke all on mapa_clientes.cache_enderecos_reversos from public, anon, authenticated;
revoke all on mapa_clientes.controle_geocodificacao_reversa from public, anon, authenticated;
revoke all on function mapa_clientes.reservar_consulta_reversa(text, integer) from public, anon, authenticated;

grant usage on schema mapa_clientes to service_role;
grant select on mapa_clientes.operadores to service_role;
grant select, insert, update on mapa_clientes.cache_enderecos_reversos to service_role;
grant execute on function mapa_clientes.reservar_consulta_reversa(text, integer) to service_role;

commit;

notify pgrst, 'reload schema';

-- Validacao somente leitura.
select
    provedor,
    count(*) as itens_em_cache,
    count(*) filter (where encontrado) as enderecos_encontrados,
    count(*) filter (where not encontrado) as pontos_sem_endereco
from mapa_clientes.cache_enderecos_reversos
group by provedor
order by provedor;
