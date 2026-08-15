# Documentação Completa e Handoff Técnico — Mapa de Potenciais Clientes

**Projeto:** Mapa de distribuição geográfica de potenciais clientes  
**Data do handoff:** 15/08/2026  
**Versão documental:** 1.0  
**Status:** primeira versão funcional concluída; próxima etapa é refinamento geográfico e migração opcional/indicada para Google Maps Platform.

---

## 1. Resumo executivo

Este projeto foi criado para um objetivo pontual: visualizar, pesquisar e filtrar a distribuição geográfica de potenciais clientes no Brasil, com foco em entender onde eles se concentram. Não é um produto de navegação, logística ou roteirização de longo prazo.

A versão atual possui um frontend puro em três arquivos (`index.html`, `style.css` e `app.js`) conectado diretamente ao Supabase. O mapa atual usa Leaflet + OpenStreetMap, clustering e heatmap. O visual foi desenhado com forte inspiração em iOS: superfícies translúcidas, painel lateral no desktop, bottom sheet no mobile, safe areas, transições suaves, busca e filtros compactos.

O banco está em um schema próprio do Supabase:

- Schema: `mapa_clientes`
- Tabela: `mapa_clientes.base_mapa`
- Leitura no frontend: `anon/public`
- Escrita no frontend: bloqueada
- RLS: habilitado
- Total de clientes consolidados: **1.099 CNPJs únicos**

A limitação atual é de dados geográficos: todos os 1.099 registros receberam inicialmente coordenadas aproximadas da sede do município. Por isso muitos pontos estão exatamente sobrepostos. Isso foi intencional para não inventar posições.

A próxima etapa desejada é:

1. manter o design atual;
2. melhorar a sensação de arraste/zoom com mouse;
3. refinar a localização de cada cliente usando o endereço disponível;
4. permitir imagem de satélite/híbrida;
5. adicionar ação **Ligar** quando houver telefone;
6. adicionar ação **Abrir no Google Maps** usando o endereço textual da base, ignorando as coordenadas atuais;
7. se possível, consultar o endereço no Google Maps/Geocoding e reposicionar o cliente com melhor precisão;
8. preservar a regra de não inventar dados.

Para usar resultados do Google Geocoding diretamente no mapa, a evolução correta é migrar o motor de mapa de Leaflet/OpenStreetMap para **Google Maps JavaScript API**. A política do Google proíbe usar conteúdo do Geocoding API em conjunto com um mapa não Google. O Google Maps JavaScript API também oferece visualização `satellite` e `hybrid`.

---

## 2. Objetivo do negócio

O sistema deve responder visualmente a perguntas como:

- Em quais estados e municípios estão concentrados os potenciais clientes?
- Qual a distribuição das empresas ativas e inaptas?
- Quais clientes existem numa determinada região?
- Onde um cliente específico está localizado ou, quando não houver precisão suficiente, qual é a melhor área aproximada?
- Qual endereço deve ser aberto no Google Maps?
- Existe telefone disponível para contato?

O sistema **não precisa**:

- criar rotas internas;
- acompanhar GPS do usuário;
- operar como sistema de navegação;
- suportar milhões de registros;
- possuir backend próprio complexo;
- possuir dashboards inflados;
- substituir Google Maps ou Google Earth.

---

## 3. Regras de produto consolidadas

### 3.1 Regras obrigatórias

1. O escopo geográfico é Brasil.
2. Informações de cliente devem vir da base de dados.
3. Não inventar endereço, número, coordenada ou dado comercial.
4. Desktop e mobile devem possuir experiências adaptadas.
5. Nada deve ficar cortado em notch, Dynamic Island, barra inferior do iPhone ou áreas seguras.
6. Interface deve ser enxuta e premium.
7. Transições devem ser suaves e naturais.
8. O sistema deve funcionar em Chrome e Safari atuais.
9. Se determinado dado estiver vazio, não mostrar linha inútil.
10. Coordenadas aproximadas devem ser claramente classificadas como aproximadas.
11. Se vários clientes possuírem a mesma coordenada real/aproximada, não deslocar os dados artificialmente no banco.
12. Ações externas ao Google Maps devem usar o endereço textual disponível, não a coordenada aproximada do município.
13. Telefone só deve aparecer como ação quando houver telefone utilizável.
14. O frontend nunca pode possuir `service_role` do Supabase.
15. Chaves do Google no navegador devem ser restritas por domínio e API.

### 3.2 Princípio de UX

Ao abrir o sistema, o usuário deve ver essencialmente:

- mapa;
- busca;
- filtros;
- número de clientes visíveis/filtrados;
- troca de visualização quando aplicável.

A ficha detalhada só aparece quando um cliente é selecionado.

---

## 4. Histórico do projeto e cronologia

### Fase 1 — Definição inicial

O pedido inicial previa um mapa robusto semelhante ao Google Maps, com zoom, pesquisa, filtros, pontos de clientes, GPS e rotas.

Após análise de escopo, o projeto foi reduzido propositalmente para um levantamento técnico pontual. Foram removidos:

- GPS;
- navegação interna;
- Routes API;
- PostGIS;
- backend customizado;
- arquitetura para altíssima escala.

### Fase 2 — Auditoria da planilha

A planilha original continha:

- 1.420 registros de empresas;
- 1.099 CNPJs únicos;
- 321 linhas duplicadas por CNPJ;
- 44 municípios;
- 3 estados;
- predominância no Ceará.

Distribuição consolidada por UF:

| UF | Clientes únicos |
|---|---:|
| CE | 920 |
| RN | 142 |
| PI | 37 |
| Total | 1.099 |

Situação cadastral consolidada:

| Situação | Quantidade |
|---|---:|
| ATIVA | 855 |
| INAPTA | 244 |

Foram encontrados problemas estruturais:

- coluna B sem nome, identificada como `seq`;
- duas colunas chamadas `situacao`;
- a primeira representa situação cadastral;
- a segunda representa motivo da situação;
- o valor `13` funciona como sentinela de ausência em vários campos;
- telefone formado apenas por zeros também deve ser tratado como ausente;
- e-mail estava essencialmente indisponível na base analisada.

Os nomes consolidados passaram a ser:

- `situacao_cadastral`
- `motivo_situacao`

### Fase 3 — Base tratada para mapa

Foi criada uma aba `Base_Mapa`, preservando a aba original.

Resultado:

- 1.099 linhas;
- uma linha por CNPJ;
- duplicidades consolidadas;
- dados úteis preservados;
- campos técnicos adicionados.

Campos técnicos adicionados:

- `endereco_busca`
- `latitude`
- `longitude`
- `geocode_status`

O endereço de busca foi montado apenas com o que existe na base:

`logradouro + bairro + municipio + uf + cep + Brasil`

Quando `logradouro` não existe, ele é omitido.

### Fase 4 — Primeira geolocalização

A base não possui número do imóvel e possui grande volume de endereços rurais ou incompletos. Para não criar coordenadas falsas, foi usada uma primeira camada de fallback:

`geocode_status = APROX_SEDE_MUNICIPIO`

Todos os 1.099 registros receberam latitude/longitude da sede do respectivo município.

Consequência esperada:

- clientes do mesmo município podem possuir exatamente a mesma latitude/longitude;
- isso é uma referência de concentração municipal, não localização do imóvel;
- nenhum ponto foi deslocado artificialmente.

### Fase 5 — Frontend V1

Foi criado o frontend em apenas três arquivos:

- `index.html`
- `style.css`
- `app.js`

Tecnologias da V1:

- Leaflet 1.9.4
- OpenStreetMap tiles
- Leaflet.markercluster 1.5.3
- Leaflet.heat 0.2.0
- Supabase JS v2
- JavaScript puro
- CSS puro
- HTML puro

Funcionalidades implementadas:

- mapa limitado visualmente ao Brasil;
- zoom;
- arraste;
- clusters;
- heatmap;
- busca local por cliente/CNPJ/cidade/bairro/CEP;
- filtro por UF;
- filtro por município;
- filtro por situação;
- ficha de cliente;
- indicação do nível de precisão;
- aviso quando várias empresas compartilham a mesma coordenada;
- botão copiar dados;
- layout desktop;
- bottom sheet mobile;
- safe areas;
- persistência de filtros/visualização;
- paginação de leitura do Supabase;
- normalização de latitude/longitude com vírgula decimal.

### Fase 6 — Supabase

Foi criado o schema customizado:

`mapa_clientes`

Tabela:

`mapa_clientes.base_mapa`

A aplicação consulta:

```js
supabase
  .schema("mapa_clientes")
  .from("base_mapa")
```

Acesso previsto:

- `anon`: SELECT
- `authenticated`: SELECT
- `service_role`: acesso administrativo
- RLS habilitado

O schema `mapa_clientes` precisa estar incluído nos schemas expostos pela Data API do projeto Supabase.

### Fase 7 — Erro de CSV brasileiro

Ao importar o CSV, o Supabase/PostgreSQL recusou valores como:

`-4,831510`

porque a primeira versão do SQL definiu latitude/longitude como `double precision`.

Correção final:

- `latitude` -> `text`
- `longitude` -> `text`
- `capital_social` -> `text`

O `app.js` normaliza:

```js
String(value)
  .trim()
  .replace(/\s/g, "")
  .replace(",", ".");
```

Assim aceita:

- `-4,831510`
- `-4.831510`

---

## 5. Estrutura atual da tabela

A tabela atual usa os 26 cabeçalhos da `Base_Mapa`:

| Coluna | Tipo atual | Observação |
|---|---|---|
| planilha | integer | origem |
| seq | integer | sequencial original |
| cnpj | text PK | identificador lógico |
| razao_social | text | dado original |
| nome_fantasia | text | opcional |
| situacao_cadastral | text | ATIVA/INAPTA |
| uf | text | UF brasileira |
| municipio | text | município |
| abertura | text | mantido como texto para CSV |
| cnae | text | código + descrição |
| logradouro | text | pode estar vazio |
| motivo_situacao | text | motivo cadastral |
| porte | text | porte |
| bairro | text | bairro/localidade |
| cep | text | preservar zeros |
| email | text | atualmente pouco útil |
| telefone | text | opcional |
| telefone_1 | text | opcional |
| capital_social | text | tolerante a vírgula decimal |
| optante_simples | text | dado original |
| qtd_socios | integer | dado original |
| optante_mei | text | dado original |
| endereco_busca | text | composto a partir da base |
| latitude | text | pode usar vírgula decimal |
| longitude | text | pode usar vírgula decimal |
| geocode_status | text | precisão/origem da coordenada |

---

## 6. Arquivos atuais do frontend

### `index.html`

Responsabilidades:

- estrutura da interface;
- mapa;
- barra de busca;
- filtros;
- toggle Pontos/Calor;
- controles;
- ficha lateral/bottom sheet;
- estados de carregamento;
- carregamento das bibliotecas por CDN.

### `style.css`

Responsabilidades:

- linguagem visual inspirada em iOS;
- glass surfaces;
- tipografia system;
- desktop/mobile;
- safe areas;
- `100dvh`;
- marcadores;
- clusters;
- ficha;
- animações;
- estados de foco;
- acessibilidade visual.

### `app.js`

Responsabilidades:

- configuração do Supabase;
- inicialização do mapa;
- leitura paginada;
- normalização dos dados;
- filtros;
- pesquisa;
- markers;
- clustering;
- heatmap;
- ficha;
- cópia de dados;
- persistência local;
- tratamento de falhas;
- conversão de coordenadas textuais.

Configuração atual importante:

```js
const CONFIG = Object.freeze({
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "COLE_SUA_ANON_PUBLIC_AQUI",
  SCHEMA_NAME: "mapa_clientes",
  TABLE_NAME: "base_mapa",
  PAGE_SIZE: 1000
});
```

---

## 7. Estado atual da geolocalização

### 7.1 Por que os pontos estão concentrados

Na versão atual, todos os registros têm:

`geocode_status = APROX_SEDE_MUNICIPIO`

Portanto, dois clientes do mesmo município normalmente compartilham exatamente a mesma coordenada.

Exemplo conceitual:

- Cliente A — Jaguaruana -> coordenada da sede de Jaguaruana
- Cliente B — Jaguaruana -> mesma coordenada
- Cliente C — Jaguaruana -> mesma coordenada

Isso gera clusters grandes e sobreposição.

### 7.2 Isso é bug?

Não. É uma consequência dos dados disponíveis e da decisão de não inventar localização.

### 7.3 O que precisa mudar

Precisamos geocodificar cada cliente usando `endereco_busca`.

Ordem de tentativa recomendada:

1. `logradouro + bairro + municipio + uf + cep + Brasil`
2. se não encontrar: `bairro + municipio + uf + cep + Brasil`
3. se não encontrar: `cep + municipio + uf + Brasil`
4. fallback final: sede do município

O resultado deve possuir uma classificação clara de precisão.

---

## 8. Limitações reais da base

Nem todo cliente poderá virar um ponto exclusivo.

A base não contém número do imóvel.

Além disso, na auditoria original:

- 816 clientes possuíam logradouro utilizável;
- 283 não possuíam logradouro;
- grande parte dos registros é rural;
- muitos clientes compartilham CEP genérico;
- vários clientes possuem exatamente os mesmos componentes de endereço.

Portanto:

**geocodificação mais precisa deve reduzir drasticamente a concentração, mas não garante 1.099 coordenadas únicas.**

Quando dois registros realmente terminarem no mesmo ponto, a UI deve:

- preservar a mesma coordenada;
- mostrar grupo/cluster;
- ao clicar, listar os clientes naquele ponto;
- opcionalmente usar expansão visual tipo spiderfy sem alterar a coordenada armazenada.

Nunca adicionar deslocamento aleatório na latitude/longitude do banco.

---

## 9. Nova necessidade: Google Maps

### 9.1 O que o usuário quer agora

O novo requisito pode ser descrito assim:

> Ao selecionar um cliente, o sistema deve utilizar o endereço textual já existente na base para tentar localizar esse endereço no ecossistema Google Maps. Quando houver uma correspondência melhor, o mapa deve posicionar o cliente nessa localização, sem depender da coordenada municipal aproximada. O usuário também deve poder abrir o endereço diretamente no Google Maps. O mapa principal deve oferecer visão normal e visão de satélite/híbrida. Se houver telefone, deve existir ação de ligação.

### 9.2 Sim, é tecnicamente possível

A arquitetura indicada é migrar o motor do mapa para:

- Google Maps JavaScript API
- Geocoding API
- AdvancedMarkerElement
- `@googlemaps/markerclusterer`
- Supabase permanece como banco
- Google Maps URLs para abrir o endereço
- `tel:` para ligação

### 9.3 Por que não apenas "acoplar o Google" ao Leaflet

O Google estabelece que conteúdo do Geocoding API não deve ser usado em conjunto com um mapa não Google. Portanto, se a localização obtida pelo Google será desenhada diretamente no mapa, a versão correta é usar um Google Map como mapa-base.

Isso também resolve de forma nativa a necessidade de:

- `roadmap`
- `satellite`
- `hybrid`
- `terrain`

### 9.4 Visual de satélite e estilo Earth

O Maps JavaScript API suporta `satellite` e `hybrid`.

Para a versão principal, usar:

`hybrid`

porque mantém:

- imagem aérea/satélite;
- nomes de vias e referências visuais.

Se o usuário quiser aparência mais próxima de Google Earth em perspectiva 3D, o Google também oferece 3D Maps/Photorealistic 3D. Isso deve ser uma opção futura, não requisito obrigatório da primeira migração.

Observação atual importante: a antiga troca automática para imagens de 45 graus em `satellite/hybrid` foi descontinuada nas versões recentes. Para perspectiva 3D, usar 3D Maps.

---

## 10. Estratégia de geocodificação recomendada

Existem duas necessidades diferentes e elas não devem ser confundidas.

### 10.1 Geocodificação em lote

Objetivo:

- separar os pontos antes de o usuário abrir o mapa;
- processar os 1.099 endereços uma vez;
- classificar a qualidade do resultado.

Como os endereços são estáticos/conhecidos, o Google recomenda o Geocoding Web Service em vez de depender do Geocoder client-side para um lote conhecido.

Fluxo:

```text
Supabase
  -> lê clientes pendentes
  -> monta endereco_busca
  -> Google Geocoding API
  -> recebe resultado
  -> valida que pertence ao Brasil/UF/município esperado
  -> registra place_id, localização, tipo de precisão e timestamp
  -> mapa usa o resultado enquanto válido
```

### 10.2 Geocodificação dinâmica ao selecionar cliente

Ao clicar num cliente cuja geocodificação esteja ausente, vencida ou ainda municipal:

```text
seleciona cliente
  -> usa endereco_busca
  -> chama Geocoder
  -> se resultado plausível:
       move o marcador selecionado
       centraliza a câmera
       mostra "localização encontrada pelo Google"
  -> se não:
       mantém fallback municipal
```

Isso dá sensação imediata de "pesquisar no Maps e devolver a localização".

### 10.3 Regra de validação

Nunca aceitar silenciosamente o primeiro resultado se ele conflitar com:

- país;
- UF;
- município;
- CEP, quando disponível.

Resultados precisam ser classificados pelo `location_type`:

- `ROOFTOP`
- `RANGE_INTERPOLATED`
- `GEOMETRIC_CENTER`
- `APPROXIMATE`

Se o resultado for fraco, a UI deve dizer que é aproximado.

---

## 11. Armazenamento Google e limitação de 30 dias

Este ponto é obrigatório para o próximo desenvolvedor.

Nos termos atuais do Google Maps Platform:

- latitude/longitude do Geocoding API podem ser armazenadas temporariamente por até 30 dias nas condições gerais aplicáveis;
- `place_id` é um identificador que pode ser armazenado para uso posterior;
- conteúdo do Google não deve ser combinado com mapa não Google.

Como este projeto foi definido como levantamento técnico pontual, uma campanha curta de geocodificação com validade controlada pode ser compatível com o objetivo.

Campos sugeridos:

- `google_place_id`
- `google_latitude`
- `google_longitude`
- `google_location_type`
- `google_formatted_address`
- `google_geocode_status`
- `google_geocoded_at`
- `google_geocode_expires_at`

Não tratar Google latitude/longitude como dado permanente sem revisar os termos vigentes.

---

## 12. Ações da ficha do cliente

### 12.1 Ligar

Só mostrar se houver `telefone` ou `telefone_1`.

Comportamento:

```text
[Ligar]
```

O link deve usar URI `tel:` com somente dígitos.

Exemplo lógico:

```js
location.href = `tel:${telefoneNormalizado}`;
```

No desktop, o sistema operacional pode encaminhar para aplicativo compatível. No mobile, abre o discador.

### 12.2 Abrir no Google Maps

Esta ação deve ignorar `latitude` e `longitude`.

Usar o endereço textual disponível:

`logradouro + bairro + municipio + uf + cep + Brasil`

Abrir por Google Maps URL.

A API de Maps URLs não exige API key.

Comportamento desejado:

```text
[Abrir no Google Maps]
  -> pesquisa o endereço textual
  -> abre Google Maps app no Android/iOS quando disponível
  -> senão abre Google Maps no navegador
```

### 12.3 Quando não houver logradouro

Ainda é permitido abrir:

`bairro + municipio + uf + cep + Brasil`

Mas a UI deve considerar que a precisão será menor.

---

## 13. Pesquisa dentro do site

A busca principal deve continuar sendo da própria base.

Ela deve localizar:

- nome fantasia;
- razão social;
- CNPJ;
- município;
- bairro;
- CEP;
- logradouro.

Não substituir essa busca por resultados gerais do Google Places, porque o sistema deve continuar centrado nos clientes existentes no Supabase.

### Google Places

Pode existir futuramente como recurso auxiliar de validação, por exemplo:

`Buscar estabelecimento no Google`

Mas não deve automaticamente substituir o cliente da base por um estabelecimento de nome parecido sem confirmação.

---

## 14. Desempenho: arraste e cursor lentos

O usuário informou que o design está muito bom, porém o movimento manual com cursor está lento.

Na versão Leaflet atual, possíveis fontes de percepção de lentidão incluem:

- centenas de markers HTML/DOM;
- recalculo de clustering;
- animações de clusters;
- atualização de tiles ao final do movimento;
- camadas simultâneas;
- transitions CSS;
- comportamento restritivo do bounds.

Não assumir uma única causa sem medir.

### Plano de otimização

Se o projeto continuar em Leaflet:

1. medir FPS e long tasks no Chrome DevTools;
2. desabilitar temporariamente animação de cluster;
3. testar `updateWhenIdle: false`;
4. reduzir custo de markers HTML;
5. garantir que filtros não sejam recalculados durante cada movimento do mapa;
6. não recriar 1.099 markers a cada `move`;
7. reduzir transições que toquem layout;
8. revisar `wheelPxPerZoomLevel`, `zoomDelta`, `zoomSnap`;
9. testar mouse/trackpad separadamente.

Se migrar para Google Maps, preservar a UI mas usar o renderer do Google e:

- `gestureHandling` adequado ao desktop/mobile;
- Advanced Markers;
- clusterer;
- atualizações de filtros fora dos eventos contínuos de câmera;
- zero chamadas Supabase durante pan/zoom;
- nenhuma geocodificação em cada frame;
- evitar re-render completo da lista durante câmera.

---

## 15. Nova arquitetura recomendada

```text
┌────────────────────────────────────────────────────┐
│                 FRONTEND 3 ARQUIVOS                │
│                                                    │
│ index.html + style.css + app.js                    │
│                                                    │
│ UI atual preservada                                │
│ busca / filtros / ficha / ações                    │
└──────────────────────┬─────────────────────────────┘
                       │
           ┌───────────┴───────────┐
           │                       │
           ▼                       ▼
┌───────────────────────┐  ┌────────────────────────┐
│       SUPABASE        │  │ GOOGLE MAPS PLATFORM   │
│                       │  │                        │
│ mapa_clientes         │  │ Maps JavaScript API   │
│   .base_mapa          │  │ Geocoding API         │
│                       │  │ Maps URLs              │
│ dados próprios        │  │ Satellite / Hybrid     │
└───────────────────────┘  └────────────────────────┘
```

### Responsabilidades

Supabase:

- cliente;
- CNPJ;
- telefone;
- endereço;
- filtros;
- coordenada municipal de fallback;
- metadados temporários de geocodificação conforme regras vigentes.

Google Maps:

- mapa-base;
- imagem de satélite;
- câmera;
- busca/geocoding de endereço;
- markers Google;
- abertura externa no Google Maps.

---

## 16. Marker strategy da próxima versão

Usar:

- `AdvancedMarkerElement`
- `@googlemaps/markerclusterer`

O antigo `google.maps.Marker` está depreciado, portanto não iniciar código novo com ele.

Comportamento:

### Zoom Brasil

Clusters.

### Zoom estadual/municipal

Clusters menores.

### Zoom local

Markers individuais.

### Coordenadas idênticas no zoom máximo

Não deslocar banco.

Abrir um componente:

```text
3 clientes nesta localização
- Cliente A
- Cliente B
- Cliente C
```

Opcionalmente usar expansão visual temporária, mantendo os dados originais.

---

## 17. Heatmap

A versão Leaflet possui heatmap.

Na migração para Google, não usar `google.maps.visualization.HeatmapLayer` em código novo: a funcionalidade foi depreciada e retirada nas versões atuais.

Se o heatmap continuar necessário, usar integração com `deck.gl HeatmapLayer` sobre Google Maps.

Como o objetivo principal é concentração, heatmap continua útil, mas é recurso secundário. O mapa deve funcionar perfeitamente mesmo sem ele.

---

## 18. SQL: histórico

### 18.1 `supabase_mapa_clientes.sql` — V1

Primeira criação do schema/tabela.

Problema:

- `latitude` e `longitude` eram `double precision`;
- CSV brasileiro trouxe vírgula decimal;
- importação falhou com erro `22P02`.

Este arquivo é histórico e não deve ser usado em nova instalação.

### 18.2 `supabase_corrigir_importacao_csv.sql`

Patch aplicado para transformar:

- `latitude` em `text`;
- `longitude` em `text`;
- `capital_social` em `text`.

### 18.3 `supabase_mapa_clientes_v2.sql` — atual

Este é o SQL atual para instalação limpa.

Características:

- schema `mapa_clientes`;
- tabela `base_mapa`;
- campos compatíveis com CSV pt-BR;
- índices;
- grants;
- RLS;
- `anon` somente leitura.

### 18.4 `sql_proposto_google_maps.sql` — futuro

Não é estado atual do banco.

Serve como proposta para adicionar metadados Google antes da próxima fase.

Só executar quando a estratégia de geocodificação estiver aprovada e o mapa-base tiver sido migrado para Google.

---

## 19. Segurança

### Supabase

No navegador:

- usar somente anon/publishable key;
- RLS obrigatório;
- não colocar service_role;
- não permitir INSERT/UPDATE/DELETE para `anon`.

A tabela contém telefone/CNPJ e deve ser tratada conforme o uso pretendido.

### Google Maps Platform

Criar chaves separadas quando possível:

- chave web: restrição por HTTP referrer;
- chave server-side de geocoding em lote: restrição apropriada ao ambiente;
- restringir APIs habilitadas na própria chave;
- configurar orçamento/quota no Google Cloud.

Nunca colocar uma chave server-side sem restrição em `app.js`.

---

## 20. Configuração Google necessária para a próxima versão

O próximo programador deve preparar:

1. Google Cloud Project.
2. Billing account.
3. Maps JavaScript API habilitada.
4. Geocoding API habilitada.
5. Map ID para Advanced Markers.
6. API key web restrita ao domínio.
7. Se houver processamento server-side/lote, credencial separada.
8. Quotas e alertas de orçamento.

---

## 21. Critérios de aceite da próxima versão

### Mapa

- [ ] Design atual preservado.
- [ ] Arraste com mouse/trackpad fluido.
- [ ] Zoom natural.
- [ ] Limitação visual ao Brasil.
- [ ] Toggle `Mapa / Satélite` ou `Mapa / Híbrido`.
- [ ] Sem travamentos ao mostrar 1.099 clientes.
- [ ] Clustering funcionando.
- [ ] Mesmo endereço não recebe offset falso no banco.

### Geocodificação

- [ ] Cliente usa `endereco_busca`.
- [ ] Resultado validado contra Brasil/UF/município.
- [ ] `place_id` registrado quando disponível.
- [ ] `location_type` registrado.
- [ ] Resultado fraco sinalizado como aproximado.
- [ ] Fallback municipal permanece disponível.
- [ ] Registros não localizados continuam utilizáveis.

### Ficha

- [ ] Nome fantasia quando houver.
- [ ] Razão social.
- [ ] CNPJ.
- [ ] Situação.
- [ ] Endereço.
- [ ] CNAE se útil.
- [ ] Telefone somente se houver.
- [ ] Botão Ligar somente se houver telefone.
- [ ] Botão Abrir no Google Maps usa o endereço, não a coordenada de fallback.
- [ ] Precisão da localização claramente indicada.

### Mobile

- [ ] Safe areas.
- [ ] Bottom sheet suave.
- [ ] Controles acessíveis ao polegar.
- [ ] Sem zoom de formulário involuntário no Safari.
- [ ] Nada cortado.

### Desktop

- [ ] Painel lateral elegante.
- [ ] Cursor/drag fluido.
- [ ] Busca não bloqueia mapa.
- [ ] Filtros não recriam o mapa inteiro.

---

## 22. O que o próximo programador NÃO deve fazer

- Não alterar a planilha original para "corrigir" dados manualmente.
- Não inventar número de endereço.
- Não espalhar markers aleatoriamente.
- Não salvar coordenadas falsas para separar visualmente clientes.
- Não substituir CNPJ por ID aleatório.
- Não misturar Google Geocoding com Leaflet/OpenStreetMap na mesma visualização.
- Não usar `google.maps.Marker` em código novo.
- Não depender do HeatmapLayer antigo do Google.
- Não colocar service_role do Supabase no navegador.
- Não esconder a atribuição do Google.
- Não pesquisar empresas externas e tratá-las automaticamente como se fossem o cliente da base.
- Não enviar geocoding a cada movimento de câmera.
- Não geocodificar todos os 1.099 endereços toda vez que a página abrir.

---

## 23. Prioridade de implementação para continuidade

### Prioridade 1 — manter a experiência visual

Antes de reescrever lógica:

- preservar HTML/CSS atuais;
- preservar identidade visual;
- alterar somente o motor do mapa.

### Prioridade 2 — Google Maps JavaScript API

Trocar:

`Leaflet + OSM`

por:

`Google Maps JavaScript API`

Preservar:

- busca;
- filtros;
- ficha;
- bottom sheet;
- painel desktop.

### Prioridade 3 — ações úteis

Implementar imediatamente:

- Ligar;
- Abrir no Google Maps por endereço;
- Mapa/Satélite.

Essas ações entregam valor mesmo antes de concluir o lote de geocodificação.

### Prioridade 4 — refinar coordenadas

Criar processo controlado para:

- 1.099 clientes;
- endereço textual;
- Google Geocoding;
- validação;
- precisão;
- timestamps;
- fallback.

### Prioridade 5 — heatmap/3D

Somente depois do mapa principal estar perfeito.

---

## 24. Prompt de continuidade para o próximo programador/Codex

Você está assumindo um projeto existente de mapa de potenciais clientes.

Seu objetivo é evoluir o projeto atual, e não recomeçar a interface do zero.

### Contexto obrigatório

- O frontend deve continuar em `index.html`, `style.css` e `app.js`.
- O design atual é aprovado e deve ser preservado.
- O banco é Supabase.
- Schema: `mapa_clientes`.
- Tabela: `base_mapa`.
- Há 1.099 clientes únicos.
- As coordenadas atuais são majoritariamente/inteiramente fallback de sede municipal.
- Nunca invente dados.
- O endereço original da base é a fonte de verdade.
- O sistema é um levantamento técnico pontual, não uma plataforma de rotas.

### Sua missão

1. Melhorar a fluidez do mouse/drag/zoom.
2. Migrar o mapa-base para Google Maps JavaScript API se for usar Google Geocoding diretamente no mapa.
3. Preservar totalmente a UX atual.
4. Implementar `roadmap` e `hybrid/satellite`.
5. Usar AdvancedMarkerElement e markerclusterer.
6. Não usar Marker legado.
7. Implementar Ligar somente quando telefone existir.
8. Implementar Abrir no Google Maps construindo a busca pelo endereço textual e ignorando coordenada municipal.
9. Criar geocodificação pelo `endereco_busca`.
10. Validar país/UF/município antes de aceitar o resultado.
11. Guardar `place_id`, classificação de precisão e timestamps.
12. Respeitar política de caching/armazenamento do Google.
13. Manter fallback `APROX_SEDE_MUNICIPIO`.
14. Não criar offsets falsos para markers.
15. Em coordenadas idênticas, abrir lista de clientes.
16. Manter RLS do Supabase e não expor service_role.
17. Testar Chrome, Safari, desktop e mobile.
18. Não introduzir frameworks sem necessidade.

### Definição de pronto

O trabalho só está pronto quando:

- todos os 1.099 registros carregam;
- mapa arrasta sem sensação de atraso;
- filtros e busca continuam funcionando;
- satélite funciona;
- clicar cliente abre ficha correta;
- ação Ligar funciona somente quando válida;
- Abrir no Google Maps usa endereço;
- geocodificação melhor não altera dados de origem;
- erros de API têm fallback e mensagem adequada;
- mobile mantém safe areas;
- console não possui erros relevantes.

---

## 25. Fontes técnicas atuais

Fontes oficiais consultadas para esta documentação:

1. Google Maps Platform — Maps JavaScript API / Map Types  
   https://developers.google.com/maps/documentation/javascript/maptypes

2. Google Maps Platform — Geocoding Service / Maps JavaScript API  
   https://developers.google.com/maps/documentation/javascript/geocoding

3. Google Maps Platform — Get Started with Geocoding API  
   https://developers.google.com/maps/documentation/geocoding/guides-v3/start

4. Google Maps Platform — Geocoding API Policies  
   https://developers.google.com/maps/documentation/geocoding/policies

5. Google Maps Platform — Service Specific Terms  
   https://cloud.google.com/maps-platform/terms/maps-service-terms

6. Google Maps Platform — Maps URLs  
   https://developers.google.com/maps/documentation/urls/get-started

7. Google Maps Platform — Marker Clustering  
   https://developers.google.com/maps/documentation/javascript/marker-clustering

8. Google Maps Platform — Advanced Marker migration  
   https://developers.google.com/maps/documentation/javascript/advanced-markers/migration

9. Google Maps Platform — Heatmap/deprecations  
   https://developers.google.com/maps/documentation/javascript/heatmaplayer

10. Google Maps Platform — 3D Maps overview  
    https://developers.google.com/maps/documentation/javascript/3d/overview

11. Google Maps Platform — API Security Best Practices  
    https://developers.google.com/maps/api-security-best-practices

12. Supabase — Securing your API  
    https://supabase.com/docs/guides/api/securing-your-api

13. Supabase — Row Level Security  
    https://supabase.com/docs/guides/database/postgres/row-level-security

---

## 26. Inventário de entrega

O pacote de handoff deve conter:

```text
documentacao/
  DOCUMENTACAO_COMPLETA_MAPA_CLIENTES.docx
  DOCUMENTACAO_COMPLETA_MAPA_CLIENTES.md
  PROMPT_CONTINUIDADE_CODEX.md

projeto_atual/
  index.html
  style.css
  app.js

sql/
  atual/
    supabase_mapa_clientes_v2.sql
  historico/
    supabase_mapa_clientes_v1.sql
    supabase_corrigir_importacao_csv.sql
  proposto/
    sql_proposto_google_maps.sql

dados/
  potenciais_carcinicultura_padronizada.xlsx
  potenciais_carcinicultura_geolocalizada_aproximada.xlsx
```

---

## 27. Conclusão

O projeto atual atingiu o primeiro objetivo: existe um mapa funcional, visualmente aprovado, conectado ao Supabase e capaz de mostrar a concentração dos 1.099 clientes.

O próximo problema não é mais "construir um mapa". É **melhorar a precisão espacial e a experiência de interação**.

A evolução correta é preservar o produto visual e trocar a camada geoespacial de forma controlada.

Para a nova necessidade, Google Maps JavaScript API é adequado porque reúne:

- mapa fluido;
- imagem de satélite/híbrida;
- geocoding;
- markers;
- clustering;
- links diretos para Google Maps.

A precisão final continuará limitada pela qualidade do endereço original. Endereços sem número, rurais ou compartilhados podem continuar retornando a mesma posição. O sistema deve representar isso com honestidade, sem criar coordenadas artificiais.
