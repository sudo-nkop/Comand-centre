import { store } from '../store.js';
import { formatBytes, formatRelative, escapeHtml, showToast } from '../utils.js';

export function renderStorage() {
  const { files } = store.data;
  const isConnected = window._driveAuth?.isConnected();

  return `
    <div class="section-header">
      <h2 class="section-title">Storage</h2>
      ${isConnected ? `
        <label class="btn btn-primary" style="cursor:pointer">
          <i data-lucide="upload"></i> Upload File
          <input type="file" id="file-upload-input" style="display:none" multiple>
        </label>
      ` : `
        <div style="display:flex;align-items:center;gap:12px">
          <span style="font-size:0.85rem;color:var(--text-muted)">Connect Google Drive to upload files</span>
          <button class="btn btn-secondary" onclick="document.getElementById('auth-btn').click()">
            <i data-lucide="cloud"></i> Connect Drive
          </button>
        </div>
      `}
    </div>

    ${!isConnected ? `
      <div class="card" style="margin-bottom:20px;border-color:rgba(124,58,237,0.3)">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:48px;height:48px;background:var(--accent-glow);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i data-lucide="cloud" style="width:24px;height:24px;color:var(--accent-light)"></i>
          </div>
          <div>
            <div style="font-weight:600;margin-bottom:4px">Google Drive Storage</div>
            <div style="font-size:0.85rem;color:var(--text-muted)">Connect your Google Drive account to upload and manage files. Files are stored securely in your own Drive.</div>
          </div>
        </div>
      </div>
    ` : ''}

    ${files.length === 0 ? `
      <div class="empty-state">
        <i data-lucide="folder-open" style="width:48px;height:48px"></i>
        <span>${isConnected ? 'No files uploaded yet. Upload your first file!' : 'Connect Drive to upload files'}</span>
      </div>
    ` : `
      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span style="font-size:0.8rem;color:var(--text-muted)">${files.length} file${files.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="file-list">
        ${files.map(f => renderFileItem(f)).join('')}
      </div>
    `}

    <!-- Upload progress area -->
    <div id="upload-progress" style="display:none;margin-top:16px">
      <div class="card" style="padding:12px">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="loading-spinner"></div>
          <div>
            <div style="font-size:0.875rem;font-weight:500" id="upload-filename">Uploading...</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">Please wait</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderFileItem(f) {
  const ext = f.name.split('.').pop().toLowerCase();
  const iconMap = {
    pdf: 'file-text', doc: 'file-text', docx: 'file-text',
    xls: 'file-spreadsheet', xlsx: 'file-spreadsheet',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', svg: 'image', webp: 'image',
    mp4: 'video', mov: 'video', avi: 'video',
    mp3: 'music', wav: 'music',
    zip: 'archive', rar: 'archive',
    js: 'code', ts: 'code', py: 'code', json: 'code', html: 'code', css: 'code'
  };
  const icon = iconMap[ext] || 'file';

  return `
    <div class="file-item">
      <div class="file-icon">
        <i data-lucide="${icon}" style="width:20px;height:20px"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div class="file-name">${escapeHtml(f.name)}</div>
        <div class="file-meta">
          ${f.size ? formatBytes(f.size) + ' · ' : ''}${formatRelative(f.uploadedAt)}
        </div>
      </div>
      <div style="display:flex;gap:6px">
        ${f.webViewLink ? `
          <a href="${f.webViewLink}" target="_blank" class="btn btn-secondary btn-sm">
            <i data-lucide="external-link" style="width:12px;height:12px"></i> Open
          </a>
        ` : ''}
        <button class="btn-icon" data-action="delete-file" data-id="${f.id}" data-drive-id="${f.driveFileId || ''}" title="Delete" style="color:var(--red)">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>
  `;
}

export function mountStorage(rerender) {
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('file-upload-input')?.addEventListener('change', async e => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const progressEl = document.getElementById('upload-progress');
    const filenameEl = document.getElementById('upload-filename');
    progressEl.style.display = 'block';

    for (const file of files) {
      filenameEl.textContent = `Uploading ${file.name}...`;
      try {
        const result = await store.uploadFileToDrive(file);
        store.addFile({
          name: result.name || file.name,
          driveFileId: result.id,
          size: result.size || file.size,
          mimeType: result.mimeType || file.type,
          webViewLink: result.webViewLink
        });
        showToast(`${file.name} uploaded!`, 'success');
      } catch (err) {
        showToast(`Failed to upload ${file.name}: ${err.message}`, 'error');
      }
    }

    progressEl.style.display = 'none';
    e.target.value = '';
    rerender();
  });

  document.querySelectorAll('[data-action="delete-file"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { id, driveId } = btn.dataset;
      if (!confirm('Delete this file? It will also be removed from Google Drive.')) return;
      if (driveId) {
        try { await store.deleteFileFromDrive(driveId); } catch (e) { console.warn('Drive delete failed', e); }
      }
      store.deleteFile(id);
      rerender();
      showToast('File deleted', 'info');
    });
  });
}
