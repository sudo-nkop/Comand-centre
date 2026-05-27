import { store } from '../store.js';
import { formatDuration, formatDate, escapeHtml, openModal, closeModal, generateId, showToast } from '../utils.js';

let currentFilter = 'all';
let currentSort = 'created';
let timerInterval = null;

export function renderTodos() {
  const { todos, activeTimer } = store.data;

  let filtered = todos.filter(t => {
    if (currentFilter === 'active') return !t.completed;
    if (currentFilter === 'completed') return t.completed;
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    if (currentSort === 'priority') {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.priority] - rank[b.priority];
    }
    if (currentSort === 'due') {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate - b.dueDate;
    }
    return b.createdAt - a.createdAt;
  });

  return `
    <div class="section-header">
      <h2 class="section-title">To-Do List</h2>
      <button class="btn btn-primary" id="add-todo-btn">
        <i data-lucide="plus"></i> Add Task
      </button>
    </div>

    <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap;align-items:center">
      <div class="filters">
        <button class="filter-btn ${currentFilter==='all'?'active':''}" data-filter="all">All (${todos.length})</button>
        <button class="filter-btn ${currentFilter==='active'?'active':''}" data-filter="active">Active (${todos.filter(t=>!t.completed).length})</button>
        <button class="filter-btn ${currentFilter==='completed'?'active':''}" data-filter="completed">Completed (${todos.filter(t=>t.completed).length})</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
        <span style="font-size:0.8rem;color:var(--text-muted)">Sort:</span>
        <select class="select" id="sort-select" style="width:auto;padding:6px 10px">
          <option value="created" ${currentSort==='created'?'selected':''}>Newest</option>
          <option value="priority" ${currentSort==='priority'?'selected':''}>Priority</option>
          <option value="due" ${currentSort==='due'?'selected':''}>Due Date</option>
        </select>
      </div>
    </div>

    ${filtered.length === 0 ? `
      <div class="empty-state">
        <i data-lucide="check-square" style="width:48px;height:48px"></i>
        <span>No tasks here. Add one above!</span>
      </div>
    ` : `
      <div class="todo-list">
        ${filtered.map(t => renderTodoItem(t, activeTimer)).join('')}
      </div>
    `}
  `;
}

function renderTodoItem(t, activeTimer) {
  const isActive = activeTimer?.todoId === t.id;
  const elapsed = isActive ? Date.now() - activeTimer.startTime : 0;
  const totalDisplay = t.totalTime + elapsed;
  const isOverdue = t.dueDate && !t.completed && Date.now() > t.dueDate;

  return `
    <div class="todo-item ${t.completed ? 'completed' : ''}" data-id="${t.id}">
      <div class="todo-checkbox ${t.completed ? 'checked' : ''}" data-action="toggle" data-id="${t.id}">
        ${t.completed ? `<i data-lucide="check" style="width:12px;height:12px"></i>` : ''}
      </div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div class="todo-title" style="${t.completed?'text-decoration:line-through;color:var(--text-muted)':''}">${escapeHtml(t.title)}</div>
          <div class="priority-indicator ${t.priority}"></div>
          <span class="badge badge-${t.priority}">${t.priority}</span>
          ${t.tags.map(tag=>`<span class="badge badge-tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
        ${t.description ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:3px">${escapeHtml(t.description)}</div>` : ''}
        ${t.dueDate ? `<div style="font-size:0.75rem;color:${isOverdue?'var(--red)':'var(--text-muted)'};margin-top:3px">
          <i data-lucide="calendar" style="width:11px;height:11px;vertical-align:middle"></i> ${formatDate(t.dueDate)}${isOverdue?' · Overdue':''}
        </div>` : ''}
      </div>
      ${totalDisplay > 0 || isActive ? `
        <span class="todo-timer ${isActive?'running':''}" id="timer-display-${t.id}">${formatDuration(totalDisplay)}</span>
      ` : ''}
      <div class="todo-actions">
        <button class="btn-icon timer-btn ${isActive?'running':''}" title="${isActive?'Stop timer':'Start timer'}" data-action="timer" data-id="${t.id}">
          <i data-lucide="${isActive?'square':'play'}"></i>
        </button>
        <button class="btn-icon" title="Edit" data-action="edit" data-id="${t.id}">
          <i data-lucide="pencil"></i>
        </button>
        <button class="btn-icon" title="Delete" data-action="delete" data-id="${t.id}" style="color:var(--red)">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>
  `;
}

export function mountTodos(rerender) {
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('add-todo-btn')?.addEventListener('click', () => openAddTodoModal(rerender));

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      rerender();
    });
  });

  document.getElementById('sort-select')?.addEventListener('change', e => {
    currentSort = e.target.value;
    rerender();
  });

  document.querySelector('.todo-list')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === 'toggle') { store.toggleTodo(id); rerender(); }
    else if (action === 'delete') { if (confirm('Delete this task?')) { store.deleteTodo(id); rerender(); } }
    else if (action === 'edit') openEditTodoModal(id, rerender);
    else if (action === 'timer') {
      const { activeTimer } = store.data;
      if (activeTimer?.todoId === id) stopTimerUI(id, rerender);
      else startTimerUI(id, rerender);
    }
  });

  // Start live timer interval if timer active
  startTimerLoop(rerender);
}

function startTimerLoop(rerender) {
  if (timerInterval) clearInterval(timerInterval);
  const { activeTimer } = store.data;
  if (!activeTimer) return;

  timerInterval = setInterval(() => {
    const el = document.getElementById(`timer-display-${activeTimer.todoId}`);
    if (!el) { clearInterval(timerInterval); return; }
    const todo = store.data.todos.find(t => t.id === activeTimer.todoId);
    if (!todo) return;
    const elapsed = Date.now() - activeTimer.startTime;

    if (elapsed >= 3600000) {
      clearInterval(timerInterval);
      timerInterval = null;
      const todoId = activeTimer.todoId;
      store.stopTimer(todoId);
      rerender();
      showHourlyPrompt(todoId, rerender);
      return;
    }

    el.textContent = formatDuration(todo.totalTime + elapsed);

    // Update header widget
    const widgetDisplay = document.getElementById('widget-timer-display');
    if (widgetDisplay) widgetDisplay.textContent = formatDuration(elapsed);
  }, 1000);
}

function showHourlyPrompt(todoId, rerender) {
  const todo = store.data.todos.find(t => t.id === todoId);
  const taskName = todo ? escapeHtml(todo.title) : 'this task';
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">1 Hour Reached</h2>
    </div>
    <p style="margin-bottom:20px;color:var(--text-muted)">
      You've been working on <strong style="color:var(--text)">${taskName}</strong> for 1 hour. Keep going?
    </p>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-secondary" id="hourly-stop-btn">Stop Timer</button>
      <button class="btn btn-primary" id="hourly-continue-btn">Continue</button>
    </div>
  `);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('hourly-continue-btn')?.addEventListener('click', () => {
    closeModal();
    startTimerUI(todoId, rerender);
  });

  document.getElementById('hourly-stop-btn')?.addEventListener('click', () => {
    closeModal();
  });
}

function startTimerUI(todoId, rerender) {
  store.startTimer(todoId);
  rerender();
}

function stopTimerUI(todoId, rerender) {
  store.stopTimer(todoId);
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  rerender();
}

function openAddTodoModal(rerender) {
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">Add Task</h2>
      <button class="btn-icon" onclick="closeModal()"><i data-lucide="x"></i></button>
    </div>
    <div class="form-group">
      <label class="form-label">Title *</label>
      <input id="todo-title" class="input" type="text" placeholder="What needs to be done?" autofocus>
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea id="todo-desc" class="textarea" placeholder="Optional details..."></textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Priority</label>
        <select id="todo-priority" class="select">
          <option value="low">Low</option>
          <option value="medium" selected>Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input id="todo-due" class="input" type="date">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Tags (comma separated)</label>
      <input id="todo-tags" class="input" type="text" placeholder="work, design, urgent">
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-todo-btn">Add Task</button>
    </div>
  `);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('todo-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('save-todo-btn').click();
  });

  document.getElementById('save-todo-btn').addEventListener('click', () => {
    const title = document.getElementById('todo-title').value.trim();
    if (!title) { showToast('Title is required', 'error'); return; }
    const tags = document.getElementById('todo-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
    const dueStr = document.getElementById('todo-due').value;
    store.addTodo({
      title,
      description: document.getElementById('todo-desc').value.trim(),
      priority: document.getElementById('todo-priority').value,
      tags,
      dueDate: dueStr ? new Date(dueStr).getTime() : null
    });
    closeModal();
    rerender();
    showToast('Task added!', 'success');
  });
}

function openEditTodoModal(id, rerender) {
  const todo = store.data.todos.find(t => t.id === id);
  if (!todo) return;
  const dueDateStr = todo.dueDate ? new Date(todo.dueDate).toISOString().split('T')[0] : '';
  openModal(`
    <div class="modal-header">
      <h2 class="modal-title">Edit Task</h2>
      <button class="btn-icon" onclick="closeModal()"><i data-lucide="x"></i></button>
    </div>
    <div class="form-group">
      <label class="form-label">Title *</label>
      <input id="todo-title" class="input" type="text" value="${escapeHtml(todo.title)}">
    </div>
    <div class="form-group">
      <label class="form-label">Description</label>
      <textarea id="todo-desc" class="textarea">${escapeHtml(todo.description || '')}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Priority</label>
        <select id="todo-priority" class="select">
          <option value="low" ${todo.priority==='low'?'selected':''}>Low</option>
          <option value="medium" ${todo.priority==='medium'?'selected':''}>Medium</option>
          <option value="high" ${todo.priority==='high'?'selected':''}>High</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date</label>
        <input id="todo-due" class="input" type="date" value="${dueDateStr}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Tags (comma separated)</label>
      <input id="todo-tags" class="input" type="text" value="${todo.tags.join(', ')}">
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-todo-btn">Save Changes</button>
    </div>
  `);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('save-todo-btn').addEventListener('click', () => {
    const title = document.getElementById('todo-title').value.trim();
    if (!title) { showToast('Title is required', 'error'); return; }
    const tags = document.getElementById('todo-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
    const dueStr = document.getElementById('todo-due').value;
    store.updateTodo(id, {
      title,
      description: document.getElementById('todo-desc').value.trim(),
      priority: document.getElementById('todo-priority').value,
      tags,
      dueDate: dueStr ? new Date(dueStr).getTime() : null
    });
    closeModal();
    rerender();
    showToast('Task updated!', 'success');
  });
}

// Export cleanup for when view changes
export function unmountTodos() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

window.closeModal = closeModal;
