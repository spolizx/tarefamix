# TarefaMix — ui-enhancements

Esta branch (ui-enhancements) contém a versão premium local do TarefaMix: interface polida, assistente local, timer e persistência em localStorage.

O que inclui:

- index.html (UI atualizada)
- styles/ui-enhancements.css (tema profissional)
- scripts/ui-enhancements.js (comportamento local, export CSV/JSON)
- assets/logo.svg e assets/hero.svg (placeholders SVG)

Como testar localmente:

1. Faça checkout da branch ui-enhancements:

   git fetch origin
   git checkout ui-enhancements

2. Sirva os arquivos estáticos (a partir da raiz do projeto):

   python -m http.server 8000

   ou

   npx serve .

3. Abra http://localhost:8000/index.html no navegador.

Export / backup:

- "Exportar CSV" gera um arquivo CSV com as tarefas.
- "Backup (JSON)" exporta um backup completo (tarefas + notas) em JSON.

Publicar no GitHub Pages (opcional):

1. Vá para o repositório no GitHub → Settings → Pages.
2. Selecione a branch `ui-enhancements` e a pasta `/ (root)` ou a branch `gh-pages` se preferir.
3. Salve e aguarde a publicação.

Observações de privacidade:

- Tudo é salvo localmente no navegador (localStorage). Nenhum dado é enviado a servidores externos.

Próximos passos que posso executar se você confirmar:

- Substituir os SVGs por ilustrações reais (posso adicionar imagens gratuitas). 
- Separar a aplicação em páginas (tarefas / estudos / configurações).
- Adicionar botão de import (restaurar backup JSON) e importar CSV.
- Criar um workflow para publicar automaticamente no GitHub Pages.
