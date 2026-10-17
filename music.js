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
  const youtubeChoice = document.querySelector('#youtubeMusicChoice');
  const youtubeFallback = document.querySelector('#youtubeMusicFallback');
  const selectedYoutubeUrl = () => `https://www.youtube.com/watch?v=${youtubeChoice.value}`;
  youtubeChoice?.addEventListener('change', () => {
    if (youtubeFallback) youtubeFallback.href = selectedYoutubeUrl();
  });
  if (youtubeFallback && youtubeChoice) youtubeFallback.href = selectedYoutubeUrl();
  youtubeButton?.addEventListener('click', () => {
    if (!youtubePlayer || !youtubeChoice) return;
    const track = youtubeChoice.options[youtubeChoice.selectedIndex];
    if (location.protocol === 'file:') {
      window.open(selectedYoutubeUrl(), '_blank', 'noopener,noreferrer');
      status.textContent = 'O player incorporado não funciona em arquivo local. Abrimos o vídeo no YouTube.';
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
    frame.src = `https://www.youtube-nocookie.com/embed/${track.value}?rel=0&modestbranding=1`;
    frame.title = track.dataset.title;
    youtubePlayer.hidden = false;
    youtubeButton.textContent = 'Trocar vídeo';
  });
  setVolume();
})();
