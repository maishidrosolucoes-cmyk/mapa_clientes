-- ============================================================
-- MAPA DE CLIENTES — SUPABASE V2
-- Schema: mapa_clientes
-- Tabela: mapa_clientes.base_mapa
--
-- Versão preparada para CSV exportado por Excel em pt-BR.
-- Campos que podem usar vírgula decimal são TEXT de propósito.
-- ============================================================

begin;

create schema if not exists mapa_clientes;

comment on schema mapa_clientes is
'Schema do mapa de potenciais clientes. Dados importados da Base_Mapa.';

create table if not exists mapa_clientes.base_mapa (
    planilha             integer,
    seq                  integer,
    cnpj                 text primary key,
    razao_social         text,
    nome_fantasia        text,
    situacao_cadastral   text,
    uf                   text,
    municipio            text,
    abertura             text,
    cnae                 text,
    logradouro           text,
    motivo_situacao      text,
    porte                text,
    bairro               text,
    cep                  text,
    email                text,
    telefone             text,
    telefone_1           text,
    capital_social       text,
    optante_simples      text,
    qtd_socios           integer,
    optante_mei          text,
    endereco_busca       text,
    latitude             text,
    longitude            text,
    geocode_status       text default 'PENDENTE'
);

comment on table mapa_clientes.base_mapa is
'Base consolidada do mapa. Uma linha por CNPJ.';

comment on column mapa_clientes.base_mapa.latitude is
'Latitude preservada conforme CSV. O frontend normaliza vírgula/ponto.';

comment on column mapa_clientes.base_mapa.longitude is
'Longitude preservada conforme CSV. O frontend normaliza vírgula/ponto.';

comment on column mapa_clientes.base_mapa.geocode_status is
'Qualidade/origem da geocodificação.';

create index if not exists base_mapa_uf_idx
    on mapa_clientes.base_mapa (uf);

create index if not exists base_mapa_municipio_idx
    on mapa_clientes.base_mapa (municipio);

create index if not exists base_mapa_situacao_idx
    on mapa_clientes.base_mapa (situacao_cadastral);

create index if not exists base_mapa_uf_municipio_idx
    on mapa_clientes.base_mapa (uf, municipio);

create index if not exists base_mapa_geocode_status_idx
    on mapa_clientes.base_mapa (geocode_status);

revoke all on schema mapa_clientes from public;
revoke all on table mapa_clientes.base_mapa from public;
revoke all on table mapa_clientes.base_mapa from anon;
revoke all on table mapa_clientes.base_mapa from authenticated;

grant usage on schema mapa_clientes to anon, authenticated, service_role;
grant select on table mapa_clientes.base_mapa to anon, authenticated;
grant all privileges on table mapa_clientes.base_mapa to service_role;

alter table mapa_clientes.base_mapa enable row level security;

drop policy if exists "base_mapa_anon_select"
on mapa_clientes.base_mapa;

create policy "base_mapa_anon_select"
on mapa_clientes.base_mapa
for select
to anon, authenticated
using (true);

commit;

-- ============================================================
-- VALIDAÇÃO APÓS IMPORTAR
-- ============================================================

select
    count(*) as total_clientes,
    count(*) filter (
        where nullif(trim(latitude), '') is not null
          and nullif(trim(longitude), '') is not null
    ) as com_coordenadas
from mapa_clientes.base_mapa;
