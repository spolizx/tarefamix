# Ativar busca de músicas no TarefaMix

A busca usa a YouTube Data API oficial. O player continua incorporado no TarefaMix; a pessoa escolhe um resultado, aperta reproduzir e pode iniciar o cronômetro na mesma página. O player do YouTube permanece visível.

## Configuração necessária

Um responsável deve:

1. Abrir o Google Cloud Console e criar ou escolher um projeto.
2. Ativar **YouTube Data API v3** em APIs e serviços > Biblioteca.
3. Criar uma chave em APIs e serviços > Credenciais > Criar credenciais > Chave de API.
4. Restringir a chave em **Restrições de aplicativo > Sites** para `https://spolizx.github.io/*`.
5. Em **Restrições de API**, permitir somente **YouTube Data API v3**.
6. Colar a chave entre as aspas simples de `youtube-config.js`, nesta linha:

   ```js
   window.TAREFAMIX_YOUTUBE_API_KEY = 'COLE_A_CHAVE_AQUI';
   ```

7. Publicar `youtube-config.js` com os outros arquivos do TarefaMix.

A chave aparece no navegador porque o TarefaMix é um site estático. As restrições de site e de API são necessárias para reduzir o uso indevido. Não coloque senhas, tokens secretos ou chaves de `service_role` nesse arquivo.

Sem a chave, as duas músicas adicionadas manualmente continuam disponíveis; o app informa que a busca ainda precisa ser configurada.
