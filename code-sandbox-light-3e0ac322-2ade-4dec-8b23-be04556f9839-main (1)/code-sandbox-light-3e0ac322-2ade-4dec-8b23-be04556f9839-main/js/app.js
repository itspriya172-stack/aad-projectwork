/* =====================================================================
   Shared UI helpers — js/app.js
   • API wrapper around the RESTful Table API (tables/{table})
   • Sidebar / navigation rendering
   • Toast notifications, modal helpers, small formatters
   ===================================================================== */

const API = {
  async list(table) {
    const res = await fetch(`tables/${table}?limit=1000`);
    if (!res.ok) throw new Error(`Failed to load ${table}`);
    const json = await res.json();
    return json.data || [];
  },
  async create(table, data) {
    const res = await fetch(`tables/${table}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return res.json();
  },
  async update(table, id, data) {
    const res = await fetch(`tables/${table}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return res.json();
  },
  async patch(table, id, data) {
    const res = await fetch(`tables/${table}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return res.json();
  },
  async remove(table, id) {
    await fetch(`tables/${table}/${id}`, { method: 'DELETE' });
  },
  /** Load everything the planner needs in parallel. */
  async loadAll() {
    const [subjects, topics, settingsRows, schedule] = await Promise.all([
      API.list('subjects'), API.list('topics'), API.list('settings'), API.list('schedule'),
    ]);
    let settings = settingsRows.find(s => s.id === 'default') || settingsRows[0];
    if (!settings) {
      settings = await API.create('settings', { id: 'default', daily_hours: 4, start_time: '09:00', slot_size: 1, algorithm: 'greedy', last_generated: '' });
    }
    return { subjects, topics, settings, schedule };
  },
};

/* ---------- helpers ---------- */
const uid = (p = 'id') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDay = (iso) => {
  const d = Algo.parseDate(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};
const fmtLong = (iso) => Algo.parseDate(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const statusBadge = (s) => `<span class="badge badge-${s}">${s === 'in-progress' ? 'In progress' : s[0].toUpperCase() + s.slice(1)}</span>`;
const stars = (n, icon = 'fa-star') => Array.from({ length: 5 }, (_, i) => `<i class="fa-solid ${icon}" style="font-size:.7rem;color:${i < n ? '#f59e0b' : '#e2e8f0'}"></i>`).join('');

/* ---------- toast ---------- */
function toast(msg, type = '') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; document.body.appendChild(wrap); }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i>${esc(msg)}`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* ---------- modal ---------- */
function openModal(id) { document.getElementById(id).classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-backdrop')) e.target.classList.remove('show');
});

/* ---------- layout ---------- */
function renderShell(active) {
  const links = [
    ['index.html', 'fa-gauge-high', 'Dashboard'],
    ['subjects.html', 'fa-book-open', 'Subjects & Topics'],
    ['timetable.html', 'fa-calendar-days', 'Timetable'],
    ['docs.html', 'fa-file-lines', 'DAA Documentation'],
  ];
  const nav = links.map(([href, icon, label]) =>
    `<a href="${href}" class="${active === href ? 'active' : ''}"><i class="fa-solid ${icon}"></i>${label}</a>`).join('');
  const sidebar = `
    <div class="brand">
      <div class="brand-icon"><i class="fa-solid fa-brain"></i></div>
      <div><div class="brand-title">Smart Study Planner</div><div class="brand-sub">DAA Project</div></div>
    </div>
    <nav class="nav" aria-label="Main navigation">${nav}</nav>
    <div class="sidebar-footer">Greedy · Priority Queue · Merge Sort · 0/1 Knapsack DP</div>`;
  document.getElementById('sidebar').innerHTML = sidebar;
  const topbar = document.getElementById('topbar');
  if (topbar) {
    topbar.innerHTML = `<strong><i class="fa-solid fa-brain"></i> Smart Study Planner</strong><button id="menu-toggle" aria-label="Open menu"><i class="fa-solid fa-bars"></i></button>`;
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    document.getElementById('menu-toggle').onclick = () => { sb.classList.toggle('open'); ov.classList.toggle('show'); };
    ov.onclick = () => { sb.classList.remove('open'); ov.classList.remove('show'); };
  }
}
