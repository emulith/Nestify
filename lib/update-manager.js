const { spawnSync } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

class UpdateManager {
  constructor(rootDir = ROOT_DIR) {
    this.rootDir = rootDir;
  }

  isGitRepository() {
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

  getCurrentBranch() {
    try {
      const res = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: this.rootDir,
        encoding: 'utf8',
        timeout: 3000
      });
      return res.status === 0 ? res.stdout.trim() : 'main';
    } catch (e) {
      return 'main';
    }
  }

  checkForUpdates() {
    if (!this.isGitRepository()) {
      return { supported: false, reason: 'Not a git repository' };
    }

    try {
      const fetchRes = spawnSync('git', ['fetch', 'origin'], {
        cwd: this.rootDir,
        encoding: 'utf8',
        timeout: 8000
      });

      if (fetchRes.status !== 0) {
        return {
          supported: true,
          upToDate: true,
          error: fetchRes.stderr ? fetchRes.stderr.trim() : 'Failed to fetch from remote'
        };
      }

      const branch = this.getCurrentBranch();
      const countRes = spawnSync('git', ['rev-list', `HEAD..origin/${branch}`, '--count'], {
        cwd: this.rootDir,
        encoding: 'utf8',
        timeout: 3000
      });

      const behindCount = countRes.status === 0 ? parseInt(countRes.stdout.trim(), 10) || 0 : 0;

      return {
        supported: true,
        upToDate: behindCount === 0,
        behindCount,
        branch
      };
    } catch (err) {
      return { supported: true, upToDate: true, error: err.message };
    }
  }

  pullUpdate() {
    if (!this.isGitRepository()) {
      return { success: false, message: 'Not a git repository' };
    }

    const check = this.checkForUpdates();
    if (!check.supported) {
      return { success: false, message: check.reason };
    }
    if (check.upToDate) {
      return { success: true, updated: false, message: 'Already up to date' };
    }

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

      console.log(`[UpdateManager] Pulling ${check.behindCount} incoming update(s)...`);
      const pullRes = spawnSync('git', ['pull', '--rebase'], {
        cwd: this.rootDir,
        encoding: 'utf8',
        timeout: 15000
      });

      if (hasChanges) {
        console.log('[UpdateManager] Restoring local changes...');
        spawnSync('git', ['stash', 'pop'], {
          cwd: this.rootDir,
          encoding: 'utf8',
          timeout: 5000
        });
      }

      if (pullRes.status !== 0) {
        return {
          success: false,
          message: pullRes.stderr ? pullRes.stderr.trim() : 'git pull failed'
        };
      }

      return {
        success: true,
        updated: true,
        behindCount: check.behindCount,
        message: `Successfully pulled ${check.behindCount} update(s).`
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  run() {
    console.log('[UpdateManager] Checking for latest updates...');
    const result = this.checkForUpdates();

    if (!result.supported) {
      console.log('[UpdateManager] Git updates not active (running as standalone copy).');
      return result;
    }

    if (result.error) {
      console.log(`[UpdateManager] Update check skipped (${result.error}).`);
      return result;
    }

    if (result.upToDate) {
      console.log('[UpdateManager] Nestify is up to date!');
      return result;
    }

    console.log(`[UpdateManager] 🚀 Found ${result.behindCount} new update(s) on GitHub!`);
    const pullResult = this.pullUpdate();
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
  try {
    updateManager.run();
  } catch (e) {
    console.log('[UpdateManager] Notice:', e.message);
  }
}

module.exports = updateManager;
