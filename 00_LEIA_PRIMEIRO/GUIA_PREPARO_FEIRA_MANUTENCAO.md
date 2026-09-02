# Preparo do banco e perfil de manutenção — Feira

Este roteiro prepara o banco sem apagar ou sobrescrever os 1.099 clientes atuais.

## 1. Fazer backup antes da migração

No Supabase, confirme que existe um backup recente ou exporte a tabela:

`mapa_clientes.base_mapa`

A migração é aditiva, mas o backup continua obrigatório antes de qualquer mudança
estrutural em produção.

## 2. Executar a migração operacional

Abra `SQL Editor` no Supabase e execute integralmente:

`03_SQL/ATUAL/supabase_operacao_feira_v1.sql`

O resultado da primeira consulta de validação deve manter o total atual de 1.099
clientes e apresentar 1.099 UUIDs preenchidos.

A migração:

- mantém todos os campos importados;
- mantém `latitude` e `longitude` municipais intactas;
- cria `latitude_confirmada` e `longitude_confirmada` numéricas;
- permite novo cliente sem CNPJ;
- cria histórico de cadastro, atualização e reposicionamento;
- cria RPCs seguras para o frontend;
- não concede escrita direta para `anon` ou `authenticated`.

## 3. Criar o usuário de manutenção

Em `Authentication > Users`, crie ou convide o usuário que fará a manutenção.

Depois abra:

`03_SQL/ATUAL/configurar_perfil_manutencao.sql`

Substitua:

`COLE_AQUI_O_EMAIL_DO_USUARIO`

pelo e-mail exato criado no Supabase Auth e execute o arquivo. O perfil será
registrado como `MANUTENCAO`.

## 4. Configuração pública do frontend

As configurações que podem ficar no navegador estão em:

`02_PROJETO_ATUAL/config.js`

Campos disponíveis:

- `SUPABASE_URL`: URL pública do projeto;
- `SUPABASE_PUBLISHABLE_KEY`: chave publishable ou anon;
- `SUPABASE_SCHEMA`: deve continuar `mapa_clientes`;
- `SUPABASE_TABLE`: permanece `base_mapa` nesta etapa;
- `REVERSE_GEOCODING_FUNCTION`: nome da função que sugere o endereço a partir do ponto;
- `GOOGLE_MAPS_BROWSER_KEY`: alternativa opcional para desenvolvimento no navegador;
- `GOOGLE_MAPS_MAP_ID`: Map ID público, quando utilizado.

O endereço automático de campo usa a Edge Function `reverse-geocode-ponto` por
padrão. Ela consulta o Nominatim/OpenStreetMap apenas quando o operador confirma
um ponto novo; não há chave paga no televisor. O cadastro e a confirmação do ponto
continuam funcionando se o serviço de endereço estiver indisponível; nesse caso, o
operador confere e preenche os campos manualmente.

## 5. Segredos que nunca entram no frontend

Não coloque em `config.js`, `app.js`, HTML ou Git:

- `SUPABASE_SERVICE_ROLE_KEY`;
- secret key do Supabase;
- senha do PostgreSQL;
- tokens de acesso pessoais.

Esses valores só são necessários para testes locais. No ambiente hospedado, o
Supabase fornece à Edge Function as variáveis internas de que ela precisa.

## 6. Publicar a consulta automática de endereço gratuita

Execute antes o SQL complementar, no SQL Editor do Supabase:

`03_SQL/ATUAL/supabase_geocodificacao_reversa_nominatim_v1.sql`

Ele cria somente o cache de endereços e o limitador global. Não altera clientes.
O limitador respeita uma consulta externa por vez, com intervalo mínimo de 1,1 s;
isso atende ao uso pontual da feira e evita repetir uma consulta para o mesmo ponto.

O código publicável já está na estrutura padrão do Supabase:

`supabase/functions/reverse-geocode-ponto/index.ts`

No PowerShell, na raiz deste projeto, execute uma única vez:

```powershell
npx --yes supabase@latest login
npx --yes supabase@latest functions deploy reverse-geocode-ponto --project-ref pwmgbaxywvyyfmlkygqr
```

Ao fazer login, a CLI abrirá o fluxo seguro do Supabase. Não cole o token de acesso
em arquivo algum do projeto. Esta solução não requer chave Google, billing ou novo
segredo no Supabase.

Alternativa pelo Dashboard: abra `Edge Functions`, crie a função com o nome exato
`reverse-geocode-ponto`, cole o conteúdo do arquivo acima, mantenha a verificação
JWT legado desligada e publique. A função valida a sessão e o perfil de operador no
próprio código. Use sempre o trecho final exibido na URL `/functions/v1/...` como
valor de `REVERSE_GEOCODING_FUNCTION` em `config.js`; o nome visual da tela pode ser
diferente do slug da URL.

Regra de uso: dispare a consulta somente ao soltar/confirmar o 📍, nunca durante
arraste, busca ou carregamento de todos os clientes. O cartão do ponto exibe a
atribuição OpenStreetMap/Nominatim e o endereço é sempre uma sugestão para revisão.
São enviados ao serviço externo somente latitude e longitude; não envie dados pessoais
do cliente. A política pública exige cache, atribuição e no máximo uma consulta por
segundo: https://operations.osmfoundation.org/policies/nominatim/

Para teste local, existe apenas este modelo vazio:

`supabase/functions/example.env`

Depois da publicação, mantenha em `02_PROJETO_ATUAL/config.js`:

```js
REVERSE_GEOCODING_FUNCTION: "reverse-geocode-ponto"
```

Não preencha `GOOGLE_MAPS_BROWSER_KEY` para a operação normal. Ele existe somente
como alternativa de desenvolvimento e, se usado, deve ter restrição por domínio e
pela Maps JavaScript API.

## 7. Ordem das próximas etapas

Depois que a validação SQL retornar 1.099 clientes:

1. criar o usuário e aplicar o perfil de manutenção;
2. entrar na área de manutenção e testar o fluxo de marcar ponto, revisar endereço e cadastrar;
3. testar edição de comunicação e reposicionamento de um registro de teste;
4. conferir a atividade recente e as cores de novo cadastro/registro atualizado;
5. remover leitura anônima quando o login estiver validado em produção.

## 8. Regra de localização

O mapa usará a seguinte prioridade:

1. `latitude_confirmada` e `longitude_confirmada`, quando existirem;
2. coordenadas originais/importadas como fallback.

Reposicionar um cliente nunca altera a coordenada municipal original.

## 9. Gestos para operação em tela touch

Com um operador de edição autenticado:

1. arraste o ícone 📍 que fica no canto do mapa até o local do novo cliente e solte;
2. aguarde a sugestão automática de endereço, confira os dados e salve;
3. arraste um marcador individual existente para o novo local;
4. escolha **Sim, reposicionar** para gravar, ou **Não, voltar** para restaurar o ponto anterior sem alteração no banco.

Marcadores dentro de um agrupamento precisam ser aproximados/abertos antes do arraste.
