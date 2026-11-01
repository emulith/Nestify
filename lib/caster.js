const { Client, Application } = require('castv2-client');
const RequestResponseController = require('castv2-client/lib/controllers/request-response');
const { Bonjour } = require('bonjour-service');
const util = require('util');

// DashCast Custom Controller
function DashCastController(client, sourceId, destinationId) {
  RequestResponseController.call(this, client, sourceId, destinationId, 'urn:x-cast:com.madmod.dashcast');
}
util.inherits(DashCastController, RequestResponseController);

DashCastController.prototype.loadUrl = function(url, options = {}) {
  const msg = {
    url: url,
    force: options.force !== undefined ? options.force : true,
    reload: options.reload || false,
    reload_time: options.reloadTime || 0
  };
  this.send(msg);
};

// DashCast Application Class
function DashCast(client, session) {
  Application.apply(this, arguments);
  this.dashcast = this.createController(DashCastController);
}
DashCast.APP_ID = '84912283';
util.inherits(DashCast, Application);

DashCast.prototype.loadUrl = function(url, options) {
  this.dashcast.loadUrl(url, options);
};

class CastManager {
  constructor() {
    this.client = null;
    this.currentApp = null;
    this.currentIp = null;
    this.currentUrl = null;
    this.keepAliveInterval = null;
    this.discoveredDevices = [];
  }

  scanDevices(durationMs = 4000) {
    return new Promise((resolve) => {
      const bonjour = new Bonjour();
      const devices = [];
      const browser = bonjour.find({ type: 'googlecast' });

      browser.on('up', (service) => {
        const ip = service.addresses ? service.addresses.find(a => a.includes('.')) : null;
        const name = service.txt?.fn || service.name;
        const model = service.txt?.md || 'Chromecast';
        if (ip) {
          const device = { name, model, ip, port: service.port, id: service.name };
          if (!devices.some(d => d.ip === ip)) {
            devices.push(device);
          }
        }
      });

      setTimeout(() => {
        bonjour.destroy();
        this.discoveredDevices = devices;
        resolve(devices);
      }, durationMs);
    });
  }

  async castUrl(deviceIp, targetUrl) {
    this.currentIp = deviceIp;
    this.currentUrl = targetUrl;

    if (this.client) {
      try { this.client.close(); } catch (e) {}
      this.client = null;
    }
    clearInterval(this.keepAliveInterval);

    return new Promise((resolve, reject) => {
      const client = new Client();
      this.client = client;

      client.connect(deviceIp, () => {
        console.log(`[CastManager] Connected to Cast device at ${deviceIp}`);

        // Stop any currently running apps first to ensure a clean slate
        client.receiver.getStatus((err, status) => {
          const apps = (status && status.applications) || [];
          
          const stopRemainingApps = () => {
            if (apps.length > 0) {
              const app = apps.shift();
              console.log(`[CastManager] Stopping previous app: ${app.displayName}...`);
              client.receiver.stop(app.sessionId, () => {
                setTimeout(stopRemainingApps, 600);
              });
            } else {
              startDashCast();
            }
          };

          const startDashCast = () => {
            client.launch(DashCast, (err, app) => {
              if (err) {
                console.error('[CastManager] Error launching DashCast:', err.message);
                client.close();
                return reject(err);
              }

              this.currentApp = app;
              console.log(`[CastManager] DashCast started, loading URL: ${targetUrl}`);
              setTimeout(() => {
                app.loadUrl(targetUrl, { force: true });
                this.startKeepAlive();
                resolve({ success: true, ip: deviceIp, url: targetUrl });
              }, 1000);
            });
          };

          stopRemainingApps();
        });
      });

      client.on('error', (err) => {
        console.error('[CastManager] Cast Client error:', err.message);
        clearInterval(this.keepAliveInterval);
      });

      client.on('close', () => {
        console.log('[CastManager] Cast connection closed');
        clearInterval(this.keepAliveInterval);
        this.currentApp = null;
        this.client = null;
      });
    });
  }

  startKeepAlive() {
    clearInterval(this.keepAliveInterval);
    this.keepAliveInterval = setInterval(() => {
      if (this.currentApp && this.currentUrl) {
        console.log('[CastManager] Keepalive refresh...');
        try {
          this.currentApp.loadUrl(this.currentUrl, { force: true });
        } catch (e) {}
      }
    }, 9 * 60 * 1000);
  }

  stopCast(deviceIp = null) {
    clearInterval(this.keepAliveInterval);
    const ip = deviceIp || this.currentIp;

    return new Promise((resolve) => {
      if (this.client && this.currentApp && this.currentApp.sessionId) {
        try {
          console.log('[CastManager] Stopping DashCast session on Nest Hub...');
          this.client.receiver.stop(this.currentApp.sessionId, () => {
            try { this.client.close(); } catch (e) {}
            this.client = null;
            this.currentApp = null;
            resolve({ success: true, stopped: true });
          });
          return;
        } catch (e) {
          try { this.client.close(); } catch (err) {}
          this.client = null;
          this.currentApp = null;
        }
      }

      if (ip) {
        const client = new Client();
        const timeout = setTimeout(() => {
          try { client.close(); } catch (e) {}
          resolve({ success: false, error: 'Timeout' });
        }, 4000);

        client.connect(ip, () => {
          client.receiver.getStatus((err, status) => {
            const apps = (status && status.applications) || [];
            const dashApp = apps.find(a => a.appId === DashCast.APP_ID || a.displayName === 'DashCast');
            if (dashApp) {
              console.log(`[CastManager] DashCast sessie (${dashApp.sessionId}) stopping...`);
              client.receiver.stop(dashApp.sessionId, () => {
                clearTimeout(timeout);
                try { client.close(); } catch (e) {}
                resolve({ success: true, stopped: true });
              });
            } else {
              clearTimeout(timeout);
              try { client.close(); } catch (e) {}
              resolve({ success: true, stopped: false });
            }
          });
        });

        client.on('error', (err) => {
          clearTimeout(timeout);
          resolve({ success: false, error: err.message });
        });
      } else {
        resolve({ success: true });
      }
    });
  }

  getStatus() {
    return {
      connected: Boolean(this.client && this.currentApp),
      targetIp: this.currentIp,
      targetUrl: this.currentUrl,
      devices: this.discoveredDevices
    };
  }
}

module.exports = new CastManager();
