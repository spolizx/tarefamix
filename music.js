(() => {
  const button = document.querySelector('#musicToggle');
  const select = document.querySelector('#musicType');
  const volume = document.querySelector('#musicVolume');
  const output = document.querySelector('#musicVolumeValue');
  const status = document.querySelector('#musicStatus');
  const youtubeButton = document.querySelector('#openYoutubeMusic');
  const youtubePlayer = document.querySelector('#youtubeMusicPlayer');
  if (!button || !select || !volume || !output || !status) return;

  const storage = {
    getItem(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    setItem(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
    removeItem(k) { try { localStorage.removeItem(k); } catch (_) {} }
  };

  let context;
  let master;
  let activeNodes = [];
  let playing = false; // logical playing state (user requested play)
  let pausedByVisibility = false;

  // Load saved settings
  try { const savedVol = storage.getItem('tm-music-volume'); if (savedVol !== null) volume.value = savedVol; } catch (_) {}
  try { const savedType = storage.getItem('tm-music-type'); if (savedType !== null) select.value = savedType; } catch (_) {}

  function safeStop(node) {
    try { if (typeof node.stop === 'function') node.stop(); } catch (_) {}
    try { if (typeof node.disconnect === 'function') node.disconnect(); } catch (_) {}
  }
  function stopNodes() {
    for (const node of activeNodes) safeStop(node);
    activeNodes = [];
  }

  function makeNoise() {
    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.025 * white) / 1.025;
      data[i] = last * 3.5;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = select.value === 'white' ? 4200 : 950;
    const gain = context.createGain();
    gain.gain.value = select.value === 'white' ? 0.16 : 0.48;
    source.connect(filter).connect(gain).connect(master);
    source.start();
    activeNodes.push(source, filter, gain);
  }

  function makeTones() {
    const notes = [196, 246.94, 293.66];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.13 : 0.08;
      oscillator.connect(gain).connect(master);
      oscillator.start();
      activeNodes.push(oscillator, gain);
    });
  }

  // Start new sound generation but keep transitions smooth (fade out old, fade in new)
  async function startSound() {
    // ensure context & master exist
    if (!context) return;
    if (!master) {
      master = context.createGain();
      master.gain.value = Number(volume.value) / 100;
      master.connect(context.destination);
    }

    const now = context.currentTime;
    try {
      // fade out quickly
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.08);
    } catch (_) {}

    // stop existing nodes after a short delay to allow fade
    setTimeout(() => stopNodes(), 120);

    // give a tiny time for old to fade
    await new Promise(r => setTimeout(r, 140));

    if (select.value === 'tones') makeTones(); else makeNoise();

    // fade in to target
    const target = Number(volume.value) / 100;
    const after = context.currentTime;
    master.gain.cancelScheduledValues(after);
    master.gain.setValueAtTime(0, after);
    master.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, target)), after + 0.12);
  }

  function setVolume() {
    const percent = Number(volume.value);
    output.value = `${percent}%`;
    output.textContent = `${percent}%`;
    storage.setItem('tm-music-volume', String(percent));
    if (master && context) {
      const now = context.currentTime;
      try {
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, percent / 100)), now + 0.08);
      } catch (_) {}
    }
  }

  // Ducking helper: temporarily lower volume when an app notification appears
  let duckTimeout = null;
  function duckTemporary(amount = 0.25, duration = 4000) {
    if (!master || !context) return;
    const now = context.currentTime;
    const current = master.gain.value ?? (Number(volume.value) / 100);
    const target = Math.max(0, Math.min(current * amount, 1));
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(current, now);
    master.gain.linearRampToValueAtTime(target, now + 0.05);
    if (duckTimeout) clearTimeout(duckTimeout);
    duckTimeout = setTimeout(() => {
      const then = context.currentTime;
      master.gain.cancelScheduledValues(then);
      master.gain.setValueAtTime(master.gain.value, then);
      master.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, Number(volume.value) / 100)), then + 0.12);
      duckTimeout = null;
    }, duration);
  }

  // Play / pause
  button.addEventListener('click', async () => {
    if (playing) {
      stopNodes();
      playing = false;
      storage.setItem('tm-music-playing', 'false');
      button.textContent = '▶ Tocar som';
      button.setAttribute('aria-pressed', 'false');
      status.textContent = 'Som pausado.';
      return;
    }
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Áudio não disponível neste navegador.');
      context ||= new AudioContextClass();
      await context.resume();
      if (!master) {
        master = context.createGain();
        master.connect(context.destination);
        master.gain.value = Number(volume.value) / 100;
      }
      setVolume();
      await startSound();
      playing = true;
      storage.setItem('tm-music-playing', 'true');
      storage.setItem('tm-music-type', select.value);
      button.textContent = '⏸ Pausar som';
      button.setAttribute('aria-pressed', 'true');
      status.textContent = `${select.options[select.selectedIndex].text} tocando. O som só começa quando você clicar.`;
    } catch (error) {
      status.textContent = error?.message || 'Não foi possível iniciar o áudio.';
    }
  });

  select.addEventListener('change', async () => {
    storage.setItem('tm-music-type', select.value);
    if (playing) {
      await startSound();
      status.textContent = `${select.options[select.selectedIndex].text} tocando.`;
    }
  });
  volume.addEventListener('input', setVolume);

  // Keyboard shortcut: Space toggles play/pause when focus not on inputs
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      e.preventDefault(); button.click();
    }
  });

  // Pause when page hidden to save CPU/battery; resume if user had music playing
  document.addEventListener('visibilitychange', async () => {
    if (document.hidden) {
      if (playing) {
        // stop nodes but remember we were playing
        pausedByVisibility = true;
        stopNodes();
      }
    } else {
      if (pausedByVisibility) {
        pausedByVisibility = false;
        if (playing) {
          try { if (context && context.state === 'suspended') await context.resume(); } catch (_) {}
          await startSound();
        }
      }
    }
  });

  // Duck when reminder toast shows (integrates with existing UI): observe class changes
  const reminderToast = document.querySelector('#reminderToast');
  if (reminderToast) {
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.attributeName === 'class') {
          const has = reminderToast.classList.contains('show');
          if (has) duckTemporary(0.25, 4000);
        }
      }
    });
    mo.observe(reminderToast, { attributes: true });
  }

  // Better YouTube handling: persist last chosen track id; save when user opens
  const youtubeChoice = document.querySelector('#youtubeMusicChoice');
  try {
    const saved = storage.getItem('tm-youtube-last');
    if (saved && youtubeChoice) {
      // try to select option with that value
      const opt = [...youtubeChoice.options].find(o => o.value === saved);
      if (opt) youtubeChoice.value = saved;
    }
  } catch (_) {}

  function playYoutubeVideo(videoId, title) {
    if (!youtubePlayer) return;
    if (location.protocol === 'file:') {
      status.textContent = 'Abra o TarefaMix publicado para tocar músicas dentro do app junto com o cronômetro.';
      return;
    }
    let frame = youtubePlayer.querySelector('iframe');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.loading = 'lazy';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      frame.allowFullscreen = true;
      youtubePlayer.append(frame);
    }
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1`;
    frame.title = title;
    youtubePlayer.hidden = false;
    youtubeButton.textContent = 'Trocar vídeo';
    storage.setItem('tm-youtube-last', videoId);
    status.textContent = `Player pronto: ${title}. Aperte reproduzir e depois inicie o cronômetro.`;
  }

  // Wrap original search handling but keep behavior; persist last search selection when user chooses
  const searchForm = document.querySelector('#youtubeMusicSearchForm');
  const searchInput = document.querySelector('#youtubeMusicSearch');
  const searchButton = document.querySelector('#youtubeMusicSearchButton');
  const searchStatus = document.querySelector('#youtubeMusicSearchStatus');
  const searchResults = document.querySelector('#youtubeMusicResults');

  searchForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const query = searchInput.value.trim();
    const apiKey = window.TAREFAMIX_YOUTUBE_API_KEY?.trim();
    if (!query) return;
    if (location.protocol === 'file:') {
      searchStatus.textContent = 'A busca de músicas funciona no site publicado, não neste arquivo local.';
      return;
    }
    if (!apiKey) {
      searchStatus.textContent = 'A busca ainda precisa da chave da API do YouTube. As músicas da lista abaixo continuam disponíveis.';
      return;
    }
    searchButton.disabled = true;
    searchResults.replaceChildren();
    searchStatus.textContent = 'Procurando músicas...';
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.search = new URLSearchParams({
        part: 'snippet', type: 'video', videoEmbeddable: 'true', safeSearch: 'strict',
        maxResults: '8', q: query, key: apiKey
      });
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Não consegui pesquisar agora.');
      const videos = (data.items || []).filter(item => item.id?.videoId && item.snippet?.title);
      if (!videos.length) {
        searchStatus.textContent = 'Não encontrei resultados que possam tocar dentro do TarefaMix. Tente outra busca.';
        return;
      }
      videos.forEach(item => {
        const result = document.createElement('button');
        result.type = 'button';
        result.className = 'youtube-result';
        result.textContent = `${item.snippet.title} · ${item.snippet.channelTitle}`;
        result.addEventListener('click', () => playYoutubeVideo(item.id.videoId, item.snippet.title));
        searchResults.append(result);
      });
      searchStatus.textContent = `Encontrei ${videos.length} opções. Escolha uma para tocar no player, sem sair do app.`;
    } catch (error) {
      searchStatus.textContent = `A busca não funcionou: ${error.message}`;
    } finally {
      searchButton.disabled = false;
    }
  });

  youtubeButton?.addEventListener('click', () => {
    if (!youtubePlayer || !youtubeChoice) return;
    const track = youtubeChoice.options[youtubeChoice.selectedIndex];
    playYoutubeVideo(track.value, track.dataset.title);
  });

  // Init UI with saved values
  setVolume();
})();
