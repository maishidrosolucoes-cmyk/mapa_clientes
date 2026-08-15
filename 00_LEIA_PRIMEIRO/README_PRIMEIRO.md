# LEIA PRIMEIRO — Handoff do Mapa de Potenciais Clientes

Data do handoff: 15/08/2026

## Ordem recomendada de leitura

1. `01_DOCUMENTACAO/DOCUMENTACAO_COMPLETA_MAPA_CLIENTES.docx`
2. `00_LEIA_PRIMEIRO/PROMPT_CONTINUIDADE_CODEX.md`
3. `02_PROJETO_ATUAL/index.html`
4. `02_PROJETO_ATUAL/style.css`
5. `02_PROJETO_ATUAL/app.js`
6. `03_SQL/ATUAL/supabase_mapa_clientes_v2.sql`
7. `03_SQL/PROPOSTO_GOOGLE_MAPS/sql_proposto_google_maps.sql`

## Estado atual

O frontend atual funciona com Leaflet + OpenStreetMap + clustering + heatmap e consulta
`mapa_clientes.base_mapa` no Supabase. O design atual foi aprovado e deve ser preservado.

As 1.099 coordenadas atuais são, nesta versão, fallback de sede municipal
(`APROX_SEDE_MUNICIPIO`). Por isso muitos clientes compartilham exatamente a mesma
latitude/longitude. Isso é uma limitação dos dados/geocodificação, não um bug de layout.

## Próxima evolução desejada

A documentação detalha a migração recomendada para Google Maps JavaScript API quando
o Google Geocoding for utilizado para reposicionar os clientes no mapa. A próxima versão
deve priorizar fluidez do pan/zoom, geocodificação por endereço, visão híbrida/satélite,
ação `tel:` e abertura do endereço textual no Google Maps.

Não inventar números, endereços ou offsets de coordenadas. Não substituir dados
originais da base sem rastreabilidade.
