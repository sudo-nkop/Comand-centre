import { store } from '../store.js';
import { formatDuration, formatRelative, formatDate, escapeHtml } from '../utils.js';

export function renderDashboard() {
  const { todos, goals, notes } = store.data;
  const today = new Date(); today.setHours(0,0,0,0);
  const todayTs = today.getTime();

  const completedToday = todos.filter(t => t.completed && t.completedAt >= todayTs).length;
  const activeGoals = goals.filter(g => g.progress < 100).length;
  const totalTimeToday = todos.reduce((acc, t) => {
    const todaySessions = (t.timerSessions || []).filter(s => s.start >= todayTs);
    return acc + todaySessions.reduce((a, s) => a + (s.duration || 0), 0);
  }, 0);

  // Active timer addition
  const activeTimer = store.data.activeTimer;
  if (activeTimer) {
    const activeTodo = todos.find(t => t.id === activeTimer.todoId);
    if (activeTodo) {
      const elapsed = Date.now() - activeTimer.startTime;
      const activeTodayTime = totalTimeToday + elapsed;
    }
  }

  const pendingTodos = todos.filter(t => !t.completed).slice(0, 5);
  const recentNotes = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
  const topGoals = goals.filter(g => g.progress < 100).slice(0, 3);

  return `
    <div class="stats-grid" style="margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-label">Tasks Done Today</div>
        <div class="stat-value" style="color:var(--green)">${completedToday}</div>
        <div class="stat-trend">${todos.filter(t=>!t.completed).length} remaining</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Time Tracked Today</div>
        <div class="stat-value" style="color:var(--cyan)" id="dash-time-today">${formatDuration(totalTimeToday)}</div>
        <div class="stat-trend">across all tasks</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Goals</div>
        <div class="stat-value" style="color:var(--accent-light)">${activeGoals}</div>
        <div class="stat-trend">${goals.filter(g=>g.progress===100).length} completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Notes</div>
        <div class="stat-value" style="color:var(--yellow)">${notes.length}</div>
        <div class="stat-trend">${notes.filter(n=>n.pinned).length} pinned</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px" class="dash-grid">
      <!-- Upcoming Tasks -->
      <div class="card">
        <div class="section-header" style="margin-bottom:12px">
          <span class="section-title" style="font-size:0.95rem">Upcoming Tasks</span>
          <button class="btn btn-secondary btn-sm" onclick="window._app.navigate('todos')">View all</button>
        </div>
        ${pendingTodos.length === 0 ? `<div class="empty-state" style="padding:20px"><i data-lucide="check-circle" style="width:32px;height:32px;color:var(--border-bright)"></i><span style="font-size:0.85rem">No pending tasks</span></div>` : ''}
        <div class="todo-list">
          ${pendingTodos.map(t => `
            <div class="todo-item" style="padding:10px 12px">
              <div class="todo-checkbox ${t.completed ? 'checked' : ''}" onclick="window._store.toggleTodo('${t.id}');window._app.render()">
                ${t.completed ? `<i data-lucide="check" style="width:12px;height:12px"></i>` : ''}
              </div>
              <div class="todo-title" style="${t.completed ? 'text-decoration:line-through;color:var(--text-muted)' : ''}">${escapeHtml(t.title)}</div>
              <span class="badge badge-${t.priority}">${t.priority}</span>
              ${t.totalTime > 0 ? `<span class="todo-timer">${formatDuration(t.totalTime)}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Goal Progress -->
      <div class="card">
        <div class="section-header" style="margin-bottom:12px">
          <span class="section-title" style="font-size:0.95rem">Goal Progress</span>
          <button class="btn btn-secondary btn-sm" onclick="window._app.navigate('goals')">View all</button>
        </div>
        ${topGoals.length === 0 ? `<div class="empty-state" style="padding:20px"><i data-lucide="target" style="width:32px;height:32px;color:var(--border-bright)"></i><span style="font-size:0.85rem">No active goals</span></div>` : ''}
        <div style="display:flex;flex-direction:column;gap:16px">
          ${topGoals.map(g => `
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span style="font-size:0.875rem;font-weight:500">${escapeHtml(g.title)}</span>
                <span style="font-size:0.8rem;color:var(--accent-light);font-weight:600">${g.progress}%</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width:${g.progress}%"></div></div>
              ${g.targetDate ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Due ${formatDate(g.targetDate)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Recent Notes -->
      <div class="card" style="grid-column:1/-1">
        <div class="section-header" style="margin-bottom:12px">
          <span class="section-title" style="font-size:0.95rem">Recent Notes</span>
          <button class="btn btn-secondary btn-sm" onclick="window._app.navigate('notes')">View all</button>
        </div>
        ${recentNotes.length === 0 ? `<div class="empty-state" style="padding:20px"><i data-lucide="file-text" style="width:32px;height:32px;color:var(--border-bright)"></i><span style="font-size:0.85rem">No notes yet</span></div>` : ''}
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
          ${recentNotes.map(n => `
            <div class="note-card" onclick="window._app.navigate('notes')">
              <div style="font-weight:600;font-size:0.9rem;margin-bottom:6px">${escapeHtml(n.title)}</div>
              <div class="note-content-preview">${escapeHtml(n.content || 'No content')}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:8px">${formatRelative(n.updatedAt)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

export function mountDashboard() {
  if (typeof lucide !== 'undefined') lucide.createIcons();
  window._store = store;
}
