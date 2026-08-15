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

## Publicacao

Use o roteiro em `SUBIR_GITHUB_POWERSHELL.md` ou o script `preparar_git.ps1`.

