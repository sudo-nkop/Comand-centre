import { showToast } from './utils.js';
import { store } from './store.js';

const TOKEN_KEY    = 'cc-drive-token';
const TOKEN_EXP_KEY = 'cc-drive-token-exp';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

class DriveAuth {
  constructor() {
    this._token = null;
    this._connected = false;
  }

  isConnected() {
    return this._connected
      && !!this._token
      && Date.now() < parseInt(localStorage.getItem(TOKEN_EXP_KEY) || '0');
  }

  getToken() { return this._token; }

  init() {
    // Check if we're returning from an OAuth redirect (token in URL hash)
    this._handleOAuthCallback();

    // Restore a previously saved token if still valid
    const saved = localStorage.getItem(TOKEN_KEY);
    const exp   = parseInt(localStorage.getItem(TOKEN_EXP_KEY) || '0');
    if (saved && Date.now() < exp) {
      this._token     = saved;
      this._connected = true;
    }

    // Wire up sidebar button once, using addEventListener so nothing can overwrite it
    const btn = document.getElementById('auth-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        if (this._connected) this._signOut();
        else this._startSignIn();
      });
    }

    this._updateUI();
  }

  // ── OAuth callback ──────────────────────────────────────────────────────
  _handleOAuthCallback() {
    // Google sends the token back in the URL hash after redirect
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) return;

    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const token     = params.get('access_token');
    const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
    if (!token) return;

    // Remove token from URL so it doesn't linger in browser history
    history.replaceState(null, '', window.location.pathname + window.location.search);

    this._saveToken(token, expiresIn);
  }

  // ── Sign-in flow ────────────────────────────────────────────────────────
  _startSignIn() {
    const clientId = store.data.settings.clientId;
    if (!clientId) {
      this._showSetupModal(() => {
        // Called after the user saves a client ID
        this._startSignIn();
      });
      return;
    }
    this._redirectToGoogle(clientId);
  }

  _redirectToGoogle(clientId) {
    // Standard OAuth 2.0 implicit flow — no library required
    const redirectUri = window.location.origin + window.location.pathname;
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id',     clientId);
    url.searchParams.set('redirect_uri',  redirectUri);
    url.searchParams.set('response_type', 'token');
    url.searchParams.set('scope',         SCOPE);
    url.searchParams.set('prompt',        'consent');
    window.location.href = url.toString();
  }

  // ── Sign-out ────────────────────────────────────────────────────────────
  _signOut() {
    // Best-effort token revocation (non-blocking)
    if (this._token) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${this._token}`, { method: 'POST' })
        .catch(() => {});
    }
    this._token     = null;
    this._connected = false;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXP_KEY);
    this._updateUI();
    showToast('Disconnected from Google Drive', 'info');
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  _saveToken(token, expiresIn) {
    this._token     = token;
    this._connected = true;
    localStorage.setItem(TOKEN_KEY,     token);
    localStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + expiresIn * 1000));
    this._updateUI();
    showToast('Google Drive connected!', 'success');
    store.syncFromDrive();
  }

  _updateUI() {
    const btn        = document.getElementById('auth-btn');
    const dot        = document.querySelector('.sync-dot');
    const statusText = document.getElementById('sync-status-text');
    const syncBtn    = document.getElementById('sync-btn');

    if (btn)        btn.textContent = this._connected ? 'Disconnect Drive' : 'Connect Drive';
    if (dot)        dot.style.background = this._connected ? 'var(--green)' : 'var(--text-muted)';
    if (statusText) statusText.textContent = this._connected ? 'Drive connected' : 'Local only';
    if (syncBtn)    syncBtn.style.display  = this._connected ? 'flex' : 'none';
  }

  // ── Setup modal ─────────────────────────────────────────────────────────
  _showSetupModal(onSaved) {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    if (!overlay || !content) return;

    const redirectUri = window.location.origin + window.location.pathname;
    const existing    = store.data.settings.clientId || '';

    content.innerHTML = `
      <div class="modal-header">
        <h2 class="modal-title">Connect Google Drive</h2>
        <button class="btn-icon" id="gdrive-modal-close">
          <i data-lucide="x"></i>
        </button>
      </div>

      <div style="background:var(--bg-primary);border-radius:var(--radius-sm);padding:14px;margin-bottom:20px;font-size:0.82rem;color:var(--text-secondary);line-height:2">
        <strong style="color:var(--text-primary);display:block;margin-bottom:4px">One-time setup (2 min)</strong>
        1. Open
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank"
           style="color:var(--accent-light)">console.cloud.google.com/apis/credentials</a><br>
        2. Create a project &rarr; enable the <strong>Google Drive API</strong><br>
        3. Click <strong>Create credentials &rarr; OAuth 2.0 Client ID &rarr; Web application</strong><br>
        4. Under <strong>Authorized JavaScript origins</strong> add:<br>
        &nbsp;&nbsp;&nbsp;<code style="color:var(--cyan);background:var(--bg-card);padding:2px 6px;border-radius:4px">${window.location.origin}</code><br>
        5. Under <strong>Authorized redirect URIs</strong> add:<br>
        &nbsp;&nbsp;&nbsp;<code style="color:var(--cyan);background:var(--bg-card);padding:2px 6px;border-radius:4px">${redirectUri}</code><br>
        6. Copy the <strong>Client ID</strong> and paste it below
      </div>

      <div class="form-group">
        <label class="form-label">Google OAuth Client ID</label>
        <input id="gdrive-client-id" class="input" type="text"
               placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
               value="${existing}" autocomplete="off">
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:20px">
        <button class="btn btn-secondary" id="gdrive-modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="gdrive-modal-save">
          <i data-lucide="log-in"></i> Save &amp; Connect
        </button>
      </div>
    `;

    overlay.classList.add('open');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const close = () => overlay.classList.remove('open');
    document.getElementById('gdrive-modal-close').addEventListener('click', close);
    document.getElementById('gdrive-modal-cancel').addEventListener('click', close);

    document.getElementById('gdrive-modal-save').addEventListener('click', () => {
      const id = document.getElementById('gdrive-client-id').value.trim();
      if (!id) { showToast('Please enter your Client ID', 'error'); return; }
      store.setSetting('clientId', id);
      close();
      onSaved();
    });

    // Allow Enter key to submit
    document.getElementById('gdrive-client-id').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('gdrive-modal-save').click();
    });
  }
}

export const driveAuth = new DriveAuth();
window._driveAuth = driveAuth;
