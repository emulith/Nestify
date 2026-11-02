const caster = require('./lib/caster');
const spotify = require('./lib/spotify');
const os = require('os');

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

const targetIp = spotify.config.nestHubIp || '192.168.1.39';
const localIp = getLocalIp(targetIp);
const PORT = process.env.PORT || 8888;
const targetUrl = `http://${localIp}:${PORT}/?device=nesthub`;

console.log('====================================================');
console.log(`[Cast] Casting to Google Nest Hub at ${targetIp}...`);
console.log(`[Cast] URL: ${targetUrl}`);
console.log('====================================================');

caster.castUrl(targetIp, targetUrl)
  .then(() => {
    console.log('Successfully launched on your Nest Hub!');
    console.log('Press Ctrl+C to stop the cast script when you are done.');
  })
  .catch((err) => {
    console.error('Error casting to Nest Hub:', err.message);
    process.exit(1);
  });
