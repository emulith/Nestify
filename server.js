const express = require('express');
const path = require('path');
const os = require('os');
const spotify = require('./lib/spotify');
const caster = require('./lib/caster');
const updater = require('./lib/update-manager');

const app = express();
const PORT = process.env.PORT || 8888;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Fast static asset serving with cache-control
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  maxAge: '1h'
}));

// Helper: Get local primary IPv4 address
function getLocalIp(targetIp = '192.168.1.39') {
  const nets = os.networkInterfaces();
  const targetSubnet = targetIp.split('.').slice(0, 3).join('.');
  let bestIp = null;
  let fallbackIp = null;

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        const addr = net.address;
        if (addr.startsWith('192.168.56.') || addr.startsWith('169.254.')) continue;
        if (addr.startsWith(targetSubnet + '.')) {
          return addr;
        }
        if (!bestIp && !addr.startsWith('172.') && !addr.startsWith('10.')) {
          bestIp = addr;
        } else if (!fallbackIp) {
          fallbackIp = addr;
        }
      }
    }
  }
  return bestIp || fallbackIp || '127.0.0.1';
}

const localIp = getLocalIp();

// Get Current Configuration & System Status
app.get('/api/config', (req, res) => {
  res.json({
    isConfigured: spotify.isConfigured(),
    isAuthenticated: spotify.isAuthenticated(),
    clientId: spotify.config.clientId || '',
    preferredDeviceName: spotify.config.preferredDeviceName || 'PC',
    nestHubName: spotify.config.nestHubName || 'Google Nest Hub',
    nestHubIp: spotify.config.nestHubIp || '192.168.1.39',
    idleTimeoutMinutes: spotify.config.idleTimeoutMinutes !== undefined ? Number(spotify.config.idleTimeoutMinutes) : 10,
    localIp,
    port: PORT,
    dashboardUrl: `http://${localIp}:${PORT}`
  });
});

// Update Configuration (Client ID, Client Secret, Nest Hub IP, Idle Timeout)
app.post('/api/config', (req, res) => {
  try {
    const { clientId, clientSecret, preferredDeviceName, nestHubName, nestHubIp, idleTimeoutMinutes } = req.body;
    const updated = spotify.saveConfig({
      clientId: clientId !== undefined ? clientId.trim() : spotify.config.clientId,
      clientSecret: clientSecret !== undefined ? clientSecret.trim() : spotify.config.clientSecret,
      preferredDeviceName: preferredDeviceName || spotify.config.preferredDeviceName,
      nestHubName: nestHubName !== undefined ? nestHubName : spotify.config.nestHubName,
      nestHubIp: nestHubIp || spotify.config.nestHubIp,
      idleTimeoutMinutes: idleTimeoutMinutes !== undefined ? Number(idleTimeoutMinutes) : (spotify.config.idleTimeoutMinutes || 10)
    });
    res.json({ success: true, config: updated });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper: Get OAuth Redirect URI (Spotify requires 127.0.0.1 for local HTTP, 'localhost' is not allowed by Spotify)
function getRedirectUri(req) {
  return `http://127.0.0.1:${PORT}/callback`;
}

// Start Spotify OAuth Login
app.get('/auth/login', (req, res) => {
  try {
    const redirectUri = getRedirectUri(req);
    const url = spotify.getAuthUrl(redirectUri);
    res.redirect(url);
  } catch (e) {
    res.status(400).send(`Error starting login: ${e.message}`);
  }
});

// Spotify OAuth Callback
app.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) {
    return res.status(400).send(`Spotify authorization rejected: ${error}`);
  }
  if (!code) {
    return res.status(400).send('No authorization code received from Spotify.');
  }

  try {
    const redirectUri = getRedirectUri(req);
    await spotify.exchangeCode(code, redirectUri);
    console.log('[Spotify] Successfully logged in and tokens saved!');
    res.redirect('/');
  } catch (e) {
    console.error('[Spotify] Callback error:', e.message);
    res.status(500).send(`Error exchanging tokens: ${e.message}`);
  }
});

// Auth Status Check
app.get('/auth/status', (req, res) => {
  res.json({
    isAuthenticated: spotify.isAuthenticated(),
    isConfigured: spotify.isConfigured()
  });
});

// In-Memory Fast Cache for Playback State & Devices (reduces upstream latency & eliminates button lag)
let cachedPlaybackState = null;
let lastStateFetchTime = 0;
let lastKnownTrackId = null;
const STATE_CACHE_TTL = 2000; // 2s TTL avoids hitting Spotify multiple times per second across devices

let cachedTargetDeviceId = null;
let lastDeviceFetchTime = 0;
const DEVICE_CACHE_TTL = 25000; // 25s TTL for device ID

async function getCachedPlaybackState(force = false) {
  const now = Date.now();
  if (!force && cachedPlaybackState && (now - lastStateFetchTime < STATE_CACHE_TTL)) {
    return cachedPlaybackState;
  }
  try {
    const state = await spotify.getPlaybackState();
    if (state) {
      cachedPlaybackState = state;
      lastStateFetchTime = now;
      const currentTrackId = state.item?.id;
      if (currentTrackId && currentTrackId !== lastKnownTrackId) {
        lastKnownTrackId = currentTrackId;
        invalidateQueueCache();
      }
    }
    return state || cachedPlaybackState;
  } catch (e) {
    if (cachedPlaybackState) return cachedPlaybackState;
    throw e;
  }
}

function updatePlaybackStateOptimistic(patch) {
  if (cachedPlaybackState) {
    cachedPlaybackState = { ...cachedPlaybackState, ...patch };
    lastStateFetchTime = Date.now();
  }
}

function invalidatePlaybackState() {
  lastStateFetchTime = 0;
}

// Helper: Get target device (PC preferred, cached to eliminate blocking calls)
async function getTargetDeviceId(preferredId = null) {
  if (preferredId) {
    cachedTargetDeviceId = preferredId;
    lastDeviceFetchTime = Date.now();
    return preferredId;
  }
  const now = Date.now();
  if (cachedTargetDeviceId && (now - lastDeviceFetchTime < DEVICE_CACHE_TTL)) {
    return cachedTargetDeviceId;
  }
  try {
    const devices = await spotify.getDevices();
    const pc = devices.find(d => 
      (d.name && d.name.toLowerCase().includes((spotify.config.preferredDeviceName || 'PC').toLowerCase())) || 
      (d.type && d.type.toLowerCase() === 'computer')
    );
    if (pc) {
      cachedTargetDeviceId = pc.id;
      lastDeviceFetchTime = now;
      return pc.id;
    }
    const state = cachedPlaybackState || await spotify.getPlaybackState();
    if (state && state.device && state.device.id) {
      cachedTargetDeviceId = state.device.id;
      lastDeviceFetchTime = now;
      return state.device.id;
    }
    if (devices.length > 0) {
      cachedTargetDeviceId = devices[0].id;
      lastDeviceFetchTime = now;
      return devices[0].id;
    }
  } catch (e) {}
  return null;
}

// Spotify Current Playback State (Served with low-latency cache)
app.get('/api/player/state', async (req, res) => {
  if (!spotify.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const state = await getCachedPlaybackState();
    res.json(state || { is_playing: false, item: null, device: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Spotify Available Devices
app.get('/api/player/devices', async (req, res) => {
  if (!spotify.isAuthenticated()) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const devices = await spotify.getDevices();
    res.json(devices);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Spotify Play / Resume (Optimistic response)
app.post('/api/player/play', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    let { deviceId } = req.body;
    updatePlaybackStateOptimistic({ is_playing: true });

    if (!deviceId) {
      deviceId = await getTargetDeviceId();
    }

    await spotify.play(deviceId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Spotify Pause (Optimistic response)
app.post('/api/player/pause', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    updatePlaybackStateOptimistic({ is_playing: false });
    await spotify.pause();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Spotify Next (Fast dispatch)
app.post('/api/player/next', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    invalidatePlaybackState();
    invalidateQueueCache();
    await spotify.next();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Spotify Previous (Fast dispatch)
app.post('/api/player/previous', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    invalidatePlaybackState();
    invalidateQueueCache();
    await spotify.previous();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Spotify Seek
app.post('/api/player/seek', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { position_ms } = req.body;
    updatePlaybackStateOptimistic({ progress_ms: position_ms });
    await spotify.seek(position_ms);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Spotify Volume
app.post('/api/player/volume', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    let { volume_percent, deviceId } = req.body;
    deviceId = await getTargetDeviceId(deviceId);
    if (cachedPlaybackState && cachedPlaybackState.device) {
      cachedPlaybackState.device.volume_percent = volume_percent;
    }
    await spotify.setVolume(volume_percent, deviceId);
    res.json({ success: true, volume_percent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Spotify Shuffle
app.post('/api/player/shuffle', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    let { state, deviceId } = req.body;
    deviceId = await getTargetDeviceId(deviceId);
    updatePlaybackStateOptimistic({ shuffle_state: Boolean(state) });
    await spotify.setShuffle(state, deviceId);
    res.json({ success: true, shuffle_state: Boolean(state) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Spotify Repeat
app.post('/api/player/repeat', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { state } = req.body; // 'track', 'context', 'off'
    updatePlaybackStateOptimistic({ repeat_state: state });
    await spotify.setRepeat(state);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Spotify Queue (Cached to prevent slamming API)
let cachedQueueData = null;
let lastQueueFetchTime = 0;
const QUEUE_CACHE_TTL = 20000; // 20s TTL for queue

function invalidateQueueCache() {
  lastQueueFetchTime = 0;
}

app.get('/api/player/queue', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  const now = Date.now();
  const force = req.query.force === 'true' || req.query.force === '1';
  if (!force && cachedQueueData && (now - lastQueueFetchTime < QUEUE_CACHE_TTL)) {
    return res.json(cachedQueueData);
  }
  try {
    const queueData = await spotify.getQueue();
    if (queueData && (queueData.queue?.length > 0 || queueData.currently_playing)) {
      cachedQueueData = queueData;
    } else if (!cachedQueueData) {
      cachedQueueData = queueData;
    }
    lastQueueFetchTime = now;
    res.json(cachedQueueData || { currently_playing: null, queue: [] });
  } catch (e) {
    if (cachedQueueData) return res.json(cachedQueueData);
    res.status(500).json({ error: e.message });
  }
});

// Spotify Add to Queue
app.post('/api/player/queue/add', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { uri, deviceId } = req.body;
    if (!uri) return res.status(400).json({ error: 'Track URI is required' });
    invalidateQueueCache();
    await spotify.addToQueue(uri, deviceId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Lyrics Cache and Clean Helper
const lyricsCache = new Map();

function cleanSongTitle(title) {
  if (!title) return '';
  return title
    .replace(/\s*[\(\[][^\)\]]*(feat\.|ft\.|with|remaster|version|bonus|live|radio edit|anthem|club mix|original mix|extended|official|audio|video|edit)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s*-\s*.*(feat\.|ft\.|with|remaster|radio edit|live|bonus|deluxe|version|mix|edit|mono|stereo|soundtrack|anthem).*/gi, '')
    .replace(/\s*-\s*\d{4}\s+remaster.*/gi, '')
    .trim();
}

async function fetchFromLrclib(trackName, artistName, duration = null, albumName = null) {
  const headers = { 'User-Agent': 'Nestify/1.0.0 (https://github.com/emulith/Nestify)' };
  let getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`;
  if (duration) {
    getUrl += `&duration=${Math.round(duration)}`;
  }
  if (albumName) {
    getUrl += `&album_name=${encodeURIComponent(albumName)}`;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(getUrl, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.syncedLyrics || data.plainLyrics || data.instrumental) {
          return {
            syncedLyrics: data.syncedLyrics || null,
            plainLyrics: data.plainLyrics || null,
            instrumental: Boolean(data.instrumental)
          };
        }
      }
      if (res.status === 404) {
        return null;
      }
      if (res.status === 503 || res.status === 429) {
        await new Promise(r => setTimeout(r, 400));
        continue;
      }
    } catch (e) {
      if (attempt === 0) await new Promise(r => setTimeout(r, 400));
    }
  }
  return null;
}

async function searchFromLrclib(query, expectedDuration = null) {
  const headers = { 'User-Agent': 'Nestify/1.0.0 (https://github.com/emulith/Nestify)' };
  const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(searchUrl, { headers });
      if (res.ok) {
        const results = await res.json();
        if (Array.isArray(results) && results.length > 0) {
          const valid = results.filter(r => r && (r.syncedLyrics || r.plainLyrics || r.instrumental));
          if (valid.length > 0) {
            if (expectedDuration) {
              const matched = valid.find(r => r.duration && Math.abs(r.duration - expectedDuration) <= 4 && r.syncedLyrics);
              if (matched) {
                return {
                  syncedLyrics: matched.syncedLyrics || null,
                  plainLyrics: matched.plainLyrics || null,
                  instrumental: Boolean(matched.instrumental)
                };
              }
            }
            const best = valid.find(r => r.syncedLyrics) || valid[0];
            return {
              syncedLyrics: best.syncedLyrics || null,
              plainLyrics: best.plainLyrics || null,
              instrumental: Boolean(best.instrumental)
            };
          }
        }
      }
      if (res.status === 503 || res.status === 429) {
        await new Promise(r => setTimeout(r, 400));
        continue;
      }
    } catch (e) {
      if (attempt === 0) await new Promise(r => setTimeout(r, 400));
    }
  }
  return null;
}

// Fetch Synced / Plain Lyrics (powered by open LRCLIB)
app.get('/api/lyrics', async (req, res) => {
  const { track, artist, duration, album } = req.query;
  if (!track || !artist) {
    return res.status(400).json({ error: 'Track and artist are required' });
  }

  const durationSec = duration ? parseFloat(duration) : null;
  const cleanTrack = cleanSongTitle(track);
  const primaryArtist = (artist || '').split(',')[0].replace(/\s*(feat\.|ft\.|with).*/gi, '').trim();
  const cacheKey = `${primaryArtist.toLowerCase()}:${cleanTrack.toLowerCase()}:${durationSec ? Math.round(durationSec) : ''}`;

  if (lyricsCache.has(cacheKey)) {
    return res.json(lyricsCache.get(cacheKey));
  }

  try {
    let result = null;

    // Attempt 1: Exact with duration & clean title + primary artist
    if (durationSec) {
      result = await fetchFromLrclib(cleanTrack, primaryArtist, durationSec, album);
      if (!result && cleanTrack !== track) {
        result = await fetchFromLrclib(track, primaryArtist, durationSec, album);
      }
    }

    // Attempt 2: Clean track + primary artist (no duration constraint)
    if (!result) {
      result = await fetchFromLrclib(cleanTrack, primaryArtist);
    }

    // Attempt 3: Clean track + full artist string
    if (!result && primaryArtist !== artist) {
      result = await fetchFromLrclib(cleanTrack, artist);
    }

    // Attempt 4: Raw track name + primary artist
    if (!result && cleanTrack !== track) {
      result = await fetchFromLrclib(track, primaryArtist);
    }

    // Attempt 5: Search query with Clean track + primary artist
    if (!result) {
      result = await searchFromLrclib(`${cleanTrack} ${primaryArtist}`, durationSec);
    }

    // Attempt 6: Search query with raw track + primary artist if different
    if (!result && cleanTrack !== track) {
      result = await searchFromLrclib(`${track} ${primaryArtist}`, durationSec);
    }

    const finalResult = result || { syncedLyrics: null, plainLyrics: null, notFound: true };
    if (result) {
      lyricsCache.set(cacheKey, finalResult);
    }
    return res.json(finalResult);
  } catch (e) {
    console.error('[Lyrics] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Spotify Transfer Playback (to PC or other device)
app.post('/api/player/transfer', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { deviceId, play } = req.body;
    await spotify.transferPlayback(deviceId, play !== false);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// In-memory caches for library data (protects against rate limits during tab navigation)
let cachedPlaylists = null;
let lastPlaylistsTime = 0;
const PLAYLISTS_CACHE_TTL = 60000;

let cachedFavorites = null;
let lastFavoritesTime = 0;
const FAVORITES_CACHE_TTL = 60000;

let cachedRecents = null;
let lastRecentsTime = 0;
const RECENTS_CACHE_TTL = 30000;

const playlistTracksCache = new Map();
const PLAYLIST_TRACKS_CACHE_TTL = 60000;

// Get User Playlists
app.get('/api/spotify/playlists', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  const now = Date.now();
  const force = req.query.force === 'true' || req.query.force === '1';
  if (!force && cachedPlaylists && (now - lastPlaylistsTime < PLAYLISTS_CACHE_TTL)) {
    return res.json(cachedPlaylists);
  }
  try {
    const playlists = await spotify.getPlaylists(50);
    if (playlists && playlists.length > 0) {
      cachedPlaylists = playlists;
      lastPlaylistsTime = now;
    }
    res.json(cachedPlaylists || playlists);
  } catch (e) {
    if (cachedPlaylists) return res.json(cachedPlaylists);
    res.status(500).json({ error: e.message });
  }
});

// Get Tracks in a specific playlist
app.get('/api/spotify/playlists/:id/tracks', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  const now = Date.now();
  const cached = playlistTracksCache.get(req.params.id);
  if (cached && (now - cached.time < PLAYLIST_TRACKS_CACHE_TTL)) {
    return res.json(cached.tracks);
  }
  try {
    const tracks = await spotify.getPlaylistTracks(req.params.id, 100);
    if (tracks && tracks.length > 0) {
      playlistTracksCache.set(req.params.id, { tracks, time: now });
    }
    res.json(tracks);
  } catch (e) {
    if (cached) return res.json(cached.tracks);
    res.status(500).json({ error: e.message });
  }
});

// Get User Liked Songs (Favorites)
app.get('/api/spotify/favorites', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  const now = Date.now();
  const force = req.query.force === 'true' || req.query.force === '1';
  if (!force && cachedFavorites && (now - lastFavoritesTime < FAVORITES_CACHE_TTL)) {
    return res.json(cachedFavorites);
  }
  try {
    const tracks = await spotify.getFavorites(50);
    if (tracks && tracks.length > 0) {
      cachedFavorites = tracks;
      lastFavoritesTime = now;
    }
    res.json(cachedFavorites || tracks);
  } catch (e) {
    if (cachedFavorites) return res.json(cachedFavorites);
    res.status(500).json({ error: e.message });
  }
});

// Get Recently Played Tracks
app.get('/api/spotify/recently-played', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  const now = Date.now();
  const force = req.query.force === 'true' || req.query.force === '1';
  if (!force && cachedRecents && (now - lastRecentsTime < RECENTS_CACHE_TTL)) {
    return res.json(cachedRecents);
  }
  try {
    const items = await spotify.getRecentlyPlayed(20);
    if (items && items.length > 0) {
      cachedRecents = items;
      lastRecentsTime = now;
    }
    res.json(cachedRecents || items);
  } catch (e) {
    if (cachedRecents) return res.json(cachedRecents);
    res.status(500).json({ error: e.message });
  }
});

// Search Tracks and Playlists
app.get('/api/spotify/search', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const query = (req.query.q || '').trim();
    if (!query || query.length < 1) return res.json({ tracks: [], playlists: [] });
    const results = await spotify.search(query);
    res.json(results || { tracks: [], playlists: [] });
  } catch (e) {
    console.error('[API] Search error:', e.message);
    res.json({ tracks: [], playlists: [] });
  }
});

// Start Playing a Playlist / Album Context (supports offset_uri)
app.post('/api/spotify/play-context', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { context_uri, offset_uri } = req.body;
    const deviceId = await getTargetDeviceId(req.body.deviceId);
    invalidatePlaybackState();
    invalidateQueueCache();
    await spotify.playContext(context_uri, deviceId, offset_uri);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start Playing Favorites / Liked Songs
app.post('/api/spotify/play-favorites', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { track_uri } = req.body;
    const deviceId = await getTargetDeviceId(req.body.deviceId);
    invalidatePlaybackState();
    invalidateQueueCache();
    await spotify.playFavorites(track_uri, deviceId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Start Playing a Specific Track (uses smart album context or collection)
app.post('/api/spotify/play-track', async (req, res) => {
  if (!spotify.isAuthenticated()) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const { uri, album_uri, context_uri } = req.body;
    const deviceId = await getTargetDeviceId(req.body.deviceId);
    invalidatePlaybackState();
    invalidateQueueCache();
    await spotify.playTrackSmart(uri, album_uri, context_uri, deviceId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Scan Google Cast Devices on Network
app.get('/api/cast/devices', async (req, res) => {
  try {
    const devices = await caster.scanDevices(3000);
    res.json(devices);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get Cast Status
app.get('/api/cast/status', (req, res) => {
  res.json(caster.getStatus());
});

// Smart Spotify Presence Watcher (Auto-Cast on play, Auto-Return to Google Clock/Photos on pause)
let isCastedToNestHub = false;
let inactiveSeconds = 0;
let isPresenceChecking = false;
let wasPlaying = false;
let manuallyDismissed = false;
let pausedSeconds = 10; // Start with 10s so first music play auto-casts immediately

async function startSmartPresenceWatcher() {
  const getTargetIp = () => spotify.config.nestHubIp || '192.168.1.39';
  const getTargetUrl = () => `http://${getLocalIp(getTargetIp())}:${PORT}/?device=nesthub`;

  const getTimeoutSeconds = () => {
    const minutes = (spotify.config && spotify.config.idleTimeoutMinutes !== undefined)
      ? Number(spotify.config.idleTimeoutMinutes)
      : 10;
    return minutes > 0 ? minutes * 60 : Infinity;
  };

  console.log('[SmartSync] Smart Spotify presence detection active.');
  console.log(`[SmartSync] Nest Hub (${getTargetIp()}) displays Nestify while music plays (sleeps after ${spotify.config.idleTimeoutMinutes || 10} min pause).`);

  try {
    const initialState = await getCachedPlaybackState();
    if (initialState && initialState.is_playing) {
      console.log('[SmartSync] Spotify is already playing music! Starting Nest Hub...');
      await caster.castUrl(getTargetIp(), getTargetUrl());
      isCastedToNestHub = true;
      wasPlaying = true;
      manuallyDismissed = false;
      pausedSeconds = 0;
    }
  } catch (e) {}

  setInterval(async () => {
    if (isPresenceChecking) return;
    if (!spotify.isAuthenticated()) return;
    isPresenceChecking = true;

    try {
      const state = await getCachedPlaybackState();
      const isPlaying = Boolean(state && state.is_playing);

      if (isPlaying) {
        inactiveSeconds = 0;

        // If music was paused for at least 6s and now resumes, clear manual dismissal
        if (!wasPlaying && pausedSeconds >= 6) {
          manuallyDismissed = false;
        }
        pausedSeconds = 0;

        // Only auto-cast if music is playing, not already casted, and user has not manually closed the screen
        if (!isCastedToNestHub && !manuallyDismissed) {
          console.log('[SmartSync] 🎵 Spotify started playing! Auto-casting to Nest Hub...');
          await caster.castUrl(getTargetIp(), getTargetUrl());
          isCastedToNestHub = true;
        }
      } else {
        pausedSeconds += 3;

        if (isCastedToNestHub) {
          inactiveSeconds += 3;
          const maxSeconds = getTimeoutSeconds();
          if (inactiveSeconds >= maxSeconds) {
            console.log(`[SmartSync] ⏸️ Spotify has been inactive for ${inactiveSeconds}s (${Math.round(inactiveSeconds / 60)} min) -> Returning Nest Hub to Clock & Photos...`);
            await caster.stopCast(getTargetIp());
            isCastedToNestHub = false;
            inactiveSeconds = 0;
          }
        }
      }

      wasPlaying = isPlaying;
    } catch (e) {
      // Ignore background transient errors
    } finally {
      isPresenceChecking = false;
    }
  }, 3000);
}

// Cast Dashboard URL to Nest Hub
app.post(['/api/cast', '/api/cast/start'], async (req, res) => {
  try {
    const targetIp = (req.body && req.body.ip) || spotify.config.nestHubIp || '192.168.1.39';
    const targetUrl = `http://${getLocalIp(targetIp)}:${PORT}/?device=nesthub`;
    console.log(`[Server] Casting to Nest Hub (${targetIp}): ${targetUrl}`);
    const result = await caster.castUrl(targetIp, targetUrl);
    isCastedToNestHub = true;
    manuallyDismissed = false; // Reset manual dismissal when explicit cast is started
    inactiveSeconds = 0;
    pausedSeconds = 0;
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Stop Casting (Returns Nest Hub to Google Photos / Clock)
app.post('/api/cast/stop', async (req, res) => {
  try {
    const targetIp = spotify.config.nestHubIp || '192.168.1.39';
    isCastedToNestHub = false;
    manuallyDismissed = true; // Mark as manually dismissed so SmartSync will NOT immediately recast
    inactiveSeconds = 0;
    pausedSeconds = 0;
    console.log('[SmartSync] Nest Hub screen closed by user. Holding screen off until new playback session.');
    const result = await caster.stopCast(targetIp);
    res.json(result || { success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Graceful Application & Cast Session Shutdown
app.post('/api/shutdown', async (req, res) => {
  res.json({ success: true, message: 'Server shutting down...' });
  const targetIp = spotify.config.nestHubIp || '192.168.1.39';
  try {
    await caster.stopCast(targetIp);
  } catch (e) {
    console.warn('[Server] Error stopping cast during shutdown:', e.message);
  }
  setTimeout(() => process.exit(0), 400);
});

// Check for updates
app.get('/api/system/update', async (req, res) => {
  try {
    const status = await updater.checkForUpdates();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Pull updates
app.post('/api/system/update', async (req, res) => {
  try {
    const result = await updater.pullUpdate();
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🎵 Nestify Spotify Controller started!`);
  console.log(`   Local PC URL: http://localhost:${PORT}`);
  console.log(`   Network URL:   http://${localIp}:${PORT}`);
  console.log('====================================================');

  if (process.argv.includes('--autocast')) {
    startSmartPresenceWatcher();
  }
});

async function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Shutting down cleanly...`);
  const targetIp = spotify.config.nestHubIp || '192.168.1.39';
  try {
    await caster.stopCast(targetIp);
  } catch (e) {}
  process.exit(0);
}
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

