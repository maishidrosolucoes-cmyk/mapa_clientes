-- ============================================================
-- MAPA DE CLIENTES — SUPABASE
-- Schema: mapa_clientes
-- Tabela: mapa_clientes.base_mapa
--
-- Compatível com o CSV exportado da aba "Base_Mapa".
-- O script NÃO apaga dados e pode ser executado antes da importação.
-- ============================================================

begin;

-- 1) Schema isolado do projeto
create schema if not exists mapa_clientes;

comment on schema mapa_clientes is
'Schema do mapa de potenciais clientes. Dados importados da Base_Mapa.';

-- 2) Tabela com os MESMOS 26 cabeçalhos do CSV.
-- CNPJ, CEP e telefones são TEXT para preservar zeros, pontuação e formatação.
-- "abertura" permanece TEXT para aceitar diretamente o formato DD/MM/AAAA do Excel.
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
    capital_social       numeric(18,2),
    optante_simples      text,
    qtd_socios           integer,
    optante_mei          text,
    endereco_busca       text,
    latitude             double precision,
    longitude            double precision,
    geocode_status       text default 'PENDENTE'
);

comment on table mapa_clientes.base_mapa is
'Base consolidada usada pelo mapa. Uma linha por CNPJ.';

comment on column mapa_clientes.base_mapa.latitude is
'Latitude do cliente ou coordenada aproximada conforme geocode_status.';

comment on column mapa_clientes.base_mapa.longitude is
'Longitude do cliente ou coordenada aproximada conforme geocode_status.';

comment on column mapa_clientes.base_mapa.geocode_status is
'Qualidade/origem da geocodificação, por exemplo APROX_SEDE_MUNICIPIO.';

-- 3) Índices para os filtros usados pelo frontend.
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

create index if not exists base_mapa_lat_lon_idx
    on mapa_clientes.base_mapa (latitude, longitude);

-- 4) Segurança.
-- Ninguém recebe escrita pelo navegador.
revoke all on schema mapa_clientes from public;
revoke all on table mapa_clientes.base_mapa from public;
revoke all on table mapa_clientes.base_mapa from anon;
revoke all on table mapa_clientes.base_mapa from authenticated;

-- O frontend precisa apenas localizar o schema e ler a tabela.
grant usage on schema mapa_clientes to anon, authenticated, service_role;
grant select on table mapa_clientes.base_mapa to anon, authenticated;
grant all privileges on table mapa_clientes.base_mapa to service_role;

-- 5) Row Level Security.
alter table mapa_clientes.base_mapa enable row level security;

-- Política de leitura para a aplicação atual que usa chave anon/public.
drop policy if exists "base_mapa_anon_select" on mapa_clientes.base_mapa;

create policy "base_mapa_anon_select"
on mapa_clientes.base_mapa
for select
to anon, authenticated
using (true);

commit;

-- ============================================================
-- VERIFICAÇÃO
-- Depois de importar o CSV, execute estas consultas.
-- ============================================================

select
    count(*) as total_clientes,
    count(latitude) as com_latitude,
    count(longitude) as com_longitude,
    count(*) filter (
        where latitude is not null
          and longitude is not null
    ) as com_coordenadas
from mapa_clientes.base_mapa;

select
    uf,
    municipio,
    count(*) as clientes
from mapa_clientes.base_mapa
group by uf, municipio
order by clientes desc, uf, municipio;
