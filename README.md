# Mapa de Potenciais Clientes MHS

Aplicacao web estatica para visualizar potenciais clientes em mapa interativo, com filtros, busca, fichas de clientes, camadas gratuitas de mapa e aba de relatorio BI.

## Projeto Atual

Abra a aplicacao em:

`02_PROJETO_ATUAL/index.html`

Para testar localmente com PowerShell:

```powershell
python -m http.server 8000
```

Depois acesse:

`http://localhost:8000/02_PROJETO_ATUAL/`

## Principais Recursos

- Mapa com Leaflet.
- Camadas `OSM`, `Vetor` e `Sat`.
- Clusters e modo calor.
- Busca por cliente, CNPJ, cidade, bairro e CEP.
- Filtros por UF, municipio e situacao.
- Fichas de clientes com acoes de ligar, abrir Maps e copiar dados.
- Distribuicao visual de pontos amontoados sem alterar coordenadas originais.
- Aba de relatorio com KPIs e graficos de concentracao.

## Estrutura

- `02_PROJETO_ATUAL/`: frontend ativo.
- `03_SQL/ATUAL/`: SQL principal do Supabase.
- `00_LEIA_PRIMEIRO/`: guias de continuidade e configuracao.
- `01_DOCUMENTACAO/`: documentacao em Markdown.

## Dados e Seguranca

As planilhas de dados e backups locais foram ignorados no Git por padrao em `.gitignore`.

O frontend usa chave anon/public do Supabase. Antes de publicar um repositorio publico, confirme que:

- RLS esta ativo.
- A role `anon` tem apenas as permissoes desejadas.
- Nenhuma chave `service_role` foi colocada no frontend.

## Operação de feira

Após executar a migração operacional no Supabase, a interface passa a oferecer
uma área restrita de manutenção para operadores autenticados. Ela permite
cadastrar um cliente, atualizar comunicação e confirmar um ponto no mapa com
histórico de cada ação.

O cadastro de campo começa pela marcação do ponto: a Edge Function autenticada
`reverse-geocode-ponto` consulta pontualmente o Nominatim/OpenStreetMap para sugerir
o endereço correspondente à coordenada. O operador confere os campos e só então salva.
Cadastros novos aparecem em laranja; registros atualizados em campo, em verde.

Em tela touch, arraste o ícone 📍 do canto da tela até o ponto para iniciar um
novo cadastro já associado àquela coordenada. Para reposicionar um cliente, arraste o marcador individual
e confirme a ação; cancelar restaura a posição anterior sem gravar alteração.

Siga o [guia de preparo da feira](00_LEIA_PRIMEIRO/GUIA_PREPARO_FEIRA_MANUTENCAO.md).
As configurações públicas ficam em `02_PROJETO_ATUAL/config.js`; credenciais
administrativas e chaves server-side permanecem apenas nos segredos do Supabase.
A fonte publicável da consulta de endereço está em
`supabase/functions/reverse-geocode-ponto/`; o guia de preparo traz a publicação
única da função.

## Publicacao

Use o roteiro em `SUBIR_GITHUB_POWERSHELL.md` ou o script `preparar_git.ps1`.
