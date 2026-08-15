-- ============================================================
-- PROPOSTA FUTURA — GOOGLE MAPS / GEOCODING
-- NÃO executar antes de migrar o mapa para Google Maps.
-- Schema: mapa_clientes
-- Tabela: mapa_clientes.base_mapa
--
-- Objetivo:
-- armazenar metadados necessários para uma campanha curta de
-- geocodificação Google, preservando o endereço original.
--
-- IMPORTANTE:
-- - google_place_id pode ser armazenado para uso posterior.
-- - latitude/longitude derivadas do Geocoding API devem obedecer
--   às regras vigentes de caching/armazenamento do Google.
-- - manter google_geocoded_at e google_geocode_expires_at.
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
    add column if not exists google_geocode_expires_at timestamptz;

create index if not exists base_mapa_google_place_id_idx
    on mapa_clientes.base_mapa (google_place_id);

create index if not exists base_mapa_google_geocode_status_idx
    on mapa_clientes.base_mapa (google_geocode_status);

commit;

-- Exemplo de auditoria:
select
    google_geocode_status,
    count(*) as registros
from mapa_clientes.base_mapa
group by google_geocode_status
order by registros desc nulls last;
