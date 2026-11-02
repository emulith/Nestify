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
const btnLyrics = document.getElementById('btn-lyrics');
const btnCloseLyrics = document.getElementById('btn-close-lyrics');
const btnDeviceSelector = document.getElementById('btn-device-selector');
const btnRepeat = document.getElementById('btn-repeat');

// Lyrics Elements & State
const lyricsContainer = document.getElementById('lyrics-container');
const coverContainer = document.getElementById('cover-container');
const lyricsLinesList = document.getElementById('lyrics-lines-list');
const lyricsScrollBox = document.getElementById('lyrics-scroll-box');
const carplayNpSplit = document.querySelector('.carplay-np-split');

let isLyricsOpen = false;
let currentLyricsTrackId = null;
let currentPlaybackTrackId = null;
let parsedLyrics = [];
let activeLyricIndex = -1;
let isPlainLyrics = false;

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
    if (isLyricsOpen) {
      const curProg = isPlaying ? (lastServerProgress + (Date.now() - lastServerFetchTime)) : lastServerProgress;
      updateLyricsHighlight(curProg || 0, true);
    }
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

    if (isLyricsOpen) {
      updateLyricsHighlight(estimatedProgress);
    }
  }
  requestAnimationFrame(updateProgressBarInterpolation);
}
requestAnimationFrame(updateProgressBarInterpolation);

// 5. Update Playback UI
function updatePlaybackUI(data) {
  currentPlayback = data;
  if (!data || !data.item) {
    trackTitle.textContent = 'No music playing';
    trackArtist.textContent = 'Select a track or playlist to play';
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
  const trackChanged = !currentPlaybackTrackId || currentPlaybackTrackId !== item.id;
  currentPlaybackTrackId = item.id;
  if (trackChanged && isLyricsOpen) {
    loadLyricsForCurrentTrack();
  }

  isPlaying = data.is_playing;
  trackDurationMs = item.duration_ms || 0;
  lastServerProgress = data.progress_ms || 0;
  lastServerFetchTime = Date.now();

  trackTitle.textContent = item.name || 'Unknown Track';
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

  if (!isPlaying && isLyricsOpen) {
    updateLyricsHighlight(lastServerProgress, false);
  }

  if (data.device) {
    activeDeviceId = data.device.id;
    if (typeof dockDeviceLabel !== 'undefined' && dockDeviceLabel) {
      dockDeviceLabel.textContent = data.device.name.includes('PC') ? 'PC' : data.device.name.slice(0, 4);
    }
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

// ==========================================================================
// 6B. Real-Time Apple Synced Lyrics & Karaoke Controller
// ==========================================================================
let isUserScrollingLyrics = false;
let userScrollTimeout = null;
let lyricsFetchSeq = 0;

function parseLrc(lrcText) {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result = [];
  const timestampRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const matches = [...trimmed.matchAll(timestampRegex)];
    if (matches.length === 0) continue;

    const lastMatch = matches[matches.length - 1];
    const textStartIndex = lastMatch.index + lastMatch[0].length;
    let text = trimmed.slice(textStartIndex).trim();

    if (!text) {
      text = '♪';
    }

    for (const m of matches) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      let fracMs = 0;
      if (m[3]) {
        fracMs = parseInt(m[3].padEnd(3, '0').slice(0, 3), 10);
      }
      const timeMs = min * 60000 + sec * 1000 + fracMs;
      result.push({ timeMs, text });
    }
  }

  return result.sort((a, b) => a.timeMs - b.timeMs);
}

function renderSyncedLyrics(lyricsArray) {
  if (!lyricsLinesList) return;
  lyricsLinesList.innerHTML = '';
  parsedLyrics = lyricsArray;
  activeLyricIndex = -1;

  let touchStartY = 0;
  let touchStartX = 0;
  let isDraggingTouch = false;

  lyricsArray.forEach((item, idx) => {
    const lineEl = document.createElement('div');
    lineEl.className = 'lyric-line';
    lineEl.textContent = item.text;
    lineEl.dataset.idx = idx;

    lineEl.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        isDraggingTouch = false;
      }
    }, { passive: true });

    lineEl.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        const dx = Math.abs(e.touches[0].clientX - touchStartX);
        const dy = Math.abs(e.touches[0].clientY - touchStartY);
        if (dx > 8 || dy > 8) {
          isDraggingTouch = true;
        }
      }
    }, { passive: true });

    const handleSeekToLine = async () => {
      if (isDraggingTouch) return;
      try {
        isUserScrollingLyrics = false;
        await fetch('/api/player/seek', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position_ms: item.timeMs })
        });
        lastServerProgress = item.timeMs;
        lastServerFetchTime = Date.now();
        updateLyricsHighlight(item.timeMs, true);
      } catch (e) {}
    };

    lineEl.addEventListener('click', handleSeekToLine);

    item.el = lineEl;
    lyricsLinesList.appendChild(lineEl);
  });

  const curProg = isPlaying ? (lastServerProgress + (Date.now() - lastServerFetchTime)) : lastServerProgress;
  updateLyricsHighlight(curProg || 0, true);
}

function renderPlainLyrics(plainText) {
  if (!lyricsLinesList) return;
  lyricsLinesList.innerHTML = '';
  parsedLyrics = [];
  activeLyricIndex = -1;

  const lines = plainText.split('\n');
  lines.forEach(line => {
    if (line.trim()) {
      const el = document.createElement('div');
      el.className = 'lyric-line plain';
      el.textContent = line.trim();
      lyricsLinesList.appendChild(el);
    }
  });
}

function updateLyricsHighlight(currentMs, forceScroll = false) {
  if (!isLyricsOpen || isPlainLyrics || !parsedLyrics || parsedLyrics.length === 0) return;

  let newActive = -1;
  for (let i = 0; i < parsedLyrics.length; i++) {
    if (currentMs >= parsedLyrics[i].timeMs) {
      newActive = i;
    } else {
      break;
    }
  }

  if (newActive >= 0 && (newActive !== activeLyricIndex || forceScroll)) {
    if (activeLyricIndex >= 0 && parsedLyrics[activeLyricIndex]?.el) {
      parsedLyrics[activeLyricIndex].el.classList.remove('active');
    }
    activeLyricIndex = newActive;
    const target = parsedLyrics[activeLyricIndex];
    if (target?.el) {
      target.el.classList.add('active');
      if (lyricsScrollBox && (!isUserScrollingLyrics || forceScroll)) {
        const boxRect = lyricsScrollBox.getBoundingClientRect();
        const lineRect = target.el.getBoundingClientRect();
        const offsetWithinScroll = lineRect.top - boxRect.top + lyricsScrollBox.scrollTop;
        const scrollToY = offsetWithinScroll - (boxRect.height / 2) + (lineRect.height / 2);
        lyricsScrollBox.scrollTo({
          top: Math.max(0, scrollToY),
          behavior: 'smooth'
        });
      }
    }
  }
}

async function loadLyricsForCurrentTrack() {
  if (!currentPlayback || !currentPlayback.item) {
    if (lyricsLinesList) {
      lyricsLinesList.innerHTML = '<div class="lyrics-status-msg">Start playing music on Spotify to see lyrics.</div>';
    }
    return;
  }

  const track = currentPlayback.item;
  if (currentLyricsTrackId === track.id && (parsedLyrics.length > 0 || isPlainLyrics)) return;

  const currentSeq = ++lyricsFetchSeq;
  currentLyricsTrackId = track.id;
  if (lyricsLinesList) {
    lyricsLinesList.innerHTML = '<div class="lyrics-status-msg">⏳ Loading lyrics...</div>';
  }
  parsedLyrics = [];
  activeLyricIndex = -1;
  isPlainLyrics = false;

  try {
    const trackName = track.name;
    const artistName = track.artists && track.artists.length > 0 ? track.artists[0].name : '';
    const durationSec = Math.round((track.duration_ms || 0) / 1000);
    const albumName = track.album?.name || '';

    const url = `/api/lyrics?track=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artistName)}&duration=${durationSec}&album=${encodeURIComponent(albumName)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Could not fetch lyrics');

    const data = await res.json();
    if (currentSeq !== lyricsFetchSeq) return;

    if (data.instrumental) {
      if (lyricsLinesList) {
        lyricsLinesList.innerHTML = '<div class="lyrics-status-msg">🎵 Instrumental Track (No lyrics)</div>';
      }
      return;
    }

    if (data.syncedLyrics) {
      isPlainLyrics = false;
      const parsed = parseLrc(data.syncedLyrics);
      if (parsed.length > 0) {
        renderSyncedLyrics(parsed);
        return;
      }
    }

    if (data.plainLyrics) {
      isPlainLyrics = true;
      renderPlainLyrics(data.plainLyrics);
      return;
    }

    if (lyricsLinesList) {
      lyricsLinesList.innerHTML = '<div class="lyrics-status-msg">No lyrics found for this track.</div>';
    }
  } catch (e) {
    if (currentSeq === lyricsFetchSeq && lyricsLinesList) {
      lyricsLinesList.innerHTML = '<div class="lyrics-status-msg">No lyrics available for this track.</div>';
    }
  }
}

function toggleLyrics() {
  isLyricsOpen = !isLyricsOpen;
  if (isLyricsOpen) {
    if (coverContainer) coverContainer.style.display = 'none';
    if (lyricsContainer) lyricsContainer.style.display = 'flex';
    if (btnLyrics) btnLyrics.classList.add('active');
    activeLyricIndex = -1;
    loadLyricsForCurrentTrack();
    const curProg = isPlaying ? (lastServerProgress + (Date.now() - lastServerFetchTime)) : lastServerProgress;
    updateLyricsHighlight(curProg || 0, true);
  } else {
    if (coverContainer) coverContainer.style.display = 'flex';
    if (lyricsContainer) lyricsContainer.style.display = 'none';
    if (btnLyrics) btnLyrics.classList.remove('active');
  }
}

if (btnLyrics) btnLyrics.addEventListener('click', toggleLyrics);
if (btnCloseLyrics) btnCloseLyrics.addEventListener('click', toggleLyrics);
if (coverContainer) {
  coverContainer.style.cursor = 'pointer';
  coverContainer.addEventListener('click', toggleLyrics);
}

if (lyricsScrollBox) {
  const markUserScroll = () => {
    isUserScrollingLyrics = true;
    clearTimeout(userScrollTimeout);
    userScrollTimeout = setTimeout(() => {
      isUserScrollingLyrics = false;
      const curProg = isPlaying ? (lastServerProgress + (Date.now() - lastServerFetchTime)) : lastServerProgress;
      updateLyricsHighlight(curProg || 0, true);
    }, 3500);
  };

  lyricsScrollBox.addEventListener('wheel', markUserScroll, { passive: true });
  lyricsScrollBox.addEventListener('touchstart', markUserScroll, { passive: true });
  lyricsScrollBox.addEventListener('touchmove', (e) => {
    markUserScroll();
    e.stopPropagation();
  }, { passive: true });
}

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
    if (isLyricsOpen) updateLyricsHighlight(seekTargetMs, true);
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

function getPlaylistTrackCount(p) {
  if (!p) return 0;
  return p.totalTracks ?? p.items?.total ?? p.tracks?.total ?? 0;
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
        <div class="carplay-card-count">${getPlaylistTrackCount(p)} tracks</div>
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
      homeRecentsList.innerHTML = '<div class="carplay-loading">No recently played tracks found.</div>';
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
    homeRecentsList.innerHTML = '<div class="carplay-loading">Error loading recently played tracks.</div>';
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
  detailPlaylistTotal.textContent = `${getPlaylistTrackCount(playlist)} tracks`;
  detailPlaylistThumb.src = playlist.images?.[0]?.url || '';

  playlistTracksScroll.innerHTML = '<div class="carplay-loading">Loading tracks...</div>';
  switchView(viewPlaylistDetail);

  btnPlayAllPlaylist.onclick = async () => {
    trackTitle.textContent = playlist.name;
    trackArtist.textContent = 'Playing playlist...';
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
      trackArtist.textContent = 'Shuffling playlist...';
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
      playlistTracksScroll.innerHTML = '<div class="carplay-loading">No tracks found in this playlist.</div>';
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
    if (tracks && tracks.length > 0) detailPlaylistTotal.textContent = `${tracks.length} tracks`;
  } catch (e) {
    playlistTracksScroll.innerHTML = '<div class="carplay-loading">Error loading tracks.</div>';
  }
}

// 11. FAVORITES VIEW (Liked Songs on PC)
async function loadFavoritesData() {
  favoritesTracksScroll.innerHTML = '<div class="carplay-loading">Loading favorites...</div>';
  try {
    const res = await fetch('/api/spotify/favorites');
    const tracks = await res.json();
    favoritesTracksScroll.innerHTML = '';
    if (!tracks || tracks.length === 0) {
      favoritesTracksScroll.innerHTML = '<div class="carplay-loading">No liked songs found.</div>';
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
        trackArtist.textContent = 'Playing Liked Songs...';
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
          trackTitle.textContent = 'Liked Songs';
          trackArtist.textContent = 'Shuffling Liked Songs...';
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
    favoritesTracksScroll.innerHTML = '<div class="carplay-loading">Error loading favorites.</div>';
  }
}

// 12. SEARCH & VIRTUAL KEYBOARD
function updateSearchTextUI() {
  if (virtualSearchQuery.length > 0) {
    virtualSearchText.textContent = virtualSearchQuery;
    virtualSearchText.style.color = '#ffffff';
    btnClearSearch.style.display = 'block';
  } else {
    virtualSearchText.textContent = 'Type to search...';
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
  searchResultsList.innerHTML = '<div class="carplay-loading">Type with the keyboard or pick a genre!</div>';
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
    searchResultsList.innerHTML = '<div class="carplay-loading">Type with the keyboard or pick a genre!</div>';
    return;
  }
  const displayQ = escapeHtml(cleanQ);
  searchResultsList.innerHTML = `<div class="carplay-loading">Searching for "${displayQ}"...</div>`;
  try {
    const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(cleanQ)}`);
    if (!res.ok) {
      searchResultsList.innerHTML = `<div class="carplay-loading">No results found for "${displayQ}".</div>`;
      return;
    }
    const data = await res.json();
    const tracks = Array.isArray(data.tracks) ? data.tracks.filter(t => t && t.name) : [];
    const playlists = Array.isArray(data.playlists) ? data.playlists.filter(p => p && p.name) : [];

    if (tracks.length === 0 && playlists.length === 0) {
      searchResultsList.innerHTML = `<div class="carplay-loading">No results found for "${displayQ}".</div>`;
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
          <div class="list-item-artist">Playlist • ${getPlaylistTrackCount(p)} tracks</div>
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
      const artists = (t.artists || []).map(a => a.name).join(', ') || 'Unknown Artist';
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
    searchResultsList.innerHTML = `<div class="carplay-loading">No results found for "${displayQ}".</div>`;
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
          ${d.is_active ? '<span style="color:#1db954; font-weight:800; font-size:0.88rem;">Active</span>' : ''}
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

const btnStopNestHubScreen = document.getElementById('btn-stop-nesthub-screen');
if (btnStopNestHubScreen) {
  btnStopNestHubScreen.addEventListener('click', async () => {
    deviceModal.style.display = 'none';
    btnStopNestHubScreen.disabled = true;
    try {
      await fetch('/api/cast/stop', { method: 'POST' });
    } catch (e) {
      console.warn('Error stopping cast:', e);
    } finally {
      setTimeout(() => { btnStopNestHubScreen.disabled = false; }, 2000);
    }
  });
}

// Open Settings Modal from Device Modal
const btnOpenSettings = document.getElementById('btn-open-settings');
const btnCloseSetupModal = document.getElementById('btn-close-setup-modal');
if (btnOpenSettings) {
  btnOpenSettings.addEventListener('click', () => {
    deviceModal.style.display = 'none';
    const setupModal = document.getElementById('setup-modal');
    if (setupModal) {
      setupModal.style.display = 'flex';
      if (btnCloseSetupModal) btnCloseSetupModal.style.display = 'block';
      const configSec = document.getElementById('setup-config-section');
      const loginSec = document.getElementById('setup-login-section');
      if (configSec) configSec.style.display = 'block';
      if (loginSec) loginSec.style.display = 'none';
    }
  });
}
if (btnCloseSetupModal) {
  btnCloseSetupModal.addEventListener('click', () => {
    const setupModal = document.getElementById('setup-modal');
    if (setupModal) setupModal.style.display = 'none';
  });
}

// Copy Redirect URI Button
const btnCopyRedirect = document.getElementById('btn-copy-redirect');
if (btnCopyRedirect) {
  btnCopyRedirect.addEventListener('click', () => {
    const text = document.getElementById('setup-redirect-uri')?.textContent || 'http://127.0.0.1:8888/callback';
    navigator.clipboard.writeText(text).then(() => {
      btnCopyRedirect.textContent = '✓ Copied!';
      setTimeout(() => { btnCopyRedirect.textContent = '📋 Copy'; }, 2000);
    }).catch(() => {
      prompt('Copy this URL:', text);
    });
  });
}

// Auto-detect Google Nest Hub via Bonjour / mDNS
const btnScanNestHub = document.getElementById('btn-scan-nesthub');
const scanStatus = document.getElementById('scan-nesthub-status');
const deviceSelect = document.getElementById('setup-nesthub-device');
const nameInput = document.getElementById('setup-nesthub-name');
const ipInput = document.getElementById('setup-nesthub-ip');

if (btnScanNestHub) {
  btnScanNestHub.addEventListener('click', async () => {
    if (scanStatus) {
      scanStatus.textContent = '⏳ Searching for Nest Hub on your Wi-Fi network...';
      scanStatus.style.color = '#38bdf8';
    }
    btnScanNestHub.disabled = true;
    try {
      const res = await fetch('/api/cast/devices');
      const devices = await res.json();
      btnScanNestHub.disabled = false;
      if (devices && devices.length > 0) {
        if (deviceSelect) {
          deviceSelect.innerHTML = '<option value="" disabled selected>-- Select a discovered Cast device --</option>';
          devices.forEach((d, idx) => {
            const opt = document.createElement('option');
            opt.value = d.ip;
            opt.dataset.name = d.name || '';
            const name = d.name || 'Cast Device';
            const model = d.model || 'Google Nest Hub';
            opt.textContent = `[${idx + 1}] ${name} (${model} - ${d.ip})`;
            deviceSelect.appendChild(opt);
          });
          deviceSelect.style.display = 'block';
        }

        // Pre-select target device (192.168.1.39 / "Slaapkamer Danian") if present, or current configured IP
        const currentConfiguredIp = ipInput ? ipInput.value.trim() : '';
        const targetDevice = devices.find(d => d.ip === '192.168.1.39' || (d.name && d.name.toLowerCase().includes('slaapkamer danian'))) ||
                             (currentConfiguredIp ? devices.find(d => d.ip === currentConfiguredIp) : null);

        if (targetDevice) {
          if (deviceSelect) deviceSelect.value = targetDevice.ip;
          if (ipInput) ipInput.value = targetDevice.ip;
          if (nameInput) nameInput.value = targetDevice.name || '';
          if (scanStatus) {
            scanStatus.textContent = `✓ Discovered ${devices.length} device(s). Pre-selected: ${targetDevice.name} (${targetDevice.ip})`;
            scanStatus.style.color = '#4ade80';
          }
        } else {
          // Do not silently auto-select devices[0]; let user select from dropdown
          if (deviceSelect) deviceSelect.value = '';
          if (scanStatus) {
            scanStatus.textContent = `✓ Discovered ${devices.length} device(s). Please choose your device from the list above.`;
            scanStatus.style.color = '#38bdf8';
          }
        }
      } else {
        if (deviceSelect) deviceSelect.style.display = 'none';
        if (scanStatus) {
          scanStatus.textContent = 'No Google Cast devices found automatically. Please enter IP manually.';
          scanStatus.style.color = '#fbbf24';
        }
      }
    } catch (e) {
      btnScanNestHub.disabled = false;
      if (scanStatus) {
        scanStatus.textContent = 'Scan error: ' + e.message;
        scanStatus.style.color = '#f87171';
      }
    }
  });
}

// Interactive device selection change handler
if (deviceSelect) {
  deviceSelect.addEventListener('change', () => {
    const selectedOpt = deviceSelect.options[deviceSelect.selectedIndex];
    if (!selectedOpt || !selectedOpt.value) return;
    const ip = selectedOpt.value;
    const name = selectedOpt.dataset.name || '';
    if (ipInput) ipInput.value = ip;
    if (nameInput) nameInput.value = name;
    if (scanStatus) {
      scanStatus.textContent = `✓ Selected: ${name ? name + ' ' : ''}(${ip})`;
      scanStatus.style.color = '#4ade80';
    }
  });
}

// 14. First-Time Setup & Auth Check
async function checkAuthStatus() {
  try {
    const res = await fetch('/auth/status');
    if (!res.ok) return;
    const status = await res.json();
    const setupModal = document.getElementById('setup-modal');
    if (!setupModal) return;

    // Prefill config inputs if available
    try {
      const cfgRes = await fetch('/api/config');
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        const ipInput = document.getElementById('setup-nesthub-ip');
        const nameInput = document.getElementById('setup-nesthub-name');
        const cidInput = document.getElementById('setup-client-id');
        const timeoutInput = document.getElementById('setup-idle-timeout');
        if (ipInput && cfg.nestHubIp && !ipInput.value) ipInput.value = cfg.nestHubIp;
        if (nameInput && cfg.nestHubName && !nameInput.value) nameInput.value = cfg.nestHubName;
        if (cidInput && cfg.clientId && !cidInput.value && !cfg.clientId.includes('YOUR_SPOTIFY') && !cfg.clientId.includes('YOUR_CLIENT_ID')) cidInput.value = cfg.clientId;
        if (timeoutInput && cfg.idleTimeoutMinutes !== undefined) timeoutInput.value = String(cfg.idleTimeoutMinutes);
      }
    } catch (err) {}

    if (!status.isConfigured || !status.isAuthenticated) {
      setupModal.style.display = 'flex';
      if (btnCloseSetupModal) btnCloseSetupModal.style.display = status.isAuthenticated ? 'block' : 'none';
      const configSec = document.getElementById('setup-config-section');
      const loginSec = document.getElementById('setup-login-section');

      if (!status.isConfigured) {
        if (configSec) configSec.style.display = 'block';
        if (loginSec) loginSec.style.display = 'none';
      } else {
        if (configSec) configSec.style.display = 'none';
        if (loginSec) loginSec.style.display = 'block';
      }
    } else {
      setupModal.style.display = 'none';
    }
  } catch (e) {}
}

const btnSaveSetupConfig = document.getElementById('btn-save-setup-config');
if (btnSaveSetupConfig) {
  btnSaveSetupConfig.addEventListener('click', async () => {
    const clientId = document.getElementById('setup-client-id').value.trim();
    const clientSecret = document.getElementById('setup-client-secret').value.trim();
    const nestHubIp = document.getElementById('setup-nesthub-ip').value.trim();
    const nestHubName = document.getElementById('setup-nesthub-name')?.value.trim() || undefined;
    const idleTimeoutMinutes = Number(document.getElementById('setup-idle-timeout')?.value || 10);

    if (!clientId || !clientSecret) {
      alert('Please enter both your Client ID and Client Secret.');
      return;
    }

    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret, nestHubName, nestHubIp, idleTimeoutMinutes })
    });

    if (res.ok) {
      const configSec = document.getElementById('setup-config-section');
      const loginSec = document.getElementById('setup-login-section');
      if (configSec) configSec.style.display = 'none';
      if (loginSec) loginSec.style.display = 'block';
    }
  });
}

// Initial Boot
checkAuthStatus();
fetchPlaybackState();
setInterval(fetchPlaybackState, 1500);
loadHomeData();

// Dynamic Home Greeting in English
function updateHomeGreeting() {
  const greetingEl = document.getElementById('home-greeting-title');
  if (!greetingEl) return;
  const hour = new Date().getHours();
  if (hour < 12) greetingEl.innerHTML = 'Good morning &rsaquo;';
  else if (hour < 18) greetingEl.innerHTML = 'Good afternoon &rsaquo;';
  else greetingEl.innerHTML = 'Good evening &rsaquo;';
}
updateHomeGreeting();
setInterval(updateHomeGreeting, 60000);
