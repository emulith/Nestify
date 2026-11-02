/**
 * lib/device-selector.js
 * Interactive CLI Google Cast device selector and configuration persistence for Nestify.
 * Discovers local Cast devices, formats indexed device list, validates user selection,
 * and persists target device parameters (nestHubName, nestHubIp) to configuration.
 */

const readline = require('readline');
const net = require('net');

/**
 * Format discovered Cast devices into a human-readable 1-based indexed list.
 * Appends ' (CURRENT)' if device IP matches currentIp.
 *
 * @param {Array<Object>} devices - Discovered Cast devices
 * @param {string} [currentIp] - Currently configured target IP
 * @returns {Array<string>} Formatted lines
 */
function formatDeviceList(devices, currentIp) {
  if (!devices || !Array.isArray(devices) || devices.length === 0) {
    return ['No Cast devices found on local network.'];
  }

  return devices.map((dev, idx) => {
    const isCurrent = Boolean(currentIp && dev.ip === currentIp);
    const currentTag = isCurrent ? ' (CURRENT)' : '';
    const name = dev.name || 'Cast Device';
    const model = dev.model || 'Chromecast';
    return `[${idx + 1}] ${name} (${model} - ${dev.ip})${currentTag}`;
  });
}

/**
 * Parse user input from CLI or API selection.
 * Handles:
 * - Empty input (Enter key): keeps current configuration or falls back to default.
 * - Integer 1..N: selects device from devices list.
 * - IPv4 address: matches device in list, or overrides with 'Google Nest Hub' and manual IP.
 * - Invalid input: throws 'Invalid selection' or 'Invalid selection: Index out of range'.
 *
 * @param {string|number} input - User input string or number
 * @param {Array<Object>} devices - Discovered Cast devices
 * @param {Object} [current={}] - Current target configuration { nestHubName, nestHubIp }
 * @returns {{ nestHubName: string, nestHubIp: string }}
 */
function parseDeviceSelection(input, devices, current = {}) {
  const str = (input === null || input === undefined) ? '' : String(input).trim();

  // Empty input retains current configuration or default
  if (str === '') {
    return {
      nestHubName: (current && current.nestHubName) || 'Slaapkamer Danian',
      nestHubIp: (current && current.nestHubIp) || '192.168.1.39'
    };
  }

  // Integer index selection (e.g. '1', '4', '0', '-1', '99')
  if (/^-?\d+$/.test(str)) {
    const index = parseInt(str, 10);
    if (isNaN(index) || index < 1 || !Array.isArray(devices) || index > devices.length) {
      throw new Error('Invalid selection: Index out of range');
    }
    const selected = devices[index - 1];
    return {
      nestHubName: selected.name || 'Google Nest Hub',
      nestHubIp: selected.ip
    };
  }

  // Manual IPv4 address override (e.g. '192.168.1.39', '192.168.1.200')
  if (net.isIPv4(str)) {
    const match = Array.isArray(devices) ? devices.find(d => d.ip === str) : null;
    if (match) {
      return {
        nestHubName: match.name || 'Google Nest Hub',
        nestHubIp: match.ip
      };
    }
    return {
      nestHubName: 'Google Nest Hub',
      nestHubIp: str
    };
  }

  // Non-numeric, malformed IP, or unsupported string
  throw new Error('Invalid selection');
}

/**
 * Interactive CLI prompt to scan network, display devices, accept selection,
 * and persist target Nest Hub to config.
 *
 * @param {Object} [options={}] - Optional configuration and dependency overrides
 * @param {number} [options.scanDurationMs=3000] - Duration for mDNS scan
 * @param {Object} [options.caster] - CastManager instance (defaults to lib/caster)
 * @param {Object} [options.spotify] - SpotifyService instance (defaults to lib/spotify)
 * @param {stream.Readable} [options.input=process.stdin] - CLI input stream
 * @param {stream.Writable} [options.output=process.stdout] - CLI output stream
 * @returns {Promise<{ nestHubName: string, nestHubIp: string }>}
 */
async function selectDeviceInteractive(options = {}) {
  const scanDurationMs = options.scanDurationMs
    || (process.env.DEVICE_SCAN_MS ? parseInt(process.env.DEVICE_SCAN_MS, 10) : 3000);
  const caster = options.caster || require('./caster');
  const spotify = options.spotify || require('./spotify');

  let currentConfig = {};
  try {
    currentConfig = (typeof spotify.loadConfig === 'function' ? spotify.loadConfig() : spotify.config) || {};
  } catch (e) {
    currentConfig = spotify.config || {};
  }

  const currentIp = currentConfig.nestHubIp || '192.168.1.39';
  const currentName = currentConfig.nestHubName || 'Slaapkamer Danian';

  console.log('====================================================================');
  console.log('  Google Cast Device Selector');
  console.log('====================================================================');
  console.log(`\nScanning local network for Cast devices (${Math.round(scanDurationMs / 1000)} seconds)...`);

  let devices = [];
  try {
    devices = await caster.scanDevices(scanDurationMs);
  } catch (err) {
    console.warn('[DeviceSelector] Discovery scan error:', err.message);
    devices = [];
  }

  console.log('\nDiscovered Cast Devices:');
  const formatted = formatDeviceList(devices, currentIp);
  for (const line of formatted) {
    console.log(`  ${line}`);
  }
  console.log('');

  const rl = options.rl || readline.createInterface({
    input: options.input || process.stdin,
    output: options.output || process.stdout
  });

  const onSigInt = () => rl.close();
  const onStreamError = (err) => {
    console.warn('[DeviceSelector] Stream error:', err.message);
    rl.close();
  };
  rl.on('SIGINT', onSigInt);
  rl.on('error', onStreamError);

  const ask = (promptText) => new Promise((resolve) => {
    if (rl.closed) return resolve(null);
    let settled = false;

    const cleanup = () => {
      rl.removeListener('close', onClose);
      rl.removeListener('error', onError);
    };

    const onClose = () => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(null);
      }
    };

    const onError = () => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(null);
      }
    };

    const onLine = (answer) => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(answer);
      }
    };

    rl.once('close', onClose);
    rl.once('error', onError);

    try {
      rl.question(promptText, onLine);
    } catch (err) {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(null);
      }
    }
  });

  const promptText = devices.length > 0
    ? `Select device [1-${devices.length}], enter IP address, or press Enter to keep current (${currentName} - ${currentIp}): `
    : `Enter IP address or press Enter to keep current (${currentName} - ${currentIp}): `;

  let selection = null;
  try {
    while (!selection) {
      const input = await ask(promptText);
      if (input === null || input === undefined) {
        selection = { nestHubName: currentName, nestHubIp: currentIp };
        break;
      }
      try {
        selection = parseDeviceSelection(input, devices, {
          nestHubName: currentName,
          nestHubIp: currentIp
        });
      } catch (err) {
        console.error(`Invalid selection: ${err.message}. Please try again.\n`);
      }
    }
  } finally {
    rl.removeListener('SIGINT', onSigInt);
    rl.removeListener('error', onStreamError);
    rl.close();
  }

  try {
    if (spotify && typeof spotify.saveConfig === 'function') {
      spotify.saveConfig({
        nestHubName: selection.nestHubName,
        nestHubIp: selection.nestHubIp
      });
    }
  } catch (err) {
    console.error('Failed to save configuration:', err.message);
  }

  console.log(`\nSuccessfully saved Cast target: ${selection.nestHubName} (${selection.nestHubIp})\n`);
  return selection;
}

if (require.main === module) {
  selectDeviceInteractive()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error during device selection:', err);
      process.exit(1);
    });
}

module.exports = {
  formatDeviceList,
  parseDeviceSelection,
  selectDeviceInteractive
};
