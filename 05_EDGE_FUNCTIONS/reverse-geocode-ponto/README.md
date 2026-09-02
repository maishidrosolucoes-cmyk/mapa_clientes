# Reverse geocode de campo

A fonte publicavel da Edge Function foi padronizada em:

`supabase/functions/reverse-geocode-ponto/index.ts`

Use o roteiro em `00_LEIA_PRIMEIRO/GUIA_PREPARO_FEIRA_MANUTENCAO.md` para executar
o SQL de cache e publicar a funcao. Esta versao consulta Nominatim/OpenStreetMap
apenas quando um operador confirma um ponto e nao exige chave ou billing Google.
