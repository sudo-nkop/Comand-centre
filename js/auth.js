import { showToast } from './utils.js';
import { store } from './store.js';

const TOKEN_KEY = 'cc-drive-token';
const TOKEN_EXP_KEY = 'cc-drive-token-exp';

class DriveAuth {
  constructor() {
    this._token = null;
    this._tokenClient = null;
    this._connected = false;
  }

  isConnected() {
    return this._connected && !!this._token && Date.now() < (parseInt(localStorage.getItem(TOKEN_EXP_KEY) || '0'));
  }

  getToken() {
    return this._token;
  }

  init(clientId) {
    // Always wire up the button so clicking it works even before a clientId is saved
    this._updateUI(false);

    if (!clientId) return;

    // Restore saved token
    const saved = localStorage.getItem(TOKEN_KEY);
    const exp = parseInt(localStorage.getItem(TOKEN_EXP_KEY) || '0');
    if (saved && Date.now() < exp) {
      this._token = saved;
      this._connected = true;
      this._updateUI(true);
    }

    // Initialize token client (GIS)
    if (typeof google === 'undefined') {
      console.warn('Google Identity Services not loaded');
      return;
    }
    this._tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp) => {
        if (resp.error) {
          showToast('Google auth failed: ' + resp.error, 'error');
          return;
        }
        this._token = resp.access_token;
        this._connected = true;
        const expiresIn = (resp.expires_in || 3600) * 1000;
        localStorage.setItem(TOKEN_KEY, this._token);
        localStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + expiresIn));
        this._updateUI(true);
        showToast('Google Drive connected!', 'success');
        store.syncFromDrive();
      }
    });
  }

  signIn() {
    const clientId = store.data.settings.clientId;
    if (!clientId) {
      this._promptClientId();
      return;
    }
    if (!this._tokenClient) {
      this.init(clientId);
    }
    if (!this._tokenClient) {
      showToast('Google Identity Services not available', 'error');
      return;
    }
    this._tokenClient.requestAccessToken({ prompt: this._connected ? '' : 'consent' });
  }

  signOut() {
    if (this._token) {
      google.accounts.oauth2.revoke(this._token);
    }
    this._token = null;
    this._connected = false;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXP_KEY);
    this._updateUI(false);
    showToast('Disconnected from Google Drive', 'info');
  }

  _updateUI(connected) {
    const btn = document.getElementById('auth-btn');
    const syncStatus = document.querySelector('.sync-status');
    const dot = document.querySelector('.sync-dot');
    const syncBtn = document.getElementById('sync-btn');
    if (btn) {
      btn.textContent = connected ? 'Disconnect Drive' : 'Connect Drive';
      btn.onclick = connected ? () => this.signOut() : () => this.signIn();
    }
    if (dot) dot.style.background = connected ? 'var(--green)' : 'var(--text-muted)';
    if (syncStatus) {
      const span = syncStatus.querySelector('span');
      if (span) span.textContent = connected ? 'Drive connected' : 'Local only';
    }
    if (syncBtn) syncBtn.style.display = connected ? 'flex' : 'none';
  }

  _promptClientId() {
    const current = store.data.settings.clientId || '';
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">Connect Google Drive</h2>
        <button class="btn-icon" onclick="document.getElementById('modal-overlay').classList.remove('open')">
          <i data-lucide="x"></i>
        </button>
      </div>
      <p style="color:var(--text-secondary);font-size:0.875rem;margin-bottom:16px;line-height:1.6">
        To sync with Google Drive, you need a Google OAuth Client ID.
        <br><br>
        <strong>Setup steps:</strong><br>
        1. Go to <a href="https://console.cloud.google.com" target="_blank" style="color:var(--accent-light)">Google Cloud Console</a><br>
        2. Create a project &amp; enable Drive API<br>
        3. Create OAuth 2.0 credentials (Web application)<br>
        4. Add your GitHub Pages URL as authorized JavaScript origin<br>
        5. Paste the Client ID below
      </p>
      <div class="form-group">
        <label class="form-label">OAuth Client ID</label>
        <input id="client-id-input" class="input" type="text" placeholder="xxxxxx.apps.googleusercontent.com" value="${current}">
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('open')">Cancel</button>
        <button class="btn btn-primary" id="save-client-id-btn">Save &amp; Connect</button>
      </div>
    `;
    overlay.classList.add('open');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    document.getElementById('save-client-id-btn').onclick = () => {
      const id = document.getElementById('client-id-input').value.trim();
      if (!id) { showToast('Please enter a Client ID', 'error'); return; }
      store.setSetting('clientId', id);
      overlay.classList.remove('open');
      this.init(id);
      this.signIn();
    };
  }
}

export const driveAuth = new DriveAuth();
window._driveAuth = driveAuth;
