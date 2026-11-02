const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_REPO = 'emulith/Nestify';
const DEFAULT_BRANCH = 'main';

class UpdateManager {
  constructor(rootDir = ROOT_DIR, options = {}) {
    this.rootDir = rootDir;
    this.repo = options.repo || process.env.NESTIFY_REPO || DEFAULT_REPO;
    this.branch = options.branch || process.env.NESTIFY_BRANCH || DEFAULT_BRANCH;
    this.versionFile = path.join(this.rootDir, 'version.json');
    this.packageFile = path.join(this.rootDir, 'package.json');
  }

  /**
   * Checks if the git executable is installed and reachable in PATH
   */
  isGitInstalled() {
    try {
      const res = spawnSync('git', ['--version'], {
        encoding: 'utf8',
        timeout: 3000
      });
      return res.status === 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Checks if this workspace is an active git repository
   */
  isGitRepository() {
    if (!this.isGitInstalled()) return false;
    if (!fs.existsSync(path.join(this.rootDir, '.git'))) return false;

    try {
      const res = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
        cwd: this.rootDir,
        encoding: 'utf8',
        timeout: 3000
      });
      return res.status === 0 && res.stdout.trim() === 'true';
    } catch (e) {
      return false;
    }
  }

  /**
   * Returns current git branch (or default branch)
   */
  getCurrentBranch() {
    if (!this.isGitRepository()) return this.branch;
    try {
      const res = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: this.rootDir,
        encoding: 'utf8',
        timeout: 3000
      });
      return res.status === 0 ? res.stdout.trim() : this.branch;
    } catch (e) {
      return this.branch;
    }
  }

  /**
   * Reads package.json version
   */
  getPackageVersion() {
    try {
      if (fs.existsSync(this.packageFile)) {
        const pkg = JSON.parse(fs.readFileSync(this.packageFile, 'utf8'));
        return pkg.version || '1.0.0';
      }
    } catch (e) {}
    return '1.0.0';
  }

  /**
   * Reads local version details (from git if present, otherwise version.json)
   */
  getLocalVersionInfo() {
    const pkgVersion = this.getPackageVersion();

    if (this.isGitRepository()) {
      try {
        const headRes = spawnSync('git', ['rev-parse', 'HEAD'], {
          cwd: this.rootDir,
          encoding: 'utf8',
          timeout: 3000
        });
        const fullSha = headRes.status === 0 ? headRes.stdout.trim() : null;
        if (fullSha) {
          const branch = this.getCurrentBranch();
          // Keep version.json synchronized with Git HEAD
          this.saveVersionJson({
            version: pkgVersion,
            commit: fullSha,
            branch
          });
          return {
            mode: 'git',
            version: pkgVersion,
            commit: fullSha,
            shortCommit: fullSha.slice(0, 7),
            branch
          };
        }
      } catch (e) {}
    }

    // Standalone / ZIP mode: read from version.json
    if (fs.existsSync(this.versionFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.versionFile, 'utf8'));
        const commit = data.commit || null;
        return {
          mode: 'standalone',
          version: data.version || pkgVersion,
          commit,
          shortCommit: commit ? commit.slice(0, 7) : null,
          date: data.date || null,
          branch: data.branch || this.branch
        };
      } catch (e) {}
    }

    return {
      mode: 'standalone',
      version: pkgVersion,
      commit: null,
      shortCommit: null,
      date: null,
      branch: this.branch
    };
  }

  /**
   * Writes local version.json metadata
   */
  saveVersionJson(info = {}) {
    try {
      let current = {};
      if (fs.existsSync(this.versionFile)) {
        try {
          current = JSON.parse(fs.readFileSync(this.versionFile, 'utf8'));
        } catch (e) {}
      }
      const updated = {
        version: info.version || current.version || this.getPackageVersion(),
        commit: info.commit || current.commit || null,
        date: info.date || current.date || null,
        branch: info.branch || current.branch || this.branch,
        updatedAt: new Date().toISOString(),
        source: info.source || current.source || (this.isGitRepository() ? 'git' : 'zip')
      };
      fs.writeFileSync(this.versionFile, JSON.stringify(updated, null, 2), 'utf8');
      return updated;
    } catch (e) {
      return null;
    }
  }

  /**
   * Fetches latest remote commit info from GitHub API with Atom feed fallback
   */
  async fetchRemoteCommit() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    // 1. Try official GitHub API
    try {
      const res = await fetch(`https://api.github.com/repos/${this.repo}/commits/${this.branch}`, {
        headers: {
          'User-Agent': 'Nestify-Update-Manager',
          'Accept': 'application/vnd.github.v3+json'
        },
        signal: controller.signal
      });

      if (res.ok) {
        clearTimeout(timeout);
        const data = await res.json();
        return {
          commit: data.sha,
          shortCommit: data.sha ? data.sha.slice(0, 7) : null,
          message: data.commit?.message ? data.commit.message.split('\n')[0].trim() : '',
          date: data.commit?.committer?.date || data.commit?.author?.date || null,
          source: 'api'
        };
      }
    } catch (e) {
      // API call failed or timed out, proceed to atom feed fallback
    } finally {
      clearTimeout(timeout);
    }

    // 2. Fallback to public GitHub Atom commit feed (no API key or rate limits)
    try {
      const atomController = new AbortController();
      const atomTimeout = setTimeout(() => atomController.abort(), 8000);
      const res = await fetch(`https://github.com/${this.repo}/commits/${this.branch}.atom`, {
        headers: {
          'User-Agent': 'Nestify-Update-Manager'
        },
        signal: atomController.signal
      });
      clearTimeout(atomTimeout);

      if (res.ok) {
        const xml = await res.text();
        const commitMatch = xml.match(/Commit\/([0-9a-f]{40})/i);
        const titleMatch = xml.match(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/i);
        const dateMatch = xml.match(/<entry>[\s\S]*?<updated>(.*?)<\/updated>/i);

        if (commitMatch) {
          const commit = commitMatch[1];
          return {
            commit,
            shortCommit: commit.slice(0, 7),
            message: titleMatch ? titleMatch[1].trim() : '',
            date: dateMatch ? dateMatch[1].trim() : null,
            source: 'atom'
          };
        }
      }
    } catch (e) {}

    return null;
  }

  /**
   * Check for updates across both Git repositories and standalone ZIP copies
   */
  async checkForUpdates() {
    const isGit = this.isGitRepository();
    const local = this.getLocalVersionInfo();

    // Strategy 1: Git repository with git installed
    if (isGit) {
      try {
        const fetchRes = spawnSync('git', ['fetch', 'origin'], {
          cwd: this.rootDir,
          encoding: 'utf8',
          timeout: 8000
        });

        if (fetchRes.status === 0) {
          const branch = this.getCurrentBranch();
          const countRes = spawnSync('git', ['rev-list', `HEAD..origin/${branch}`, '--count'], {
            cwd: this.rootDir,
            encoding: 'utf8',
            timeout: 3000
          });

          const behindCount = countRes.status === 0 ? parseInt(countRes.stdout.trim(), 10) || 0 : 0;

          // Get latest remote commit message if behind
          let latestMessage = '';
          let remoteShortCommit = local.shortCommit;
          if (behindCount > 0) {
            const logRes = spawnSync('git', ['log', `origin/${branch}`, '-1', '--format=%h %s'], {
              cwd: this.rootDir,
              encoding: 'utf8',
              timeout: 3000
            });
            if (logRes.status === 0 && logRes.stdout.trim()) {
              const parts = logRes.stdout.trim().split(' ');
              remoteShortCommit = parts[0];
              latestMessage = parts.slice(1).join(' ');
            }
          }

          return {
            supported: true,
            mode: 'git',
            upToDate: behindCount === 0,
            behindCount,
            branch,
            repo: this.repo,
            version: local.version,
            currentCommit: local.shortCommit,
            latestCommit: remoteShortCommit,
            latestMessage
          };
        }
      } catch (e) {
        // Fall back to Standalone / GitHub remote check if git fetch encounters issues
      }
    }

    // Strategy 2: Standalone / ZIP mode (or Git mode fallback)
    const remote = await this.fetchRemoteCommit();

    if (!remote) {
      return {
        supported: true,
        mode: isGit ? 'git' : 'standalone',
        upToDate: true,
        version: local.version,
        currentCommit: local.shortCommit || 'standalone',
        error: 'Network offline or GitHub unreachable'
      };
    }

    let upToDate = true;
    let behindCount = 0;

    if (local.commit) {
      const sameCommit = (local.commit.toLowerCase() === remote.commit.toLowerCase()) ||
        (local.shortCommit && remote.commit.toLowerCase().startsWith(local.shortCommit.toLowerCase()));
      upToDate = Boolean(sameCommit);
      behindCount = upToDate ? 0 : 1;
    } else {
      // No local commit tracked yet in this standalone folder -> update recommended
      upToDate = false;
      behindCount = 1;
    }

    return {
      supported: true,
      mode: 'standalone',
      upToDate,
      behindCount,
      branch: this.branch,
      repo: this.repo,
      version: local.version,
      currentCommit: local.shortCommit || 'standalone',
      latestCommit: remote.shortCommit,
      latestMessage: remote.message,
      latestDate: remote.date
    };
  }

  /**
   * Pure JavaScript ZIP unarchiver using Node's built-in zlib (zero dependencies)
   */
  extractZipBuffer(buffer, targetDir) {
    let offset = 0;
    let extractedCount = 0;

    while (offset < buffer.length - 4) {
      const sig = buffer.readUInt32LE(offset);
      if (sig !== 0x04034b50) break; // End of local file headers

      const flags = buffer.readUInt16LE(offset + 6);
      const method = buffer.readUInt16LE(offset + 8);
      let compSize = buffer.readUInt32LE(offset + 18);
      const nameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);

      const fileName = buffer.toString('utf8', offset + 30, offset + 30 + nameLen);
      const dataStart = offset + 30 + nameLen + extraLen;

      if ((flags & 0x08) !== 0 && compSize === 0) {
        let nextSig = dataStart;
        while (nextSig < buffer.length - 4) {
          const s = buffer.readUInt32LE(nextSig);
          if (s === 0x04034b50 || s === 0x02014b50 || s === 0x08074b50) break;
          nextSig++;
        }
        compSize = nextSig - dataStart;
        offset = (buffer.readUInt32LE(nextSig) === 0x08074b50) ? nextSig + 16 : nextSig;
      } else {
        offset = dataStart + compSize;
      }

      if (fileName.endsWith('/')) {
        fs.mkdirSync(path.join(targetDir, fileName), { recursive: true });
        continue;
      }

      const compressedData = buffer.slice(dataStart, dataStart + compSize);
      let fileData;

      if (method === 0) {
        fileData = compressedData;
      } else if (method === 8) {
        fileData = zlib.inflateRawSync(compressedData);
      } else {
        continue;
      }

      const dest = path.join(targetDir, fileName);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, fileData);
      extractedCount++;
    }

    return extractedCount;
  }

  /**
   * Unpacks a ZIP archive into a destination directory using available tools
   */
  unpackZipArchive(zipBuffer, zipFilePath, extractDir) {
    // 1. Try standard bsdtar / tar (native on Windows 10/11, Linux, macOS)
    try {
      const tarRes = spawnSync('tar', ['-xf', zipFilePath, '-C', extractDir], {
        encoding: 'utf8',
        timeout: 20000
      });
      if (tarRes.status === 0) return true;
    } catch (e) {}

    // 2. Try PowerShell Expand-Archive (built into Windows 7/8/10/11)
    if (process.platform === 'win32') {
      try {
        const psCmd = `Expand-Archive -LiteralPath '${zipFilePath}' -DestinationPath '${extractDir}' -Force`;
        const psRes = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', psCmd], {
          encoding: 'utf8',
          timeout: 30000
        });
        if (psRes.status === 0) return true;
      } catch (e) {}
    }

    // 3. Fallback to pure Node.js zip unarchiver (works anywhere Node runs)
    try {
      const count = this.extractZipBuffer(zipBuffer, extractDir);
      return count > 0;
    } catch (e) {
      return false;
    }
  }

  /**
   * Downloads GitHub repository ZIP archive and applies files cleanly while protecting configs
   */
  async downloadAndApplyZipUpdate(remoteInfo) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nestify-update-'));
    const zipPath = path.join(tempDir, 'update.zip');
    const extractDir = path.join(tempDir, 'extracted');
    fs.mkdirSync(extractDir);

    try {
      console.log(`[UpdateManager] Downloading latest version from ${this.repo} (${this.branch})...`);
      const downloadUrls = [
        `https://codeload.github.com/${this.repo}/zip/refs/heads/${this.branch}`,
        `https://github.com/${this.repo}/archive/refs/heads/${this.branch}.zip`
      ];

      let zipBuffer = null;
      for (const url of downloadUrls) {
        try {
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Nestify-Update-Manager' }
          });
          if (res.ok) {
            zipBuffer = Buffer.from(await res.arrayBuffer());
            if (zipBuffer && zipBuffer.length > 5000) break;
          }
        } catch (err) {}
      }

      if (!zipBuffer) {
        throw new Error('Failed to download update package from GitHub.');
      }

      fs.writeFileSync(zipPath, zipBuffer);

      console.log('[UpdateManager] Extracting update archive...');
      const unpacked = this.unpackZipArchive(zipBuffer, zipPath, extractDir);
      if (!unpacked) {
        throw new Error('Failed to extract update package archive.');
      }

      // Locate the inner project directory (e.g. Nestify-main)
      const entries = fs.readdirSync(extractDir);
      let archiveRoot = extractDir;
      for (const entry of entries) {
        const full = path.join(extractDir, entry);
        if (fs.statSync(full).isDirectory() &&
          (fs.existsSync(path.join(full, 'server.js')) || fs.existsSync(path.join(full, 'package.json')))) {
          archiveRoot = full;
          break;
        }
      }

      if (!fs.existsSync(path.join(archiveRoot, 'server.js'))) {
        throw new Error('Extracted update archive does not contain Nestify core files.');
      }

      // Track old package.json dependencies to see if npm install is needed
      let oldDeps = '';
      if (fs.existsSync(this.packageFile)) {
        try {
          oldDeps = JSON.stringify(JSON.parse(fs.readFileSync(this.packageFile, 'utf8')).dependencies || {});
        } catch (e) {}
      }

      // Safe recursive file copy preserving user configs
      const copyFilesSafely = (srcDir, dstDir, rel = '') => {
        const items = fs.readdirSync(srcDir);
        for (const item of items) {
          const sPath = path.join(srcDir, item);
          const dPath = path.join(dstDir, item);
          const rPath = rel ? `${rel}/${item}` : item;
          const normalized = rPath.replace(/\\/g, '/');

          // Strict Protection: Never overwrite user credentials or sensitive configs
          if (normalized === 'config/config.json' ||
              normalized === 'config/tokens.json' ||
              normalized === '.env' ||
              normalized === '.git' ||
              normalized === 'node_modules') {
            continue;
          }

          if (fs.statSync(sPath).isDirectory()) {
            if (!fs.existsSync(dPath)) {
              fs.mkdirSync(dPath, { recursive: true });
            }
            copyFilesSafely(sPath, dPath, rPath);
          } else {
            fs.copyFileSync(sPath, dPath);
          }
        }
      };

      console.log('[UpdateManager] Applying updated files...');
      copyFilesSafely(archiveRoot, this.rootDir);

      // Check if npm packages need installation
      let newDeps = '';
      if (fs.existsSync(this.packageFile)) {
        try {
          newDeps = JSON.stringify(JSON.parse(fs.readFileSync(this.packageFile, 'utf8')).dependencies || {});
        } catch (e) {}
      }

      if (oldDeps && newDeps && oldDeps !== newDeps) {
        console.log('[UpdateManager] New dependencies detected. Running npm install...');
        try {
          const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
          spawnSync(npmCmd, ['install', '--no-audit', '--no-fund'], {
            cwd: this.rootDir,
            encoding: 'utf8',
            timeout: 120000
          });
        } catch (e) {
          console.warn('[UpdateManager] npm install notice:', e.message);
        }
      }

      // Save version.json with the new remote commit
      const saved = this.saveVersionJson({
        version: this.getPackageVersion(),
        commit: remoteInfo ? remoteInfo.commit : null,
        date: remoteInfo ? remoteInfo.date : null,
        branch: this.branch,
        source: 'zip'
      });

      const commitDisplay = remoteInfo && remoteInfo.shortCommit ? remoteInfo.shortCommit : 'latest';
      return {
        success: true,
        updated: true,
        mode: 'standalone',
        commit: commitDisplay,
        message: `Successfully updated Nestify to ${commitDisplay}.`
      };
    } finally {
      // Clean up temporary workspace
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {}
    }
  }

  /**
   * Pulls the latest updates (via git pull or direct ZIP download)
   */
  async pullUpdate() {
    const check = await this.checkForUpdates();
    if (!check.supported) {
      return { success: false, message: check.reason || 'Updates not supported' };
    }
    if (check.upToDate) {
      return { success: true, updated: false, message: 'Already up to date' };
    }

    // Git Mode update
    if (check.mode === 'git' && this.isGitRepository()) {
      try {
        const statusRes = spawnSync('git', ['status', '--porcelain'], {
          cwd: this.rootDir,
          encoding: 'utf8',
          timeout: 3000
        });
        const hasChanges = Boolean(statusRes.stdout && statusRes.stdout.trim().length > 0);

        if (hasChanges) {
          console.log('[UpdateManager] Stashing local changes before updating...');
          spawnSync('git', ['stash', 'push', '-u', '-m', 'auto-update-stash'], {
            cwd: this.rootDir,
            encoding: 'utf8',
            timeout: 5000
          });
        }

        console.log(`[UpdateManager] Pulling update(s) via git...`);
        const pullRes = spawnSync('git', ['pull', '--rebase'], {
          cwd: this.rootDir,
          encoding: 'utf8',
          timeout: 20000
        });

        if (hasChanges) {
          console.log('[UpdateManager] Restoring local changes...');
          spawnSync('git', ['stash', 'pop'], {
            cwd: this.rootDir,
            encoding: 'utf8',
            timeout: 5000
          });
        }

        if (pullRes.status === 0) {
          this.getLocalVersionInfo(); // Refresh version.json
          return {
            success: true,
            updated: true,
            mode: 'git',
            behindCount: check.behindCount,
            message: `Successfully pulled update(s).`
          };
        } else {
          console.warn('[UpdateManager] Git pull failed, attempting standalone ZIP update fallback...');
        }
      } catch (err) {
        console.warn('[UpdateManager] Git pull error, falling back to ZIP updater:', err.message);
      }
    }

    // Standalone / ZIP Mode update
    try {
      const zipResult = await this.downloadAndApplyZipUpdate({
        commit: check.latestCommit,
        shortCommit: check.latestCommit ? check.latestCommit.slice(0, 7) : null,
        date: check.latestDate
      });
      return zipResult;
    } catch (err) {
      return {
        success: false,
        message: err.message || 'Failed to download and apply update'
      };
    }
  }

  /**
   * Main CLI execution routine (called automatically on start.bat)
   */
  async run() {
    console.log('[UpdateManager] Checking for latest updates...');
    const result = await this.checkForUpdates();

    if (result.error) {
      console.log(`[UpdateManager] Update check skipped (${result.error}).`);
      return result;
    }

    if (result.upToDate) {
      const commitTag = result.currentCommit && result.currentCommit !== 'standalone'
        ? ` (${result.currentCommit})`
        : '';
      console.log(`[UpdateManager] Nestify is up to date!${commitTag}`);
      return result;
    }

    const newTarget = result.latestCommit ? `[${result.latestCommit}]` : 'new version';
    const msg = result.latestMessage ? ` - ${result.latestMessage}` : '';
    console.log(`[UpdateManager] 🚀 Found update on GitHub! ${newTarget}${msg}`);
    console.log(`[UpdateManager] Applying update (mode: ${result.mode})...`);

    const pullResult = await this.pullUpdate();
    if (pullResult.success && pullResult.updated) {
      console.log('[UpdateManager] ✓ Successfully updated to the latest version!');
    } else if (!pullResult.success) {
      console.log(`[UpdateManager] Update notice: ${pullResult.message}`);
    }
    return pullResult;
  }
}

const updateManager = new UpdateManager();

if (require.main === module) {
  (async () => {
    try {
      await updateManager.run();
    } catch (e) {
      console.log('[UpdateManager] Notice:', e.message);
    }
  })();
}

module.exports = updateManager;
