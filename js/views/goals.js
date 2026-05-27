import { store } from '../store.js';
import { formatDate, formatRelative, escapeHtml, openModal, closeModal, showToast, generateId } from '../utils.js';

const CATEGORIES = ['personal', 'work', 'health', 'finance', 'learning', 'other'];

let _clickHandler = null;
let _changeHandler = null;

export function unmountGoals() {
  if (_clickHandler) { document.removeEventListener('click', _clickHandler); _clickHandler = null; }
  if (_changeHandler) { document.removeEventListener('change', _changeHandler); _changeHandler = null; }
}

export function renderGoals() {
  const { goals } = store.data;
  const active = goals.filter(g => g.progress < 100);
  const completed = goals.filter(g => g.progress === 100);

  return `
    <div class="section-header">
      <h2 class="section-title">Goals</h2>
      <button class="btn btn-primary" id="add-goal-btn"><i data-lucide="plus"></i> Add Goal</button>
    </div>

    ${goals.length === 0 ? `
      <div class="empty-state">
        <i data-lucide="target" style="width:48px;height:48px"></i>
        <span>No goals yet. Set your first goal!</span>
      </div>
    ` : ''}

    ${active.length > 0 ? `
      <h3 style="font-size:0.85rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Active Goals</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;margin-bottom:24px">
        ${active.map(g => renderGoalCard(g)).join('')}
      </div>
    ` : ''}

    ${completed.length > 0 ? `
      <h3 style="font-size:0.85rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Completed</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px">
        ${completed.map(g => renderGoalCard(g, true)).join('')}
      </div>
    ` : ''}
  `;
}

function renderGoalCard(g, done = false) {
  const daysLeft = g.targetDate ? Math.ceil((g.targetDate - Date.now()) / 86400000) : null;
  const isOverdue = daysLeft !== null && daysLeft < 0 && !done;
  const linkedTasks = (g.linkedTaskIds || [])
    .map(id => store.data.todos.find(t => t.id === id))
    .filter(Boolean);

  return `
    <div class="goal-card ${done ? 'completed-goal' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <div style="flex:1;min-width:0">
          <span class="badge" style="background:var(--accent-glow);color:var(--accent-light);margin-bottom:6px">${g.category}</span>
          <h3 style="font-size:1rem;font-weight:600;margin:0 0 4px">${escapeHtml(g.title)}</h3>
          ${g.description ? `<p style="font-size:0.8rem;color:var(--text-muted);margin:0">${escapeHtml(g.description)}</p>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn-icon" data-action="edit-goal" data-id="${g.id}" title="Edit"><i data-lucide="pencil"></i></button>
          <button class="btn-icon" data-action="delete-goal" data-id="${g.id}" title="Delete" style="color:var(--red)"><i data-lucide="trash-2"></i></button>
        </div>
      </div>

      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:0.8rem;color:var(--text-secondary)">Progress</span>
          <span style="font-size:0.8rem;font-weight:600;color:${done?'var(--green)':'var(--accent-light)'}">${g.progress}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${g.progress}%;${done?'background:var(--green)':''}"></div>
        </div>
      </div>

      ${g.targetDate ? `
        <div style="font-size:0.75rem;color:${isOverdue?'var(--red)':done?'var(--green)':'var(--text-muted)'};margin-bottom:12px">
          <i data-lucide="calendar" style="width:11px;height:11px;vertical-align:middle"></i>
          ${done ? `Completed` : isOverdue ? `Overdue by ${Math.abs(daysLeft)} days` : `${daysLeft} days left`}
          · ${formatDate(g.targetDate)}
        </div>
      ` : ''}

      ${g.milestones.length > 0 ? `
        <div style="margin-bottom:12px">
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
            Milestones (${g.milestones.filter(m=>m.completed).length}/${g.milestones.length})
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            ${g.milestones.map(m => `
              <div class="milestone-item">
                <div class="milestone-check ${m.completed?'completed':''}" data-action="toggle-milestone" data-goal-id="${g.id}" data-milestone-id="${m.id}">
                  ${m.completed ? `<i data-lucide="check" style="width:10px;height:10px"></i>` : ''}
                </div>
                <span style="font-size:0.85rem;${m.completed?'text-decoration:line-through;color:var(--text-muted)':''}">${escapeHtml(m.title)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${linkedTasks.length > 0 ? `
        <div style="margin-bottom:12px">
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px">
            Linked Tasks (${linkedTasks.filter(t=>t.completed).length}/${linkedTasks.length})
          </div>
          <div style="display:flex;flex-direction:column;gap:4px">
            ${linkedTasks.map(t => `
              <div class="milestone-item" style="justify-content:space-between">
                <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
                  <div class="milestone-check ${t.completed?'completed':''}" data-action="toggle-linked-task" data-todo-id="${t.id}">
                    ${t.completed ? `<i data-lucide="check" style="width:10px;height:10px"></i>` : ''}
                  </div>
                  <span style="font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${t.completed?'text-decoration:line-through;color:var(--text-muted)':''}">${escapeHtml(t.title)}</span>
                  <span class="badge badge-${t.priority}" style="flex-shrink:0">${t.priority}</span>
                </div>
                <button class="btn-icon" style="flex-shrink:0;width:20px;height:20px;color:var(--text-muted)" data-action="unlink-task" data-goal-id="${g.id}" data-todo-id="${t.id}" title="Unlink">
                  <i data-lucide="x" style="width:12px;height:12px"></i>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${!done ? `
        <button class="btn btn-secondary" style="width:100%;font-size:0.8rem;margin-bottom:12px" data-action="link-task" data-id="${g.id}">
          <i data-lucide="paperclip" style="width:13px;height:13px"></i> Link Task
        </button>
        <div>
          <label style="font-size:0.75rem;color:var(--text-muted)">Set progress manually</label>
          <input type="range" min="0" max="100" value="${g.progress}" class="progress-slider" data-action="set-progress" data-id="${g.id}" style="width:100%;margin-top:4px;accent-color:var(--accent)">
        </div>
      ` : ''}
    </div>
  `;
}

export function mountGoals(rerender) {
  unmountGoals();

  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('add-goal-btn')?.addEventListener('click', () => openAddGoalModal(rerender));

  _clickHandler = function(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id, goalId, milestoneId, todoId } = btn.dataset;
    if (action === 'edit-goal') openEditGoalModal(id, rerender);
    else if (action === 'delete-goal') {
      if (confirm('Delete this goal?')) { store.deleteGoal(id); rerender(); }
    }
    else if (action === 'toggle-milestone') {
      store.toggleMilestone(goalId, milestoneId);
      rerender();
    }
    else if (action === 'link-task') openLinkTaskModal(id, rerender);
    else if (action === 'toggle-linked-task') {
      store.toggleTodo(todoId);
      rerender();
    }
    else if (action === 'unlink-task') {
      store.unlinkTaskFromGoal(goalId, todoId);
      rerender();
    }
  };

  _changeHandler = function(e) {
    const el = e.target.closest('[data-action="set-progress"]');
    if (!el) return;
    store.updateGoal(el.dataset.id, { progress: parseInt(el.value), milestones: store.data.goals.find(g=>g.id===el.dataset.id)?.milestones || [] });
    rerender();
  };

  document.addEventListener('click', _clickHandler);
  document.addEventListener('change', _changeHandler);
}

function openAddGoalModal(rerender) {
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">Add Goal</h2>
      <button class="btn-icon" onclick="closeModal()"><i data-lucide="x"></i></button>
    </div>
    <div class="form-group">
      <label class="form-label">Goal Title *</label>
      <input id="goal-title" class="input" type="text" placeholder="What do you want to achieve?" autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea id="goal-desc" class="textarea" placeholder="Why is this important?"></textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Category</label>
        <select id="goal-category" class="select">
          ${CATEGORIES.map(c => `<option value="${c}">${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Target Date</label>
        <input id="goal-date" class="input" type="date">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Milestones (one per line)</label>
      <textarea id="goal-milestones" class="textarea" placeholder="Research options&#10;Create a plan&#10;Take first step" style="min-height:80px"></textarea>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-goal-btn">Add Goal</button>
    </div>
  `);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('save-goal-btn').addEventListener('click', () => {
    const title = document.getElementById('goal-title').value.trim();
    if (!title) { showToast('Title is required', 'error'); return; }
    const milestones = document.getElementById('goal-milestones').value
      .split('\n').map(s=>s.trim()).filter(Boolean);
    const dateStr = document.getElementById('goal-date').value;
    store.addGoal({
      title,
      description: document.getElementById('goal-desc').value.trim(),
      category: document.getElementById('goal-category').value,
      targetDate: dateStr ? new Date(dateStr).getTime() : null,
      milestones
    });
    closeModal();
    rerender();
    showToast('Goal added!', 'success');
  });
}

function openEditGoalModal(id, rerender) {
  const goal = store.data.goals.find(g => g.id === id);
  if (!goal) return;
  const dateStr = goal.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : '';
  const milestonesText = goal.milestones.map(m => m.title).join('\n');

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">Edit Goal</h2>
      <button class="btn-icon" onclick="closeModal()"><i data-lucide="x"></i></button>
    </div>
    <div class="form-group">
      <label class="form-label">Goal Title *</label>
      <input id="goal-title" class="input" type="text" value="${escapeHtml(goal.title)}">
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea id="goal-desc" class="textarea">${escapeHtml(goal.description || '')}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Category</label>
        <select id="goal-category" class="select">
          ${CATEGORIES.map(c => `<option value="${c}" ${goal.category===c?'selected':''}>${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Target Date</label>
        <input id="goal-date" class="input" type="date" value="${dateStr}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Milestones (one per line)</label>
      <textarea id="goal-milestones" class="textarea" style="min-height:80px">${escapeHtml(milestonesText)}</textarea>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-goal-btn">Save Changes</button>
    </div>
  `);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('save-goal-btn').addEventListener('click', () => {
    const title = document.getElementById('goal-title').value.trim();
    if (!title) { showToast('Title is required', 'error'); return; }
    const newMilestoneTitles = document.getElementById('goal-milestones').value
      .split('\n').map(s=>s.trim()).filter(Boolean);
    // Preserve existing milestone completion status where title matches
    const existingMap = Object.fromEntries(goal.milestones.map(m=>[m.title, m]));
    const milestones = newMilestoneTitles.map(title => {
      const existing = existingMap[title];
      return existing || { id: generateId(), title, completed: false };
    });
    const dateStr = document.getElementById('goal-date').value;
    store.updateGoal(id, {
      title,
      description: document.getElementById('goal-desc').value.trim(),
      category: document.getElementById('goal-category').value,
      targetDate: dateStr ? new Date(dateStr).getTime() : null,
      milestones
    });
    closeModal();
    rerender();
    showToast('Goal updated!', 'success');
  });
}

function openLinkTaskModal(goalId, rerender) {
  const goal = store.data.goals.find(g => g.id === goalId);
  if (!goal) return;
  const linkedIds = new Set(goal.linkedTaskIds || []);
  const available = store.data.todos.filter(t => !linkedIds.has(t.id));

  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">Link a Task</h2>
      <button class="btn-icon" onclick="closeModal()"><i data-lucide="x"></i></button>
    </div>
    ${available.length === 0 ? `
      <p style="color:var(--text-muted);text-align:center;padding:24px 0">No tasks available to link.</p>
    ` : `
      <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px">Click a task to attach it to this goal.</p>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:320px;overflow-y:auto">
        ${available.map(t => `
          <button class="link-task-option" data-task-id="${t.id}"
            style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;cursor:pointer;text-align:left;width:100%;color:var(--text)">
            <span class="badge badge-${t.priority}" style="flex-shrink:0">${t.priority}</span>
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(t.title)}</span>
            ${t.completed ? `<span style="font-size:0.75rem;color:var(--green);flex-shrink:0">Done</span>` : ''}
          </button>
        `).join('')}
      </div>
    `}
    <div style="display:flex;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
    </div>
  `);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.querySelectorAll('.link-task-option').forEach(btn => {
    btn.addEventListener('click', () => {
      store.linkTaskToGoal(goalId, btn.dataset.taskId);
      closeModal();
      rerender();
      showToast('Task linked!', 'success');
    });
  });
}

window.closeModal = closeModal;
