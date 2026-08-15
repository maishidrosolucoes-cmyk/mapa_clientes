-- ============================================================
-- CORREÇÃO DE IMPORTAÇÃO CSV — MAPA DE CLIENTES
-- Resolve valores brasileiros como -4,831510 no Supabase.
--
-- Execute este script UMA VEZ no SQL Editor antes de reenviar o CSV.
-- Não apaga dados existentes.
-- ============================================================

begin;

-- Latitude/longitude passam a TEXT para aceitar tanto:
--   -4,831510  (Excel/CSV pt-BR)
-- quanto:
--   -4.831510  (formato internacional)
--
-- O app.js do projeto já normaliza vírgula para ponto em tempo de leitura.
alter table mapa_clientes.base_mapa
    alter column latitude type text
    using latitude::text;

alter table mapa_clientes.base_mapa
    alter column longitude type text
    using longitude::text;

-- Capital social também pode ser exportado pelo Excel com vírgula decimal.
-- Como o mapa não realiza cálculos financeiros, TEXT preserva o valor original
-- e evita outra falha de importação por localidade.
alter table mapa_clientes.base_mapa
    alter column capital_social type text
    using capital_social::text;

commit;

-- ============================================================
-- VERIFICAÇÃO DA ESTRUTURA
-- Deve mostrar latitude, longitude e capital_social como "text".
-- ============================================================

select
    column_name,
    data_type
from information_schema.columns
where table_schema = 'mapa_clientes'
  and table_name = 'base_mapa'
  and column_name in ('latitude', 'longitude', 'capital_social')
order by ordinal_position;

-- ============================================================
-- APÓS IMPORTAR O CSV, valide:
-- ============================================================

select
    count(*) as total_clientes,
    count(*) filter (
        where nullif(trim(latitude), '') is not null
          and nullif(trim(longitude), '') is not null
    ) as com_coordenadas
from mapa_clientes.base_mapa;

-- Opcional: mostra exemplos exatamente como chegaram do CSV.
select
    cnpj,
    municipio,
    latitude,
    longitude,
    geocode_status
from mapa_clientes.base_mapa
limit 10;
