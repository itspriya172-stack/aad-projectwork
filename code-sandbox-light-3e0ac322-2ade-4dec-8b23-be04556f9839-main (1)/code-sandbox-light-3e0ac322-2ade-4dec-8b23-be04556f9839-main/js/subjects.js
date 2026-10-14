/* Subjects & Topics CRUD page — js/subjects.js */
renderShell('subjects.html');

let state = { subjects: [], topics: [], filter: 'all', sort: 'priority' };
const today = Algo.todayStr();

async function load() {
  const d = await API.loadAll();
  state.subjects = d.subjects;
  state.topics = d.topics;
  render();
}

/* ------------------------------------------------------------------ render */
function render() {
  const grid = document.getElementById('subject-grid');
  if (!state.subjects.length) {
    grid.innerHTML = `<div class="card empty" style="grid-column:1/-1"><i class="fa-solid fa-book-open"></i>No subjects yet. Click <b>Add subject</b> or <b>Load sample data</b>.</div>`;
    return;
  }
  const items = Algo.buildWorkItems(state.topics, state.subjects, today);
  const byId = Object.fromEntries(items.map(i => [i.id, i]));
  const sorted = Algo.mergeSort(state.subjects, (a, b) => a.exam_date < b.exam_date ? -1 : a.exam_date > b.exam_date ? 1 : 0);

  grid.innerHTML = sorted.map(s => {
    let its = items.filter(i => i.subjectId === s.id);
    const all = its.length;
    if (state.filter !== 'all') its = its.filter(i => i.status === state.filter);
    const cmp = state.sort === 'priority' ? Algo.byPriorityDesc : state.sort === 'deadline' ? Algo.byDeadline : (a, b) => a.name.localeCompare(b.name);
    its = Algo.mergeSort(its, cmp);
    const days = Algo.daysBetween(today, s.exam_date);
    const tot = its.reduce((a, b) => a + b.duration, 0), rem = its.reduce((a, b) => a + b.remaining, 0);
    const pct = tot ? Math.round((tot - rem) / tot * 100) : 0;

    return `
    <article class="card subject-card" style="border-top-color:${s.color}">
      <div class="card-header" style="margin-bottom:.2rem">
        <h2 style="font-size:1.08rem">${esc(s.name)}</h2>
        <div class="topic-actions">
          <button class="btn btn-sm btn-secondary" onclick="openTopicModal(null,'${s.id}')"><i class="fa-solid fa-plus"></i> Topic</button>
          <button class="btn btn-sm btn-secondary btn-icon" title="Edit subject" onclick="openSubjectModal('${s.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-danger btn-icon" title="Delete subject" onclick="deleteSubject('${s.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="meta">
        <span><i class="fa-solid fa-hashtag"></i> ${esc(s.code || '—')}</span>
        <span><i class="fa-solid fa-calendar"></i> ${fmtDay(s.exam_date)}</span>
        <span class="badge ${days < 0 ? 'badge-pending' : days <= 3 ? 'badge-danger' : days <= 7 ? 'badge-in-progress' : 'badge-info'}">${days < 0 ? 'Exam over' : days === 0 ? 'Exam today' : days + ' days left'}</span>
        <span><i class="fa-solid fa-layer-group"></i> ${all} topics</span>
      </div>
      <div class="progress sm"><span style="width:${pct}%;background:${s.color}"></span></div>
      <div class="small muted" style="margin:.3rem 0 .6rem">${+(tot - rem).toFixed(1)}h / ${+tot.toFixed(1)}h studied (${pct}%)</div>
      ${its.length ? its.map(t => topicRow(t, byId)).join('') : `<div class="muted small" style="padding:.6rem 0;border-top:1px solid var(--border)">No topics${state.filter !== 'all' ? ' with this status' : ''}.</div>`}
    </article>`;
  }).join('');
}

function topicRow(t, byId) {
  const pre = t.prerequisiteId && byId[t.prerequisiteId];
  const pct = t.duration ? Math.round((t.duration - t.remaining) / t.duration * 100) : 0;
  return `
  <div class="topic-row">
    <div style="min-width:0">
      <div class="topic-name">${esc(t.name)} ${statusBadge(t.status)}</div>
      <div class="topic-meta">
        <span title="Difficulty"><i class="fa-solid fa-dumbbell"></i>${stars(t.difficulty, 'fa-circle')}</span>
        <span title="Importance"><i class="fa-solid fa-star"></i>${stars(t.importance)}</span>
        <span title="Hours"><i class="fa-regular fa-clock"></i>${t.duration - t.remaining}/${t.duration}h</span>
        <span title="Priority score" class="badge badge-primary">P = ${t.priority}</span>
        ${pre ? `<span title="Prerequisite"><i class="fa-solid fa-link"></i>after: ${esc(pre.name)}</span>` : ''}
      </div>
      <div class="progress sm" style="margin-top:.35rem;max-width:220px"><span style="width:${pct}%"></span></div>
    </div>
    <div class="topic-actions">
      ${t.status !== 'completed' ? `<button class="btn btn-sm btn-success btn-icon" title="Mark completed" onclick="markComplete('${t.id}')"><i class="fa-solid fa-check"></i></button>` : ''}
      <button class="btn btn-sm btn-secondary btn-icon" title="Edit topic" onclick="openTopicModal('${t.id}')"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-sm btn-danger btn-icon" title="Delete topic" onclick="deleteTopic('${t.id}')"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ subjects CRUD */
function openSubjectModal(id) {
  const s = id ? state.subjects.find(x => x.id === id) : null;
  document.getElementById('subject-modal-title').textContent = s ? 'Edit subject' : 'Add subject';
  document.getElementById('subject-id').value = s ? s.id : '';
  document.getElementById('subject-name').value = s ? s.name : '';
  document.getElementById('subject-code').value = s ? s.code || '' : '';
  document.getElementById('subject-exam').value = s ? s.exam_date : Algo.addDays(today, 14);
  document.getElementById('subject-color').value = s ? s.color : ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6'][state.subjects.length % 6];
  openModal('subject-modal');
}
document.getElementById('subject-form').onsubmit = async (e) => {
  e.preventDefault();
  const id = document.getElementById('subject-id').value || uid('sub');
  const data = {
    id, name: document.getElementById('subject-name').value.trim(),
    code: document.getElementById('subject-code').value.trim(),
    exam_date: document.getElementById('subject-exam').value,
    color: document.getElementById('subject-color').value,
  };
  if (document.getElementById('subject-id').value) await API.update('subjects', id, data);
  else await API.create('subjects', data);
  closeModal('subject-modal'); toast('Subject saved', 'success'); await load();
};
async function deleteSubject(id) {
  const n = state.topics.filter(t => t.subject_id === id).length;
  if (!confirm(`Delete this subject${n ? ` and its ${n} topic(s)` : ''}?`)) return;
  await Promise.all(state.topics.filter(t => t.subject_id === id).map(t => API.remove('topics', t.id)));
  await API.remove('subjects', id);
  toast('Subject deleted'); await load();
}

/* -------------------------------------------------------------- topics CRUD */
function openTopicModal(id, subjectId) {
  const t = id ? state.topics.find(x => x.id === id) : null;
  document.getElementById('topic-modal-title').textContent = t ? 'Edit topic' : 'Add topic';
  document.getElementById('topic-id').value = t ? t.id : '';
  document.getElementById('topic-name').value = t ? t.name : '';
  const subSel = document.getElementById('topic-subject');
  subSel.innerHTML = state.subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  subSel.value = t ? t.subject_id : (subjectId || state.subjects[0]?.id);
  document.getElementById('topic-difficulty').value = t ? t.difficulty : 3;
  document.getElementById('topic-importance').value = t ? t.importance : 3;
  document.getElementById('topic-duration').value = t ? t.duration : 2;
  document.getElementById('topic-done').value = t ? t.hours_done || 0 : 0;
  document.getElementById('topic-status').value = t ? t.status : 'pending';
  refreshPrereqOptions(t ? t.prerequisite_id : '');
  updateTopicPreview();
  openModal('topic-modal');
}
function refreshPrereqOptions(selected) {
  const subId = document.getElementById('topic-subject').value;
  const selfId = document.getElementById('topic-id').value;
  // only topics of the same subject may be prerequisites; exclude self
  const opts = state.topics.filter(t => t.subject_id === subId && t.id !== selfId);
  const sel = document.getElementById('topic-prereq');
  sel.innerHTML = `<option value="">— none —</option>` + opts.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('');
  sel.value = selected && opts.some(o => o.id === selected) ? selected : '';
}
function updateTopicPreview() {
  const d = +document.getElementById('topic-difficulty').value;
  const i = +document.getElementById('topic-importance').value;
  document.getElementById('difficulty-val').textContent = d;
  document.getElementById('importance-val').textContent = i;
  const sub = state.subjects.find(s => s.id === document.getElementById('topic-subject').value);
  const days = sub ? Algo.daysBetween(today, sub.exam_date) : 0;
  const p = Algo.computePriority(i, d, days);
  document.querySelector('#priority-preview span').innerHTML =
    `Priority preview: (2×${i} + ${d}) × (1 + 10/(${days}+1)) = <b>${p}</b> &nbsp;·&nbsp; ${days} day(s) until exam`;
}
['topic-difficulty', 'topic-importance'].forEach(id => document.getElementById(id).addEventListener('input', updateTopicPreview));
document.getElementById('topic-subject').addEventListener('change', () => { refreshPrereqOptions(''); updateTopicPreview(); });

document.getElementById('topic-form').onsubmit = async (e) => {
  e.preventDefault();
  const existing = document.getElementById('topic-id').value;
  const id = existing || uid('t');
  const duration = +document.getElementById('topic-duration').value;
  let hours_done = Math.min(+document.getElementById('topic-done').value || 0, duration);
  let status = document.getElementById('topic-status').value;
  if (status === 'completed') hours_done = duration;
  else if (hours_done >= duration) status = 'completed';
  else if (hours_done > 0) status = 'in-progress';
  const prerequisite_id = document.getElementById('topic-prereq').value;
  const data = {
    id, subject_id: document.getElementById('topic-subject').value,
    name: document.getElementById('topic-name').value.trim(),
    difficulty: +document.getElementById('topic-difficulty').value,
    importance: +document.getElementById('topic-importance').value,
    duration, hours_done, status, prerequisite_id,
  };
  // cycle check with the new edge
  const cycle = Algo.detectPrerequisiteCycle([...state.topics.filter(t => t.id !== id), data]);
  if (cycle) { toast('That prerequisite would create a cycle!', 'error'); return; }
  if (existing) await API.update('topics', id, data); else await API.create('topics', data);
  closeModal('topic-modal'); toast('Topic saved', 'success'); await load();
};
async function deleteTopic(id) {
  if (!confirm('Delete this topic?')) return;
  // clear dangling prerequisite references
  await Promise.all(state.topics.filter(t => t.prerequisite_id === id).map(t => API.patch('topics', t.id, { prerequisite_id: '' })));
  await API.remove('topics', id);
  toast('Topic deleted'); await load();
}
async function markComplete(id) {
  const t = state.topics.find(x => x.id === id);
  await API.patch('topics', id, { status: 'completed', hours_done: t.duration });
  toast(`"${t.name}" marked completed`, 'success'); await load();
}

/* ------------------------------------------------------------ filter / sort */
document.getElementById('status-filter').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#status-filter button').forEach(x => x.classList.remove('active'));
  b.classList.add('active'); state.filter = b.dataset.v; render();
});
document.getElementById('sort-select').addEventListener('change', (e) => { state.sort = e.target.value; render(); });

/* ------------------------------------------------------------- sample data */
document.getElementById('btn-reset-sample').onclick = async () => {
  if (!confirm('Replace ALL current subjects, topics and the saved timetable with the sample dataset?')) return;
  const cur = await API.loadAll();
  await Promise.all([
    ...cur.topics.map(t => API.remove('topics', t.id)),
    ...cur.subjects.map(s => API.remove('subjects', s.id)),
    ...cur.schedule.map(s => API.remove('schedule', s.id)),
  ]);
  const sample = buildSampleData(today);
  for (const s of sample.subjects) await API.create('subjects', s);
  for (const t of sample.topics) await API.create('topics', t);
  toast('Sample data loaded', 'success'); await load();
};
document.getElementById('btn-add-subject').onclick = () => openSubjectModal(null);

load();
