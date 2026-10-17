(function () {
  const ASSISTANT_URL = 'http://127.0.0.1:3001/api/assistant';

  function getChatBox() {
    return document.querySelector('#studyChat');
  }

  function getInput() {
    return document.querySelector('#subjectSearch');
  }

  function addChatMessage(text, who, videoQuery = '') {
    const chat = getChatBox();
    if (!chat) return;

    const message = document.createElement('div');
    message.className = `chat-message ${who}`;
    message.textContent = text;

    if (videoQuery) {
      const link = document.createElement('a');
      link.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${videoQuery} aula explicação`)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Procurar vídeos no YouTube ↗';
      message.append(document.createElement('br'), link);
    }

    chat.append(message);
    chat.scrollTop = chat.scrollHeight;
  }

  function fallbackLocalResponse(question) {
    if (typeof window.answerStudyQuestion === 'function') {
      const result = window.answerStudyQuestion(question);
      return {
        text: result && result.text ? result.text : String(result),
        video: result && result.video ? result.video : ''
      };
    }

    return {
      text: 'Não consegui acessar a IA do backend agora. Tente novamente em alguns instantes.',
      video: ''
    };
  }

  async function askBackend(question) {
    const response = await fetch(ASSISTANT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const answer = typeof data === 'string'
      ? data
      : (data.answer || data.message || data.output || '');

    if (!answer) {
      throw new Error('Resposta vazia do backend');
    }

    return {
      text: String(answer),
      video: ''
    };
  }

  async function sendStudyQuestion(question) {
    const text = String(question || '').trim();
    if (!text) return;

    addChatMessage(text, 'user');
    const input = getInput();
    if (input) input.value = '';

    let answer = { text: '...', video: '' };

    try {
      answer = await askBackend(text);
    } catch (error) {
      console.warn('Assistant backend unavailable, using local fallback:', error);
      answer = fallbackLocalResponse(text);
    }

    window.setTimeout(() => {
      addChatMessage(answer.text, 'assistant', answer.video || '');
    }, 220);
  }

  if (typeof window !== 'undefined') {
    window.sendStudyQuestion = sendStudyQuestion;
  }
})();
