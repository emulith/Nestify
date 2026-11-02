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
      let bonjour;
      try {
        bonjour = new Bonjour();
      } catch (e) {
        return resolve(this.discoveredDevices || []);
      }
      const devices = [];
      const browser = bonjour.find({ type: 'googlecast' });

      browser.on('error', (err) => {
        console.warn('[CastManager] Discovery error:', err.message);
      });

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
        try { bonjour.destroy(); } catch (e) {}
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
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    return new Promise((resolve, reject) => {
      const client = new Client();
      this.client = client;

      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { client.close(); } catch (e) {}
          reject(new Error(`Connection to Cast device at ${deviceIp} timed out after 10s`));
        }
      }, 10000);

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
                if (!settled) {
                  settled = true;
                  clearTimeout(timeout);
                  try { client.close(); } catch (e) {}
                  return reject(err);
                }
                return;
              }

              this.currentApp = app;
              console.log(`[CastManager] DashCast started, loading URL: ${targetUrl}`);
              setTimeout(() => {
                try {
                  app.loadUrl(targetUrl, { force: true });
                  this.startKeepAlive();
                } catch (e) {}
                if (!settled) {
                  settled = true;
                  clearTimeout(timeout);
                  resolve({ success: true, ip: deviceIp, url: targetUrl });
                }
              }, 1000);
            });
          };

          stopRemainingApps();
        });
      });

      client.on('error', (err) => {
        console.error('[CastManager] Cast Client error:', err.message);
        if (this.keepAliveInterval) {
          clearInterval(this.keepAliveInterval);
          this.keepAliveInterval = null;
        }
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(err);
        }
      });

      client.on('close', () => {
        console.log('[CastManager] Cast connection closed');
        if (this.keepAliveInterval) {
          clearInterval(this.keepAliveInterval);
          this.keepAliveInterval = null;
        }
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
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    const ip = deviceIp || this.currentIp;

    return new Promise((resolve) => {
      // Support both castv2-client session object and legacy direct property
      const activeSessionId = this.currentApp ? (this.currentApp.sessionId || (this.currentApp.session && this.currentApp.session.sessionId)) : null;

      if (this.client) {
        const clientToClose = this.client;
        const appToClose = this.currentApp;
        this.client = null;
        this.currentApp = null;

        if (activeSessionId) {
          let settled = false;
          const finishActive = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(activeTimeout);
            try { clientToClose.close(); } catch (e) {}
            resolve(result);
          };

          const activeTimeout = setTimeout(() => {
            finishActive({ success: true, stopped: false });
          }, 4000);

          try {
            console.log('[CastManager] Stopping DashCast session on Nest Hub...');
            if (appToClose && typeof appToClose.close === 'function') {
              try { appToClose.close(); } catch (e) {}
            }

            if (clientToClose.receiver && typeof clientToClose.receiver.stop === 'function') {
              clientToClose.receiver.stop(activeSessionId, () => {
                finishActive({ success: true, stopped: true });
              });
            } else if (typeof clientToClose.stop === 'function') {
              clientToClose.stop(appToClose, () => {
                finishActive({ success: true, stopped: true });
              });
            } else {
              finishActive({ success: true, stopped: true });
            }
            return;
          } catch (e) {
            finishActive({ success: true, stopped: false });
            return;
          }
        } else {
          try { clientToClose.close(); } catch (e) {}
        }
      }

      if (ip) {
        const client = new Client();
        let settled = false;

        const finish = (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          try { client.close(); } catch (e) {}
          resolve(result);
        };

        const timeout = setTimeout(() => {
          finish({ success: false, error: 'Timeout' });
        }, 4000);

        client.connect(ip, () => {
          client.receiver.getStatus((err, status) => {
            if (settled) return;
            if (err) {
              return finish({ success: false, error: err.message });
            }
            const apps = (status && status.applications) || [];
            const dashApp = apps.find(a => (a.appId === DashCast.APP_ID || a.displayName === 'DashCast') && !a.isIdleScreen);
            if (dashApp && dashApp.sessionId) {
              console.log(`[CastManager] DashCast session (${dashApp.sessionId}) stopping...`);
              client.receiver.stop(dashApp.sessionId, () => {
                finish({ success: true, stopped: true });
              });
            } else {
              finish({ success: true, stopped: false });
            }
          });
        });

        client.on('error', (err) => {
          finish({ success: false, error: err.message });
        });
      } else {
        resolve({ success: true, stopped: false });
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
