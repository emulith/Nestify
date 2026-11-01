// State Management
let currentPlayback = null;
let currentConfig = null;
let isDraggingSeek = false;
let isDraggingVolume = false;
let lastServerProgress = 0;
let lastServerFetchTime = 0;
let isPlaying = false;
let trackDurationMs = 0;
let activeDeviceId = null;
let currentPlaylistContext = null;
let virtualSearchQuery = '';
let searchDebounceTimer = null;
let volumeDebounceTimer = null;
let currentVolumePercent = 50;

// DOM Elements - Top Liquid Glass Navigation & Controls
const ambientBackdrop = document.getElementById('ambient-backdrop');
const topClock = document.getElementById('top-clock');

const tabNowPlaying = document.getElementById('tab-nowplaying');
const tabHome = document.getElementById('tab-home');
const tabFavorites = document.getElementById('tab-favorites');
const tabSearch = document.getElementById('tab-search');
const btnGotoNowplaying = document.getElementById('btn-goto-nowplaying');
const btnDeviceTop = document.getElementById('btn-device-selector-top');

// Views
const viewNowPlaying = document.getElementById('view-now-playing');
const viewHome = document.getElementById('view-home');
const viewPlaylistDetail = document.getElementById('view-playlist-detail');
const viewFavorites = document.getElementById('view-favorites');
const viewSearch = document.getElementById('view-search');

// Now Playing Elements
const trackTitle = document.getElementById('track-title');
const trackArtist = document.getElementById('track-artist');
const trackAlbum = document.getElementById('track-album');
const albumCover = document.getElementById('album-cover');

const timeCurrent = document.getElementById('time-current');
const timeRemaining = document.getElementById('time-remaining');
const progressBarContainer = document.getElementById('progress-bar-container');
const progressFill = document.getElementById('progress-fill');
const progressHandle = document.getElementById('progress-handle');

const btnPrevious = document.getElementById('btn-previous');
const btnPlayPause = document.getElementById('btn-play-pause');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const btnNext = document.getElementById('btn-next');

const btnShuffle = document.getElementById('btn-shuffle');
const btnDeviceSelector = document.getElementById('btn-device-selector');
const btnRepeat = document.getElementById('btn-repeat');

// Volume Elements
const volumeSliderContainer = document.getElementById('volume-slider-container');
const volumeFill = document.getElementById('volume-fill');
const volumeHandle = document.getElementById('volume-handle');

// Home / Playlists Elements
const cardLikedSongs = document.getElementById('card-liked-songs');
const homePlaylistsCards = document.getElementById('home-playlists-cards');
const homeRecentsList = document.getElementById('home-recents-list');
const btnScrollUp = document.getElementById('btn-scroll-up');
const btnScrollDown = document.getElementById('btn-scroll-down');
const carplayScrollWrapper = document.querySelector('.carplay-scroll-wrapper');

// Playlist Detail Elements
const btnBackToLibrary = document.getElementById('btn-back-to-library');
const detailPlaylistThumb = document.getElementById('detail-playlist-thumb');
const detailPlaylistName = document.getElementById('detail-playlist-name');
const detailPlaylistTotal = document.getElementById('detail-playlist-total');
const btnPlayAllPlaylist = document.getElementById('btn-play-all-playlist');
const playlistTracksScroll = document.getElementById('playlist-tracks-scroll');

// Favorites Elements
const favoritesTracksScroll = document.getElementById('favorites-tracks-scroll');
const btnPlayAllFavorites = document.getElementById('btn-play-all-favorites');

// Search & Virtual Keyboard Elements
const virtualSearchText = document.getElementById('virtual-search-text');
const btnClearSearch = document.getElementById('btn-clear-search');
const btnSearchTrigger = document.getElementById('btn-search-trigger');
const virtualKeyboard = document.getElementById('virtual-keyboard');
const searchResultsList = document.getElementById('search-results-list');

// Device Modal
const deviceModal = document.getElementById('device-modal');
const btnCloseDeviceModal = document.getElementById('btn-close-device-modal');
const devicesList = document.getElementById('devices-list');

// 1. Clock Update
function updateClock() {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  if (topClock) topClock.textContent = `${hours}:${minutes}`;
}
setInterval(updateClock, 1000);
updateClock();

// 2. Format Milliseconds (MM:SS)
function formatTime(ms) {
  if (!ms || isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// 3. Navigation Switcher
function switchView(targetView, activeTab = null) {
  const views = [viewNowPlaying, viewHome, viewPlaylistDetail, viewFavorites, viewSearch];
  const tabs = [tabNowPlaying, tabHome, tabFavorites, tabSearch];
  const carplayHeader = document.getElementById('carplay-header');

  views.forEach(v => { if (v) v.classList.remove('active'); });
  tabs.forEach(t => { if (t) t.classList.remove('active'); });

  if (targetView) targetView.classList.add('active');

  // Liquid glass header is always shown across all screens
  if (carplayHeader) carplayHeader.style.display = 'flex';

  if (targetView === viewNowPlaying) {
    if (tabNowPlaying) tabNowPlaying.classList.add('active');
  } else if (targetView === viewHome) {
    if (tabHome) tabHome.classList.add('active');
    loadHomeData();
  } else if (targetView === viewPlaylistDetail) {
    if (tabHome) tabHome.classList.add('active');
  } else if (targetView === viewFavorites) {
    if (tabFavorites) tabFavorites.classList.add('active');
    loadFavoritesData();
  } else if (targetView === viewSearch) {
    if (tabSearch) tabSearch.classList.add('active');
  }
}

if (tabNowPlaying) tabNowPlaying.addEventListener('click', () => switchView(viewNowPlaying));
if (tabHome) tabHome.addEventListener('click', () => switchView(viewHome));
if (tabFavorites) tabFavorites.addEventListener('click', () => switchView(viewFavorites));
if (tabSearch) tabSearch.addEventListener('click', () => switchView(viewSearch));
if (btnGotoNowplaying) btnGotoNowplaying.addEventListener('click', () => switchView(viewNowPlaying));
if (btnDeviceTop) btnDeviceTop.addEventListener('click', openDeviceModal);
if (btnBackToLibrary) btnBackToLibrary.addEventListener('click', () => switchView(viewHome));

// 4. Smooth 60fps Scrubber Interpolation
function updateProgressBarInterpolation() {
  if (isPlaying && !isDraggingSeek && trackDurationMs > 0) {
    const elapsedSinceFetch = Date.now() - lastServerFetchTime;
    const estimatedProgress = Math.min(lastServerProgress + elapsedSinceFetch, trackDurationMs);
    const percent = (estimatedProgress / trackDurationMs) * 100;
    const remainingMs = Math.max(0, trackDurationMs - estimatedProgress);

    progressFill.style.width = `${percent}%`;
    progressHandle.style.left = `${percent}%`;
    timeCurrent.textContent = formatTime(estimatedProgress);
    timeRemaining.textContent = `-${formatTime(remainingMs)}`;
  }
  requestAnimationFrame(updateProgressBarInterpolation);
}
requestAnimationFrame(updateProgressBarInterpolation);

// 5. Update Playback UI
function updatePlaybackUI(data) {
  currentPlayback = data;
  if (!data || !data.item) {
    trackTitle.textContent = 'Geen muziek actief';
    trackArtist.textContent = 'Tik op een playlist om af te spelen';
    trackAlbum.textContent = '';
    albumCover.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 24 24' fill='%23333'%3E%3Crect width='24' height='24' fill='%2318181b'/%3E%3Cpath fill='%23555' d='M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z'/%3E%3C/svg%3E";
    ambientBackdrop.style.backgroundImage = 'none';
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
    timeCurrent.textContent = '0:00';
    timeRemaining.textContent = '-0:00';
    progressFill.style.width = '0%';
    progressHandle.style.left = '0%';
    isPlaying = false;
    return;
  }

  const item = data.item;
  isPlaying = data.is_playing;
  trackDurationMs = item.duration_ms || 0;
  lastServerProgress = data.progress_ms || 0;
  lastServerFetchTime = Date.now();

  trackTitle.textContent = item.name || 'Onbekend';
  const artists = (item.artists || []).map(a => a.name).join(', ');
  trackArtist.textContent = artists || '';
  trackAlbum.textContent = item.album?.name || '';

  const coverUrl = item.album?.images?.[0]?.url || null;
  if (coverUrl && albumCover.src !== coverUrl) {
    albumCover.src = coverUrl;
    ambientBackdrop.style.backgroundImage = `url('${coverUrl}')`;
  }

  if (isPlaying) {
    iconPlay.style.display = 'none';
    iconPause.style.display = 'block';
  } else {
    iconPlay.style.display = 'block';
    iconPause.style.display = 'none';
  }

  const rem = Math.max(0, trackDurationMs - lastServerProgress);
  timeRemaining.textContent = `-${formatTime(rem)}`;

  if (data.device) {
    activeDeviceId = data.device.id;
    dockDeviceLabel.textContent = data.device.name.includes('PC') ? 'PC' : data.device.name.slice(0, 4);
    if (!isDraggingVolume && data.device.volume_percent !== null) {
      setVolumeUI(data.device.volume_percent);
    }
  }

  btnShuffle.classList.toggle('active', Boolean(data.shuffle_state));
  btnRepeat.classList.toggle('active', Boolean(data.repeat_state && data.repeat_state !== 'off'));
}

async function fetchPlaybackState() {
  try {
    const res = await fetch('/api/player/state');
    if (res.ok) {
      const data = await res.json();
      updatePlaybackUI(data);
    }
  } catch (e) {}
}

// 6. Playback Transport Handlers
btnPlayPause.addEventListener('click', async () => {
  try {
    if (isPlaying) {
      iconPlay.style.display = 'block';
      iconPause.style.display = 'none';
      isPlaying = false;
      await fetch('/api/player/pause', { method: 'POST' });
    } else {
      iconPlay.style.display = 'none';
      iconPause.style.display = 'block';
      isPlaying = true;
      await fetch('/api/player/play', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: activeDeviceId })
      });
    }
    setTimeout(fetchPlaybackState, 300);
  } catch (e) {}
});

btnNext.addEventListener('click', async () => {
  try {
    await fetch('/api/player/next', { method: 'POST' });
    setTimeout(fetchPlaybackState, 300);
  } catch (e) {}
});

btnPrevious.addEventListener('click', async () => {
  try {
    await fetch('/api/player/previous', { method: 'POST' });
    setTimeout(fetchPlaybackState, 300);
  } catch (e) {}
});

btnShuffle.addEventListener('click', async () => {
  try {
    const newState = !btnShuffle.classList.contains('active');
    btnShuffle.classList.toggle('active', newState);
    await fetch('/api/player/shuffle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: newState })
    });
  } catch (e) {}
});

btnRepeat.addEventListener('click', async () => {
  try {
    const nextState = btnRepeat.classList.contains('active') ? 'off' : 'context';
    btnRepeat.classList.toggle('active', nextState !== 'off');
    await fetch('/api/player/repeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: nextState })
    });
  } catch (e) {}
});

// 7. Scrubber Drag
function handleSeek(clientX) {
  if (!trackDurationMs) return;
  const rect = progressBarContainer.getBoundingClientRect();
  const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
  const percent = (x / rect.width);
  const seekTargetMs = Math.round(percent * trackDurationMs);

  progressFill.style.width = `${percent * 100}%`;
  progressHandle.style.left = `${percent * 100}%`;
  timeCurrent.textContent = formatTime(seekTargetMs);
  return seekTargetMs;
}

async function commitSeek(seekTargetMs) {
  try {
    lastServerProgress = seekTargetMs;
    lastServerFetchTime = Date.now();
    await fetch('/api/player/seek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position_ms: seekTargetMs })
    });
  } catch (e) {}
}

progressBarContainer.addEventListener('mousedown', (e) => {
  isDraggingSeek = true;
  handleSeek(e.clientX);
  const onMove = (ev) => handleSeek(ev.clientX);
  const onUp = (ev) => {
    isDraggingSeek = false;
    commitSeek(handleSeek(ev.clientX));
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
});

progressBarContainer.addEventListener('touchstart', (e) => {
  isDraggingSeek = true;
  if (e.touches && e.touches[0]) handleSeek(e.touches[0].clientX);
}, { passive: true });

progressBarContainer.addEventListener('touchmove', (e) => {
  if (isDraggingSeek && e.touches && e.touches[0]) {
    if (e.cancelable) e.preventDefault();
    handleSeek(e.touches[0].clientX);
  }
}, { passive: false });

progressBarContainer.addEventListener('touchend', (e) => {
  if (isDraggingSeek) {
    isDraggingSeek = false;
    if (e.changedTouches && e.changedTouches[0]) {
      commitSeek(handleSeek(e.changedTouches[0].clientX));
    }
  }
});

// 8. SLEEK CARPLAY VOLUME SLIDER
function setVolumeUI(percent) {
  currentVolumePercent = Math.max(0, Math.min(100, Math.round(percent)));
  if (volumeFill) volumeFill.style.width = `${currentVolumePercent}%`;
  if (volumeHandle) volumeHandle.style.left = `${currentVolumePercent}%`;
}

function sendVolumeUpdate(percent) {
  setVolumeUI(percent);
  clearTimeout(volumeDebounceTimer);
  volumeDebounceTimer = setTimeout(async () => {
    try {
      await fetch('/api/player/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          volume_percent: currentVolumePercent,
          deviceId: activeDeviceId
        })
      });
    } catch (e) {}
  }, 80);
}

function handleVolumeDrag(clientX) {
  if (!volumeSliderContainer) return;
  const rect = volumeSliderContainer.getBoundingClientRect();
  const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
  const percent = (x / rect.width) * 100;
  sendVolumeUpdate(percent);
}

if (volumeSliderContainer) {
  // Direct click / tap to jump volume
  volumeSliderContainer.addEventListener('click', (e) => {
    handleVolumeDrag(e.clientX);
  });

  volumeSliderContainer.addEventListener('mousedown', (e) => {
    isDraggingVolume = true;
    handleVolumeDrag(e.clientX);
    const onMove = (ev) => handleVolumeDrag(ev.clientX);
    const onUp = () => {
      isDraggingVolume = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  volumeSliderContainer.addEventListener('touchstart', (e) => {
    isDraggingVolume = true;
    if (e.touches && e.touches[0]) handleVolumeDrag(e.touches[0].clientX);
  }, { passive: true });

  volumeSliderContainer.addEventListener('touchmove', (e) => {
    if (isDraggingVolume && e.touches && e.touches[0]) {
      if (e.cancelable) e.preventDefault();
      handleVolumeDrag(e.touches[0].clientX);
    }
  }, { passive: false });

  volumeSliderContainer.addEventListener('touchend', () => {
    isDraggingVolume = false;
  });
}

// Volume step icons (+/- 10%)
const volIconLow = document.querySelector('.vol-icon-low');
const volIconHigh = document.querySelector('.vol-icon-high');
if (volIconLow) {
  volIconLow.style.cursor = 'pointer';
  volIconLow.addEventListener('click', () => {
    sendVolumeUpdate(Math.max(0, currentVolumePercent - 10));
  });
}
if (volIconHigh) {
  volIconHigh.style.cursor = 'pointer';
  volIconHigh.addEventListener('click', () => {
    sendVolumeUpdate(Math.min(100, currentVolumePercent + 10));
  });
}

// 9. HOME & PLAYLISTS (Screenshot 2 Replica)
cardLikedSongs.addEventListener('click', () => {
  switchView(viewFavorites, tabFavorites);
});

async function loadHomeData() {
  loadPlaylistsStrip();
  loadRecentsList();
}

async function loadPlaylistsStrip() {
  try {
    const res = await fetch('/api/spotify/playlists');
    const playlists = await res.json();
    homePlaylistsCards.innerHTML = '';
    if (!playlists || playlists.length === 0) return;

    playlists.forEach(p => {
      const card = document.createElement('div');
      card.className = 'carplay-card';
      const imgUrl = p.images?.[0]?.url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="80" fill="%23222"%3E%3Crect width="100" height="80"/%3E%3C/svg%3E';
      card.innerHTML = `
        <img class="carplay-card-img" src="${imgUrl}" alt="${p.name}">
        <div class="carplay-card-name">${p.name}</div>
        <div class="carplay-card-count">${p.tracks?.total || 0} tracks</div>
      `;
      card.addEventListener('click', () => openPlaylistDetail(p));
      homePlaylistsCards.appendChild(card);
    });
  } catch (e) {}
}

async function loadRecentsList() {
  try {
    const res = await fetch('/api/spotify/recently-played');
    const items = await res.json();
    homeRecentsList.innerHTML = '';
    if (!items || items.length === 0) {
      homeRecentsList.innerHTML = '<div class="carplay-loading">Geen recente nummers gevonden.</div>';
      return;
    }

    items.forEach(entry => {
      const t = entry.track;
      if (!t) return;
      const row = document.createElement('div');
      row.className = 'carplay-list-item';
      const coverUrl = t.album?.images?.[0]?.url || '';
      const artists = (t.artists || []).map(a => a.name).join(', ');
      row.innerHTML = `
        <img class="list-item-thumb" src="${coverUrl}" alt="${t.name}">
        <div class="list-item-meta">
          <div class="list-item-title">${t.name}</div>
          <div class="list-item-artist">${artists}</div>
        </div>
        <svg class="list-item-play-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      `;
      row.addEventListener('click', async () => {
        trackTitle.textContent = t.name;
        trackArtist.textContent = artists;
        switchView(viewNowPlaying);
        await fetch('/api/spotify/play-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uri: t.uri,
            album_uri: t.album?.uri
          })
        });
        setTimeout(fetchPlaybackState, 800);
      });
      homeRecentsList.appendChild(row);
    });
  } catch (e) {
    homeRecentsList.innerHTML = '<div class="carplay-loading">Fout bij laden van recent afgespeeld.</div>';
  }
}

// CarPlay Scroll Chevrons
btnScrollDown.addEventListener('click', () => {
  carplayScrollWrapper.scrollBy({ top: 260, behavior: 'smooth' });
});
btnScrollUp.addEventListener('click', () => {
  carplayScrollWrapper.scrollBy({ top: -260, behavior: 'smooth' });
});

// 10. PLAYLIST DETAIL (Inspect & Play tracks in playlist)
async function openPlaylistDetail(playlist) {
  currentPlaylistContext = playlist;
  detailPlaylistName.textContent = playlist.name;
  detailPlaylistTotal.textContent = `${playlist.tracks?.total || 0} nummers`;
  detailPlaylistThumb.src = playlist.images?.[0]?.url || '';

  playlistTracksScroll.innerHTML = '<div class="carplay-loading">Nummers ophalen...</div>';
  switchView(viewPlaylistDetail);

  btnPlayAllPlaylist.onclick = async () => {
    trackTitle.textContent = playlist.name;
    trackArtist.textContent = 'Afspeellijst wordt afgespeeld...';
    switchView(viewNowPlaying);
    await fetch('/api/spotify/play-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context_uri: playlist.uri })
    });
    setTimeout(fetchPlaybackState, 800);
  };

  const btnShufflePlaylist = document.getElementById('btn-shuffle-playlist');
  if (btnShufflePlaylist) {
    btnShufflePlaylist.onclick = async () => {
      trackTitle.textContent = playlist.name;
      trackArtist.textContent = 'Afspeellijst wordt geshuffled...';
      switchView(viewNowPlaying);
      await fetch('/api/player/shuffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: true })
      });
      await fetch('/api/spotify/play-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_uri: playlist.uri })
      });
      setTimeout(fetchPlaybackState, 800);
    };
  }

  try {
    const res = await fetch(`/api/spotify/playlists/${playlist.id}/tracks`);
    const tracks = await res.json();
    playlistTracksScroll.innerHTML = '';
    if (!tracks || tracks.length === 0) {
      playlistTracksScroll.innerHTML = '<div class="carplay-loading">Geen nummers gevonden in deze afspeellijst.</div>';
      return;
    }

    tracks.forEach((t, idx) => {
      const row = document.createElement('div');
      row.className = 'carplay-list-item';
      const coverUrl = t.album?.images?.[0]?.url || playlist.images?.[0]?.url || '';
      const artists = (t.artists || []).map(a => a.name).join(', ');
      row.innerHTML = `
        <span style="font-size:0.95rem; font-weight:800; color:var(--text-dim); width:28px;">${idx + 1}</span>
        <img class="list-item-thumb" src="${coverUrl}" alt="${t.name}">
        <div class="list-item-meta">
          <div class="list-item-title">${t.name}</div>
          <div class="list-item-artist">${artists}</div>
        </div>
        <svg class="list-item-play-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      `;
      row.addEventListener('click', async () => {
        trackTitle.textContent = t.name;
        trackArtist.textContent = artists;
        switchView(viewNowPlaying);
        await fetch('/api/spotify/play-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context_uri: playlist.uri,
            offset_uri: t.uri
          })
        });
        setTimeout(fetchPlaybackState, 800);
      });
      playlistTracksScroll.appendChild(row);
    });
  } catch (e) {
    playlistTracksScroll.innerHTML = '<div class="carplay-loading">Fout bij laden van nummers.</div>';
  }
}

// 11. FAVORITES VIEW (Liked Songs on PC)
async function loadFavoritesData() {
  favoritesTracksScroll.innerHTML = '<div class="carplay-loading">Favorieten laden...</div>';
  try {
    const res = await fetch('/api/spotify/favorites');
    const tracks = await res.json();
    favoritesTracksScroll.innerHTML = '';
    if (!tracks || tracks.length === 0) {
      favoritesTracksScroll.innerHTML = '<div class="carplay-loading">Nog geen gelikete nummers gevonden.</div>';
      return;
    }

    tracks.forEach((t, idx) => {
      const row = document.createElement('div');
      row.className = 'carplay-list-item';
      const coverUrl = t.album?.images?.[0]?.url || '';
      const artists = (t.artists || []).map(a => a.name).join(', ');
      row.innerHTML = `
        <span style="font-size:0.95rem; font-weight:800; color:var(--text-dim); width:28px;">${idx + 1}</span>
        <img class="list-item-thumb" src="${coverUrl}" alt="${t.name}">
        <div class="list-item-meta">
          <div class="list-item-title">${t.name}</div>
          <div class="list-item-artist">${artists}</div>
        </div>
        <svg class="list-item-play-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      `;
      row.addEventListener('click', async () => {
        trackTitle.textContent = t.name;
        trackArtist.textContent = artists;
        switchView(viewNowPlaying);
        await fetch('/api/spotify/play-favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track_uri: t.uri })
        });
        setTimeout(fetchPlaybackState, 800);
      });
      favoritesTracksScroll.appendChild(row);
    });

    btnPlayAllFavorites.onclick = async () => {
      if (tracks.length > 0) {
        trackTitle.textContent = tracks[0].name;
        trackArtist.textContent = 'Favorieten worden afgespeeld...';
        switchView(viewNowPlaying);
        await fetch('/api/spotify/play-favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track_uri: tracks[0].uri })
        });
        setTimeout(fetchPlaybackState, 800);
      }
    };

    const btnShuffleFavorites = document.getElementById('btn-shuffle-favorites');
    if (btnShuffleFavorites) {
      btnShuffleFavorites.onclick = async () => {
        if (tracks.length > 0) {
          trackTitle.textContent = 'Favorieten';
          trackArtist.textContent = 'Favorieten worden geshuffled...';
          switchView(viewNowPlaying);
          await fetch('/api/player/shuffle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: true })
          });
          const randIdx = Math.floor(Math.random() * tracks.length);
          await fetch('/api/spotify/play-favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ track_uri: tracks[randIdx].uri })
          });
          setTimeout(fetchPlaybackState, 800);
        }
      };
    }
  } catch (e) {
    favoritesTracksScroll.innerHTML = '<div class="carplay-loading">Fout bij laden van favorieten.</div>';
  }
}

// 12. SEARCH & VIRTUAL KEYBOARD
function updateSearchTextUI() {
  if (virtualSearchQuery.length > 0) {
    virtualSearchText.textContent = virtualSearchQuery;
    virtualSearchText.style.color = '#ffffff';
    btnClearSearch.style.display = 'block';
  } else {
    virtualSearchText.textContent = 'Typ om te zoeken...';
    virtualSearchText.style.color = 'var(--text-dim)';
    btnClearSearch.style.display = 'none';
  }
}

virtualKeyboard.addEventListener('click', (e) => {
  const target = e.target.closest('.key');
  if (!target) return;

  const char = target.getAttribute('data-k');
  const action = target.getAttribute('data-action');

  if (char !== null) {
    virtualSearchQuery += char;
  } else if (action === 'backspace') {
    virtualSearchQuery = virtualSearchQuery.slice(0, -1);
  } else if (action === 'clear') {
    virtualSearchQuery = '';
  }

  updateSearchTextUI();

  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    const q = (virtualSearchQuery || '').trim();
    if (q.length >= 2) {
      executeSearch(q);
    }
  }, 450);
});

btnClearSearch.addEventListener('click', () => {
  virtualSearchQuery = '';
  updateSearchTextUI();
  searchResultsList.innerHTML = '<div class="carplay-loading">Typ met de toetsen of kies een genre!</div>';
});

btnSearchTrigger.addEventListener('click', () => {
  const q = (virtualSearchQuery || '').trim();
  if (q.length > 0) {
    executeSearch(q);
  }
});

document.querySelectorAll('.genre-tag').forEach(btn => {
  btn.addEventListener('click', () => {
    const q = (btn.getAttribute('data-q') || '').trim();
    virtualSearchQuery = q;
    updateSearchTextUI();
    executeSearch(q);
  });
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function executeSearch(query) {
  const cleanQ = (query || '').trim();
  if (!cleanQ) {
    searchResultsList.innerHTML = '<div class="carplay-loading">Typ met de toetsen of kies een genre!</div>';
    return;
  }
  const displayQ = escapeHtml(cleanQ);
  searchResultsList.innerHTML = `<div class="carplay-loading">Zoeken naar "${displayQ}"...</div>`;
  try {
    const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(cleanQ)}`);
    if (!res.ok) {
      searchResultsList.innerHTML = `<div class="carplay-loading">Geen resultaten gevonden voor "${displayQ}".</div>`;
      return;
    }
    const data = await res.json();
    const tracks = Array.isArray(data.tracks) ? data.tracks.filter(t => t && t.name) : [];
    const playlists = Array.isArray(data.playlists) ? data.playlists.filter(p => p && p.name) : [];

    if (tracks.length === 0 && playlists.length === 0) {
      searchResultsList.innerHTML = `<div class="carplay-loading">Geen resultaten gevonden voor "${displayQ}".</div>`;
      return;
    }

    searchResultsList.innerHTML = '';

    // Render Playlists
    playlists.forEach(p => {
      if (!p || !p.name) return;
      const row = document.createElement('div');
      row.className = 'carplay-list-item';
      const coverUrl = p.images?.[0]?.url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60" fill="%23222"%3E%3Crect width="60" height="60"/%3E%3C/svg%3E';
      const pName = escapeHtml(p.name);
      row.innerHTML = `
        <img class="list-item-thumb" src="${coverUrl}" alt="${pName}">
        <div class="list-item-meta">
          <div class="list-item-title">📁 ${pName}</div>
          <div class="list-item-artist">Afspeellijst • ${p.tracks?.total || 0} nummers</div>
        </div>
      `;
      row.addEventListener('click', () => openPlaylistDetail(p));
      searchResultsList.appendChild(row);
    });

    // Render Tracks
    tracks.forEach(t => {
      if (!t || !t.name) return;
      const row = document.createElement('div');
      row.className = 'carplay-list-item';
      const coverUrl = t.album?.images?.[0]?.url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="60" fill="%23222"%3E%3Crect width="60" height="60"/%3E%3C/svg%3E';
      const artists = (t.artists || []).map(a => a.name).join(', ') || 'Onbekend';
      const tName = escapeHtml(t.name);
      const artEscaped = escapeHtml(artists);
      row.innerHTML = `
        <img class="list-item-thumb" src="${coverUrl}" alt="${tName}">
        <div class="list-item-meta">
          <div class="list-item-title">${tName}</div>
          <div class="list-item-artist">${artEscaped}</div>
        </div>
        <svg class="list-item-play-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
      `;
      row.addEventListener('click', async () => {
        trackTitle.textContent = t.name;
        trackArtist.textContent = artists;
        switchView(viewNowPlaying);
        await fetch('/api/spotify/play-track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uri: t.uri,
            album_uri: t.album?.uri
          })
        });
        setTimeout(fetchPlaybackState, 800);
      });
      searchResultsList.appendChild(row);
    });
  } catch (e) {
    console.error('Search client error:', e);
    searchResultsList.innerHTML = `<div class="carplay-loading">Geen resultaten gevonden voor "${displayQ}".</div>`;
  }
}

// 13. Device Switcher Modal
function openDeviceModal() {
  fetch('/api/player/devices')
    .then(r => r.json())
    .then(devices => {
      devicesList.innerHTML = '';
      devices.forEach(d => {
        const item = document.createElement('div');
        item.className = `device-item ${d.is_active ? 'active' : ''}`;
        item.innerHTML = `
          <div>
            <div style="font-weight:900; font-size:1.05rem; color:#fff;">${d.name}</div>
            <div style="font-size:0.82rem; color:#888;">${d.type}</div>
          </div>
          ${d.is_active ? '<span style="color:#1db954; font-weight:800; font-size:0.88rem;">Actief</span>' : ''}
        `;
        item.addEventListener('click', async () => {
          await fetch('/api/player/transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: d.id, play: true })
          });
          deviceModal.style.display = 'none';
          setTimeout(fetchPlaybackState, 600);
        });
        devicesList.appendChild(item);
      });
      deviceModal.style.display = 'flex';
    });
}

if (btnDeviceSelector) btnDeviceSelector.addEventListener('click', openDeviceModal);
if (btnCloseDeviceModal) btnCloseDeviceModal.addEventListener('click', () => { deviceModal.style.display = 'none'; });

// Initial Boot
fetchPlaybackState();
setInterval(fetchPlaybackState, 1500);
loadHomeData();
