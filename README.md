# 🍏 Nestify — Spotify Apple Liquid Glass Controller for Google Nest Hub

Control Spotify on your PC with a pristine **Apple Liquid Glass** touch interface, cast directly to your **Google Nest Hub** smart display!

---

## ✨ Features

- **🚗 Authentic Apple CarPlay Design:**
  - True-to-life Apple CarPlay dark theme inspired by premium automotive dashboards (such as BMW iDrive CarPlay).
  - Uncluttered & minimal: 100% focused on pure, fluid Spotify control with zero fake apps or bloat.
  - Dynamic *Ambient Glow* background that adapts seamlessly to the currently playing album artwork.
  - Full-screen Now Playing view with an uncropped, centered 280x280 album cover.
- **🔊 Sleek Single Volume Slider:**
  - A clean, intuitive touch volume slider directly on the *Now Playing* screen (`🔈 ────●──── 🔊`).
  - Instantly syncs volume with the Spotify Desktop client on your Windows PC.
- **📚 Complete Touchscreen Music Library:**
  - **Liked Songs (Favorites):** Instant access to your saved songs with direct touch-to-play.
  - **User Playlists:** Browse through your playlists, inspect the tracklist, and start any specific track directly on your PC.
  - **Recently Played:** Quickly resume tracks you recently listened to.
- **⌨️ Built-in Virtual On-Screen Keyboard:**
  - Cast web runtime lacks a native virtual keyboard; this project includes a custom responsive on-screen touch keyboard and genre shortcuts for effortless searching.
- **🤫 100% Silent Background Daemon (Windows Startup):**
  - Zero open command prompt windows.
  - Zero open browser tabs required.
  - Automatically boots in the background when Windows starts and auto-casts to your Nest Hub within 2 seconds.
- **⏱️ Anti-Timeout & Keep-Alive:**
  - Automatically pings the Cast receiver to prevent the Nest Hub from dropping back to ambient photo-frame mode.

---

## 📋 Prerequisites

1. **Windows PC** with Spotify Desktop installed and running.
2. **Spotify Premium Account** (required by Spotify for Web API playback control).
3. **Google Nest Hub** (1st or 2nd Generation) on the same local Wi-Fi network.
4. **Node.js 18 or higher** installed ([nodejs.org](https://nodejs.org/)).

---

## 🚀 Installation & Quick Start (3 Minutes)

### 1. Clone Repository & Install Dependencies
```bash
git clone https://github.com/your-username/spotify-carplay-nesthub.git
cd spotify-carplay-nesthub
npm install
```

### 2. Create a Free Spotify Developer App
1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in.
2. Click **Create app**.
3. Fill in the details:
   - **App name:** `Nest Hub CarPlay`
   - **App description:** `CarPlay touch controller for Nest Hub`
   - **Redirect URIs:** `http://127.0.0.1:8888/callback` *(Spotify requires 127.0.0.1 instead of localhost)*
   - **Which APIs are you planning to use:** Check **Web API**.
4. Accept the developer terms and click **Save**.
5. In your new app settings, copy your:
   - **Client ID**
   - **Client Secret**

### 3. Setup Configuration
Copy `config/config.example.json` to `config/config.json`:
```bash
cp config/config.example.json config/config.json
```
Edit `config/config.json` with your credentials:
```json
{
  "clientId": "YOUR_SPOTIFY_CLIENT_ID",
  "clientSecret": "YOUR_SPOTIFY_CLIENT_SECRET",
  "preferredDeviceName": "PC",
  "nestHubIp": "192.168.2.7"
}
```
*Note: Replace `preferredDeviceName` with your PC's name in Spotify (e.g. `PC` or `NICK-PC`), and `nestHubIp` with your Google Nest Hub's IP address (found in the Google Home app under device settings).*

### 4. Authenticate with Spotify (One-Time)
1. Start the server manually:
   ```bash
   node server.js
   ```
2. Open your browser to: [http://127.0.0.1:8888/auth/login](http://127.0.0.1:8888/auth/login)
3. Grant permission to your app. OAuth tokens will be securely saved locally to `config/tokens.json`.

---

## 🖥️ Silent Background Auto-Start on Windows

To run the controller completely invisibly on Windows boot (with zero command prompt windows and zero open browser tabs):

1. Open PowerShell in the project directory and run the setup script:
   ```powershell
   powershell -ExecutionPolicy Bypass -File setup-startup.ps1
   ```
2. This creates a startup shortcut in Windows `shell:startup` that executes `start-stil.vbs`.
3. The server will now start invisibly in the background on system boot and cast directly to your Nest Hub (`--autocast`).

### Manual Control
- **Silent Background Start:** Double-click `start-stil.vbs`.
- **Stop Server:** Double-click `stop.bat` (cleanly terminates the background process on port 8888).

---

## 📁 Project Architecture

```
spotify-carplay-nesthub/
├── config/
│   ├── config.example.json   # Template ready for GitHub (no personal secrets)
│   └── config.json           # Local config with your credentials (ignored by git)
├── lib/
│   ├── spotify.js            # Spotify Web API client, token refresh & smart playback
│   └── caster.js             # Google Cast v2 & DashCast client with keepalive ping
├── public/
│   ├── css/
│   │   └── style.css         # Apple CarPlay dark styling, touch optimizations & animations
│   ├── js/
│   │   └── app.js            # Client router, 60fps scrubber, volume touch drag & keyboard
│   └── index.html            # Clean CarPlay DOM structure (Dock, Now Playing, Library, Search)
├── server.js                 # Express server, REST endpoints & auto-cast daemon
├── setup-startup.ps1         # Windows Startup shortcut installer
├── start-stil.vbs            # Silent VBScript launcher (0 windows)
├── stop.bat                  # Clean process terminator for port 8888
├── .gitignore                # Protects personal tokens and secrets from being committed
├── package.json              # Project dependencies and npm scripts
└── LICENSE                   # MIT License
```

---

## 🔒 Security & Privacy

- All Spotify tokens (`config/tokens.json`) and API credentials (`config/config.json`) remain **100% local** on your machine.
- `.gitignore` is configured to prevent personal credentials or access tokens from ever being uploaded to GitHub.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
