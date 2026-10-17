(() => {
  const button = document.querySelector('#musicToggle');
  const select = document.querySelector('#musicType');
  const volume = document.querySelector('#musicVolume');
  const output = document.querySelector('#musicVolumeValue');
  const status = document.querySelector('#musicStatus');
  const youtubeButton = document.querySelector('#openYoutubeMusic');
  const youtubePlayer = document.querySelector('#youtubeMusicPlayer');
  if (!button || !select || !volume || !output || !status) return;

  let context;
  let master;
  let activeNodes = [];
  let playing = false;

  function stopNodes() {
    for (const node of activeNodes) {
      try { node.stop?.(); } catch (_) {}
      try { node.disconnect(); } catch (_) {}
    }
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

  function startSound() {
    stopNodes();
    if (select.value === 'tones') makeTones();
    else makeNoise();
  }

  function setVolume() {
    const percent = Number(volume.value);
    output.value = `${percent}%`;
    output.textContent = `${percent}%`;
    if (master && context) master.gain.setTargetAtTime(percent / 100, context.currentTime, 0.06);
  }

  button.addEventListener('click', async () => {
    if (playing) {
      stopNodes();
      playing = false;
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
      }
      setVolume();
      startSound();
      playing = true;
      button.textContent = '⏸ Pausar som';
      button.setAttribute('aria-pressed', 'true');
      status.textContent = `${select.options[select.selectedIndex].text} tocando. O som só começa quando você clicar.`;
    } catch (error) {
      status.textContent = error.message || 'Não foi possível iniciar o áudio.';
    }
  });

  select.addEventListener('change', () => {
    if (playing) {
      startSound();
      status.textContent = `${select.options[select.selectedIndex].text} tocando.`;
    }
  });
  volume.addEventListener('input', setVolume);
  const searchForm = document.querySelector('#youtubeMusicSearchForm');
  const searchInput = document.querySelector('#youtubeMusicSearch');
  const searchButton = document.querySelector('#youtubeMusicSearchButton');
  const searchStatus = document.querySelector('#youtubeMusicSearchStatus');
  const searchResults = document.querySelector('#youtubeMusicResults');
  const youtubeChoice = document.querySelector('#youtubeMusicChoice');

  function playYoutubeVideo(videoId, title) {
    if (!youtubePlayer) return;
    if (location.protocol === 'file:') {
      searchStatus.textContent = 'Abra o TarefaMix publicado para tocar músicas dentro do app junto com o cronômetro.';
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
    searchStatus.textContent = `Player pronto: ${title}. Aperte reproduzir e depois inicie o cronômetro.`;
  }

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
  setVolume();
})();
