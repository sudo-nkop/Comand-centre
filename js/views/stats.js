import { store } from '../store.js';
import { formatDuration, formatRelative, getLastNDays, getDayLabel, startOfDay } from '../utils.js';

let charts = {};

export function renderStats() {
  const { todos, goals, satPrep } = store.data;

  const total = todos.length;
  const completed = todos.filter(t => t.completed).length;
  const totalTime = todos.reduce((a, t) => a + (t.totalTime || 0), 0);

  // Streak calculation
  const streak = calcStreak(todos);
  // Goals completion rate
  const goalRate = goals.length ? Math.round((goals.filter(g=>g.progress===100).length / goals.length) * 100) : 0;
  // Today's completions
  const todayTs = startOfDay();
  const todayDone = todos.filter(t => t.completed && t.completedAt >= todayTs).length;

  // SAT Prep stats
  const satStats = satPrep?.stats || {};
  const satHistory = satPrep?.history || [];
  const satAccuracy = satStats.answered ? Math.round((satStats.correct / satStats.answered) * 100) : null;
  const hasSatData = satHistory.length > 0;

  const satSection = hasSatData ? `
    <div class="section-header" style="margin-top:32px;margin-bottom:16px">
      <h2 class="section-title" style="font-size:1rem">SAT Prep</h2>
      ${satPrep.lastSynced ? `<span style="font-size:0.75rem;color:var(--text-muted)">Last synced ${formatRelative(satPrep.lastSynced)}</span>` : ''}
    </div>
    <div class="stats-grid" style="margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-label">Accuracy</div>
        <div class="stat-value" style="color:var(--green)">${satAccuracy}%</div>
        <div class="stat-trend">${satStats.correct} / ${satStats.answered} correct</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Sessions</div>
        <div class="stat-value" style="color:var(--cyan)">${satHistory.length}</div>
        <div class="stat-trend">practice sessions</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">SAT Streak</div>
        <div class="stat-value" style="color:var(--yellow)">${satStats.streak || 0}</div>
        <div class="stat-trend">days in a row</div>
      </div>
    </div>
    <div class="charts-grid" style="margin-bottom:32px">
      <div class="chart-card">
        <div class="chart-title">SAT Accuracy (Last 7 Sessions)</div>
        <canvas id="sat-accuracy-chart" height="200"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">Recent Session Scores</div>
        <canvas id="sat-scores-chart" height="200"></canvas>
      </div>
    </div>
  ` : `
    <div class="section-header" style="margin-top:32px;margin-bottom:16px">
      <h2 class="section-title" style="font-size:1rem">SAT Prep</h2>
    </div>
    <div class="empty-state" style="padding:32px;margin-bottom:32px">
      <i data-lucide="book-open" style="width:36px;height:36px;color:var(--border-bright)"></i>
      <span>No SAT data yet — connect Drive in the SAT Prep app to sync stats here.</span>
    </div>
  `;

  return `
    <div class="section-header"><h2 class="section-title">Stats Board</h2></div>

    <div class="stats-grid" style="margin-bottom:24px">
      <div class="stat-card">
        <div class="stat-label">Total Tasks</div>
        <div class="stat-value">${total}</div>
        <div class="stat-trend">${completed} completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Completion Rate</div>
        <div class="stat-value" style="color:var(--green)">${total ? Math.round(completed/total*100) : 0}%</div>
        <div class="stat-trend">${total - completed} remaining</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Time Tracked</div>
        <div class="stat-value" style="color:var(--cyan)">${formatDuration(totalTime)}</div>
        <div class="stat-trend">across all tasks</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Current Streak</div>
        <div class="stat-value" style="color:var(--yellow)">${streak}</div>
        <div class="stat-trend">days in a row</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Done Today</div>
        <div class="stat-value" style="color:var(--accent-light)">${todayDone}</div>
        <div class="stat-trend">tasks completed</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Goal Success Rate</div>
        <div class="stat-value" style="color:var(--green)">${goalRate}%</div>
        <div class="stat-trend">${goals.filter(g=>g.progress===100).length}/${goals.length} goals done</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card">
        <div class="chart-title">Tasks Completed (Last 7 Days)</div>
        <canvas id="completions-chart" height="200"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">Time Tracked (Last 7 Days)</div>
        <canvas id="time-chart" height="200"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">Tasks by Priority</div>
        <canvas id="priority-chart" height="200"></canvas>
      </div>
      <div class="chart-card">
        <div class="chart-title">Goal Progress Overview</div>
        <canvas id="goals-chart" height="200"></canvas>
      </div>
    </div>

    ${satSection}
  `;
}

export function mountStats() {
  const { todos, goals, satPrep } = store.data;

  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded');
    return;
  }

  // Destroy old charts
  Object.values(charts).forEach(c => c.destroy());
  charts = {};

  const chartDefaults = {
    color: '#94a3b8',
    font: { family: 'Inter' }
  };
  Chart.defaults.color = chartDefaults.color;
  Chart.defaults.font.family = chartDefaults.font.family;

  const gridColor = 'rgba(255,255,255,0.05)';
  const days = getLastNDays(7);
  const labels = days.map(getDayLabel);

  // ─── Completions chart ───────────────────────────────────────────────────
  const completionsData = days.map(dayStart => {
    const dayEnd = dayStart + 86400000;
    return todos.filter(t => t.completed && t.completedAt >= dayStart && t.completedAt < dayEnd).length;
  });

  charts.completions = new Chart(document.getElementById('completions-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Tasks Completed',
        data: completionsData,
        backgroundColor: 'rgba(124,58,237,0.6)',
        borderColor: '#7c3aed',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { font: { size: 11 } } },
        y: { grid: { color: gridColor }, ticks: { stepSize: 1 }, beginAtZero: true }
      }
    }
  });

  // ─── Time tracked chart ──────────────────────────────────────────────────
  const timeData = days.map(dayStart => {
    const dayEnd = dayStart + 86400000;
    let ms = 0;
    todos.forEach(t => {
      (t.timerSessions || []).forEach(s => {
        if (s.start >= dayStart && s.start < dayEnd) ms += s.duration || 0;
      });
    });
    return Math.round(ms / 60000); // minutes
  });

  charts.time = new Chart(document.getElementById('time-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Minutes',
        data: timeData,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6,182,212,0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#06b6d4',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { font: { size: 11 } } },
        y: { grid: { color: gridColor }, beginAtZero: true, ticks: { callback: v => `${v}m` } }
      }
    }
  });

  // ─── Priority donut chart ────────────────────────────────────────────────
  const priorityCounts = {
    high: todos.filter(t => t.priority === 'high').length,
    medium: todos.filter(t => t.priority === 'medium').length,
    low: todos.filter(t => t.priority === 'low').length
  };

  charts.priority = new Chart(document.getElementById('priority-chart'), {
    type: 'doughnut',
    data: {
      labels: ['High', 'Medium', 'Low'],
      datasets: [{
        data: [priorityCounts.high, priorityCounts.medium, priorityCounts.low],
        backgroundColor: ['rgba(239,68,68,0.8)', 'rgba(245,158,11,0.8)', 'rgba(16,185,129,0.8)'],
        borderColor: ['#ef4444', '#f59e0b', '#10b981'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 16, font: { size: 12 } } }
      }
    }
  });

  // ─── Goals chart ─────────────────────────────────────────────────────────
  const goalLabels = goals.slice(0, 8).map(g => g.title.length > 16 ? g.title.slice(0, 16) + '…' : g.title);
  const goalProgress = goals.slice(0, 8).map(g => g.progress);

  charts.goals = new Chart(document.getElementById('goals-chart'), {
    type: 'bar',
    data: {
      labels: goalLabels.length ? goalLabels : ['No goals yet'],
      datasets: [{
        label: 'Progress %',
        data: goalProgress.length ? goalProgress : [0],
        backgroundColor: goalProgress.map(p =>
          p === 100 ? 'rgba(16,185,129,0.7)' : 'rgba(167,139,250,0.7)'
        ),
        borderColor: goalProgress.map(p => p === 100 ? '#10b981' : '#a78bfa'),
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, max: 100, ticks: { callback: v => `${v}%` } },
        y: { grid: { color: gridColor }, ticks: { font: { size: 11 } } }
      }
    }
  });

  // ─── SAT Prep charts ──────────────────────────────────────────────────────
  const satHistory = satPrep?.history || [];
  if (satHistory.length && document.getElementById('sat-accuracy-chart')) {
    const recent7 = satHistory.slice(0, 7).reverse();
    const satLabels = recent7.map((s, i) => {
      const d = new Date(s.timestamp || s.when || 0);
      return `${d.getMonth()+1}/${d.getDate()}`;
    });
    const satAccData = recent7.map(s => s.total ? Math.round((s.score / s.total) * 100) : 0);
    const satScoreData = recent7.map(s => s.score || 0);
    const satTotalData = recent7.map(s => s.total || 0);

    charts.satAccuracy = new Chart(document.getElementById('sat-accuracy-chart'), {
      type: 'line',
      data: {
        labels: satLabels,
        datasets: [{
          label: 'Accuracy %',
          data: satAccData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16,185,129,0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#10b981',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { font: { size: 11 } } },
          y: { grid: { color: gridColor }, beginAtZero: true, max: 100, ticks: { callback: v => `${v}%` } }
        }
      }
    });

    charts.satScores = new Chart(document.getElementById('sat-scores-chart'), {
      type: 'bar',
      data: {
        labels: satLabels,
        datasets: [{
          label: 'Correct',
          data: satScoreData,
          backgroundColor: 'rgba(16,185,129,0.6)',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 4
        }, {
          label: 'Total',
          data: satTotalData,
          backgroundColor: 'rgba(148,163,184,0.2)',
          borderColor: 'rgba(148,163,184,0.5)',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { font: { size: 11 } } },
          y: { grid: { color: gridColor }, beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }
}

export function unmountStats() {
  Object.values(charts).forEach(c => c.destroy());
  charts = {};
}

function calcStreak(todos) {
  const today = startOfDay();
  let streak = 0;
  let day = today;
  while (true) {
    const dayEnd = day + 86400000;
    const completedOnDay = todos.some(t => t.completed && t.completedAt >= day && t.completedAt < dayEnd);
    if (!completedOnDay && day < today) break;
    if (!completedOnDay) { day -= 86400000; continue; }
    streak++;
    day -= 86400000;
    if (streak > 365) break;
  }
  return streak;
}
