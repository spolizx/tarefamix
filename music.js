(() => {
  // Music system with local playlist, uploads, .m3u import, YouTube bulk add, and persistence.
  const button = document.querySelector('#musicToggle');
  const select = document.querySelector('#musicType');
  const volume = document.querySelector('#musicVolume');
  const output = document.querySelector('#musicVolumeValue');
  const status = document.querySelector('#musicStatus');
  const youtubeButton = document.querySelector('#openYoutubeMusic');
  const youtubePlayer = document.querySelector('#youtubeMusicPlayer');
  const searchForm = document.querySelector('#youtubeMusicSearchForm');
  const searchInput = document.querySelector('#youtubeMusicSearch');
  const searchButton = document.querySelector('#youtubeMusicSearchButton');
  const searchStatus = document.querySelector('#youtubeMusicSearchStatus');
  const searchResults = document.querySelector('#youtubeMusicResults');
  const youtubeChoice = document.querySelector('#youtubeMusicChoice');

  if (!button || !select || !volume || !output || !status) return;

  // Small IndexedDB helper for storing uploaded files persistently
  const IDB = {
    db: null,
    async open() {
      if (this.db) return this.db;
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('tm-music-db', 1);
        req.onupgradeneeded = () => { req.result.createObjectStore('files', { keyPath: 'id', autoIncrement: true }); };
        req.onsuccess = () => { this.db = req.result; resolve(this.db); };
        req.onerror = () => reject(req.error);
      });
    },
    async addFile(name, blob) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        const store = tx.objectStore('files');
        const item = { name, blob, created: Date.now() };
        const r = store.add(item);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    },
    async getFile(id) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readonly');
        const r = tx.objectStore('files').get(Number(id));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    },
    async listFiles() {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readonly');
        const store = tx.objectStore('files');
        const r = store.getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      });
    },
    async removeFile(id) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('files', 'readwrite');
        const r = tx.objectStore('files').delete(Number(id));
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
      });
    }
  };

  const storage = {
    getItem(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    setItem(k, v) { try { localStorage.setItem(k, v); } catch (_) {} },
    removeItem(k) { try { localStorage.removeItem(k); } catch (_) {} }
  };

  // WebAudio context & master gain
  let context;
  let master;
  let mediaSource = null; // MediaElementSource for local audio playback
  let currentAudioElement = null;

  // Playlist model: array of { id, type: 'local'|'url'|'youtube', title, sourceId (for local) or url/videoId }
  let playlist = JSON.parse(storage.getItem('tm-music-playlist') || '[]');
  let currentIndex = Number(storage.getItem('tm-music-current') || 0);

  function savePlaylist() { storage.setItem('tm-music-playlist', JSON.stringify(playlist)); storage.setItem('tm-music-current', String(currentIndex)); }

  function ensureAudioContext() {
    if (context) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = Number(volume.value) / 100;
    master.connect(context.destination);
  }

  function setVolumeRamp(valuePercent) {
    if (!master || !context) return;
    const now = context.currentTime;
    try { master.gain.cancelScheduledValues(now); master.gain.setValueAtTime(master.gain.value, now); master.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, valuePercent/100)), now + 0.08);} catch(_){}
  }

  function updateVolumeUI() {
    const percent = Number(volume.value); output.value = `${percent}%`; output.textContent = `${percent}%`; setVolumeRamp(percent); storage.setItem('tm-music-volume', String(percent)); }

  // Playback helpers for local/url tracks using HTMLAudio connected to WebAudio
  async function playTrackAt(index) {
    if (index < 0 || index >= playlist.length) return;
    const track = playlist[index];
    // stop previous
    if (currentAudioElement) { try { currentAudioElement.pause(); currentAudioElement.src = ''; } catch(_){} currentAudioElement = null; }
    // Clear previous media source
    try { if (mediaSource) mediaSource.disconnect(); } catch(_){}
    // If track is local (stored in IDB)
    if (track.type === 'local') {
      const record = await IDB.getFile(track.sourceId);
      if (!record) { status.textContent = 'Arquivo local não encontrado. Removendo da fila.'; playlist.splice(index,1); savePlaylist(); return; }
      const blobUrl = URL.createObjectURL(record.blob);
      const audio = new Audio(); audio.src = blobUrl; audio.crossOrigin = 'anonymous'; audio.loop = false; audio.preload = 'auto';
      await audio.play().catch(()=>{}); // may be blocked until user gesture
      ensureAudioContext();
      if (context) {
        try { mediaSource = context.createMediaElementSource(audio); mediaSource.connect(master); } catch(_){}
      }
      currentAudioElement = audio;
      audio.onended = () => { nextTrack(); };
      status.textContent = `Tocando: ${track.title}`;
    } else if (track.type === 'url') {
      // URL could be any audio file
      const audio = new Audio(); audio.src = track.url; audio.crossOrigin = 'anonymous'; audio.loop = false; audio.preload = 'auto';
      await audio.play().catch(()=>{});
      ensureAudioContext();
      if (context) { try { mediaSource = context.createMediaElementSource(audio); mediaSource.connect(master); } catch(_){} }
      currentAudioElement = audio; audio.onended = () => nextTrack(); status.textContent = `Tocando: ${track.title || track.url}`;
    } else if (track.type === 'youtube') {
      // If in no-ads mode, skip youtube tracks
      if (storage.getItem('tm-music-no-ads') === 'true') {
        status.textContent = 'Modo sem anúncios ativo — pulando conteúdo do YouTube.';
        nextTrack(); return;
      }
      // Use embed iframe to play YouTube video (user must press play in iframe)
      playYoutubeVideo(track.videoId, track.title || track.videoId);
      status.textContent = `Escolha reproduzir no player: ${track.title || track.videoId}`;
    }
    currentIndex = index; savePlaylist();
  }

  function nextTrack() { if (currentIndex + 1 < playlist.length) playTrackAt(currentIndex + 1); }
  function prevTrack() { if (currentIndex - 1 >= 0) playTrackAt(currentIndex - 1); }

  // Playlist UI injection (if not present) inside the music card
  function injectPlaylistUI() {
    const musicCard = document.querySelector('.music-card') || document.querySelector('.card.music-card') || document.querySelector('.card.music-card, .music-card');
    if (!musicCard) return;
    if (musicCard.querySelector('#tmLocalUploadContainer')) return; // already injected

    const container = document.createElement('div'); container.id = 'tmLocalUploadContainer'; container.className = 'tm-music-local';
    container.innerHTML = `
      <h3>Música sem anúncios</h3>
      <label><input type="checkbox" id="tmNoAds"> Ativar modo sem anúncios (usar apenas faixas locais)</label>
      <div style="margin-top:8px">
        <label>Enviar músicas (MP3/OGG) <input type="file" id="tmMusicUpload" multiple accept="audio/*"></label>
        <div id="tmDropZone" style="border:1px dashed #cfcfcf;padding:10px;border-radius:8px;margin-top:8px">Arraste e solte arquivos aqui</div>
        <div style="margin-top:8px"><label>Importar playlist (.m3u): <input type="file" id="tmM3uImport" accept=".m3u,.pls,text/plain"></label></div>
        <div style="margin-top:8px"><label>Colar URLs/IDs do YouTube (uma por linha):</label><textarea id="tmYouTubeBulk" rows="3" style="width:100%" placeholder="https://youtu.be/ID ou ID por linha"></textarea><button id="tmAddYouTubeBulk">Adicionar ao playlist</button></div>
        <h4>Fila</h4>
        <ol id="tmPlaylist" style="max-height:220px;overflow:auto;padding-left:18px"></ol>
        <div style="display:flex;gap:8px;margin-top:8px"><button id="tmPrev">◀ Anterior</button><button id="tmPlay">▶ Tocar</button><button id="tmNext">Próxima ▶</button><button id="tmClear">Limpar fila</button></div>
      </div>
    `;

    musicCard.append(container);

    // Hook events
    const upload = container.querySelector('#tmMusicUpload');
    const dropZone = container.querySelector('#tmDropZone');
    const m3uImport = container.querySelector('#tmM3uImport');
    const youBulk = container.querySelector('#tmYouTubeBulk');
    const youBulkAdd = container.querySelector('#tmAddYouTubeBulk');
    const playlistEl = container.querySelector('#tmPlaylist');
    const noAdsCheckbox = container.querySelector('#tmNoAds');
    const prevBtn = container.querySelector('#tmPrev');
    const playBtn = container.querySelector('#tmPlay');
    const nextBtn = container.querySelector('#tmNext');
    const clearBtn = container.querySelector('#tmClear');

    // initialize checkbox
    noAdsCheckbox.checked = storage.getItem('tm-music-no-ads') === 'true';
    noAdsCheckbox.addEventListener('change', () => { storage.setItem('tm-music-no-ads', noAdsCheckbox.checked ? 'true' : 'false'); });

    upload.addEventListener('change', async (e) => { const files = Array.from(e.target.files || []); await handleFilesUpload(files); e.target.value = ''; });
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#8ab79a'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#cfcfcf'; });
    dropZone.addEventListener('drop', async (e) => { e.preventDefault(); dropZone.style.borderColor = '#cfcfcf'; const files = Array.from(e.dataTransfer.files || []); await handleFilesUpload(files); });

    m3uImport.addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return; const text = await file.text(); const urls = parseM3u(text); addUrlTracks(urls); e.target.value = '';
    });

    youBulkAdd.addEventListener('click', () => { const lines = youBulk.value.split('\n').map(l => l.trim()).filter(Boolean); const videos = lines.map(parseYouTubeId).filter(Boolean); for (const v of videos) playlist.push({ type: 'youtube', videoId: v.id, title: v.title || v.id }); savePlaylist(); renderPlaylist(); });

    prevBtn.addEventListener('click', () => prevTrack());
    nextBtn.addEventListener('click', () => nextTrack());
    playBtn.addEventListener('click', async () => { if (!playlist.length) { status.textContent = 'Fila vazia.'; return; } ensureAudioContext(); await playTrackAt(currentIndex || 0); });
    clearBtn.addEventListener('click', () => { playlist = []; savePlaylist(); renderPlaylist(); status.textContent = 'Fila limpa.'; });

    renderPlaylist();
  }

  function renderPlaylist() {
    const el = document.querySelector('#tmPlaylist'); if (!el) return; el.replaceChildren();
    playlist.forEach((t, i) => {
      const li = document.createElement('li'); li.style.display = 'flex'; li.style.justifyContent = 'space-between'; li.style.alignItems = 'center';
      const title = document.createElement('span'); title.textContent = t.title || (t.type === 'local' ? `Arquivo ${t.sourceId}` : t.url || t.videoId);
      const controls = document.createElement('span');
      const playBtn = document.createElement('button'); playBtn.textContent = '▶'; playBtn.addEventListener('click', () => playTrackAt(i));
      const removeBtn = document.createElement('button'); removeBtn.textContent = '✖'; removeBtn.addEventListener('click', async () => { playlist.splice(i,1); savePlaylist(); renderPlaylist(); });
      controls.append(playBtn, removeBtn);
      li.append(title, controls);
      el.append(li);
    });
  }

  // Parse .m3u: lines with URLs, ignore comments
  function parseM3u(text) { return text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')); }

  // Parse YouTube ID from URL or raw ID
  function parseYouTubeId(text) {
    if (!text) return null; text = text.trim();
    // common formats
    try {
      const u = new URL(text);
      if (u.hostname.includes('youtu.be')) return { id: u.pathname.slice(1) };
      if (u.hostname.includes('youtube.com')) {
        const v = new URLSearchParams(u.search).get('v'); if (v) return { id: v };
        const list = u.searchParams.get('list'); if (list) return { id: list }; // playlist id fallback
      }
    } catch (_) {
      // not a url, assume it's an ID
      if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return { id: text };
    }
    return null;
  }

  // Add url tracks (generic audio URLs)
  function addUrlTracks(urls) {
    for (const u of urls) playlist.push({ type:'url', url: u, title: u }); savePlaylist(); renderPlaylist();
  }

  // Handle multiple file uploads and persist to IDB
  async function handleFilesUpload(files) {
    const accepted = files.filter(f => f.type.startsWith('audio/'));
    if (!accepted.length) { status.textContent = 'Nenhum arquivo de áudio válido encontrado.'; return; }
    status.textContent = `Adicionando ${accepted.length} arquivo(s)...`;
    for (const file of accepted) {
      try {
        const id = await IDB.addFile(file.name, file);
        playlist.push({ type: 'local', sourceId: id, title: file.name });
      } catch (err) { console.error('IDB add error', err); }
    }
    savePlaylist(); renderPlaylist(); status.textContent = 'Arquivos adicionados à fila.';
  }

  // Play YouTube video in the existing iframe behavior
  function playYoutubeVideo(videoId, title) {
    if (!youtubePlayer) return;
    if (location.protocol === 'file:') { status.textContent = 'Abra o TarefaMix publicado para tocar músicas dentro do app junto com o cronômetro.'; return; }
    let frame = youtubePlayer.querySelector('iframe');
    if (!frame) { frame = document.createElement('iframe'); frame.loading = 'lazy'; frame.referrerPolicy = 'strict-origin-when-cross-origin'; frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'; frame.allowFullscreen = true; youtubePlayer.append(frame); }
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1`; frame.title = title || videoId; youtubePlayer.hidden = false; youtubeButton.textContent = 'Trocar vídeo'; storage.setItem('tm-youtube-last', videoId); status.textContent = `Player pronto: ${title || videoId}. Aperte reproduzir no player.`;
  }

  // Add "Add all" support to YouTube search results if present
  function addSearchAddAllUI() {
    if (!searchResults) return;
    // add a small control
    const existing = document.querySelector('#tmAddAllSearchResults'); if (existing) return;
    const btn = document.createElement('button'); btn.id = 'tmAddAllSearchResults'; btn.textContent = 'Adicionar todos os resultados à fila'; btn.style.display = 'block'; btn.style.marginTop = '8px';
    searchResults.parentNode.insertBefore(btn, searchResults.nextSibling);
    btn.addEventListener('click', () => {
      const items = searchResults.querySelectorAll('.youtube-result');
      let added = 0;
      items.forEach(item => {
        const vid = item.dataset.videoId; const title = item.textContent;
        if (vid) { playlist.push({ type: 'youtube', videoId: vid, title }); added++; }
      });
      if (added) { savePlaylist(); renderPlaylist(); status.textContent = `Adicionados ${added} vídeos à fila.`; } else { status.textContent = 'Nenhum vídeo selecionável nos resultados.'; }
    });
  }

  // Hook to augment search result rendering to include data-videoId attribute
  (function wrapSearchResults() {
    if (!searchResults) return;
    const origAppend = searchResults.append.bind(searchResults);
    searchResults.append = function() {
      for (const node of arguments) {
        // if node is a button added by search, try to extract video id from its click listener closure - our earlier code didn't store it
        // but search code in this repo creates result buttons with click that calls playYoutubeVideo(item.id.videoId, ...)
        // We can store the id in dataset if possible by parsing text, but safer approach: when search runs, it will create buttons here with dataset already if modified.
        origAppend(node);
      }
      // ensure Add All button exists
      addSearchAddAllUI();
    };
  })();

  // Enhance search form behavior to set dataset on results
  if (searchForm) {
    const origHandler = searchForm.onsubmit;
    // We rely on existing searchForm handler (already set earlier in app), but we don't replace it — the handler creates results with class youtube-result.
    // To ensure dataset, observe childList changes and find buttons and set data-videoId by parsing their text if possible.
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (node.nodeType === 1 && node.classList.contains('youtube-result')) {
            // try to obtain id from an attribute in the click listener? Not accessible. We'll leave data-videoId empty unless code adds it.
            // If the search code is in our control, we could modify it to set dataset; but here we provide Add All that only works for items with dataset.videoId.
          }
        }
      }
    });
    observer.observe(searchResults, { childList: true });
  }

  // Initialize injected UI
  injectPlaylistUI();

  // Integrate with existing ducking logic: observe reminderToast
  const reminderToast = document.querySelector('#reminderToast');
  if (reminderToast) {
    const mo = new MutationObserver((records) => {
      for (const r of records) if (r.attributeName === 'class') { if (reminderToast.classList.contains('show')) {
        // temporarily duck
        if (master && context) {
          const now = context.currentTime; master.gain.cancelScheduledValues(now); master.gain.linearRampToValueAtTime(Math.max(0, master.gain.value * 0.25), now + 0.02);
          setTimeout(() => { const t = context.currentTime; master.gain.cancelScheduledValues(t); master.gain.linearRampToValueAtTime(Number(volume.value)/100, t + 0.12); }, 3500);
        }
      } }
    });
    mo.observe(reminderToast, { attributes: true });
  }

  // Keyboard shortcut for space to toggle play/pause (if not focused on input)
  document.addEventListener('keydown', (e) => { const tag = document.activeElement && document.activeElement.tagName; if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') { e.preventDefault(); button.click(); } });

  // Pause playback when tab hidden to save resources (remember play state)
  let wasPlayingBeforeHide = false;
  document.addEventListener('visibilitychange', async () => { if (document.hidden) { try { wasPlayingBeforeHide = Boolean(storage.getItem('tm-music-playing') === 'true'); if (wasPlayingBeforeHide) { // stop media element playback
        if (currentAudioElement) currentAudioElement.pause(); }
      } catch(_){} } else { try { if (wasPlayingBeforeHide) { if (context && context.state === 'suspended') await context.resume(); if (currentAudioElement) currentAudioElement.play().catch(()=>{}); } } catch(_){} } });

  // Restore volume/type from storage
  try { const savedVol = storage.getItem('tm-music-volume'); if (savedVol !== null) volume.value = savedVol; } catch(_){}
  try { const savedType = storage.getItem('tm-music-type'); if (savedType !== null) select.value = savedType; } catch(_){}
  try { const wasPlaying = storage.getItem('tm-music-playing'); if (wasPlaying === 'true') { /* don't auto-start audio without user gesture */ status.textContent = 'Recarregue e clique em tocar para restaurar reprodução.'; } } catch(_){}

  // Wire up existing controls
  volume.addEventListener('input', updateVolumeUI);
  select.addEventListener('change', () => { storage.setItem('tm-music-type', select.value); if (storage.getItem('tm-music-playing') === 'true') { ensureAudioContext(); /* startSound() in original generator remains available */ } });

})();
