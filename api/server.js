const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { docs } = require('./local-corpus');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const USE_SUPABASE_VECTOR = process.env.USE_SUPABASE_VECTOR === 'true';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function normalize(text = '') {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function localHeuristicAnswer(question) {
  const q = normalize(question);

  if (!q) return { source: 'local', answer: 'Posso ajudar com estudos, tarefas, matemática, foco, música e uso do TarefaMix. Tente uma pergunta específica.' };

  const fraction = /fra[cç][aã]o|fracoes|fractions/.test(q);
  if (fraction) {
    return { source: 'local', answer: 'Para somar frações com denominadores iguais, some os numeradores e mantenha o denominador. Exemplo: 2/7 + 3/7 = 5/7. Se os denominadores forem diferentes, primeiro encontre o menor múltiplo comum.' };
  }

  const photo = /fotossintese|fotossíntese|photosynthesis/.test(q);
  if (photo) {
    return { source: 'local', answer: 'Fotossíntese é o processo pelo qual plantas usam luz do Sol, água e gás carbônico para produzir glicose e liberar oxigênio.' };
  }

  const percent = q.match(/(\d+(?:[.,]\d+)?)\s*%\s*(?:de|do|da)?\s*(\d+(?:[.,]\d+)?)/);
  if (percent) {
    const value = Number((percent[1] || '0').replace(',', '.'));
    const total = Number((percent[2] || '0').replace(',', '.'));
    return { source: 'local', answer: `Cálculo aproximado: ${value}% de ${total} é ${(value * total / 100).toFixed(2).replace('.', ',')}.` };
  }

  const math = q.match(/(\d+)\s*[+\-*/]\s*(\d+)/);
  if (math) {
    const a = Number(math[1]);
    const b = Number(math[2]);
    const op = String(question.match(/[+\-*/]/)?.[0] || '+');
    let result = 0;
    if (op === '+') result = a + b;
    if (op === '-') result = a - b;
    if (op === '*') result = a * b;
    if (op === '/') result = a / b;
    return { source: 'local', answer: `${a} ${op} ${b} = ${result}.` };
  }

  if (/tarefa|planner|organizador|tarefas/.test(q)) {
    return { source: 'local', answer: 'O TarefaMix é um organizador de tarefas e estudo. Ele inclui planner, notas, lembretes, foco, calendário, músicas e jogos educativos para estudo e produtividade.' };
  }

  if (/música|music|audio|som/.test(q)) {
    return { source: 'local', answer: 'O sistema de música do TarefaMix oferece sons em WebAudio, upload de arquivos locais, fila de reprodução, playlist .m3u e um modo sem anúncios que ignora YouTube quando ativado.' };
  }

  if (/game|jogo|math|matematica|educational/.test(q)) {
    return { source: 'local', answer: 'A página de jogos do TarefaMix inclui exercícios de matemática com adição, subtração, multiplicação, divisão e modo misto, com pontuação salva no navegador.' };
  }

  return null;
}

function scoreChunk(chunk, question) {
  const qTerms = new Set(normalize(question).split(' ').filter(Boolean));
  const cText = normalize(chunk.content);
  let score = 0;
  for (const term of qTerms) {
    if (term.length < 3) continue;
    if (cText.includes(term)) score += 2;
  }
  return score;
}

function retrieveRelevantDocs(question) {
  const q = normalize(question);
  if (!q) return docs.slice(0, 3);
  return docs
    .map(doc => ({ ...doc, score: scoreChunk(doc, q) }))
    .sort((a, b) => b.score - a.score)
    .filter(doc => doc.score > 0 || doc.title.toLowerCase().includes(q.slice(0, 5)))
    .slice(0, 3);
}

async function askOpenAI(question, contextDocs) {
  if (!OPENAI_API_KEY) {
    return { source: 'local', answer: 'Como a chave da API OpenAI não foi configurada, o backend retornou uma resposta local. Configure OPENAI_API_KEY no .env para ativar a IA avançada.' };
  }

  const systemPrompt = 'Você é um assistente de estudos para o TarefaMix. Responda em português. Use somente o contexto fornecido, e se ele não for suficiente, diga claramente que não encontrou informação suficiente. Seja breve, útil e didático.';
  const userPrompt = `Contexto:\n${contextDocs.map(doc => `- ${doc.title}: ${doc.content}`).join('\n')}\n\nPergunta do usuário: ${question}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI request failed: ${err}`);
  }

  const json = await response.json();
  const answer = json?.choices?.[0]?.message?.content || 'Não foi possível gerar uma resposta agora.';
  return { source: 'openai', answer, context: contextDocs.map(doc => ({ id: doc.id, title: doc.title })) };
}

async function maybeSupabaseLookup(question) {
  if (!USE_SUPABASE_VECTOR || !SUPABASE_URL || !SUPABASE_KEY) return null;

  const url = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/rag-search`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY
      },
      body: JSON.stringify({ question })
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (_) {
    return null;
  }
}

app.get('/api/health', (_, res) => {
  res.json({ ok: true, service: 'tarefamix-ai', model: OPENAI_MODEL || 'local-fallback' });
});

app.post('/api/assistant', async (req, res) => {
  const question = String(req.body?.question || '').trim();
  if (!question) {
    return res.status(400).json({ error: 'Pergunta vazia.' });
  }

  try {
    const local = localHeuristicAnswer(question);
    if (local) {
      return res.json({
        answer: local.answer,
        source: local.source,
        context: retrieveRelevantDocs(question),
        mode: 'local-rules'
      });
    }

    const supabaseContext = await maybeSupabaseLookup(question);
    const retrieval = supabaseContext?.results?.length ? supabaseContext.results : retrieveRelevantDocs(question);

    const answer = await askOpenAI(question, retrieval);
    return res.json({
      answer: answer.answer,
      source: answer.source,
      context: retrieval,
      mode: 'rag'
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Não foi possível responder agora.',
      fallback: localHeuristicAnswer(question)?.answer || 'Tente uma pergunta mais específica.'
    });
  }
});

app.post('/api/index-docs', async (_, res) => {
  return res.json({
    ok: true,
    docs: docs.map(doc => ({ id: doc.id, title: doc.title })),
    message: 'Documentos locais carregados. Configure Supabase/Vector DB para um RAG completo no ambiente real.'
  });
});

app.listen(PORT, () => {
  console.log(`TarefaMix AI backend listening on http://localhost:${PORT}`);
});
