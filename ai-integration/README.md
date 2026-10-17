# Front-end AI integration for TarefaMix

This file adds a small, non-intrusive AI widget that calls the local backend at `http://localhost:3001/api/assistant`.

I did not modify `index.html` directly to avoid accidental edits of the large single-file app. Instead, paste the snippet below near the end of the `<body>` in `index.html` (just before `</body>`). That will add a small UI and the JavaScript to call the backend. It works with or without an OpenAI API key because the backend already supports a local fallback.

---

Copy and paste this exact block into `index.html` before the closing `</body>` tag:

```html
<!-- AI widget: paste before </body> -->
<div id="ai-widget" style="max-width:720px;margin:18px auto;padding:12px;border:1px solid #e8ece8;border-radius:10px;background:#fff">
  <label for="ai-question" style="font-weight:700;display:block;margin-bottom:8px">Assistente (perguntas rápidas)</label>
  <textarea id="ai-question" rows="3" style="width:100%;padding:10px;border:1px solid #e8ece8;border-radius:8px;font:14px/1.4 Arial,sans-serif" placeholder="Pergunte algo ao assistente..."></textarea>
  <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
    <button id="ai-send" style="padding:8px 12px;border-radius:8px;border:0;background:#347a58;color:white;font-weight:700;cursor:pointer">Perguntar</button>
    <span id="ai-status" style="color:#666;font-size:13px"></span>
  </div>
  <div id="ai-answer" style="margin-top:12px;white-space:pre-wrap;color:#111"></div>
</div>

<script>
(function(){
  async function askTarefaMix(question) {
    const url = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:3001/api/assistant'
      : '/api/assistant';

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error('API error ' + res.status + ': ' + txt);
      }
      return await res.json();
    } catch (err) {
      // propagate error to caller
      throw err;
    }
  }

  const sendBtn = document.getElementById('ai-send');
  const qEl = document.getElementById('ai-question');
  const statusEl = document.getElementById('ai-status');
  const answerEl = document.getElementById('ai-answer');

  sendBtn.addEventListener('click', async () => {
    const question = qEl.value && qEl.value.trim();
    if (!question) return;
    statusEl.textContent = 'Enviando...';
    answerEl.textContent = '';

    try {
      const data = await askTarefaMix(question);
      // backend returns `answer` or `answer.text` depending on implementation
      const text = data.answer || data.text || (data.result && data.result.answer) || JSON.stringify(data);
      answerEl.textContent = text;
      statusEl.textContent = data.source ? 'Fonte: ' + data.source : '';
    } catch (err) {
      statusEl.textContent = '';
      answerEl.textContent = 'Erro ao chamar a API local: ' + err.message + '\n\nVou tentar a resposta local...';

      // fallback: try a minimal local response based on simple rules (best-effort)
      try {
        // simple local fallback: use the existing study input code if available
        if (typeof answerStudyQuestion === 'function') {
          const reply = answerStudyQuestion(question);
          answerEl.textContent = reply && (reply.text || reply) || 'Sem resposta local.';
        } else {
          answerEl.textContent += '\n(Resposta local não disponível neste contexto)';
        }
      } catch (e) {
        answerEl.textContent += '\n(Falha no fallback local)';
      }
    }
  });
})();
</script>
```

---

How I committed this
- I added this file to branch `ai-rag-assistant` at `ai-integration/README.md` with the snippet and instructions.

Next steps I can do for you
- If you want, I can directly edit `index.html` in the `ai-rag-assistant` branch and insert the snippet for you. Reply "commit to index.html" and I'll update the file in the same branch.
- Or you can paste the snippet manually into `index.html` as instructed above.

Safety note
- Do not add your OpenAI key to the repository. Add it to `.env` locally and restart the backend to enable RAG.
