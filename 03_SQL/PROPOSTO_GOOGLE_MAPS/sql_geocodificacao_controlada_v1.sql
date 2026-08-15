-- ============================================================
-- PROPOSTA FUTURA - GEOCODIFICACAO GOOGLE CONTROLADA V1
-- Nao execute antes de configurar Google Maps Platform, billing,
-- chave server-side segura e revisar os termos vigentes.
--
-- Este script nao apaga dados. Ele prepara metadados para usar
-- resultados do Google Geocoding com rastreabilidade e validade.
-- ============================================================

begin;

alter table mapa_clientes.base_mapa
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

comment on column mapa_clientes.base_mapa.google_place_id is
'Place ID retornado pelo Google. Pode ser armazenado conforme documentacao vigente.';

comment on column mapa_clientes.base_mapa.google_latitude is
'Latitude retornada pelo Google Geocoding. Respeitar validade/caching.';

comment on column mapa_clientes.base_mapa.google_longitude is
'Longitude retornada pelo Google Geocoding. Respeitar validade/caching.';

comment on column mapa_clientes.base_mapa.google_geocode_expires_at is
'Data limite para uso/cache das coordenadas Google, conforme termos vigentes.';

comment on column mapa_clientes.base_mapa.google_geocode_source_address is
'Endereco textual proprio enviado ao geocoder; nao e conteudo derivado do Google.';

create index if not exists base_mapa_google_place_id_idx
    on mapa_clientes.base_mapa (google_place_id);

create index if not exists base_mapa_google_geocode_status_idx
    on mapa_clientes.base_mapa (google_geocode_status);

create index if not exists base_mapa_google_geocode_expires_at_idx
    on mapa_clientes.base_mapa (google_geocode_expires_at);

create index if not exists base_mapa_google_pending_idx
    on mapa_clientes.base_mapa (google_geocode_status, google_geocode_expires_at)
    where endereco_busca is not null;

create or replace view mapa_clientes.vw_google_geocode_pendentes
with (security_invoker = true) as
select
    cnpj,
    razao_social,
    nome_fantasia,
    endereco_busca,
    logradouro,
    bairro,
    municipio,
    uf,
    cep,
    google_geocode_status,
    google_geocoded_at,
    google_geocode_expires_at,
    google_geocode_attempts
from mapa_clientes.base_mapa
where nullif(trim(coalesce(endereco_busca, '')), '') is not null
  and (
        google_geocode_status is null
        or google_geocode_status in ('PENDENTE', 'REFINAR', 'ERRO_TEMPORARIO')
        or google_geocode_expires_at is null
        or google_geocode_expires_at <= now()
      )
  and (
        (nullif(trim(coalesce(logradouro, '')), '') is not null and trim(logradouro) <> '13')
        or (nullif(trim(coalesce(bairro, '')), '') is not null and trim(bairro) <> '13')
        or nullif(trim(coalesce(cep, '')), '') is not null
      )
order by
    case
        when nullif(trim(coalesce(logradouro, '')), '') is not null
         and trim(logradouro) <> '13'
         and nullif(trim(coalesce(bairro, '')), '') is not null
         and trim(bairro) <> '13'
         and nullif(trim(coalesce(cep, '')), '') is not null
        then 1
        when nullif(trim(coalesce(bairro, '')), '') is not null
         and trim(bairro) <> '13'
         and nullif(trim(coalesce(cep, '')), '') is not null
        then 2
        when nullif(trim(coalesce(cep, '')), '') is not null
        then 3
        else 4
    end,
    uf,
    municipio,
    cnpj;

grant select on mapa_clientes.vw_google_geocode_pendentes to authenticated, service_role;

commit;

-- ============================================================
-- AUDITORIAS APOS EXECUTAR
-- ============================================================

select
    google_geocode_status,
    count(*) as registros
from mapa_clientes.base_mapa
group by google_geocode_status
order by registros desc nulls last;

select count(*) as pendentes
from mapa_clientes.vw_google_geocode_pendentes;
