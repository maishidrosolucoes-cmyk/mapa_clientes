# Prompt de continuidade — Mapa de Potenciais Clientes

Você está assumindo um projeto existente e funcional. **Não recomece a interface do zero.** Leia primeiro `DOCUMENTACAO_COMPLETA_MAPA_CLIENTES.md`.

## Contexto

- Frontend: `index.html`, `style.css`, `app.js`.
- Design atual aprovado e inspirado em iOS; preserve a linguagem visual.
- Backend: Supabase.
- Schema: `mapa_clientes`.
- Tabela: `base_mapa`.
- Base consolidada: 1.099 clientes únicos.
- Coordenadas atuais: fallback de sede municipal (`APROX_SEDE_MUNICIPIO`), portanto muitos pontos estão sobrepostos.
- O endereço textual da base é a fonte de verdade.
- O projeto é um levantamento técnico pontual, não um sistema de logística/rotas.
- Nunca invente endereço, número ou coordenada.

## Objetivos imediatos

1. Melhorar muito a fluidez de mouse/drag/zoom.
2. Preservar busca, filtros, ficha, painel desktop e bottom sheet mobile.
3. Migrar o mapa-base para Google Maps JavaScript API caso Google Geocoding seja usado diretamente no mapa.
4. Oferecer `roadmap` e `hybrid/satellite`.
5. Usar `AdvancedMarkerElement` + `@googlemaps/markerclusterer`.
6. Não usar `google.maps.Marker` legado.
7. Implementar **Ligar** apenas quando houver telefone válido.
8. Implementar **Abrir no Google Maps** usando o endereço textual (`logradouro`, `bairro`, `municipio`, `uf`, `cep`, `Brasil`) e ignorando latitude/longitude aproximadas.
9. Geocodificar `endereco_busca` para refinar localização.
10. Validar país/UF/município antes de aceitar resultado.
11. Guardar `place_id`, `location_type`, status e timestamps.
12. Respeitar as regras vigentes de cache/armazenamento do Google.
13. Manter fallback municipal quando a geocodificação falhar.
14. Não criar offsets falsos para separar markers no banco.
15. Quando vários clientes tiverem a mesma coordenada, mostrar lista/cluster e, se necessário, expansão visual temporária.
16. Manter RLS do Supabase.
17. Nunca expor `service_role` no navegador.
18. Testar Chrome, Safari, desktop e mobile.

## Arquitetura pretendida

Frontend continua com três arquivos.

- Supabase: dados próprios, filtros, endereços, telefone, CNPJ, fallback municipal.
- Google Maps JavaScript API: mapa-base e satélite/híbrido.
- Geocoding API: localização por endereço.
- Maps URLs: abrir o endereço no Google Maps sem depender da coordenada salva.
- `tel:`: chamada telefônica.

## Regras de UX

- Tela inicial continua sendo essencialmente mapa.
- Nada de dashboard pesado.
- Cliente selecionado abre ficha.
- Campos vazios não aparecem.
- Mostrar claramente quando a localização é aproximada.
- Safe areas obrigatórias.
- Transições suaves, sem atrasar a interação.
- Sem geocodificação disparada durante pan/zoom.
- Sem recriar os 1.099 markers a cada movimento de câmera.

## Critério de aceite

Considere concluído apenas quando:

- 1.099 clientes carregam;
- pan/zoom ficam fluidos;
- busca e filtros funcionam;
- satélite/híbrido funciona;
- cluster funciona;
- ficha mostra cliente correto;
- Ligar aparece apenas com telefone válido;
- Abrir no Google Maps usa endereço;
- geocodificação não altera dados originais;
- falha de API mantém fallback;
- mobile respeita safe areas;
- console não apresenta erros relevantes.

## Arquivos obrigatórios para consulta

- `DOCUMENTACAO_COMPLETA_MAPA_CLIENTES.md`
- `projeto_atual/index.html`
- `projeto_atual/style.css`
- `projeto_atual/app.js`
- `sql/atual/supabase_mapa_clientes_v2.sql`
- `sql/proposto/sql_proposto_google_maps.sql`

Antes de editar, faça uma leitura do projeto atual e descreva brevemente quais partes serão preservadas, quais serão substituídas e como você garantirá que a mudança não quebre a conexão com o Supabase.
