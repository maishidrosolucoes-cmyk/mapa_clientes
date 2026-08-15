# Guia rapido - caminho gratuito e Google Maps opcional

## Situacao atual sem billing

Como nao ha como vincular conta de faturamento agora, a versao ativa em
`02_PROJETO_ATUAL` voltou para Leaflet + OpenStreetMap.

Ela nao exige Google Cloud, API key ou billing para abrir o mapa.

Recursos ativos sem custo de API:

- mapa base OpenStreetMap;
- mapa vetorial OpenFreeMap/MapLibre, sem API key;
- camada `Sat` com imagem de satelite via tiles ArcGIS/Esri, sem Google API key;
- clusters;
- modo `Pontos / Calor`;
- busca na base Supabase;
- filtros;
- ficha desktop/mobile;
- `Ligar` via `tel:`;
- `Abrir Maps` via URL publica do Google Maps, sem API key;
- lista de clientes quando varios compartilham a mesma coordenada.

Limites importantes:

- sem billing Google, nao ha Google Maps JavaScript API no mapa principal;
- sem billing Google, nao ha satelite/hibrido do Google dentro do app;
- `Sat` nao e Google Satellite. A fonte ativa usa tiles ArcGIS/Esri e exige
  atribuicao visivel no mapa;
- para uso publico/comercial em producao, valide os termos da fonte de tiles
  escolhida antes de publicar;
- sem geocoding pago ou infraestrutura propria, os pontos continuam limitados
  pela coordenada municipal ou pela qualidade da base existente.

A tentativa Google foi preservada em `backup_google_maps`.

## Opcoes gratuitas realistas

1. Manter Leaflet + OpenStreetMap como versao principal.
2. Usar `Vetor` com OpenFreeMap/MapLibre quando quiser um mapa mais moderno.
3. Usar `Sat` para contexto visual por imagem de satelite sem Google.
4. Usar `Abrir Maps` para consulta manual do endereco no app/site do Google Maps.
5. Fazer refinamento manual/amostral de coordenadas, registrando fonte e data.
6. Usar Nominatim publico apenas com muito cuidado, cache e baixo volume.
   A politica publica limita uso pesado e desencoraja geocodificacao em lote.
7. Para geocodificacao livre em escala, a opcao tecnicamente correta e hospedar
   uma instancia propria do Nominatim/OSM, mas isso exige servidor, PostGIS e
   manutencao. Nao e simples para este projeto pontual.

## Caminho robusto sem Google

Para deixar o mapa mais independente de servicos externos no futuro:

1. Baixar tiles vetoriais OSM em MBTiles/PMTiles.
2. Servir localmente com TileServer GL, Martin, Protomaps ou OpenFreeMap
   self-hosted.
3. Se precisar satelite local, baixar mosaicos INPE/CBERS ou Landsat em GeoTIFF,
   recortar para a area de interesse e gerar tiles raster.
4. Publicar esses tiles em um servidor proprio ou CDN barata.

Isso evita billing Google, mas exige armazenamento, processamento geoespacial e
uma decisao clara da area que sera mantida offline.

Observacao: o WMS publico do INPE/Brazil Data Cube foi documentado como fonte
aberta, mas pode falhar no navegador por instabilidade, lentidao ou bloqueio de
HTTP em paginas HTTPS. Para satelite nacional robusto, o melhor caminho e baixar
o GeoTIFF/CBERS ou Landsat e gerar tiles proprios.

## Se Google Maps for possivel no futuro

A versao arquivada em `backup_google_maps` esta preparada para Google Maps
JavaScript API no frontend, mantendo Supabase como fonte de verdade dos clientes.

## 1. Google Cloud

1. Crie ou selecione um Google Cloud Project.
2. Vincule uma conta de billing.
3. Ative estas APIs:
   - Maps JavaScript API
   - Geocoding API
4. Crie um Map ID para Web / JavaScript.
5. Crie uma API key web para o navegador.
6. Restrinja essa API key:
   - Application restrictions: HTTP referrers.
   - Referrers de teste: `http://localhost:*` e o dominio final.
   - API restrictions: Maps JavaScript API.
7. No arquivo `02_PROJETO_ATUAL/app.js`, preencha:
   - `GOOGLE_MAPS_API_KEY`
   - `GOOGLE_MAPS_MAP_ID`

Nao use chave server-side no navegador.

## 2. Supabase

1. Confirme que o schema `mapa_clientes` esta exposto na Data API.
2. Confirme que `mapa_clientes.base_mapa` tem RLS ativo.
3. Confirme que a role `anon` possui apenas SELECT.
4. Para preparar metadados Google, execute no SQL Editor:
   - `03_SQL/PROPOSTO_GOOGLE_MAPS/sql_geocodificacao_controlada_v1.sql`

Esse SQL nao apaga dados. Ele adiciona colunas e uma view de pendencias.

## 3. Geocodificacao em lote

Use uma funcao server-side, preferencialmente Supabase Edge Function, com uma
chave Google separada e segura. Nao rode 1.099 enderecos no navegador.

Foi deixado um modelo em:

`05_EDGE_FUNCTIONS/geocode-clientes/index.ts`

Para usar no formato padrao do Supabase CLI:

1. Crie a funcao:
   - `supabase functions new geocode-clientes`
2. Substitua o arquivo gerado por `05_EDGE_FUNCTIONS/geocode-clientes/index.ts`.
3. Configure secrets:
   - `GOOGLE_GEOCODING_API_KEY`
   - `GEOCODING_ADMIN_TOKEN`
   - `SUPABASE_SERVICE_ROLE_KEY` se seu projeto nao expuser `SUPABASE_SECRET_KEYS`
4. Rode localmente com `dryRun`:
   - `supabase functions serve geocode-clientes --env-file .env.local`
5. Chame com limite baixo:
   - `POST /functions/v1/geocode-clientes`
   - header: `x-geocode-token: SEU_TOKEN`
   - body: `{ "limit": 10, "dryRun": true }`
6. Somente depois de validar, rode:
   - `{ "limit": 10, "dryRun": false }`

Fluxo recomendado:

1. Buscar 10 linhas em `mapa_clientes.vw_google_geocode_pendentes`.
2. Para cada linha, enviar `endereco_busca` ao Google Geocoding API.
3. Validar resultado:
   - pais deve ser Brasil;
   - UF deve bater com a base;
   - municipio deve bater ou ser justificavel;
   - `location_type` deve ser registrado.
4. Atualizar somente colunas `google_*`.
5. Definir `google_geocode_expires_at` conforme os termos vigentes.
6. Conferir visualmente os 10 resultados no mapa.
7. Repetir com 50.
8. So depois expandir para a base completa.

## 4. O que testar no frontend

1. Abrir `http://localhost:8000/02_PROJETO_ATUAL/`.
2. Confirmar que 1.099 clientes carregam.
3. Alternar `OSM`, `Vetor` e `Sat`.
4. Alternar `Pontos` e `Calor`.
5. Buscar por nome, CNPJ, municipio, bairro e CEP.
6. Filtrar por UF, municipio e situacao.
7. Clicar em marker e cluster.
8. Em coordenadas repetidas, conferir a lista de clientes no painel.
9. Conferir que `Ligar` so aparece com telefone valido.
10. Conferir que `Abrir Maps` usa endereco textual, nao coordenada municipal.
11. Testar mobile em 390x844 e 430x932.
12. Conferir console sem erros relevantes.

## 5. Cuidados

- Nao inventar numero, rua, bairro ou coordenada.
- Nao deslocar pontos no banco para separar visualmente.
- Nao expor `service_role`.
- Nao geocodificar durante pan, zoom ou drag.
- Nao usar Google Geocoding sobre mapa nao Google.
- Nao tratar coordenadas Google como permanentes sem revisar os termos atuais.
