-- ============================================================
-- MAPA DE CLIENTES MHS - OPERACAO DE CAMPO / FEIRA V1
--
-- Pre-requisito:
--   03_SQL/ATUAL/supabase_mapa_clientes_v2.sql
--
-- Objetivos:
--   - preservar integralmente os dados importados;
--   - permitir clientes sem CNPJ, usando UUID tecnico;
--   - guardar coordenadas confirmadas sem sobrescrever o fallback;
--   - registrar autoria, datas e historico de alteracoes;
--   - permitir escrita somente por RPC para operadores autenticados.
--
-- Este arquivo e idempotente e nao apaga registros.
-- ============================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- 1. Evolucao aditiva da tabela existente
-- ------------------------------------------------------------

alter table mapa_clientes.base_mapa
    add column if not exists cliente_id uuid,
    add column if not exists cnpj_normalizado text generated always as (
        nullif(regexp_replace(coalesce(cnpj, ''), '[^0-9]', '', 'g'), '')
    ) stored,
    add column if not exists origem_registro text not null default 'IMPORTACAO_INICIAL',
    add column if not exists contato_nome text,
    add column if not exists contato_cargo text,
    add column if not exists whatsapp text,
    add column if not exists canal_preferido text,
    add column if not exists observacoes_comerciais text,
    add column if not exists latitude_confirmada double precision,
    add column if not exists longitude_confirmada double precision,
    add column if not exists localizacao_status text not null default 'SEM_CONFIRMACAO',
    add column if not exists localizacao_fonte text,
    add column if not exists localizacao_precisao_m double precision,
    add column if not exists localizacao_observacao text,
    add column if not exists localizacao_confirmada_em timestamptz,
    add column if not exists localizacao_confirmada_por uuid,
    add column if not exists criado_em timestamptz not null default now(),
    add column if not exists atualizado_em timestamptz not null default now(),
    add column if not exists criado_por uuid,
    add column if not exists atualizado_por uuid,
    add column if not exists revisao integer not null default 1,
    add column if not exists google_place_id text,
    add column if not exists google_latitude text,
    add column if not exists google_longitude text,
    add column if not exists google_location_type text,
    add column if not exists google_formatted_address text,
    add column if not exists google_geocode_status text,
    add column if not exists google_geocoded_at timestamptz,
    add column if not exists google_geocode_expires_at timestamptz,
    add column if not exists google_geocode_attempts integer not null default 0,
    add column if not exists google_geocode_error text,
    add column if not exists google_geocode_source_address text,
    add column if not exists google_geocode_validated boolean not null default false,
    add column if not exists google_geocode_validation_note text;

update mapa_clientes.base_mapa
set cliente_id = gen_random_uuid()
where cliente_id is null;

alter table mapa_clientes.base_mapa
    alter column cliente_id set default gen_random_uuid(),
    alter column cliente_id set not null;

-- Troca somente a chave tecnica. O CNPJ continua preservado e unico quando existir.
do $$
declare
    v_pk_name text;
    v_pk_definition text;
begin
    select c.conname, pg_get_constraintdef(c.oid)
      into v_pk_name, v_pk_definition
      from pg_constraint c
     where c.conrelid = 'mapa_clientes.base_mapa'::regclass
       and c.contype = 'p'
     limit 1;

    if v_pk_name is not null and v_pk_definition not ilike '%cliente_id%' then
        if v_pk_definition not ilike '%cnpj%' then
            raise exception 'Chave primaria inesperada em mapa_clientes.base_mapa: %', v_pk_definition;
        end if;

        execute format(
            'alter table mapa_clientes.base_mapa drop constraint %I',
            v_pk_name
        );
        v_pk_name := null;
    end if;

    if v_pk_name is null then
        alter table mapa_clientes.base_mapa
            add constraint base_mapa_pkey primary key (cliente_id);
    end if;
end;
$$;

alter table mapa_clientes.base_mapa
    alter column cnpj drop not null;

create unique index if not exists base_mapa_cnpj_normalizado_uidx
    on mapa_clientes.base_mapa (cnpj_normalizado)
    where cnpj_normalizado is not null;

create index if not exists base_mapa_atualizado_em_idx
    on mapa_clientes.base_mapa (atualizado_em desc);

create index if not exists base_mapa_origem_registro_idx
    on mapa_clientes.base_mapa (origem_registro);

create index if not exists base_mapa_localizacao_status_idx
    on mapa_clientes.base_mapa (localizacao_status);

update mapa_clientes.base_mapa
set localizacao_status = coalesce(nullif(trim(geocode_status), ''), 'SEM_STATUS')
where latitude_confirmada is null
  and longitude_confirmada is null
  and localizacao_status = 'SEM_CONFIRMACAO';

-- ------------------------------------------------------------
-- 2. Perfis de acesso do aplicativo
-- ------------------------------------------------------------

create table if not exists mapa_clientes.operadores (
    usuario_id       uuid primary key references auth.users(id) on delete cascade,
    nome             text not null,
    papel            text not null default 'LEITOR',
    ativo            boolean not null default true,
    criado_em        timestamptz not null default now(),
    atualizado_em    timestamptz not null default now(),
    criado_por       uuid references auth.users(id) on delete set null,
    constraint operadores_papel_check
        check (papel in ('ADMIN', 'MANUTENCAO', 'EDITOR', 'LEITOR'))
);

comment on table mapa_clientes.operadores is
'Usuarios autorizados a operar a interface. MANUTENCAO pode cadastrar, editar, reposicionar e administrar operadores.';

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'base_mapa_localizacao_par_check'
          and conrelid = 'mapa_clientes.base_mapa'::regclass
    ) then
        alter table mapa_clientes.base_mapa
            add constraint base_mapa_localizacao_par_check check (
                (latitude_confirmada is null and longitude_confirmada is null)
                or
                (latitude_confirmada is not null and longitude_confirmada is not null)
            );
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'base_mapa_latitude_confirmada_check'
          and conrelid = 'mapa_clientes.base_mapa'::regclass
    ) then
        alter table mapa_clientes.base_mapa
            add constraint base_mapa_latitude_confirmada_check check (
                latitude_confirmada is null
                or latitude_confirmada between -34.2 and 5.4
            );
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'base_mapa_longitude_confirmada_check'
          and conrelid = 'mapa_clientes.base_mapa'::regclass
    ) then
        alter table mapa_clientes.base_mapa
            add constraint base_mapa_longitude_confirmada_check check (
                longitude_confirmada is null
                or longitude_confirmada between -74.1 and -32.2
            );
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'base_mapa_localizacao_confirmada_por_fkey'
          and conrelid = 'mapa_clientes.base_mapa'::regclass
    ) then
        alter table mapa_clientes.base_mapa
            add constraint base_mapa_localizacao_confirmada_por_fkey
            foreign key (localizacao_confirmada_por)
            references auth.users(id) on delete set null;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'base_mapa_criado_por_fkey'
          and conrelid = 'mapa_clientes.base_mapa'::regclass
    ) then
        alter table mapa_clientes.base_mapa
            add constraint base_mapa_criado_por_fkey
            foreign key (criado_por)
            references auth.users(id) on delete set null;
    end if;

    if not exists (
        select 1 from pg_constraint
        where conname = 'base_mapa_atualizado_por_fkey'
          and conrelid = 'mapa_clientes.base_mapa'::regclass
    ) then
        alter table mapa_clientes.base_mapa
            add constraint base_mapa_atualizado_por_fkey
            foreign key (atualizado_por)
            references auth.users(id) on delete set null;
    end if;
end;
$$;

create or replace function mapa_clientes.eh_operador(
    p_papeis text[] default array['ADMIN', 'MANUTENCAO', 'EDITOR', 'LEITOR']::text[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, mapa_clientes
as $$
    select auth.uid() is not null
       and exists (
            select 1
              from mapa_clientes.operadores o
             where o.usuario_id = auth.uid()
               and o.ativo
               and o.papel = any (p_papeis)
       );
$$;

revoke all on function mapa_clientes.eh_operador(text[]) from public;
grant execute on function mapa_clientes.eh_operador(text[]) to authenticated;

-- ------------------------------------------------------------
-- 3. Historico imutavel
-- ------------------------------------------------------------

create table if not exists mapa_clientes.historico_clientes (
    evento_id       uuid primary key default gen_random_uuid(),
    cliente_id      uuid not null,
    tipo_evento     text not null,
    dados_antes     jsonb,
    dados_depois    jsonb,
    operador_id     uuid references auth.users(id) on delete set null,
    criado_em       timestamptz not null default now()
);

create index if not exists historico_clientes_cliente_idx
    on mapa_clientes.historico_clientes (cliente_id, criado_em desc);

create index if not exists historico_clientes_criado_em_idx
    on mapa_clientes.historico_clientes (criado_em desc);

create index if not exists historico_clientes_tipo_idx
    on mapa_clientes.historico_clientes (tipo_evento);

create or replace function mapa_clientes.tocar_base_mapa()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, mapa_clientes
as $$
begin
    new.atualizado_em := clock_timestamp();
    new.atualizado_por := coalesce(new.atualizado_por, auth.uid(), old.atualizado_por);
    new.revisao := coalesce(old.revisao, 0) + 1;
    return new;
end;
$$;

create or replace function mapa_clientes.auditar_base_mapa()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, mapa_clientes
as $$
declare
    v_tipo text;
begin
    if tg_op = 'INSERT' then
        v_tipo := 'CADASTRO';
    elsif row(new.latitude_confirmada, new.longitude_confirmada,
              new.localizacao_status, new.localizacao_fonte)
          is distinct from
          row(old.latitude_confirmada, old.longitude_confirmada,
              old.localizacao_status, old.localizacao_fonte) then
        v_tipo := 'REPOSICIONAMENTO';
    elsif row(new.google_place_id, new.google_latitude, new.google_longitude,
              new.google_geocode_status)
          is distinct from
          row(old.google_place_id, old.google_latitude, old.google_longitude,
              old.google_geocode_status) then
        v_tipo := 'GEOCODIFICACAO';
    else
        v_tipo := 'ATUALIZACAO';
    end if;

    insert into mapa_clientes.historico_clientes (
        cliente_id,
        tipo_evento,
        dados_antes,
        dados_depois,
        operador_id
    ) values (
        new.cliente_id,
        v_tipo,
        case when tg_op = 'INSERT' then null else to_jsonb(old) end,
        to_jsonb(new),
        coalesce(auth.uid(), new.atualizado_por, new.criado_por)
    );

    return new;
end;
$$;

drop trigger if exists base_mapa_tocar_atualizacao
on mapa_clientes.base_mapa;

create trigger base_mapa_tocar_atualizacao
before update on mapa_clientes.base_mapa
for each row execute function mapa_clientes.tocar_base_mapa();

drop trigger if exists base_mapa_auditar
on mapa_clientes.base_mapa;

create trigger base_mapa_auditar
after insert or update on mapa_clientes.base_mapa
for each row execute function mapa_clientes.auditar_base_mapa();

-- ------------------------------------------------------------
-- 4. Funcoes auxiliares e visoes de leitura
-- ------------------------------------------------------------

create or replace function mapa_clientes.decimal_texto(p_valor text)
returns double precision
language sql
immutable
set search_path = pg_catalog
as $$
    select case
        when nullif(trim(p_valor), '') is null then null
        when replace(trim(p_valor), ',', '.') ~ '^-?[0-9]+([.][0-9]+)?$'
            then replace(trim(p_valor), ',', '.')::double precision
        else null
    end;
$$;

create or replace function mapa_clientes.texto_limpo(p_valor text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
    select case
        when nullif(trim(p_valor), '') is null then null
        when trim(p_valor) = '13' then null
        else trim(p_valor)
    end;
$$;

create or replace view mapa_clientes.vw_clientes_app
with (security_invoker = true)
as
select
    b.*,
    coalesce(
        b.latitude_confirmada,
        mapa_clientes.decimal_texto(b.latitude)
    ) as latitude_efetiva,
    coalesce(
        b.longitude_confirmada,
        mapa_clientes.decimal_texto(b.longitude)
    ) as longitude_efetiva,
    (b.latitude_confirmada is not null and b.longitude_confirmada is not null)
        as localizacao_confirmada,
    case
        when b.latitude_confirmada is not null then 'CONFIRMADA_CAMPO'
        else coalesce(nullif(trim(b.geocode_status), ''), 'SEM_STATUS')
    end as precisao_efetiva,
    case
        when b.origem_registro = 'CADASTRO_CAMPO' then 'NOVO'
        when b.revisao > 1 then 'ATUALIZADO'
        else 'BASE_ORIGINAL'
    end as classificacao_registro
from mapa_clientes.base_mapa b;

create or replace view mapa_clientes.vw_atividade_clientes
with (security_invoker = true)
as
select
    h.evento_id,
    h.criado_em as ocorrido_em,
    h.tipo_evento,
    h.cliente_id,
    coalesce(b.nome_fantasia, b.razao_social, b.cnpj, 'Cliente') as cliente,
    b.cnpj,
    b.municipio,
    b.uf,
    b.origem_registro,
    o.nome as operador,
    o.papel as operador_papel
from mapa_clientes.historico_clientes h
left join mapa_clientes.base_mapa b on b.cliente_id = h.cliente_id
left join mapa_clientes.operadores o on o.usuario_id = h.operador_id;

-- ------------------------------------------------------------
-- 5. RPCs: unica porta de escrita utilizada pelo frontend
-- ------------------------------------------------------------

create or replace function mapa_clientes.cadastrar_cliente(p_dados jsonb)
returns setof mapa_clientes.base_mapa
language plpgsql
security definer
set search_path = pg_catalog, mapa_clientes
as $$
declare
    v_cnpj text;
    v_nome text;
    v_lat double precision;
    v_lng double precision;
    v_row mapa_clientes.base_mapa%rowtype;
    v_desconhecidos jsonb;
begin
    if not mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO', 'EDITOR']) then
        raise exception 'Operador nao autorizado.' using errcode = '42501';
    end if;

    p_dados := coalesce(p_dados, '{}'::jsonb);
    v_desconhecidos := p_dados - array[
        'cnpj', 'razao_social', 'nome_fantasia', 'situacao_cadastral',
        'uf', 'municipio', 'logradouro', 'bairro', 'cep', 'email',
        'telefone', 'telefone_1', 'contato_nome', 'contato_cargo',
        'whatsapp', 'canal_preferido', 'observacoes_comerciais',
        'latitude', 'longitude', 'localizacao_fonte',
        'localizacao_precisao_m', 'localizacao_observacao'
    ]::text[];

    if v_desconhecidos <> '{}'::jsonb then
        raise exception 'Campos nao permitidos: %', v_desconhecidos;
    end if;

    v_cnpj := nullif(regexp_replace(coalesce(p_dados->>'cnpj', ''), '[^0-9]', '', 'g'), '');
    if v_cnpj is not null and length(v_cnpj) <> 14 then
        raise exception 'CNPJ deve possuir 14 digitos.';
    end if;

    if v_cnpj is not null and exists (
        select 1 from mapa_clientes.base_mapa where cnpj_normalizado = v_cnpj
    ) then
        raise exception 'Ja existe cliente com este CNPJ.' using errcode = '23505';
    end if;

    v_nome := coalesce(
        mapa_clientes.texto_limpo(p_dados->>'nome_fantasia'),
        mapa_clientes.texto_limpo(p_dados->>'razao_social')
    );
    if v_nome is null then
        raise exception 'Informe nome fantasia ou razao social.';
    end if;

    v_lat := nullif(p_dados->>'latitude', '')::double precision;
    v_lng := nullif(p_dados->>'longitude', '')::double precision;

    if v_lat is null or v_lng is null then
        raise exception 'O ponto do novo cliente e obrigatorio.';
    end if;

    if v_lat not between -34.2 and 5.4 or v_lng not between -74.1 and -32.2 then
        raise exception 'Coordenada fora dos limites do Brasil.';
    end if;

    insert into mapa_clientes.base_mapa (
        cnpj,
        razao_social,
        nome_fantasia,
        situacao_cadastral,
        uf,
        municipio,
        logradouro,
        bairro,
        cep,
        email,
        telefone,
        telefone_1,
        contato_nome,
        contato_cargo,
        whatsapp,
        canal_preferido,
        observacoes_comerciais,
        latitude_confirmada,
        longitude_confirmada,
        localizacao_status,
        localizacao_fonte,
        localizacao_precisao_m,
        localizacao_observacao,
        localizacao_confirmada_em,
        localizacao_confirmada_por,
        origem_registro,
        geocode_status,
        criado_por,
        atualizado_por
    ) values (
        v_cnpj,
        mapa_clientes.texto_limpo(p_dados->>'razao_social'),
        mapa_clientes.texto_limpo(p_dados->>'nome_fantasia'),
        mapa_clientes.texto_limpo(p_dados->>'situacao_cadastral'),
        upper(mapa_clientes.texto_limpo(p_dados->>'uf')),
        mapa_clientes.texto_limpo(p_dados->>'municipio'),
        mapa_clientes.texto_limpo(p_dados->>'logradouro'),
        mapa_clientes.texto_limpo(p_dados->>'bairro'),
        mapa_clientes.texto_limpo(p_dados->>'cep'),
        lower(mapa_clientes.texto_limpo(p_dados->>'email')),
        mapa_clientes.texto_limpo(p_dados->>'telefone'),
        mapa_clientes.texto_limpo(p_dados->>'telefone_1'),
        mapa_clientes.texto_limpo(p_dados->>'contato_nome'),
        mapa_clientes.texto_limpo(p_dados->>'contato_cargo'),
        mapa_clientes.texto_limpo(p_dados->>'whatsapp'),
        upper(mapa_clientes.texto_limpo(p_dados->>'canal_preferido')),
        mapa_clientes.texto_limpo(p_dados->>'observacoes_comerciais'),
        v_lat,
        v_lng,
        'CONFIRMADA_CAMPO',
        coalesce(upper(mapa_clientes.texto_limpo(p_dados->>'localizacao_fonte')), 'AJUSTE_MANUAL_MAPA'),
        nullif(p_dados->>'localizacao_precisao_m', '')::double precision,
        mapa_clientes.texto_limpo(p_dados->>'localizacao_observacao'),
        now(),
        auth.uid(),
        'CADASTRO_CAMPO',
        'CONFIRMADA_CAMPO',
        auth.uid(),
        auth.uid()
    )
    returning * into v_row;

    return next v_row;
end;
$$;

create or replace function mapa_clientes.atualizar_comunicacao(
    p_cliente_id uuid,
    p_dados jsonb
)
returns setof mapa_clientes.base_mapa
language plpgsql
security definer
set search_path = pg_catalog, mapa_clientes
as $$
declare
    v_atual mapa_clientes.base_mapa%rowtype;
    v_row mapa_clientes.base_mapa%rowtype;
    v_desconhecidos jsonb;
begin
    if not mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO', 'EDITOR']) then
        raise exception 'Operador nao autorizado.' using errcode = '42501';
    end if;

    p_dados := coalesce(p_dados, '{}'::jsonb);
    v_desconhecidos := p_dados - array[
        'razao_social', 'nome_fantasia', 'email', 'telefone', 'telefone_1',
        'contato_nome', 'contato_cargo', 'whatsapp', 'canal_preferido',
        'observacoes_comerciais'
    ]::text[];

    if v_desconhecidos <> '{}'::jsonb then
        raise exception 'Campos nao permitidos: %', v_desconhecidos;
    end if;

    select * into v_atual
      from mapa_clientes.base_mapa
     where cliente_id = p_cliente_id
     for update;

    if not found then
        raise exception 'Cliente nao encontrado.' using errcode = 'P0002';
    end if;

    update mapa_clientes.base_mapa
       set razao_social = case when p_dados ? 'razao_social'
                               then mapa_clientes.texto_limpo(p_dados->>'razao_social')
                               else razao_social end,
           nome_fantasia = case when p_dados ? 'nome_fantasia'
                                then mapa_clientes.texto_limpo(p_dados->>'nome_fantasia')
                                else nome_fantasia end,
           email = case when p_dados ? 'email'
                        then lower(mapa_clientes.texto_limpo(p_dados->>'email'))
                        else email end,
           telefone = case when p_dados ? 'telefone'
                           then mapa_clientes.texto_limpo(p_dados->>'telefone')
                           else telefone end,
           telefone_1 = case when p_dados ? 'telefone_1'
                             then mapa_clientes.texto_limpo(p_dados->>'telefone_1')
                             else telefone_1 end,
           contato_nome = case when p_dados ? 'contato_nome'
                               then mapa_clientes.texto_limpo(p_dados->>'contato_nome')
                               else contato_nome end,
           contato_cargo = case when p_dados ? 'contato_cargo'
                                then mapa_clientes.texto_limpo(p_dados->>'contato_cargo')
                                else contato_cargo end,
           whatsapp = case when p_dados ? 'whatsapp'
                           then mapa_clientes.texto_limpo(p_dados->>'whatsapp')
                           else whatsapp end,
           canal_preferido = case when p_dados ? 'canal_preferido'
                                  then upper(mapa_clientes.texto_limpo(p_dados->>'canal_preferido'))
                                  else canal_preferido end,
           observacoes_comerciais = case when p_dados ? 'observacoes_comerciais'
                                         then mapa_clientes.texto_limpo(p_dados->>'observacoes_comerciais')
                                         else observacoes_comerciais end,
           atualizado_por = auth.uid()
     where cliente_id = p_cliente_id
     returning * into v_row;

    if coalesce(v_row.nome_fantasia, v_row.razao_social, v_row.cnpj) is null then
        raise exception 'O cliente precisa manter ao menos um nome ou CNPJ.';
    end if;

    return next v_row;
end;
$$;

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
           atualizado_por = auth.uid()
     where cliente_id = p_cliente_id
     returning * into v_row;

    if not found then
        raise exception 'Cliente nao encontrado.' using errcode = 'P0002';
    end if;

    return next v_row;
end;
$$;

create or replace function mapa_clientes.definir_operador(
    p_usuario_id uuid,
    p_nome text,
    p_papel text,
    p_ativo boolean default true
)
returns setof mapa_clientes.operadores
language plpgsql
security definer
set search_path = pg_catalog, mapa_clientes
as $$
declare
    v_papel text := upper(trim(coalesce(p_papel, '')));
    v_row mapa_clientes.operadores%rowtype;
begin
    if not mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO']) then
        raise exception 'Somente ADMIN ou MANUTENCAO pode administrar operadores.'
            using errcode = '42501';
    end if;

    if p_usuario_id is null then
        raise exception 'Usuario obrigatorio.';
    end if;

    if v_papel not in ('ADMIN', 'MANUTENCAO', 'EDITOR', 'LEITOR') then
        raise exception 'Papel invalido.';
    end if;

    insert into mapa_clientes.operadores (
        usuario_id, nome, papel, ativo, criado_por
    ) values (
        p_usuario_id,
        coalesce(mapa_clientes.texto_limpo(p_nome), 'Operador'),
        v_papel,
        coalesce(p_ativo, true),
        auth.uid()
    )
    on conflict (usuario_id) do update
       set nome = excluded.nome,
           papel = excluded.papel,
           ativo = excluded.ativo,
           atualizado_em = now()
    returning * into v_row;

    return next v_row;
end;
$$;

-- ------------------------------------------------------------
-- 6. RLS, grants e superficie publica
-- ------------------------------------------------------------

alter table mapa_clientes.operadores enable row level security;
alter table mapa_clientes.historico_clientes enable row level security;

drop policy if exists operadores_select on mapa_clientes.operadores;
create policy operadores_select
on mapa_clientes.operadores
for select
to authenticated
using (
    usuario_id = auth.uid()
    or mapa_clientes.eh_operador(array['ADMIN', 'MANUTENCAO'])
);

drop policy if exists historico_clientes_select on mapa_clientes.historico_clientes;
create policy historico_clientes_select
on mapa_clientes.historico_clientes
for select
to authenticated
using (mapa_clientes.eh_operador());

revoke all on mapa_clientes.operadores from public, anon, authenticated;
revoke all on mapa_clientes.historico_clientes from public, anon, authenticated;
grant select on mapa_clientes.operadores to authenticated;
grant select on mapa_clientes.historico_clientes to authenticated;

grant select on mapa_clientes.vw_clientes_app to anon, authenticated;
grant select on mapa_clientes.vw_atividade_clientes to authenticated;

revoke all on function mapa_clientes.cadastrar_cliente(jsonb) from public, anon;
revoke all on function mapa_clientes.atualizar_comunicacao(uuid, jsonb) from public, anon;
revoke all on function mapa_clientes.confirmar_localizacao(uuid, double precision, double precision, text, double precision, text) from public, anon;
revoke all on function mapa_clientes.definir_operador(uuid, text, text, boolean) from public, anon;

grant execute on function mapa_clientes.cadastrar_cliente(jsonb) to authenticated;
grant execute on function mapa_clientes.atualizar_comunicacao(uuid, jsonb) to authenticated;
grant execute on function mapa_clientes.confirmar_localizacao(uuid, double precision, double precision, text, double precision, text) to authenticated;
grant execute on function mapa_clientes.definir_operador(uuid, text, text, boolean) to authenticated;

revoke all on function mapa_clientes.tocar_base_mapa() from public;
revoke all on function mapa_clientes.auditar_base_mapa() from public;
revoke all on function mapa_clientes.decimal_texto(text) from public;
revoke all on function mapa_clientes.texto_limpo(text) from public;
grant execute on function mapa_clientes.decimal_texto(text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- 7. Validacao pos-migracao (somente leitura)
-- ------------------------------------------------------------

select
    count(*) as total_clientes,
    count(cliente_id) as total_com_uuid,
    count(cnpj_normalizado) as total_com_cnpj,
    count(*) filter (
        where latitude_confirmada is not null
          and longitude_confirmada is not null
    ) as localizacoes_confirmadas
from mapa_clientes.base_mapa;

select
    origem_registro,
    localizacao_status,
    count(*) as clientes
from mapa_clientes.base_mapa
group by origem_registro, localizacao_status
order by origem_registro, localizacao_status;
