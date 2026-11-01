# 🍏 Nestify — Spotify Apple Liquid Glass Controller for Google Nest Hub

Control Spotify on your Windows PC with a pristine **Apple Liquid Glass** touch interface, cast directly to your **Google Nest Hub** smart display!

---

## ✨ Features

- **💎 Apple Liquid Glass Aesthetic:**
  - Symmetrical, unified Apple Liquid Glass UI with frosted translucent blur and specular glass reflections.
  - Centered floating glass capsule with integrated real-time clock and smooth navigation tabs.
  - Large, fingertip-friendly controls crafted specifically for the 7-inch 1024×600 Nest Hub display.
  - Dynamic ambient glow backdrop that adapts to the currently playing song's artwork.
- **🧠 SmartSync (Automatic Presence Detection):**
  - **Music Playing ➔ Screen Turns On:** Nestify automatically wakes your Nest Hub when you play music on Spotify.
  - **Music Paused/Stopped ➔ Screen Turns Off:** When paused or inactive for 45s, your Nest Hub automatically returns to its Google Clock & Photo Frame!
- **🔀 1-Tap Playlist & Favorites Shuffling:**
  - Dedicated **Shuffle** button on both playlists and Liked Songs to instantly mix playback.
- **🔊 Unified Liquid Glass Volume & Transport Bar:**
  - Thick, comfortable touch slider for volume and timeline scrubbing.
  - Direct 1-tap volume step controls (+/- 10%) on the speaker icons.
- **📚 Full Touchscreen Music Library:**
  - Browse user playlists, inspect songs, play favorites, and browse recent tracks.
- **⌨️ Built-in Large Virtual Touch Keyboard:**
  - 52px high responsive touch keys and quick genre pills for effortless on-screen searching.
- **🤫 100% Silent Background Daemon (Zero Command Prompt Windows):**
  - Runs silently in the background without open terminal or browser windows.
  - Automatic Windows Startup integration.

---

## 🚀 Super Easy 1-Click Quick Start (Windows)

### 1. Download or Clone the Repository
```bash
git clone https://github.com/emulith/Nestify.git
cd Nestify
```
*(Or click **Code** ➔ **Download ZIP** on GitHub and extract the folder).*

### 2. Double-Click `setup.bat`
Simply double-click **`setup.bat`** in the project folder! The automated installer will:
1. Check for **Node.js** (and can install it for you automatically if missing).
2. Install all required dependencies (`npm install`).
3. Place **`Start Nestify`** and **`Stop Nestify`** 1-click shortcuts directly on your **Desktop**.
4. Offer to enable silent auto-start with Windows (optional).
5. Automatically open the Web Setup Assistant in your browser.

---

## 🔑 Create Your Free Spotify Developer App (1 Minute)

To allow Nestify to communicate with Spotify Web API:

1. Visit the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in.
2. Click **Create app**.
3. Fill in:
   - **App name:** `Nestify`
   - **App description:** `Nest Hub Touch Controller`
   - **Redirect URIs:** `http://127.0.0.1:8888/callback` *(Note: Spotify requires 127.0.0.1, not localhost)*
   - **Which APIs are you planning to use:** Check **Web API**.
4. Accept the terms and click **Save**.
5. Click **Settings** to find your **Client ID** and **Client Secret**.
6. Paste them into the Nestify web setup wizard or save in `config/config.json`:
   ```json
   {
     "clientId": "YOUR_SPOTIFY_CLIENT_ID",
     "clientSecret": "YOUR_SPOTIFY_CLIENT_SECRET",
     "preferredDeviceName": "PC",
     "nestHubIp": "192.168.2.7"
   }
   ```
   *(Replace `nestHubIp` with your Nest Hub's local IP address, found in the Google Home app under Device Settings).*

---

## 🎮 Desktop Shortcuts & Controls

- **`Start Nestify`** (on your Desktop): Starts Nestify silently in the background with zero command prompt windows.
- **`Stop Nestify`** (on your Desktop): Stops the background controller instantly with a single double-click.
- **Close Nest Hub Screen Manually:** Tap the AirPlay icon on the player screen and tap **`Nest Hub scherm sluiten (Terug naar Klok)`** to return your display to Google Photos immediately.

---

## 🛠️ Manual CLI Commands (Optional)

If you prefer using the terminal:

```bash
# Start server manually
npm start

# Start server with SmartSync Auto-Cast
npm run autocast

# Stop running background server
npm run stop
```

---

## 🔒 Privacy & Security

- **Your credentials stay local:** Spotify client secrets and OAuth refresh tokens are stored exclusively on your own computer in the `config/` directory and are strictly excluded via `.gitignore`.
- No telemetry, analytics, or external cloud servers are used.

---

## 📄 License

MIT License — Created with ❤️ by [Emulith](https://github.com/emulith).
