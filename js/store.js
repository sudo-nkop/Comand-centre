import { generateId, showToast, debounce } from './utils.js';

const STORAGE_KEY = 'command-centre-data';
const DRIVE_FILE_NAME = 'command-centre-data.json';

class Store {
  constructor() {
    this.listeners = {};
    this.data = this._defaultData();
    this.driveFileId = null;
    this.syncDebounced = debounce(() => this._syncToDrive(), 4000);
  }

  _defaultData() {
    return {
      todos: [],
      goals: [],
      notes: [],
      files: [],
      activeTimer: null, // { todoId, startTime }
      settings: { theme: 'dark', clientId: '' }
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        this.data = { ...this._defaultData(), ...saved };
      }
    } catch (e) {
      console.warn('Could not load local data', e);
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.emit('change', this.data);
      if (window._driveAuth?.isConnected()) {
        this.syncDebounced();
      }
    } catch (e) {
      console.warn('Could not save data', e);
    }
  }

  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
    return () => { this.listeners[event] = this.listeners[event].filter(l => l !== cb); };
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  }

  // ─── Todos ────────────────────────────────────────────────────────────────
  addTodo(fields) {
    const todo = {
      id: generateId(),
      title: fields.title || 'Untitled Task',
      description: fields.description || '',
      priority: fields.priority || 'medium',
      tags: fields.tags || [],
      dueDate: fields.dueDate || null,
      completed: false,
      createdAt: Date.now(),
      completedAt: null,
      timerSessions: [],
      totalTime: 0
    };
    this.data.todos.unshift(todo);
    this.save();
    return todo;
  }

  updateTodo(id, fields) {
    const idx = this.data.todos.findIndex(t => t.id === id);
    if (idx === -1) return;
    this.data.todos[idx] = { ...this.data.todos[idx], ...fields };
    this.save();
    return this.data.todos[idx];
  }

  toggleTodo(id) {
    const todo = this.data.todos.find(t => t.id === id);
    if (!todo) return;
    if (this.data.activeTimer?.todoId === id) this.stopTimer(id);
    todo.completed = !todo.completed;
    todo.completedAt = todo.completed ? Date.now() : null;
    this.save();
  }

  deleteTodo(id) {
    if (this.data.activeTimer?.todoId === id) this.stopTimer(id);
    this.data.todos = this.data.todos.filter(t => t.id !== id);
    this.save();
  }

  // ─── Timer ────────────────────────────────────────────────────────────────
  startTimer(todoId) {
    if (this.data.activeTimer) this.stopTimer(this.data.activeTimer.todoId);
    this.data.activeTimer = { todoId, startTime: Date.now() };
    this.save();
    this.emit('timerChange', this.data.activeTimer);
  }

  stopTimer(todoId) {
    const timer = this.data.activeTimer;
    if (!timer || timer.todoId !== todoId) return;
    const duration = Date.now() - timer.startTime;
    const todo = this.data.todos.find(t => t.id === todoId);
    if (todo) {
      todo.timerSessions.push({ start: timer.startTime, end: Date.now(), duration });
      todo.totalTime = (todo.totalTime || 0) + duration;
    }
    this.data.activeTimer = null;
    this.save();
    this.emit('timerChange', null);
  }

  getTimerElapsed() {
    if (!this.data.activeTimer) return 0;
    return Date.now() - this.data.activeTimer.startTime;
  }

  // ─── Goals ────────────────────────────────────────────────────────────────
  addGoal(fields) {
    const goal = {
      id: generateId(),
      title: fields.title || 'Untitled Goal',
      description: fields.description || '',
      category: fields.category || 'personal',
      targetDate: fields.targetDate || null,
      progress: 0,
      milestones: (fields.milestones || []).map(m => ({ id: generateId(), title: m, completed: false })),
      createdAt: Date.now()
    };
    this.data.goals.unshift(goal);
    this.save();
    return goal;
  }

  updateGoal(id, fields) {
    const idx = this.data.goals.findIndex(g => g.id === id);
    if (idx === -1) return;
    this.data.goals[idx] = { ...this.data.goals[idx], ...fields };
    this._recalcGoalProgress(id);
    this.save();
    return this.data.goals[idx];
  }

  toggleMilestone(goalId, milestoneId) {
    const goal = this.data.goals.find(g => g.id === goalId);
    if (!goal) return;
    const ms = goal.milestones.find(m => m.id === milestoneId);
    if (ms) ms.completed = !ms.completed;
    this._recalcGoalProgress(goalId);
    this.save();
  }

  _recalcGoalProgress(goalId) {
    const goal = this.data.goals.find(g => g.id === goalId);
    if (!goal || !goal.milestones.length) return;
    const done = goal.milestones.filter(m => m.completed).length;
    goal.progress = Math.round((done / goal.milestones.length) * 100);
  }

  deleteGoal(id) {
    this.data.goals = this.data.goals.filter(g => g.id !== id);
    this.save();
  }

  // ─── Notes ────────────────────────────────────────────────────────────────
  addNote(fields) {
    const note = {
      id: generateId(),
      title: fields.title || 'Untitled Note',
      content: fields.content || '',
      tags: fields.tags || [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.data.notes.unshift(note);
    this.save();
    return note;
  }

  updateNote(id, fields) {
    const idx = this.data.notes.findIndex(n => n.id === id);
    if (idx === -1) return;
    this.data.notes[idx] = { ...this.data.notes[idx], ...fields, updatedAt: Date.now() };
    this.save();
    return this.data.notes[idx];
  }

  deleteNote(id) {
    this.data.notes = this.data.notes.filter(n => n.id !== id);
    this.save();
  }

  togglePinNote(id) {
    const note = this.data.notes.find(n => n.id === id);
    if (note) { note.pinned = !note.pinned; this.save(); }
  }

  // ─── Files ────────────────────────────────────────────────────────────────
  addFile(fileRecord) {
    this.data.files.unshift({ id: generateId(), uploadedAt: Date.now(), ...fileRecord });
    this.save();
  }

  deleteFile(id) {
    this.data.files = this.data.files.filter(f => f.id !== id);
    this.save();
  }

  // ─── Settings ─────────────────────────────────────────────────────────────
  setSetting(key, value) {
    this.data.settings[key] = value;
    this.save();
  }

  // ─── Google Drive Sync ────────────────────────────────────────────────────
  async syncFromDrive() {
    try {
      const auth = window._driveAuth;
      if (!auth?.isConnected()) return;
      const token = auth.getToken();

      // Search for existing file
      const search = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='${DRIVE_FILE_NAME}' and trashed=false&spaces=drive&fields=files(id,name,modifiedTime)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const { files } = await search.json();

      if (files && files.length > 0) {
        this.driveFileId = files[0].id;
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${this.driveFileId}?alt=media`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const remote = await res.json();
        // Merge: remote wins for entities (last-write-wins per item by updatedAt/createdAt)
        this._mergeData(remote);
        this.save();
        this.emit('syncComplete', 'loaded');
      } else {
        await this._syncToDrive();
        this.emit('syncComplete', 'created');
      }
    } catch (e) {
      console.warn('Drive sync error:', e);
      showToast('Drive sync failed', 'error');
    }
  }

  _mergeData(remote) {
    // Simple merge: union by ID, remote newer item wins
    ['todos', 'goals', 'notes', 'files'].forEach(key => {
      if (!remote[key]) return;
      const localMap = Object.fromEntries(this.data[key].map(i => [i.id, i]));
      const remoteMap = Object.fromEntries(remote[key].map(i => [i.id, i]));
      const merged = {};
      for (const id of new Set([...Object.keys(localMap), ...Object.keys(remoteMap)])) {
        const l = localMap[id];
        const r = remoteMap[id];
        if (!l) merged[id] = r;
        else if (!r) merged[id] = l;
        else merged[id] = (r.updatedAt || r.createdAt || 0) > (l.updatedAt || l.createdAt || 0) ? r : l;
      }
      this.data[key] = Object.values(merged).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    });
    if (remote.settings) this.data.settings = { ...this.data.settings, ...remote.settings, clientId: this.data.settings.clientId };
  }

  async _syncToDrive() {
    try {
      const auth = window._driveAuth;
      if (!auth?.isConnected()) return;
      const token = auth.getToken();
      const body = JSON.stringify(this.data);
      const blob = new Blob([body], { type: 'application/json' });

      if (this.driveFileId) {
        // Update existing
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify({ name: DRIVE_FILE_NAME })], { type: 'application/json' }));
        form.append('file', blob);
        await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${this.driveFileId}?uploadType=multipart`,
          { method: 'PATCH', headers: { Authorization: `Bearer ${token}` }, body: form }
        );
      } else {
        // Create new
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify({ name: DRIVE_FILE_NAME, mimeType: 'application/json' })], { type: 'application/json' }));
        form.append('file', blob);
        const res = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
          { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
        );
        const json = await res.json();
        this.driveFileId = json.id;
      }
      this.emit('syncComplete', 'saved');
    } catch (e) {
      console.warn('Drive save error:', e);
    }
  }

  async uploadFileToDrive(file) {
    const auth = window._driveAuth;
    if (!auth?.isConnected()) throw new Error('Not connected to Drive');
    const token = auth.getToken();
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify({ name: file.name })], { type: 'application/json' }));
    form.append('file', file);
    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,mimeType,webViewLink',
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
    );
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  }

  async deleteFileFromDrive(driveFileId) {
    const auth = window._driveAuth;
    if (!auth?.isConnected()) return;
    const token = auth.getToken();
    await fetch(`https://www.googleapis.com/drive/v3/files/${driveFileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
  }
}

export const store = new Store();
