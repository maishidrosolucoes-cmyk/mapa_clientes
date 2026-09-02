-- ============================================================
-- MAPA DE CLIENTES MHS - PRIMEIRO PERFIL DE MANUTENCAO
--
-- Execute SOMENTE depois de:
--   1. executar supabase_operacao_feira_v1.sql;
--   2. criar o usuario em Authentication > Users no Supabase;
--   3. substituir o e-mail abaixo pelo e-mail real desse usuario.
--
-- Este script nao cria senha e nao armazena API keys.
-- ============================================================

do $$
declare
    v_email text := lower(trim('COLE_AQUI_O_EMAIL_DO_USUARIO'));
    v_nome text := 'Manutencao MHS';
    v_usuario_id uuid;
begin
    if v_email = 'cole_aqui_o_email_do_usuario' or position('@' in v_email) = 0 then
        raise exception 'Substitua COLE_AQUI_O_EMAIL_DO_USUARIO antes de executar.';
    end if;

    select id
      into v_usuario_id
      from auth.users
     where lower(email) = v_email
     limit 1;

    if v_usuario_id is null then
        raise exception 'Usuario % nao encontrado em Authentication > Users.', v_email;
    end if;

    insert into mapa_clientes.operadores (
        usuario_id,
        nome,
        papel,
        ativo,
        criado_por
    ) values (
        v_usuario_id,
        v_nome,
        'MANUTENCAO',
        true,
        v_usuario_id
    )
    on conflict (usuario_id) do update
       set nome = excluded.nome,
           papel = 'MANUTENCAO',
           ativo = true,
           atualizado_em = now();

    raise notice 'Perfil MANUTENCAO configurado para %.', v_email;
end;
$$;

select
    o.nome,
    u.email,
    o.papel,
    o.ativo,
    o.atualizado_em
from mapa_clientes.operadores o
join auth.users u on u.id = o.usuario_id
where o.papel = 'MANUTENCAO'
order by o.atualizado_em desc;
