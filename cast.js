const caster = require('./lib/caster');
const spotify = require('./lib/spotify');
const os = require('os');

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

const localIp = getLocalIp();
const PORT = process.env.PORT || 8888;
const targetIp = spotify.config.nestHubIp || '192.168.2.7';
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
