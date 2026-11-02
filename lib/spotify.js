const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'config', 'config.json');
const TOKENS_FILE = path.join(__dirname, '..', 'config', 'tokens.json');

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-read-recently-played',
  'user-top-read'
].join(' ');

class SpotifyService {
  constructor() {
    this.config = this.loadConfig();
    this.tokens = this.loadTokens();
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const loaded = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        if (loaded.idleTimeoutMinutes === undefined) loaded.idleTimeoutMinutes = 10;
        return loaded;
      }
    } catch (e) {
      console.error('Error loading config:', e.message);
    }
    return {
      clientId: process.env.SPOTIFY_CLIENT_ID || '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || '',
      preferredDeviceName: 'PC',
      nestHubName: 'Google Nest Hub',
      nestHubIp: '192.168.1.39',
      idleTimeoutMinutes: 10
    };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf8');
    return this.config;
  }

  loadTokens() {
    try {
      if (fs.existsSync(TOKENS_FILE)) {
        return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('Error loading tokens:', e.message);
    }
    return null;
  }

  saveTokens(tokens) {
    this.tokens = tokens;
    fs.mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(this.tokens, null, 2), 'utf8');
  }

  isConfigured() {
    if (!this.config || !this.config.clientId || !this.config.clientSecret) return false;
    const cid = String(this.config.clientId).trim();
    const sec = String(this.config.clientSecret).trim();
    if (!cid || !sec) return false;
    if (cid.includes('YOUR_SPOTIFY') || sec.includes('YOUR_SPOTIFY')) {
      return false;
    }
    return true;
  }

  isAuthenticated() {
    return Boolean(this.tokens && this.tokens.access_token);
  }

  getAuthUrl(redirectUri) {
    if (!this.config.clientId) throw new Error('Spotify Client ID is not configured');
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SCOPES,
      show_dialog: 'true'
    });
    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }

  async exchangeCode(code, redirectUri) {
    const creds = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Spotify token exchange failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    this.saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token || (this.tokens && this.tokens.refresh_token),
      expires_at: Date.now() + ((data.expires_in || 3600) - 60) * 1000
    });
    return this.tokens;
  }

  async refreshAccessToken() {
    if (!this.tokens || !this.tokens.refresh_token) {
      throw new Error('No refresh token available');
    }

    const creds = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: this.tokens.refresh_token
    });

    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Token refresh failed: ${errText}`);
    }

    const data = await res.json();
    this.saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token || this.tokens.refresh_token,
      expires_at: Date.now() + ((data.expires_in || 3600) - 60) * 1000
    });
    return this.tokens.access_token;
  }

  async getValidToken() {
    if (!this.tokens || !this.tokens.access_token) {
      throw new Error('Not logged into Spotify');
    }
    if (Date.now() >= (this.tokens.expires_at || 0)) {
      return await this.refreshAccessToken();
    }
    return this.tokens.access_token;
  }

  async apiRequest(endpoint, method = 'GET', body = null, isRetry = false) {
    const token = await this.getValidToken();
    const url = `https://api.spotify.com/v1${endpoint}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (res.status === 401 && !isRetry) {
      console.log('[Spotify] Token expired or invalid, refreshing and retrying...');
      await this.refreshAccessToken();
      return this.apiRequest(endpoint, method, body, true);
    }

    if (res.status === 204 || res.status === 202) return null;
    const text = await res.text();
    if (!text || !text.trim()) return null;

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }

    if (!res.ok) {
      const msg = (data && data.error && data.error.message) || text || res.statusText;
      throw new Error(`Spotify API error [${method} ${endpoint}] ${res.status}: ${msg}`);
    }
    return data;
  }

  async getPlaybackState() {
    try {
      return await this.apiRequest('/me/player');
    } catch (e) {
      if (e.message.includes('404') || e.message.includes('204')) return null;
      throw e;
    }
  }

  async getDevices() {
    const data = await this.apiRequest('/me/player/devices');
    return data ? data.devices : [];
  }

  async play(deviceId = null) {
    const endpoint = deviceId ? `/me/player/play?device_id=${encodeURIComponent(deviceId)}` : '/me/player/play';
    return await this.apiRequest(endpoint, 'PUT');
  }

  async pause() {
    return await this.apiRequest('/me/player/pause', 'PUT');
  }

  async next() {
    return await this.apiRequest('/me/player/next', 'POST');
  }

  async previous() {
    return await this.apiRequest('/me/player/previous', 'POST');
  }

  async seek(positionMs) {
    return await this.apiRequest(`/me/player/seek?position_ms=${Math.round(positionMs)}`, 'PUT');
  }

  async setVolume(volumePercent, deviceId = null) {
    const vol = Math.max(0, Math.min(100, Math.round(volumePercent)));
    const endpoint = deviceId ? `/me/player/volume?volume_percent=${vol}&device_id=${encodeURIComponent(deviceId)}` : `/me/player/volume?volume_percent=${vol}`;
    return await this.apiRequest(endpoint, 'PUT');
  }

  async setShuffle(state, deviceId = null) {
    const endpoint = deviceId ? `/me/player/shuffle?state=${Boolean(state)}&device_id=${encodeURIComponent(deviceId)}` : `/me/player/shuffle?state=${Boolean(state)}`;
    return await this.apiRequest(endpoint, 'PUT');
  }

  async setRepeat(state) {
    // state: 'track', 'context', or 'off'
    return await this.apiRequest(`/me/player/repeat?state=${state}`, 'PUT');
  }

  async transferPlayback(deviceId, play = true) {
    return await this.apiRequest('/me/player', 'PUT', {
      device_ids: [deviceId],
      play: Boolean(play)
    });
  }

  async getPlaylists(limit = 40) {
    const data = await this.apiRequest(`/me/playlists?limit=${limit}`);
    if (!data || !data.items) return [];
    return data.items.map(p => {
      const total = p.items?.total ?? p.tracks?.total ?? 0;
      p.totalTracks = total;
      if (!p.tracks) p.tracks = { total };
      else if (typeof p.tracks === 'object' && p.tracks.total === undefined) p.tracks.total = total;
      return p;
    });
  }

  async getPlaylistTracks(playlistId, limit = 100) {
    try {
      const data = await this.apiRequest(`/playlists/${playlistId}/items?limit=${limit}`);
      if (!data || !data.items) return [];
      return data.items
        .map(entry => entry.item || entry.track)
        .filter(t => t && t.id);
    } catch (e) {
      console.warn('[Spotify] Could not fetch playlist tracks:', e.message);
      return [];
    }
  }

  async getFavorites(limit = 50) {
    try {
      const data = await this.apiRequest(`/me/tracks?limit=${limit}`);
      if (!data || !data.items) return [];
      return data.items
        .map(entry => entry.track)
        .filter(t => t && t.id);
    } catch (e) {
      console.error('[Spotify] Error fetching favorites:', e.message);
      return [];
    }
  }

  async getRecentlyPlayed(limit = 20) {
    try {
      const data = await this.apiRequest(`/me/player/recently-played?limit=${limit}`);
      return data ? data.items : [];
    } catch (e) {
      console.warn('[Spotify] Could not fetch recently played tracks:', e.message);
      return [];
    }
  }

  async search(query, limit = 10) {
    const cleanQuery = (query || '').trim();
    if (!cleanQuery) {
      return { tracks: [], playlists: [] };
    }
    const safeLimit = Math.max(1, Math.min(10, parseInt(limit, 10) || 10));
    try {
      const data = await this.apiRequest(`/search?q=${encodeURIComponent(cleanQuery)}&type=track%2Cplaylist&limit=${safeLimit}`);
      const rawTracks = data?.tracks?.items || [];
      const rawPlaylists = data?.playlists?.items || [];
      return {
        tracks: rawTracks.filter(t => t && t.id && t.name),
        playlists: rawPlaylists.filter(p => p && p.id && p.name).map(p => {
          const total = p.items?.total ?? p.tracks?.total ?? 0;
          p.totalTracks = total;
          if (!p.tracks) p.tracks = { total };
          else if (typeof p.tracks === 'object' && p.tracks.total === undefined) p.tracks.total = total;
          return p;
        })
      };
    } catch (e) {
      console.error('[Spotify] Search error:', e.message);
      return { tracks: [], playlists: [] };
    }
  }

  async getUserId() {
    if (this._userId) return this._userId;
    try {
      const user = await this.apiRequest('/me');
      if (user && user.id) {
        this._userId = user.id;
        return this._userId;
      }
    } catch (e) {}
    return null;
  }

  async playFavorites(trackUri = null, deviceId = null) {
    const userId = await this.getUserId();
    if (userId) {
      const contextUri = `spotify:user:${userId}:collection`;
      try {
        return await this.playContext(contextUri, deviceId, trackUri);
      } catch (e) {
        // Fallback to track URIs below
      }
    }
    const favs = await this.getFavorites(50);
    const uris = favs.map(t => t.uri).filter(Boolean);
    if (uris.length > 0) {
      if (trackUri) {
        const idx = uris.indexOf(trackUri);
        if (idx > -1) {
          const reordered = uris.slice(idx).concat(uris.slice(0, idx));
          return await this.playTracks(reordered, deviceId);
        }
      }
      return await this.playTracks(uris, deviceId);
    }
    return null;
  }

  async playTrackSmart(trackUri, albumUri = null, contextUri = null, deviceId = null) {
    if (contextUri) {
      return await this.playContext(contextUri, deviceId, trackUri);
    }
    if (albumUri) {
      return await this.playContext(albumUri, deviceId, trackUri);
    }
    // Fallback: try user collection or standalone
    return await this.playTracks([trackUri], deviceId);
  }

  async playContext(contextUri, deviceId = null, offsetUri = null) {
    const endpoint = deviceId ? `/me/player/play?device_id=${encodeURIComponent(deviceId)}` : '/me/player/play';
    const body = { context_uri: contextUri };
    if (offsetUri) {
      body.offset = { uri: offsetUri };
    }
    return await this.apiRequest(endpoint, 'PUT', body);
  }

  async playTracks(uris, deviceId = null) {
    const endpoint = deviceId ? `/me/player/play?device_id=${encodeURIComponent(deviceId)}` : '/me/player/play';
    return await this.apiRequest(endpoint, 'PUT', {
      uris: Array.isArray(uris) ? uris : [uris]
    });
  }
}

module.exports = new SpotifyService();
