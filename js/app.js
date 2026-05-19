import { store } from './store.js';
import { driveAuth } from './auth.js';
import { showToast, formatDuration } from './utils.js';

import { renderDashboard, mountDashboard } from './views/dashboard.js';
import { renderTodos, mountTodos, unmountTodos } from './views/todos.js';
import { renderGoals, mountGoals } from './views/goals.js';
import { renderNotes, mountNotes } from './views/notes.js';
import { renderStats, mountStats, unmountStats } from './views/stats.js';
import { renderStorage, mountStorage } from './views/storage.js';

const VIEWS = {
  dashboard: { label: 'Dashboard', render: renderDashboard, mount: mountDashboard },
  todos:     { label: 'To-Do List', render: renderTodos,     mount: mountTodos,     unmount: unmountTodos },
  goals:     { label: 'Goals',      render: renderGoals,     mount: mountGoals },
  notes:     { label: 'Notes',      render: renderNotes,     mount: mountNotes },
  stats:     { label: 'Stats Board', render: renderStats,    mount: mountStats,     unmount: unmountStats },
  storage:   { label: 'Storage',    render: renderStorage,   mount: mountStorage }
};

let currentView = 'dashboard';
let timerWidgetInterval = null;

class App {
  constructor() {
    window._app = this;
    window._store = store;
  }

  init() {
    store.load();
    this._applyStyle(store.data.settings.style || 'ai');
    this._applyMode(store.data.settings.mode  || 'dark');
    this._setupNav();
    this._setupModal();
    this._setupSyncBtn();
    this._setupStyleSelector();
    this._setupModeToggle();

    const hash = window.location.hash.slice(1);
    if (VIEWS[hash]) currentView = hash;

    driveAuth.init();

    store.on('timerChange', () => this._updateTimerWidget());
    store.on('syncComplete', (type) => {
      if (type === 'loaded') {
        showToast('Synced from Google Drive', 'success');
        this.render();
      }
    });

    this.render();
    this._updateTimerWidget();
  }

  navigate(view) {
    if (!VIEWS[view]) return;
    const prev = VIEWS[currentView];
    if (prev?.unmount) prev.unmount();
    currentView = view;
    window.location.hash = view;
    this.render();
  }

  render() {
    const view = VIEWS[currentView];
    if (!view) return;

    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === currentView);
    });

    const titleEl = document.querySelector('.page-title');
    if (titleEl) titleEl.textContent = view.label;

    const container = document.getElementById('view-container');
    if (!container) return;
    container.innerHTML = view.render();

    const rerender = () => {
      container.innerHTML = view.render();
      if (view.mount) view.mount(rerender);
      if (typeof lucide !== 'undefined') lucide.createIcons();
      this._updateTimerWidget();
    };

    if (view.mount) view.mount(rerender);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    this._updateTimerWidget();
  }

  _setupNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => this.navigate(item.dataset.view));
    });

    const hamburger = document.getElementById('hamburger-btn');
    const sidebar = document.getElementById('sidebar');
    if (hamburger && sidebar) {
      hamburger.addEventListener('click', () => sidebar.classList.toggle('open'));
      document.getElementById('view-container')?.addEventListener('click', () => {
        if (window.innerWidth <= 768) sidebar.classList.remove('open');
      });
    }

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1);
      if (VIEWS[hash] && hash !== currentView) this.navigate(hash);
    });
  }

  _setupModal() {
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') {
        document.getElementById('modal-overlay').classList.remove('open');
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.getElementById('modal-overlay')?.classList.remove('open');
      }
    });
  }

  _setupSyncBtn() {
    const btn = document.getElementById('sync-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const icon = btn.querySelector('span[data-lucide]');
      if (icon) icon.setAttribute('data-lucide', 'loader');
      if (typeof lucide !== 'undefined') lucide.createIcons();
      await store.syncFromDrive();
      if (icon) icon.setAttribute('data-lucide', 'refresh-cw');
      if (typeof lucide !== 'undefined') lucide.createIcons();
      this.render();
    });
  }

  _applyStyle(style) {
    const active = style || 'ai';
    document.documentElement.setAttribute('data-theme', active);
    document.querySelectorAll('.style-btn').forEach(btn => {
      const isActive = btn.dataset.style === active;
      const color = btn.dataset.color || '#fff';
      btn.classList.toggle('active', isActive);
      if (isActive) {
        btn.style.borderColor = color;
        btn.style.color = color;
        btn.style.background = color + '22';
      } else {
        btn.style.borderColor = '';
        btn.style.color = '';
        btn.style.background = '';
      }
    });
  }

  _setupStyleSelector() {
    document.querySelectorAll('.style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const style = btn.dataset.style;
        store.setSetting('style', style);
        this._applyStyle(style);
      });
    });
  }

  _setupModeToggle() {
    const btn = document.getElementById('mode-toggle-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = (store.data.settings.mode || 'dark') === 'dark' ? 'light' : 'dark';
      store.setSetting('mode', next);
      this._applyMode(next);
    });
  }

  _applyMode(mode) {
    const m = mode || 'dark';
    document.documentElement.setAttribute('data-mode', m);
    const icon = document.getElementById('mode-toggle-icon');
    const btn  = document.getElementById('mode-toggle-btn');
    if (icon) {
      icon.setAttribute('data-lucide', m === 'dark' ? 'sun' : 'moon');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    if (btn) btn.title = m === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }

  _updateTimerWidget() {
    const widget = document.getElementById('active-timer-widget');
    if (!widget) return;

    const { activeTimer, todos } = store.data;

    if (!activeTimer) {
      widget.style.display = 'none';
      if (timerWidgetInterval) { clearInterval(timerWidgetInterval); timerWidgetInterval = null; }
      return;
    }

    const todo = todos.find(t => t.id === activeTimer.todoId);
    widget.style.display = 'flex';
    widget.innerHTML = `
      <i data-lucide="timer" style="width:16px;height:16px;color:var(--cyan);flex-shrink:0"></i>
      <span class="timer-task-name">${todo ? todo.title.slice(0, 30) + (todo.title.length > 30 ? '…' : '') : 'Task'}</span>
      <span class="timer-display" id="widget-timer-display">${formatDuration(Date.now() - activeTimer.startTime)}</span>
      <button class="btn-icon timer-stop-btn" id="widget-stop-btn" title="Stop timer">
        <i data-lucide="square" style="width:14px;height:14px"></i>
      </button>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    document.getElementById('widget-stop-btn')?.addEventListener('click', () => {
      store.stopTimer(activeTimer.todoId);
      this.render();
    });

    if (timerWidgetInterval) clearInterval(timerWidgetInterval);
    timerWidgetInterval = setInterval(() => {
      const display = document.getElementById('widget-timer-display');
      if (display && store.data.activeTimer) {
        display.textContent = formatDuration(Date.now() - store.data.activeTimer.startTime);
      } else {
        clearInterval(timerWidgetInterval);
        timerWidgetInterval = null;
      }
    }, 1000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
