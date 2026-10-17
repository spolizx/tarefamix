# Fazer o cadastro do TarefaMix funcionar

O código do cadastro está preparado, mas ele precisa ser ligado a um projeto Supabase. Pense no Supabase como o serviço que guarda as contas e confere as senhas. Um responsável pode criar e configurar esse projeto com você.

## Primeiro: cadastro com e-mail e senha

1. Com um responsável, entre em [supabase.com](https://supabase.com/) e crie uma conta e um projeto. Guarde a senha da conta Supabase com o responsável.
2. No projeto, abra **Connect** ou **Project Settings > API Keys**. Copie o **Project URL** e a chave **Publishable** (em projetos antigos, ela pode aparecer como `anon`).
3. Abra o arquivo `auth-config.js` desta pasta. Cole o Project URL no lugar de `COLE_AQUI_O_PROJECT_URL` e a chave publicável no lugar de `COLE_AQUI_A_CHAVE_PUBLISHABLE`. Salve o arquivo.
4. No Supabase, entre em **Authentication > URL Configuration**. Em **Site URL**, coloque `https://spolizx.github.io/tarefamix/`. Adicione esse mesmo endereço em **Redirect URLs** e salve.
5. Publique juntos os arquivos do TarefaMix, incluindo `auth-config.js`, no GitHub Pages. Depois, teste criar uma conta e confirmar o e-mail.

Se os nomes dos menus estiverem diferentes, pare e peça ajuda ao responsável; o painel pode mudar. Não cole senhas aqui.

## Segurança

`auth-config.js` deve conter apenas o endereço do projeto e a chave **Publishable**. Nunca coloque no site nem envie para ninguém uma chave chamada `Secret`, `service_role`, senha do Supabase ou segredo do Google. A chave publicável foi feita para aparecer no navegador.

## Google pode ficar para depois

Entrar com Google exige criar credenciais adicionais no Google Cloud e configurá-las também no Supabase. Não é necessário para começar com e-mail e senha; podemos configurar isso numa segunda etapa.

## O que esta primeira versão faz

As pessoas podem criar conta, entrar e sair. As tarefas continuam guardadas no aparelho usado e não são sincronizadas com outros aparelhos ainda.
