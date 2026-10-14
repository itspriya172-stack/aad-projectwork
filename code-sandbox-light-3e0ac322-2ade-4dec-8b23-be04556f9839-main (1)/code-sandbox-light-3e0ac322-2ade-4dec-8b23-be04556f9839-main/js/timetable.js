/* Timetable page logic — js/timetable.js
   Generates the plan with Algo.generateSchedule / Algo.planWithDP,
   saves it to the `schedule` table and lets the student tick slots off. */
renderShell('timetable.html');

const today = Algo.todayStr();
let state = { subjects: [], topics: [], settings: null, schedule: [], view: 'cards', preview: null };

const ALGO_HELP = {
  greedy: 'Greedy: every day a max-heap picks the highest priority eligible topic (priority ↑ as the exam approaches). All topics are attempted; those that do not fit are reported.',
  dp: 'Greedy + DP: a 0/1 Knapsack first chooses the set of topics that maximises total priority within the total available hours (committed set). The greedy scheduler then places committed topics first and fills leftover time with the rest.',
};

async function load() {
  const d = await API.loadAll();
  Object.assign(state, d);
  const s = state.settings;
  document.getElementById('set-hours').value = s.daily_hours;
  document.getElementById('set-start').value = s.start_time;
  document.getElementById('set-slot').value = String(s.slot_size);
  setAlgo(s.algorithm || 'greedy', false);
  document.getElementById('last-generated').textContent = s.last_generated ? `Last generated ${new Date(s.last_generated).toLocaleString()}` : 'Not generated yet';
  renderSaved();
}

function readSettings() {
  return {
    ...state.settings,
    daily_hours: +document.getElementById('set-hours').value || 4,
    start_time: document.getElementById('set-start').value || '09:00',
    slot_size: +document.getElementById('set-slot').value || 1,
    algorithm: document.querySelector('#algo-switch .active').dataset.v,
  };
}
function setAlgo(v, rerender = true) {
  document.querySelectorAll('#algo-switch button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  document.getElementById('algo-help').textContent = ALGO_HELP[v];
}
document.getElementById('algo-switch').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setAlgo(b.dataset.v); });
document.getElementById('view-switch').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('#view-switch button').forEach(x => x.classList.remove('active')); b.classList.add('active');
  state.view = b.dataset.v; renderSaved();
});

/* ----------------------------------------------------------- generate */
async function generate({ reschedule = false } = {}) {
  const settings = readSettings();
  if (!state.topics.length) { toast('Add some topics first', 'error'); return; }

  // Rescheduling: unfinished past slots → simply regenerate from today, the
  // scheduler works from remaining hours, so they are automatically carried
  // forward. Mark them so the UI highlights moved slots.
  const missed = Algo.findMissedSlots(state.schedule, today);
  const missedTopicIds = new Set(missed.map(m => m.topic_id));
  if (reschedule && !missed.length) { toast('No unfinished past slots to reschedule', ''); }

  const result = settings.algorithm === 'dp'
    ? Algo.planWithDP({ topics: state.topics, subjects: state.subjects, settings, today })
    : Algo.generateSchedule({ topics: state.topics, subjects: state.subjects, settings, today });

  result.slots.forEach(s => { s.rescheduled = missedTopicIds.has(s.topic_id); });

  // persist: delete old schedule, insert new slots, save settings
  const btn = document.getElementById('btn-generate'); btn.disabled = true;
  try {
    await Promise.all(state.schedule.map(s => API.remove('schedule', s.id)));
    for (const s of result.slots) await API.create('schedule', s);
    settings.last_generated = new Date().toISOString();
    await API.update('settings', settings.id, settings);
    toast(`Timetable saved — ${result.slots.length} slots over ${result.stats.horizonDays} days`, 'success');
  } finally { btn.disabled = false; }

  state.lastResult = result;
  await load();
  renderResultExtras(result, settings);
}
document.getElementById('btn-generate').onclick = () => generate();
document.getElementById('btn-reschedule').onclick = () => generate({ reschedule: true });

/* --------------------------------------------------- result side panels */
function renderResultExtras(result, settings) {
  const w = document.getElementById('warnings');
  w.innerHTML = result.warnings.length ? result.warnings.map(x => `
    <div class="alert ${x.type === 'cycle' ? 'alert-danger' : 'alert-warning'}"><i class="fa-solid fa-triangle-exclamation"></i><div>${esc(x.message)}</div></div>`).join('')
    : `<div class="alert alert-success"><i class="fa-solid fa-circle-check"></i><div>All topics fit within the available hours before their exams. 🎉</div></div>`;

  const st = result.stats;
  document.getElementById('kpis').innerHTML = `
    <div class="card kpi"><b>${st.horizonDays}</b><span>days in plan</span></div>
    <div class="card kpi"><b>${st.totalPlannedHours}h</b><span>scheduled of ${st.totalAvailableHours}h available (${st.utilisation}%)</span></div>
    <div class="card kpi"><b>${st.slots}</b><span>study slots · ${st.heapOperations} heap ops</span></div>
    <div class="card kpi"><b>${result.unscheduled.length}</b><span>topics short on time</span></div>`;

  const panel = document.getElementById('dp-panel');
  if (result.dp) {
    panel.style.display = '';
    const { dp, greedy, budget, needed, deferred } = result;
    const better = dp.value > greedy.value ? 'DP found a strictly better set than greedy-by-density.' : dp.value === greedy.value ? 'Both found the same optimal value here.' : '';
    document.getElementById('dp-content').innerHTML = `
      <div class="grid grid-3 mb">
        <div class="kpi"><b>${needed}h</b><span>hours needed for all pending topics</span></div>
        <div class="kpi"><b>${budget}h</b><span>total budget (${settings.daily_hours}h × ${st.horizonDays} days)</span></div>
        <div class="kpi"><b>${result.allFit ? 'Yes' : 'No'}</b><span>everything fits?</span></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Method</th><th>Total priority value</th><th>Hours used</th><th>Topics selected</th><th>Work</th><th>Complexity</th></tr></thead>
        <tbody>
          <tr><td><b>0/1 Knapsack DP</b> (optimal)</td><td class="score">${dp.value}</td><td>${dp.usedHours}h</td><td>${dp.selectedCount}</td><td>${dp.cellsComputed} cells (${dp.tableSize})</td><td>Θ(n·W)</td></tr>
          <tr><td><b>Greedy by density</b> (priority/hour)</td><td class="score">${greedy.value}</td><td>${greedy.usedHours}h</td><td>${greedy.selectedCount}</td><td>${greedy.comparisons} comparisons</td><td>O(n log n)</td></tr>
        </tbody></table></div>
      <p class="small muted" style="margin-top:.6rem">${better} ${deferred.length ? `Deferred (best-effort only): ${deferred.map(d => `<span class="badge badge-pending">${esc(d.name)} · ${d.remaining}h</span>`).join(' ')}` : 'No topics had to be deferred.'}</p>`;
  } else panel.style.display = 'none';
}

/* -------------------------------------------------------- render saved */
function renderSaved() {
  const el = document.getElementById('timetable');
  const slots = state.schedule;
  if (!slots.length) {
    el.innerHTML = `<div class="empty"><i class="fa-solid fa-calendar-plus"></i>No timetable saved yet. Set your hours above and click <b>Generate &amp; save</b>.</div>`;
    document.getElementById('tt-legend').innerHTML = '';
    if (!state.lastResult) { document.getElementById('kpis').innerHTML = ''; document.getElementById('warnings').innerHTML = ''; }
    return;
  }
  // legend
  const subs = [...new Map(slots.map(s => [s.subject_name, s.color])).entries()];
  document.getElementById('tt-legend').innerHTML = subs.map(([n, c]) => `<span class="chip"><span class="dot" style="background:${c}"></span>${esc(n)}</span>`).join('');

  // group by date
  const byDate = new Map();
  slots.forEach(s => { if (!byDate.has(s.date)) byDate.set(s.date, []); byDate.get(s.date).push(s); });
  const dates = [...byDate.keys()].sort();
  const examsByDate = new Map();
  state.subjects.forEach(s => { if (!examsByDate.has(s.exam_date)) examsByDate.set(s.exam_date, []); examsByDate.get(s.exam_date).push(s); });
  // include exam-only dates inside range
  const first = dates[0], last = dates[dates.length - 1];
  const allDates = new Set(dates);
  examsByDate.forEach((_, d) => { if (d >= first && d <= Algo.addDays(last, 1)) allDates.add(d); });
  const ordered = [...allDates].sort();
  const daily = +state.settings.daily_hours;

  if (state.view === 'table') {
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Time</th><th>Topic</th><th>Subject</th><th>Hours</th><th>Priority</th><th>Done</th></tr></thead>
      <tbody>${ordered.flatMap(d => {
        const rows = (byDate.get(d) || []).sort((a, b) => a.start_time.localeCompare(b.start_time)).map(s => `
          <tr class="${s.done ? 'done' : ''}">
            <td>${fmtDay(d)}${d === today ? ' <span class="badge badge-primary">today</span>' : ''}</td>
            <td class="small">${s.start_time}–${s.end_time}</td>
            <td><span class="dot" style="background:${s.color}"></span> ${esc(s.topic_name)}${s.rescheduled ? ' <span class="badge badge-in-progress">rescheduled</span>' : ''}</td>
            <td class="small muted">${esc(s.subject_name)}</td><td>${s.hours}h</td><td>${s.priority}</td>
            <td><input type="checkbox" class="check" ${s.done ? 'checked' : ''} onchange="toggleDone('${s.id}', this.checked)"></td>
          </tr>`);
        const exams = (examsByDate.get(d) || []).map(e => `<tr><td>${fmtDay(d)}</td><td colspan="6"><span class="exam-marker"><i class="fa-solid fa-graduation-cap"></i> EXAM: ${esc(e.name)}</span></td></tr>`);
        return [...exams, ...rows];
      }).join('')}</tbody></table></div>`;
    return;
  }

  el.innerHTML = `<div class="timetable">${ordered.map(d => {
    const ds = (byDate.get(d) || []).sort((a, b) => a.start_time.localeCompare(b.start_time));
    const used = ds.reduce((a, b) => a + b.hours, 0);
    const exams = examsByDate.get(d) || [];
    return `
      <article class="day-card ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}">
        <div class="day-head"><div><div class="d">${fmtDay(d)}</div><div class="w">${d === today ? 'Today' : Algo.daysBetween(today, d) > 0 ? `in ${Algo.daysBetween(today, d)} days` : 'past'}</div></div><span class="small muted">${+used.toFixed(1)}/${daily}h</span></div>
        <div class="day-body">
          ${exams.map(e => `<div class="exam-marker"><i class="fa-solid fa-graduation-cap"></i> EXAM: ${esc(e.name)}</div>`).join('')}
          ${ds.map(s => `
            <div class="slot ${s.done ? 'done' : ''} ${s.rescheduled ? 'rescheduled' : ''}" style="border-left-color:${s.color}">
              <div><div class="time">${s.start_time} – ${s.end_time} · ${s.hours}h</div><div class="name">${esc(s.topic_name)}</div><div class="subj">${esc(s.subject_name)} · P ${s.priority}</div></div>
              <input type="checkbox" class="check" title="Mark done" ${s.done ? 'checked' : ''} onchange="toggleDone('${s.id}', this.checked)">
            </div>`).join('')}
          ${!ds.length && !exams.length ? '<div class="free-time">free day</div>' : used < daily && ds.length ? `<div class="free-time">${+(daily - used).toFixed(1)}h free</div>` : ''}
        </div>
      </article>`;
  }).join('')}</div>`;
}

/* ------------------------------------------------- mark slot as done */
async function toggleDone(slotId, done) {
  const slot = state.schedule.find(s => s.id === slotId);
  if (!slot) return;
  await API.patch('schedule', slotId, { done });
  // update the topic's hours_done and status
  const topic = state.topics.find(t => t.id === slot.topic_id);
  if (topic) {
    const doneHours = state.schedule.filter(s => s.topic_id === topic.id && (s.id === slotId ? done : s.done)).reduce((a, b) => a + b.hours, 0);
    const base = Number(topic.hours_done) || 0;
    // hours_done = max(previously recorded, hours ticked off in this plan)
    const prevPlanDone = state.schedule.filter(s => s.topic_id === topic.id && s.done).reduce((a, b) => a + b.hours, 0);
    const recordedBeforePlan = Math.max(0, base - prevPlanDone);
    const newDone = Math.min(topic.duration, +(recordedBeforePlan + doneHours).toFixed(2));
    const status = newDone >= topic.duration ? 'completed' : newDone > 0 ? 'in-progress' : 'pending';
    await API.patch('topics', topic.id, { hours_done: newDone, status });
    if (status === 'completed') toast(`🎉 "${topic.name}" completed!`, 'success');
  }
  await load();
}

load();
