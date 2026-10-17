// assistant-backend.js (DISABLED)
// This file previously routed the study assistant to a backend AI service.
// It has been stubbed to avoid external API calls — the app will use the built-in local assistant instead.

(function () {
  // If the page defines the local helper functions (answerStudyQuestion, addChatMessage),
  // use them. Otherwise expose a safe no-op.
  function safeAddChatMessage(text, who, videoQuery) {
    if (typeof addChatMessage === 'function') return addChatMessage(text, who, videoQuery);
    // fallback: try to append to #studyChat
    try {
      const chat = document.querySelector('#studyChat');
      if (!chat) return;
      const message = document.createElement('div');
      message.className = `chat-message ${who}`;
      message.textContent = text;
      chat.append(message);
      chat.scrollTop = chat.scrollHeight;
    } catch (_) {}
  }

  function localSend(question) {
    const text = String(question || '').trim();
    if (!text) return;
    safeAddChatMessage(text, 'user');

    try {
      const reply = (typeof answerStudyQuestion === 'function')
        ? answerStudyQuestion(text)
        : { text: 'Assistente local indisponível.' };
      window.setTimeout(() => safeAddChatMessage(reply && reply.text ? reply.text : String(reply), 'assistant', reply && reply.video ? reply.video : ''), 220);
    } catch (err) {
      safeAddChatMessage('Erro no assistente local.', 'assistant');
    }
  }

  if (typeof window !== 'undefined') {
    // Expose a safe stub that forces the app to use the built-in local assistant only.
    window.sendStudyQuestion = localSend;
  }
})();
