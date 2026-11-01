# 🍏 Nestify — Spotify Apple Liquid Glass Controller for Google Nest Hub

[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6.svg?logo=windows&logoColor=white)](https://github.com/emulith/Nestify)
[![Node.js: >=18.0.0](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933.svg?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Transform your **Google Nest Hub** (or any Chromecast-enabled smart display) into a stunning, responsive **Apple Liquid Glass** touch controller for Spotify running on your PC!

---

## ✨ Features

- **💎 Apple Liquid Glass Aesthetic:**
  - Frosted translucent glass with real-time blur (`backdrop-filter: blur(28px)`), specular light borders, and deep ambient glow that dynamically synchronizes with current album art.
  - Symmetrical floating center capsule combining live clock and intuitive navigation tabs without visual clutter.
  - Generous fingertip touch targets crafted specifically for the 7-inch 1024×600 Nest Hub display.
- **🧠 SmartSync (Automatic Presence Detection):**
  - **Music Starts Playing ➔ Screen Wakes Up:** Nestify automatically launches itself on your Nest Hub whenever Spotify starts playing music on your computer.
  - **Music Paused / Stopped ➔ Screen Turns Off:** After 10 minutes (configurable in settings) of pause or inactivity, Nestify gracefully closes and returns your Nest Hub back to Google Photos & Clock!
- **🎙️ Real-Time Synced Apple Lyrics & Karaoke Mode:**
  - Dedicated microphone button on player controls to toggle live synchronized lyrics with frosted glass blur.
  - Real-time line highlighting with smooth auto-scrolling and Apple Music top/bottom gradient mask.
  - Interactive Karaoke Jump: tap any lyric line on the touchscreen to immediately seek playback to that exact second!
- **🔀 1-Tap Playlist & Favorites Shuffling:**
  - Dedicated Shuffle button on playlists and Liked Songs to instantly start randomized playback.
- **🔊 Unified Liquid Glass Volume & Transport Bar:**
  - Smooth slider controls for timeline scrubbing and volume adjustment, plus 1-tap `+10%` / `-10%` step buttons on speaker icons.
- **🔍 Auto-Detect Google Nest Hub:**
  - The built-in setup wizard can automatically discover your Nest Hub on your Wi-Fi network with one click using mDNS/Bonjour.
- **⌨️ Built-in Large Virtual Touch Keyboard:**
  - 52px tall keys and quick genre pills to easily search artists, tracks, and playlists directly from the touchscreen.
- **🤫 100% Silent Background Daemon (Zero Command Prompt Windows):**
  - Runs silently in the background with zero terminal windows or popups. Includes desktop shortcuts and optional Windows Startup autostart.

---

## 🚀 Super Easy Quick Start (Windows)

### Step 1: Download Nestify
- Click the green **Code** button at the top of this repository, then click **[Download ZIP](https://github.com/emulith/Nestify/archive/refs/heads/main.zip)**.
- Extract the ZIP archive to any folder on your computer (e.g. `C:\Nestify`).
*(Or clone with Git: `git clone https://github.com/emulith/Nestify.git`)*

### Step 2: Double-Click `setup.bat`
Inside the Nestify folder, simply double-click **`setup.bat`**!

The installer automatically:
1. Verifies **Node.js** (and installs it automatically if you don't have it yet).
2. Installs required packages via `npm install`.
3. Creates **`Start Nestify`** and **`Stop Nestify`** 1-click shortcuts directly on your **Desktop**.
4. Prompts to enable silent auto-start with Windows on boot (optional).
5. Silently launches the background server and opens your web browser to the setup wizard.

---

## 🔑 1-Minute Spotify Setup

When the browser wizard opens:

1. Create a free developer app at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard):
   - **App name:** `Nestify`
   - **App description:** `Nest Hub Controller`
   - **Redirect URIs:** `http://127.0.0.1:8888/callback` *(Click "📋 Copy" in the setup wizard to copy this instantly)*
   - **APIs used:** Select **Web API**.
2. Go to your app's **Settings** to view your **Client ID** and **Client Secret**.
3. Paste both keys into the Nestify setup page.
4. Click **🔍 Auto-detect** to automatically find your Google Nest Hub on Wi-Fi, then click **💾 Save & Continue**.
5. Click **🚀 Connect with Spotify** to authorize your account.

🎉 **You are all done!** Next time you play music on Spotify, Nestify will automatically light up your Google Nest Hub display!

---

## 🎮 Desktop Shortcuts & Controls

- **`Start Nestify`** (on your Desktop): Silently starts Nestify on the background with zero visible windows.
- **`Stop Nestify`** (on your Desktop): Stops the background controller instantly.
- **Close Screen Manually:** Tap the AirPlay device icon on the touchscreen and tap **`Close Nest Hub Screen (Return to Clock)`** to return to Google Photos at any time.
- **Change Settings / IP:** Tap the AirPlay icon and select **`⚙️ Settings & Nest Hub IP`** to reopen the setup wizard anytime.

---

## 🛠️ Advanced CLI Commands (Optional)

For power users running Nestify via terminal:

```bash
# Start server manually
npm start

# Start server with SmartSync Auto-Cast enabled
npm run autocast

# Stop running background server
npm run stop
```

---

## 🔒 Privacy & Security

- **100% Local:** Your Spotify client secrets and OAuth refresh tokens are stored exclusively on your own computer in the `config/` directory and are strictly excluded via `.gitignore`.
- No telemetry, analytics, or third-party cloud servers are involved.

---

## 📄 License

MIT License © 2026 [Emulith](https://github.com/emulith)
