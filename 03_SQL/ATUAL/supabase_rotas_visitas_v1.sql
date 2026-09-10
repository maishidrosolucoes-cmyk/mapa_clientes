-- ============================================================
-- MAPA DE CLIENTES MHS - ROTAS, VISITAS E ANEXOS V1
--
-- Pre-requisitos:
--   03_SQL/ATUAL/supabase_operacao_feira_v1.sql
--
-- Objetivos:
--   - distinguir reposicionamento de edicao de comunicacao;
--   - permitir montar rotas manuais de visitas;
--   - registrar relatorios de visita por cliente;
--   - anexar documentos privados a clientes ou visitas;
--   - manter escrita apenas por RPC para operadores autenticados.
--
-- Este arquivo e aditivo, idempotente e nao remove dados.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Sinal operacional preciso para filtros do mapa
-- ------------------------------------------------------------

alter table mapa_clientes.base_mapa
    add column if not exists reposicionado_em timestamptz,
    add column if not exists reposicionado_por uuid;

do $$
begin
    if not exists (
        select 1
          from pg_constraint
         where conname = 'base_mapa_reposicionado_por_fkey'
           and conrelid = 'mapa_clientes.base_mapa'::regclass
    ) then
        alter table mapa_clientes.base_mapa
            add constraint base_mapa_reposicionado_por_fkey
            foreign key (reposicionado_por)
            references auth.users(id) on delete set null;
    end if;
end;
$$;

-- Recupera reposicionamentos que ja foram confirmados pela interface antes
-- desta migracao. Mantem a data e o operador do ultimo ajuste de cada cliente.
update mapa_clientes.base_mapa b
   set reposicionado_em = h.criado_em,
       reposicionado_por = h.operador_id
  from (
      select distinct on (cliente_id)
          cliente_id,
          criado_em,
          operador_id
      from mapa_clientes.historico_clientes
      where tipo_evento = 'REPOSICIONAMENTO'
      order by cliente_id, criado_em desc
  ) h
 where b.cliente_id = h.cliente_id
   and b.reposicionado_em is null;

create index if not exists base_mapa_reposicionado_em_idx
    on mapa_clientes.base_mapa (reposicionado_em desc)
    where reposicionado_em is not null;

-- Reposicionamento e diferente de editar telefone, e-mail ou contato.
-- A funcao abaixo substitui a versao da migracao de operacao de feira.
create or replace function mapa_clientes.confirmar_localizacao(
    p_cliente_id uuid,
    p_latitude double precision,
    p_longitude double precision,
    p_fonte text default 'AJUSTE_MANUAL_MAPA',
    p_precisao_m double precision default null,
    p_observacao text default null
)
returns setof mapa_clientes.base_mapa
language plpgsql
security definer
set search_path = pg_catalog, mapa_clientes
as $$
declare
    v_row mapa_clientes.base_mapa%rowtype;
begin
    if not mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO', 'EDITOR']) then
        raise exception 'Operador nao autorizado.' using errcode = '42501';
    end if;

    if p_latitude is null or p_longitude is null then
        raise exception 'Latitude e longitude sao obrigatorias.';
    end if;

    if p_latitude not between -34.2 and 5.4
       or p_longitude not between -74.1 and -32.2 then
        raise exception 'Coordenada fora dos limites do Brasil.';
    end if;

    if p_precisao_m is not null and p_precisao_m < 0 then
        raise exception 'Precisao nao pode ser negativa.';
    end if;

    update mapa_clientes.base_mapa
       set latitude_confirmada = p_latitude,
           longitude_confirmada = p_longitude,
           localizacao_status = 'CONFIRMADA_CAMPO',
           localizacao_fonte = coalesce(
               upper(mapa_clientes.texto_limpo(p_fonte)),
               'AJUSTE_MANUAL_MAPA'
           ),
           localizacao_precisao_m = p_precisao_m,
           localizacao_observacao = mapa_clientes.texto_limpo(p_observacao),
           localizacao_confirmada_em = now(),
           localizacao_confirmada_por = auth.uid(),
           reposicionado_em = now(),
           reposicionado_por = auth.uid(),
           atualizado_por = auth.uid()
     where cliente_id = p_cliente_id
     returning * into v_row;

    if not found then
        raise exception 'Cliente nao encontrado.' using errcode = 'P0002';
    end if;

    return next v_row;
end;
$$;

-- ------------------------------------------------------------
-- 2. Rotas e paradas planejadas
-- ------------------------------------------------------------

create table if not exists mapa_clientes.rotas_visitas (
    rota_id         uuid primary key default gen_random_uuid(),
    titulo          text not null,
    data_planejada  date,
    status          text not null default 'RASCUNHO',
    observacao      text,
    criado_em       timestamptz not null default now(),
    atualizado_em   timestamptz not null default now(),
    criado_por      uuid references auth.users(id) on delete set null,
    atualizado_por  uuid references auth.users(id) on delete set null,
    constraint rotas_visitas_titulo_check check (length(trim(titulo)) between 1 and 160),
    constraint rotas_visitas_status_check
        check (status in ('RASCUNHO', 'PLANEJADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'))
);

create table if not exists mapa_clientes.rotas_paradas (
    rota_parada_id          uuid primary key default gen_random_uuid(),
    rota_id                 uuid not null references mapa_clientes.rotas_visitas(rota_id) on delete cascade,
    cliente_id              uuid not null references mapa_clientes.base_mapa(cliente_id) on delete restrict,
    ordem                   integer not null,
    status                  text not null default 'PENDENTE',
    agendado_para           timestamptz,
    observacao_planejamento text,
    criado_em               timestamptz not null default now(),
    atualizado_em           timestamptz not null default now(),
    criado_por              uuid references auth.users(id) on delete set null,
    atualizado_por          uuid references auth.users(id) on delete set null,
    constraint rotas_paradas_ordem_check check (ordem > 0),
    constraint rotas_paradas_status_check
        check (status in ('PENDENTE', 'VISITADO', 'NAO_REALIZADO', 'CANCELADO')),
    constraint rotas_paradas_rota_cliente_uidx unique (rota_id, cliente_id),
    constraint rotas_paradas_rota_ordem_uidx unique (rota_id, ordem)
);

create index if not exists rotas_visitas_data_idx
    on mapa_clientes.rotas_visitas (data_planejada desc, criado_em desc);

create index if not exists rotas_paradas_rota_idx
    on mapa_clientes.rotas_paradas (rota_id, ordem);

create index if not exists rotas_paradas_cliente_idx
    on mapa_clientes.rotas_paradas (cliente_id, criado_em desc);

comment on table mapa_clientes.rotas_visitas is
'Roteiros de visita criados manualmente pela equipe de campo.';

comment on table mapa_clientes.rotas_paradas is
'Clientes selecionados e ordenados manualmente em uma rota de visitas.';

-- ------------------------------------------------------------
-- 3. Relatorios de visita e anexos privados
-- ------------------------------------------------------------

create table if not exists mapa_clientes.visitas_clientes (
    visita_id          uuid primary key default gen_random_uuid(),
    cliente_id         uuid not null references mapa_clientes.base_mapa(cliente_id) on delete restrict,
    rota_id            uuid references mapa_clientes.rotas_visitas(rota_id) on delete set null,
    rota_parada_id     uuid references mapa_clientes.rotas_paradas(rota_parada_id) on delete set null,
    status             text not null default 'REALIZADA',
    ocorreu_em         timestamptz not null default now(),
    relato             text,
    resultado          text,
    proximo_passo      text,
    proxima_visita_em  timestamptz,
    criado_em          timestamptz not null default now(),
    criado_por         uuid references auth.users(id) on delete set null,
    constraint visitas_clientes_status_check
        check (status in ('REALIZADA', 'NAO_REALIZADA', 'REAGENDAR')),
    constraint visitas_clientes_relato_check
        check (relato is null or length(relato) <= 12000),
    constraint visitas_clientes_resultado_check
        check (resultado is null or length(resultado) <= 4000),
    constraint visitas_clientes_proximo_passo_check
        check (proximo_passo is null or length(proximo_passo) <= 4000)
);

create table if not exists mapa_clientes.documentos_clientes (
    documento_id     uuid primary key default gen_random_uuid(),
    cliente_id       uuid not null references mapa_clientes.base_mapa(cliente_id) on delete restrict,
    visita_id        uuid references mapa_clientes.visitas_clientes(visita_id) on delete cascade,
    tipo             text not null default 'CLIENTE',
    nome_arquivo     text not null,
    caminho_storage  text not null unique,
    content_type     text not null,
    tamanho_bytes    bigint not null,
    descricao        text,
    criado_em        timestamptz not null default now(),
    criado_por       uuid references auth.users(id) on delete set null,
    constraint documentos_clientes_tipo_check check (tipo in ('CLIENTE', 'VISITA')),
    constraint documentos_clientes_nome_check check (length(trim(nome_arquivo)) between 1 and 255),
    constraint documentos_clientes_tamanho_check check (tamanho_bytes > 0 and tamanho_bytes <= 10485760)
);

create index if not exists visitas_clientes_cliente_idx
    on mapa_clientes.visitas_clientes (cliente_id, ocorreu_em desc);

create index if not exists visitas_clientes_rota_idx
    on mapa_clientes.visitas_clientes (rota_id, ocorreu_em desc)
    where rota_id is not null;

create index if not exists documentos_clientes_cliente_idx
    on mapa_clientes.documentos_clientes (cliente_id, criado_em desc);

create index if not exists documentos_clientes_visita_idx
    on mapa_clientes.documentos_clientes (visita_id, criado_em desc)
    where visita_id is not null;

comment on table mapa_clientes.visitas_clientes is
'Relatorios imutaveis de visitas realizadas, nao realizadas ou reagendadas.';

comment on table mapa_clientes.documentos_clientes is
'Metadados de arquivos privados no bucket Storage clientes-anexos.';

-- Bucket privado. Limite de 10 MB e formatos adequados para relatorios de campo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'clientes-anexos',
    'clientes-anexos',
    false,
    10485760,
    array[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp'
    ]::text[]
)
on conflict (id) do update
   set public = excluded.public,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- ------------------------------------------------------------
-- 4. Visões de leitura para rota, ficha do cliente e relatorios
-- ------------------------------------------------------------

create or replace view mapa_clientes.vw_rotas_visitas
with (security_invoker = true)
as
select
    r.*,
    count(p.rota_parada_id) as total_paradas,
    count(p.rota_parada_id) filter (where p.status = 'VISITADO') as paradas_visitadas,
    count(p.rota_parada_id) filter (where p.status = 'PENDENTE') as paradas_pendentes
from mapa_clientes.rotas_visitas r
left join mapa_clientes.rotas_paradas p on p.rota_id = r.rota_id
group by r.rota_id;

create or replace view mapa_clientes.vw_visitas_clientes
with (security_invoker = true)
as
select
    v.*,
    coalesce(b.nome_fantasia, b.razao_social, b.cnpj, 'Cliente') as cliente,
    b.municipio,
    b.uf,
    r.titulo as rota_titulo,
    o.nome as operador,
    count(d.documento_id) as total_anexos
from mapa_clientes.visitas_clientes v
join mapa_clientes.base_mapa b on b.cliente_id = v.cliente_id
left join mapa_clientes.rotas_visitas r on r.rota_id = v.rota_id
left join mapa_clientes.operadores o on o.usuario_id = v.criado_por
left join mapa_clientes.documentos_clientes d on d.visita_id = v.visita_id
group by v.visita_id, b.cliente_id, r.rota_id, o.usuario_id;

-- ------------------------------------------------------------
-- 5. RPCs: escrita autenticada e auditavel
-- ------------------------------------------------------------

create or replace function mapa_clientes.criar_rota_visita(
    p_titulo text,
    p_data_planejada date default null,
    p_observacao text default null
)
returns setof mapa_clientes.rotas_visitas
language plpgsql
security definer
set search_path = pg_catalog, mapa_clientes
as $$
declare
    v_titulo text := mapa_clientes.texto_limpo(p_titulo);
    v_row mapa_clientes.rotas_visitas%rowtype;
begin
    if not mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO', 'EDITOR']) then
        raise exception 'Operador nao autorizado.' using errcode = '42501';
    end if;

    if v_titulo is null then
        raise exception 'Informe um titulo para a rota.';
    end if;

    insert into mapa_clientes.rotas_visitas (
        titulo, data_planejada, observacao, criado_por, atualizado_por
    ) values (
        v_titulo,
        p_data_planejada,
        mapa_clientes.texto_limpo(p_observacao),
        auth.uid(),
        auth.uid()
    ) returning * into v_row;

    return next v_row;
end;
$$;

create or replace function mapa_clientes.definir_paradas_rota(
    p_rota_id uuid,
    p_paradas jsonb
)
returns setof mapa_clientes.rotas_visitas
language plpgsql
security definer
set search_path = pg_catalog, mapa_clientes
as $$
declare
    v_rota mapa_clientes.rotas_visitas%rowtype;
    v_item jsonb;
    v_cliente_id uuid;
    v_ordem integer := 0;
    v_ids uuid[] := array[]::uuid[];
    v_desconhecidos jsonb;
begin
    if not mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO', 'EDITOR']) then
        raise exception 'Operador nao autorizado.' using errcode = '42501';
    end if;

    if p_rota_id is null or jsonb_typeof(p_paradas) <> 'array' then
        raise exception 'Rota e lista de paradas sao obrigatorias.';
    end if;

    if jsonb_array_length(p_paradas) = 0 then
        raise exception 'Selecione ao menos um cliente para a rota.';
    end if;

    select * into v_rota
      from mapa_clientes.rotas_visitas
     where rota_id = p_rota_id
       and status in ('RASCUNHO', 'PLANEJADA')
     for update;

    if not found then
        raise exception 'Rota nao encontrada ou nao pode mais ser alterada.' using errcode = 'P0002';
    end if;

    foreach v_item in array array(select value from jsonb_array_elements(p_paradas)) loop
        if jsonb_typeof(v_item) <> 'object' then
            raise exception 'Cada parada precisa ser um objeto JSON.';
        end if;

        v_desconhecidos := v_item - array[
            'cliente_id', 'agendado_para', 'observacao_planejamento'
        ]::text[];
        if v_desconhecidos <> '{}'::jsonb then
            raise exception 'Campos de parada nao permitidos: %', v_desconhecidos;
        end if;

        v_cliente_id := nullif(v_item->>'cliente_id', '')::uuid;
        if v_cliente_id is null or not exists (
            select 1 from mapa_clientes.base_mapa where cliente_id = v_cliente_id
        ) then
            raise exception 'Cliente invalido na rota.';
        end if;

        if v_cliente_id = any(v_ids) then
            raise exception 'Um cliente nao pode aparecer duas vezes na mesma rota.';
        end if;

        v_ids := array_append(v_ids, v_cliente_id);
    end loop;

    delete from mapa_clientes.rotas_paradas where rota_id = p_rota_id;

    foreach v_item in array array(select value from jsonb_array_elements(p_paradas)) loop
        v_ordem := v_ordem + 1;
        insert into mapa_clientes.rotas_paradas (
            rota_id,
            cliente_id,
            ordem,
            agendado_para,
            observacao_planejamento,
            criado_por,
            atualizado_por
        ) values (
            p_rota_id,
            (v_item->>'cliente_id')::uuid,
            v_ordem,
            nullif(v_item->>'agendado_para', '')::timestamptz,
            mapa_clientes.texto_limpo(v_item->>'observacao_planejamento'),
            auth.uid(),
            auth.uid()
        );
    end loop;

    update mapa_clientes.rotas_visitas
       set status = 'PLANEJADA',
           atualizado_em = now(),
           atualizado_por = auth.uid()
     where rota_id = p_rota_id
     returning * into v_rota;

    return next v_rota;
end;
$$;

create or replace function mapa_clientes.definir_status_rota_visita(
    p_rota_id uuid,
    p_status text
)
returns setof mapa_clientes.rotas_visitas
language plpgsql
security definer
set search_path = pg_catalog, mapa_clientes
as $$
declare
    v_status text := upper(trim(coalesce(p_status, '')));
    v_row mapa_clientes.rotas_visitas%rowtype;
begin
    if not mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO', 'EDITOR']) then
        raise exception 'Operador nao autorizado.' using errcode = '42501';
    end if;

    if v_status not in ('RASCUNHO', 'PLANEJADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA') then
        raise exception 'Status de rota invalido.';
    end if;

    update mapa_clientes.rotas_visitas
       set status = v_status,
           atualizado_em = now(),
           atualizado_por = auth.uid()
     where rota_id = p_rota_id
     returning * into v_row;

    if not found then
        raise exception 'Rota nao encontrada.' using errcode = 'P0002';
    end if;

    return next v_row;
end;
$$;

create or replace function mapa_clientes.registrar_visita_cliente(
    p_cliente_id uuid,
    p_dados jsonb
)
returns setof mapa_clientes.visitas_clientes
language plpgsql
security definer
set search_path = pg_catalog, mapa_clientes
as $$
declare
    v_dados jsonb := coalesce(p_dados, '{}'::jsonb);
    v_desconhecidos jsonb;
    v_status text := upper(coalesce(nullif(trim(p_dados->>'status'), ''), 'REALIZADA'));
    v_rota_id uuid := nullif(p_dados->>'rota_id', '')::uuid;
    v_rota_parada_id uuid := nullif(p_dados->>'rota_parada_id', '')::uuid;
    v_parada mapa_clientes.rotas_paradas%rowtype;
    v_row mapa_clientes.visitas_clientes%rowtype;
begin
    if not mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO', 'EDITOR']) then
        raise exception 'Operador nao autorizado.' using errcode = '42501';
    end if;

    if p_cliente_id is null or not exists (
        select 1 from mapa_clientes.base_mapa where cliente_id = p_cliente_id
    ) then
        raise exception 'Cliente nao encontrado.' using errcode = 'P0002';
    end if;

    v_desconhecidos := v_dados - array[
        'status', 'ocorreu_em', 'relato', 'resultado', 'proximo_passo',
        'proxima_visita_em', 'rota_id', 'rota_parada_id'
    ]::text[];
    if v_desconhecidos <> '{}'::jsonb then
        raise exception 'Campos de visita nao permitidos: %', v_desconhecidos;
    end if;

    if v_status not in ('REALIZADA', 'NAO_REALIZADA', 'REAGENDAR') then
        raise exception 'Status de visita invalido.';
    end if;

    if v_rota_parada_id is not null then
        select * into v_parada
          from mapa_clientes.rotas_paradas
         where rota_parada_id = v_rota_parada_id
         for update;

        if not found or v_parada.cliente_id <> p_cliente_id then
            raise exception 'Parada de rota invalida para este cliente.';
        end if;

        if v_rota_id is not null and v_rota_id <> v_parada.rota_id then
            raise exception 'Rota informada nao corresponde a parada.';
        end if;

        v_rota_id := v_parada.rota_id;
    end if;

    if v_rota_id is not null and not exists (
        select 1 from mapa_clientes.rotas_visitas where rota_id = v_rota_id
    ) then
        raise exception 'Rota nao encontrada.' using errcode = 'P0002';
    end if;

    insert into mapa_clientes.visitas_clientes (
        cliente_id,
        rota_id,
        rota_parada_id,
        status,
        ocorreu_em,
        relato,
        resultado,
        proximo_passo,
        proxima_visita_em,
        criado_por
    ) values (
        p_cliente_id,
        v_rota_id,
        v_rota_parada_id,
        v_status,
        coalesce(nullif(v_dados->>'ocorreu_em', '')::timestamptz, now()),
        mapa_clientes.texto_limpo(v_dados->>'relato'),
        mapa_clientes.texto_limpo(v_dados->>'resultado'),
        mapa_clientes.texto_limpo(v_dados->>'proximo_passo'),
        nullif(v_dados->>'proxima_visita_em', '')::timestamptz,
        auth.uid()
    ) returning * into v_row;

    if v_rota_parada_id is not null then
        update mapa_clientes.rotas_paradas
           set status = case
                   when v_status = 'REALIZADA' then 'VISITADO'
                   when v_status = 'NAO_REALIZADA' then 'NAO_REALIZADO'
                   else 'PENDENTE'
               end,
               atualizado_em = now(),
               atualizado_por = auth.uid()
         where rota_parada_id = v_rota_parada_id;

        update mapa_clientes.rotas_visitas
           set status = case when status = 'PLANEJADA' then 'EM_ANDAMENTO' else status end,
               atualizado_em = now(),
               atualizado_por = auth.uid()
         where rota_id = v_rota_id;
    end if;

    return next v_row;
end;
$$;

create or replace function mapa_clientes.registrar_documento_cliente(
    p_cliente_id uuid,
    p_dados jsonb
)
returns setof mapa_clientes.documentos_clientes
language plpgsql
security definer
set search_path = pg_catalog, mapa_clientes
as $$
declare
    v_dados jsonb := coalesce(p_dados, '{}'::jsonb);
    v_desconhecidos jsonb;
    v_visita_id uuid := nullif(p_dados->>'visita_id', '')::uuid;
    v_nome text := mapa_clientes.texto_limpo(p_dados->>'nome_arquivo');
    v_caminho text := mapa_clientes.texto_limpo(p_dados->>'caminho_storage');
    v_content_type text := lower(mapa_clientes.texto_limpo(p_dados->>'content_type'));
    v_tamanho bigint := nullif(p_dados->>'tamanho_bytes', '')::bigint;
    v_tipo text := 'CLIENTE';
    v_row mapa_clientes.documentos_clientes%rowtype;
begin
    if not mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO', 'EDITOR']) then
        raise exception 'Operador nao autorizado.' using errcode = '42501';
    end if;

    if p_cliente_id is null or not exists (
        select 1 from mapa_clientes.base_mapa where cliente_id = p_cliente_id
    ) then
        raise exception 'Cliente nao encontrado.' using errcode = 'P0002';
    end if;

    v_desconhecidos := v_dados - array[
        'visita_id', 'nome_arquivo', 'caminho_storage', 'content_type',
        'tamanho_bytes', 'descricao'
    ]::text[];
    if v_desconhecidos <> '{}'::jsonb then
        raise exception 'Campos de documento nao permitidos: %', v_desconhecidos;
    end if;

    if v_nome is null or v_caminho is null or v_content_type is null or v_tamanho is null then
        raise exception 'Arquivo, caminho, tipo e tamanho sao obrigatorios.';
    end if;

    if v_tamanho <= 0 or v_tamanho > 10485760 then
        raise exception 'O arquivo deve possuir no maximo 10 MB.';
    end if;

    if v_content_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') then
        raise exception 'Tipo de arquivo nao permitido.';
    end if;

    if not starts_with(v_caminho, format('clientes/%s/', p_cliente_id))
       or v_caminho like '%..%' then
        raise exception 'Caminho de arquivo invalido.';
    end if;

    if not exists (
        select 1
          from storage.objects
         where bucket_id = 'clientes-anexos'
           and name = v_caminho
    ) then
        raise exception 'Arquivo nao encontrado no Storage.' using errcode = 'P0002';
    end if;

    if v_visita_id is not null then
        if not exists (
            select 1
              from mapa_clientes.visitas_clientes
             where visita_id = v_visita_id
               and cliente_id = p_cliente_id
        ) then
            raise exception 'Visita invalida para este cliente.';
        end if;
        v_tipo := 'VISITA';
    end if;

    insert into mapa_clientes.documentos_clientes (
        cliente_id,
        visita_id,
        tipo,
        nome_arquivo,
        caminho_storage,
        content_type,
        tamanho_bytes,
        descricao,
        criado_por
    ) values (
        p_cliente_id,
        v_visita_id,
        v_tipo,
        v_nome,
        v_caminho,
        v_content_type,
        v_tamanho,
        mapa_clientes.texto_limpo(v_dados->>'descricao'),
        auth.uid()
    ) returning * into v_row;

    return next v_row;
end;
$$;

-- ------------------------------------------------------------
-- 6. RLS, Storage e superficie publica
-- ------------------------------------------------------------

alter table mapa_clientes.rotas_visitas enable row level security;
alter table mapa_clientes.rotas_paradas enable row level security;
alter table mapa_clientes.visitas_clientes enable row level security;
alter table mapa_clientes.documentos_clientes enable row level security;

drop policy if exists rotas_visitas_select on mapa_clientes.rotas_visitas;
create policy rotas_visitas_select
on mapa_clientes.rotas_visitas
for select to authenticated
using (mapa_clientes.eh_operador());

drop policy if exists rotas_paradas_select on mapa_clientes.rotas_paradas;
create policy rotas_paradas_select
on mapa_clientes.rotas_paradas
for select to authenticated
using (mapa_clientes.eh_operador());

drop policy if exists visitas_clientes_select on mapa_clientes.visitas_clientes;
create policy visitas_clientes_select
on mapa_clientes.visitas_clientes
for select to authenticated
using (mapa_clientes.eh_operador());

drop policy if exists documentos_clientes_select on mapa_clientes.documentos_clientes;
create policy documentos_clientes_select
on mapa_clientes.documentos_clientes
for select to authenticated
using (mapa_clientes.eh_operador());

drop policy if exists mapa_clientes_anexos_select on storage.objects;
create policy mapa_clientes_anexos_select
on storage.objects
for select to authenticated
using (
    bucket_id = 'clientes-anexos'
    and mapa_clientes.eh_operador()
);

drop policy if exists mapa_clientes_anexos_insert on storage.objects;
create policy mapa_clientes_anexos_insert
on storage.objects
for insert to authenticated
with check (
    bucket_id = 'clientes-anexos'
    and starts_with(name, 'clientes/')
    and mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO', 'EDITOR'])
);

drop policy if exists mapa_clientes_anexos_update on storage.objects;
create policy mapa_clientes_anexos_update
on storage.objects
for update to authenticated
using (
    bucket_id = 'clientes-anexos'
    and mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO', 'EDITOR'])
)
with check (
    bucket_id = 'clientes-anexos'
    and starts_with(name, 'clientes/')
    and mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO', 'EDITOR'])
);

drop policy if exists mapa_clientes_anexos_delete on storage.objects;
create policy mapa_clientes_anexos_delete
on storage.objects
for delete to authenticated
using (
    bucket_id = 'clientes-anexos'
    and mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO'])
);

revoke all on mapa_clientes.rotas_visitas from public, anon, authenticated;
revoke all on mapa_clientes.rotas_paradas from public, anon, authenticated;
revoke all on mapa_clientes.visitas_clientes from public, anon, authenticated;
revoke all on mapa_clientes.documentos_clientes from public, anon, authenticated;

grant select on mapa_clientes.rotas_visitas to authenticated;
grant select on mapa_clientes.rotas_paradas to authenticated;
grant select on mapa_clientes.visitas_clientes to authenticated;
grant select on mapa_clientes.documentos_clientes to authenticated;
grant select on mapa_clientes.vw_rotas_visitas to authenticated;
grant select on mapa_clientes.vw_visitas_clientes to authenticated;

revoke all on function mapa_clientes.criar_rota_visita(text, date, text) from public, anon;
revoke all on function mapa_clientes.definir_paradas_rota(uuid, jsonb) from public, anon;
revoke all on function mapa_clientes.definir_status_rota_visita(uuid, text) from public, anon;
revoke all on function mapa_clientes.registrar_visita_cliente(uuid, jsonb) from public, anon;
revoke all on function mapa_clientes.registrar_documento_cliente(uuid, jsonb) from public, anon;

grant execute on function mapa_clientes.criar_rota_visita(text, date, text) to authenticated;
grant execute on function mapa_clientes.definir_paradas_rota(uuid, jsonb) to authenticated;
grant execute on function mapa_clientes.definir_status_rota_visita(uuid, text) to authenticated;
grant execute on function mapa_clientes.registrar_visita_cliente(uuid, jsonb) to authenticated;
grant execute on function mapa_clientes.registrar_documento_cliente(uuid, jsonb) to authenticated;

commit;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 7. Validacao pos-migracao (somente leitura)
-- ------------------------------------------------------------

select
    (select count(*) from mapa_clientes.rotas_visitas) as total_rotas,
    (select count(*) from mapa_clientes.rotas_paradas) as total_paradas,
    (select count(*) from mapa_clientes.visitas_clientes) as total_visitas,
    (select count(*) from mapa_clientes.documentos_clientes) as total_anexos;

select
    count(*) filter (where origem_registro = 'CADASTRO_CAMPO') as clientes_novos,
    count(*) filter (where reposicionado_em is not null) as clientes_reposicionados
from mapa_clientes.base_mapa;
