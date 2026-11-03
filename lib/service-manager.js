const { spawn, spawnSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');
const SERVER_SCRIPT = path.join(ROOT_DIR, 'server.js');
const LOG_FILE = path.join(ROOT_DIR, 'nestify.log');
const PID_FILE = path.join(ROOT_DIR, 'nestify.pid');
const DEFAULT_PORT = 8888;

/**
 * Checks if the Nestify server is currently responding on the target port
 */
function checkServerRunning(port = DEFAULT_PORT, timeoutMs = 1000) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/config`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const config = JSON.parse(data);
          resolve({ running: true, config });
        } catch (e) {
          resolve({ running: true, config: null });
        }
      });
    });

    req.on('error', () => resolve({ running: false, config: null }));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve({ running: false, config: null });
    });
  });
}

/**
 * Check if a process with the given PID is currently active
 */
function isPidAlive(pid) {
  if (!pid || isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/**
 * Rotate or truncate log file if larger than 2MB
 */
function prepareLogFile() {
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > 2 * 1024 * 1024) {
        const data = fs.readFileSync(LOG_FILE, 'utf8');
        const lines = data.split('\n');
        const recent = lines.slice(-300).join('\n');
        fs.writeFileSync(LOG_FILE, recent + '\n', 'utf8');
      }
    }
  } catch (e) {}
}

/**
 * Spawns the background server process completely detached from any console window
 */
function spawnBackgroundProcess() {
  prepareLogFile();

  // Method 1: Node native detached spawn (cleanest Win32 CreateProcess, handles spaces in paths natively)
  try {
    const logFd = fs.openSync(LOG_FILE, 'a');
    const child = spawn(process.execPath, [SERVER_SCRIPT, '--autocast'], {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      windowsHide: true,
      cwd: ROOT_DIR
    });
    child.unref();

    try { fs.closeSync(logFd); } catch (e) {}

    if (child && child.pid) {
      fs.writeFileSync(PID_FILE, String(child.pid), 'utf8');
      return child.pid;
    }
  } catch (err) {
    console.warn('[ServiceManager] Native spawn error, falling back to PowerShell:', err.message);
  }

  // Method 2: PowerShell Start-Process fallback
  try {
    const psCmd = `Start-Process -FilePath "${process.execPath}" -ArgumentList @("${SERVER_SCRIPT}", "--autocast") -RedirectStandardOutput "${LOG_FILE}" -RedirectStandardError "${LOG_FILE}" -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id`;
    const res = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], {
      encoding: 'utf8',
      cwd: ROOT_DIR
    });
    const pid = parseInt((res.stdout || '').trim(), 10);
    if (pid && !isNaN(pid)) {
      fs.writeFileSync(PID_FILE, String(pid), 'utf8');
      return pid;
    }
  } catch (err) {
    console.error('[Error] PowerShell fallback failed:', err.message);
  }

  return null;
}

/**
 * Stream/tail output from LOG_FILE starting from given byte offset
 */
function startLogTail(initialOffset = 0) {
  let offset = initialOffset;

  // Print existing content from offset
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > offset) {
        const len = stats.size - offset;
        const buf = Buffer.alloc(len);
        const fd = fs.openSync(LOG_FILE, 'r');
        fs.readSync(fd, buf, 0, len, offset);
        fs.closeSync(fd);
        process.stdout.write(buf.toString('utf8'));
        offset = stats.size;
      }
    }
  } catch (e) {}

  // Poll for newly appended bytes
  const timer = setInterval(() => {
    try {
      if (!fs.existsSync(LOG_FILE)) return;
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > offset) {
        const len = stats.size - offset;
        const buf = Buffer.alloc(len);
        const fd = fs.openSync(LOG_FILE, 'r');
        fs.readSync(fd, buf, 0, len, offset);
        fs.closeSync(fd);
        process.stdout.write(buf.toString('utf8'));
        offset = stats.size;
      } else if (stats.size < offset) {
        offset = 0; // Truncated
      }
    } catch (e) {}
  }, 250);

  return timer;
}

/**
 * Setup keyboard listener so pressing any key exits the log-viewing window
 * while keeping the background service running
 */
function setupKeyExit() {
  if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
    try {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', () => {
        console.log('\nClosing window. Nestify will continue running in the background.\n');
        process.exit(0);
      });
    } catch (e) {}
  }

  process.on('SIGINT', () => {
    console.log('\nClosing window. Nestify will continue running in the background.\n');
    process.exit(0);
  });
}

/**
 * Start Nestify service as an independent detached background process
 */
async function startService(options = {}) {
  const shouldTail = options.tail !== false;
  const currentStatus = await checkServerRunning(DEFAULT_PORT, 600);

  if (currentStatus.running) {
    const cfg = currentStatus.config;
    const localIp = (cfg && cfg.localIp) || '127.0.0.1';
    const port = (cfg && cfg.port) || DEFAULT_PORT;

    console.log('====================================================');
    console.log('🎵 Nestify Spotify Controller is already running!');
    console.log(`   Local PC URL: http://localhost:${port}`);
    console.log(`   Network URL:  http://${localIp}:${port}`);
    console.log('====================================================');
    console.log('[INFO] Nestify service is active in the background.');
    console.log();
    console.log('----------------------------------------------------');
    console.log('💡 BACKGROUND MODE ACTIVE:');
    console.log(' • You can safely close (X) this window at any time.');
    console.log('   The service will keep running in the background!');
    console.log(' • To stop the service, double-click stop.bat.');
    console.log(' • Press any key to close this window now.');
    console.log('----------------------------------------------------');

    if (!shouldTail) return currentStatus;

    console.log('\n[Recent Live Activity]:');

    // Show last 15 lines of log
    try {
      if (fs.existsSync(LOG_FILE)) {
        const text = fs.readFileSync(LOG_FILE, 'utf8');
        const lines = text.trim().split('\n');
        const tailLines = lines.slice(-15);
        if (tailLines.length > 0) {
          console.log(tailLines.join('\n'));
        }
      }
    } catch (e) {}

    let initialOffset = 0;
    try {
      if (fs.existsSync(LOG_FILE)) initialOffset = fs.statSync(LOG_FILE).size;
    } catch (e) {}

    setupKeyExit();
    startLogTail(initialOffset);
    return currentStatus;
  }

  // Not running yet: Start background process
  let logOffset = 0;
  try {
    if (fs.existsSync(LOG_FILE)) {
      logOffset = fs.statSync(LOG_FILE).size;
    }
  } catch (e) {}

  console.log('Starting server and automatically connecting to Nest Hub...');

  const spawnedPid = spawnBackgroundProcess();

  // Wait for the server to be responsive
  let readyStatus = null;
  const maxAttempts = 35; // 35 * 200ms = 7s
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, 200));
    readyStatus = await checkServerRunning(DEFAULT_PORT, 400);
    if (readyStatus.running) break;
  }

  if (!readyStatus || !readyStatus.running) {
    if (spawnedPid && !isPidAlive(spawnedPid)) {
      console.error('\n[Error] Nestify server failed to start.');
      try {
        if (fs.existsSync(LOG_FILE)) {
          const logContent = fs.readFileSync(LOG_FILE, 'utf8');
          const lastLines = logContent.split('\n').slice(-15).join('\n');
          console.error('\n--- Log output ---\n' + lastLines);
        }
      } catch (e) {}
      process.exit(1);
    }
  }

  const cfg = (readyStatus && readyStatus.config) || {};
  const localIp = cfg.localIp || '127.0.0.1';
  const port = cfg.port || DEFAULT_PORT;

  console.log();
  console.log('====================================================');
  console.log('🎵 Nestify Spotify Controller started!');
  console.log(`   Local PC URL: http://localhost:${port}`);
  console.log(`   Network URL:  http://${localIp}:${port}`);
  console.log('====================================================');
  console.log('[SmartSync] Presence detection active.');
  console.log('[SmartSync] Auto-casting to Google Nest Hub when music plays.');
  console.log();
  console.log('----------------------------------------------------');
  console.log('✨ BACKGROUND SERVICE ACTIVE:');
  console.log(' • You can safely close (X) this window at any time!');
  console.log('   The service will KEEP RUNNING in the background.');
  console.log(' • When you want to stop the service, run stop.bat.');
  console.log(' • Press any key or Ctrl+C to close this window.');
  console.log('----------------------------------------------------');

  if (!shouldTail) return readyStatus;

  console.log('\n[Live Logs]:');

  setupKeyExit();
  startLogTail(logOffset);
  return readyStatus;
}

/**
 * Stop Nestify service and return Nest Hub to home screen
 */
async function stopService() {
  console.log('Returning Google Nest Hub to home screen...');

  // 1. Send shutdown request to running server if active
  try {
    await new Promise((resolve) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: DEFAULT_PORT,
        path: '/api/shutdown',
        method: 'POST',
        timeout: 2000
      }, () => resolve());
      req.on('error', () => resolve());
      req.on('timeout', () => { req.destroy(); resolve(); });
      req.end();
    });
  } catch (e) {}

  // 2. Direct fallback call to stopCast to ensure Nest Hub disconnects
  try {
    const spotify = require('./spotify');
    const caster = require('./caster');
    const targetIp = (spotify.config && spotify.config.nestHubIp) || '192.168.1.39';
    await caster.stopCast(targetIp);
  } catch (e) {}

  // 3. Stop process by PID if still alive
  try {
    if (fs.existsSync(PID_FILE)) {
      const pidStr = fs.readFileSync(PID_FILE, 'utf8').trim();
      const pid = parseInt(pidStr, 10);
      if (pid && !isNaN(pid)) {
        try {
          spawnSync('taskkill', ['/F', '/PID', String(pid), '/T'], { windowsHide: true });
        } catch (e) {}
        try {
          process.kill(pid);
        } catch (e) {}
      }
      try {
        fs.unlinkSync(PID_FILE);
      } catch (e) {}
    }
  } catch (e) {}

  console.log('[OK] Nestify stopped and Nest Hub returned to home screen.');
}

// CLI handler
if (require.main === module) {
  const action = process.argv[2] || 'start';

  if (action === 'stop') {
    stopService().then(() => process.exit(0)).catch(() => process.exit(0));
  } else if (action === 'status') {
    checkServerRunning(DEFAULT_PORT).then((status) => {
      if (status.running) {
        console.log('Nestify is running on port ' + DEFAULT_PORT);
        process.exit(0);
      } else {
        console.log('Nestify is stopped.');
        process.exit(1);
      }
    });
  } else if (action === 'spawn') {
    startService({ tail: false }).then(() => process.exit(0)).catch((err) => {
      console.error('[Error]', err.message);
      process.exit(1);
    });
  } else {
    startService({ tail: true }).catch((err) => {
      console.error('[Error]', err.message);
      process.exit(1);
    });
  }
}

module.exports = {
  checkServerRunning,
  startService,
  stopService
};
