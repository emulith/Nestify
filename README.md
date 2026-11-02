# 🍏 Nestify — Spotify Touch Controller for Google Nest Hub

[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%20%7C%2011-0078D6.svg?logo=windows&logoColor=white)](https://github.com/emulith/Nestify)
[![Node.js: >=18.0.0](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933.svg?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Transform your **Google Nest Hub** (or any Chromecast-enabled smart display) into a responsive, beautiful touch controller for Spotify running on your PC.

---

## ✨ Features

- **📱 Touchscreen Interface:** Large, responsive buttons and smooth navigation designed for smart displays.
- **🧠 SmartSync (Automatic Presence Detection):**
  - **Music Starts Playing ➔ Screen Wakes Up:** Nestify automatically launches on your Nest Hub whenever Spotify starts playing music on your computer.
  - **Music Paused / Stopped ➔ Screen Sleeps:** After 10 minutes (configurable in settings) of pause or inactivity, Nestify gracefully closes and returns your Nest Hub back to Google Photos & Clock.
- **🎙️ Live Synced Lyrics & Karaoke Mode:** Real-time synchronized lyrics with smooth auto-scrolling. Tap any lyric line on the screen to jump directly to that part of the song.
- **🔀 1-Tap Playlists & Favorites:** Browse and shuffle your Liked Songs and playlists with one tap.
- **🔊 Volume & Playback Controls:** Smooth timeline scrubber, volume slider, and quick +10% / -10% step buttons.
- **🔍 Auto-Detect Google Nest Hub:** Discover all Google Cast devices on your network with one click and select your Nest Hub from an interactive list.
- **⌨️ Virtual Touch Keyboard:** Search tracks, artists, and playlists directly from the touchscreen.
- **🔄 Auto-Update Manager:** Automatically checks for and pulls the latest updates every time you launch the app.

---

## 🚀 Quick Start (Windows)

### Step 1: Download Nestify
- Click the green **Code** button at the top of this repository, then click **[Download ZIP](https://github.com/emulith/Nestify/archive/refs/heads/main.zip)**.
- Extract the ZIP archive to any folder on your computer (e.g. `C:\Nestify`).
*(Or clone with Git: `git clone https://github.com/emulith/Nestify.git`)*

### Step 2: Run `setup.bat`
Inside the Nestify folder, double-click **`setup.bat`**.

The installer will:
1. Check for **Node.js** (and can install it for you if you don't have it).
2. Install required packages via `npm install`.
3. Create **`Start Nestify`** and **`Stop Nestify`** shortcuts on your **Desktop**.
4. Launch the web setup wizard in your browser.

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
4. Click **🔍 Auto-detect** to find your Google Nest Hub on Wi-Fi, select it from the list, then click **💾 Save & Continue**.
5. Click **🚀 Connect with Spotify** to link your account.

🎉 **You're all done!** Next time you play music on Spotify, Nestify will automatically appear on your Google Nest Hub display.

---

## 🎮 How to Use

- **`start.bat`** (or **`Start Nestify`** on Desktop): Checks for updates, starts the background server, and connects to your Nest Hub.
- **`stop.bat`** (or **`Stop Nestify`** on Desktop): Stops Nestify and immediately returns your Nest Hub to its clock and photos.
- **Return to Clock from the Screen:** Tap the device icon on the touchscreen and tap **`Close Nest Hub Screen (Return to Clock)`**.
- **Change Settings / Device:** Tap the device icon and select **`⚙️ Settings & Nest Hub IP`**.

---

## 🔒 Privacy & Security

- **100% Local:** Your Spotify client credentials and tokens are stored exclusively on your own computer in the `config/` folder and are strictly excluded via `.gitignore`.
- No telemetry, analytics, or external third-party servers.

---

## 📄 License

MIT License © 2026 [Emulith](https://github.com/emulith)
