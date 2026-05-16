import { store } from '../store.js';
import { formatRelative, escapeHtml, openModal, closeModal, showToast } from '../utils.js';

let searchQuery = '';

export function renderNotes() {
  const { notes } = store.data;

  const pinned = notes.filter(n => n.pinned);
  const unpinned = notes.filter(n => !n.pinned);
  let allNotes = [...pinned, ...unpinned];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    allNotes = allNotes.filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  return `
    <div class="section-header">
      <h2 class="section-title">Notes</h2>
      <div style="display:flex;gap:8px">
        <input class="input" id="notes-search" type="text" placeholder="Search notes..." value="${escapeHtml(searchQuery)}" style="width:220px">
        <button class="btn btn-primary" id="add-note-btn"><i data-lucide="plus"></i> New Note</button>
      </div>
    </div>

    ${allNotes.length === 0 ? `
      <div class="empty-state">
        <i data-lucide="file-text" style="width:48px;height:48px"></i>
        <span>${searchQuery ? 'No notes match your search' : 'No notes yet. Create your first one!'}</span>
      </div>
    ` : `
      <div class="notes-grid">
        ${allNotes.map(n => renderNoteCard(n)).join('')}
      </div>
    `}
  `;
}

function renderNoteCard(n) {
  return `
    <div class="note-card" data-id="${n.id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <h3 style="font-size:0.95rem;font-weight:600;margin:0;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(n.title)}</h3>
        <div style="display:flex;gap:2px;flex-shrink:0;margin-left:8px;opacity:0;transition:opacity 0.2s" class="note-actions">
          <button class="btn-icon" data-action="pin" data-id="${n.id}" title="${n.pinned?'Unpin':'Pin'}">
            <i data-lucide="${n.pinned?'pin-off':'pin'}" style="width:14px;height:14px;color:${n.pinned?'var(--accent-light)':'var(--text-muted)'}"></i>
          </button>
          <button class="btn-icon" data-action="delete-note" data-id="${n.id}" title="Delete">
            <i data-lucide="trash-2" style="width:14px;height:14px;color:var(--red)"></i>
          </button>
        </div>
      </div>
      <div class="note-content-preview" style="margin-bottom:10px">${escapeHtml(n.content || 'Empty note')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
        ${n.tags.map(t => `<span class="badge badge-tag">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div style="font-size:0.72rem;color:var(--text-muted);display:flex;align-items:center;gap:4px">
        ${n.pinned ? `<i data-lucide="pin" style="width:10px;height:10px;color:var(--accent-light)"></i>` : ''}
        ${formatRelative(n.updatedAt)}
      </div>
    </div>
  `;
}

export function mountNotes(rerender) {
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('add-note-btn')?.addEventListener('click', () => openNoteEditor(null, rerender));

  document.getElementById('notes-search')?.addEventListener('input', e => {
    searchQuery = e.target.value;
    rerender();
  });

  // Show note actions on hover
  document.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('mouseenter', () => card.querySelector('.note-actions').style.opacity = '1');
    card.addEventListener('mouseleave', () => card.querySelector('.note-actions').style.opacity = '0');
    card.addEventListener('click', e => {
      if (e.target.closest('[data-action]')) return;
      const id = card.dataset.id;
      openNoteEditor(id, rerender);
    });
  });

  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (action === 'pin') { store.togglePinNote(id); rerender(); }
      else if (action === 'delete-note') {
        if (confirm('Delete this note?')) { store.deleteNote(id); rerender(); }
      }
    });
  });
}

function openNoteEditor(id, rerender) {
  const note = id ? store.data.notes.find(n => n.id === id) : null;

  openModal(`
    <div class="modal-header" style="margin-bottom:12px">
      <div style="flex:1">
        <input id="note-title" class="input" type="text" placeholder="Note title..." value="${note ? escapeHtml(note.title) : ''}" style="font-size:1.1rem;font-weight:600;border:none;background:transparent;padding:4px 0;width:100%" autofocus>
      </div>
      <button class="btn-icon" onclick="closeModal()"><i data-lucide="x"></i></button>
    </div>
    <div style="border-bottom:1px solid var(--border);margin-bottom:12px;padding-bottom:12px">
      <input id="note-tags" class="input" type="text" placeholder="Tags (comma separated)..." value="${note ? escapeHtml(note.tags.join(', ')) : ''}" style="border:none;background:transparent;padding:4px 0;font-size:0.8rem;color:var(--accent-light)">
    </div>
    <textarea id="note-content" class="textarea" placeholder="Write your note here... (Markdown supported)" style="min-height:300px;border:none;background:transparent;resize:vertical;font-size:0.9rem;line-height:1.7">${note ? escapeHtml(note.content || '') : ''}</textarea>
    <div style="display:flex;gap:8px;justify-content:space-between;margin-top:16px;padding-top:12px;border-top:1px solid var(--border)">
      <div style="font-size:0.75rem;color:var(--text-muted);display:flex;align-items:center;gap:4px">
        ${note ? `Last edited ${formatRelative(note.updatedAt)}` : 'New note'}
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" id="save-note-btn">${note ? 'Save Changes' : 'Create Note'}</button>
      </div>
    </div>
  `);

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Auto-save hint: Ctrl+S
  document.getElementById('note-content').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); document.getElementById('save-note-btn').click(); }
  });

  document.getElementById('save-note-btn').addEventListener('click', () => {
    const title = document.getElementById('note-title').value.trim() || 'Untitled Note';
    const content = document.getElementById('note-content').value;
    const tags = document.getElementById('note-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
    if (note) {
      store.updateNote(id, { title, content, tags });
      showToast('Note saved!', 'success');
    } else {
      store.addNote({ title, content, tags });
      showToast('Note created!', 'success');
    }
    closeModal();
    rerender();
  });
}

window.closeModal = closeModal;
