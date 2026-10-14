/* Dashboard page logic — js/dashboard.js */
renderShell('index.html');

(async function init() {
  const today = Algo.todayStr();
  document.getElementById('today-label').textContent = fmtLong(today);

  let data;
  try { data = await API.loadAll(); }
  catch (e) { toast('Could not load data', 'error'); console.error(e); return; }
  const { subjects, topics, schedule } = data;

  /* ----- work items (priority computed by Algo) ----- */
  const items = Algo.buildWorkItems(topics, subjects, today);

  /* ----- KPI cards ----- */
  const completed = topics.filter(t => t.status === 'completed').length;
  const remainingHours = items.reduce((s, i) => s + i.remaining, 0);
  document.getElementById('stat-subjects').textContent = subjects.length;
  document.getElementById('stat-completed').textContent = `${completed}/${topics.length}`;
  document.getElementById('stat-hours').textContent = `${+remainingHours.toFixed(1)}h`;

  const upcoming = Algo.mergeSort(subjects.filter(s => Algo.daysBetween(today, s.exam_date) >= 0),
    (a, b) => a.exam_date < b.exam_date ? -1 : a.exam_date > b.exam_date ? 1 : 0);
  if (upcoming.length) {
    const d = Algo.daysBetween(today, upcoming[0].exam_date);
    document.getElementById('stat-next-exam').textContent = d;
    document.getElementById('stat-next-exam-label').textContent = `Days to ${upcoming[0].code || upcoming[0].name}`;
  } else {
    document.getElementById('stat-next-exam').textContent = '—';
  }

  /* ----- overall progress (by hours) ----- */
  const totalHours = items.reduce((s, i) => s + i.duration, 0);
  const doneHours = totalHours - remainingHours;
  const pct = totalHours ? Math.round(doneHours / totalHours * 100) : 0;
  document.getElementById('progress-bar').style.width = pct + '%';
  document.getElementById('progress-text').textContent = `${+doneHours.toFixed(1)}h of ${+totalHours.toFixed(1)}h studied · ${pct}%`;
  const counts = { pending: 0, 'in-progress': 0, completed: 0 };
  topics.forEach(t => counts[t.status] = (counts[t.status] || 0) + 1);
  document.getElementById('status-legend').innerHTML = `
    <span class="chip"><span class="dot" style="background:#94a3b8"></span>${counts.pending} pending</span>
    <span class="chip"><span class="dot" style="background:#f59e0b"></span>${counts['in-progress']} in progress</span>
    <span class="chip"><span class="dot" style="background:#10b981"></span>${counts.completed} completed</span>`;

  /* ----- high priority topics: merge sort by priority (desc) ----- */
  const active = items.filter(i => i.remaining > 0 && i.daysLeft >= 0);
  const ranked = Algo.mergeSort(active, Algo.byPriorityDesc).slice(0, 6);
  const plist = document.getElementById('priority-list');
  plist.innerHTML = ranked.length ? ranked.map((i, idx) => `
    <div class="list-item">
      <div class="rank" style="background:${i.color}">${idx + 1}</div>
      <div class="grow">
        <div class="title">${esc(i.name)}</div>
        <div class="sub">${esc(i.subjectName)} · ${i.daysLeft} day${i.daysLeft === 1 ? '' : 's'} left · ${i.remaining}h remaining · I=${i.importance} D=${i.difficulty}</div>
      </div>
      <div class="score" title="Priority score">${i.priority}</div>
    </div>`).join('') : `<div class="empty"><i class="fa-solid fa-mug-hot"></i>Nothing pending — great job!</div>`;

  /* ----- upcoming exams ----- */
  const elist = document.getElementById('exam-list');
  elist.innerHTML = upcoming.length ? upcoming.map(s => {
    const d = Algo.daysBetween(today, s.exam_date);
    const sub = items.filter(i => i.subjectId === s.id);
    const tot = sub.reduce((a, b) => a + b.duration, 0), rem = sub.reduce((a, b) => a + b.remaining, 0);
    const p = tot ? Math.round((tot - rem) / tot * 100) : 0;
    const badge = d <= 3 ? 'badge-danger' : d <= 7 ? 'badge-in-progress' : 'badge-info';
    return `
      <div class="list-item">
        <span class="dot" style="background:${s.color};width:14px;height:14px"></span>
        <div class="grow">
          <div class="title">${esc(s.name)} <span class="muted small">${esc(s.code || '')}</span></div>
          <div class="sub">${fmtDay(s.exam_date)} · ${sub.length} topics · ${+rem.toFixed(1)}h left</div>
          <div class="progress sm" style="margin-top:.4rem"><span style="width:${p}%;background:${s.color}"></span></div>
        </div>
        <span class="badge ${badge}">${d === 0 ? 'Today' : d + 'd'}</span>
      </div>`;
  }).join('') : `<div class="empty"><i class="fa-solid fa-calendar"></i>No upcoming exams. <a href="subjects.html">Add a subject</a>.</div>`;

  /* ----- charts ----- */
  new Chart(document.getElementById('status-chart'), {
    type: 'doughnut',
    data: { labels: ['Pending', 'In progress', 'Completed'], datasets: [{ data: [counts.pending, counts['in-progress'], counts.completed], backgroundColor: ['#94a3b8', '#f59e0b', '#10b981'], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom' } } },
  });
  new Chart(document.getElementById('subject-chart'), {
    type: 'bar',
    data: {
      labels: subjects.map(s => s.code || s.name),
      datasets: [
        { label: 'Done (h)', data: subjects.map(s => +items.filter(i => i.subjectId === s.id).reduce((a, b) => a + (b.duration - b.remaining), 0).toFixed(1)), backgroundColor: '#10b981', borderRadius: 6 },
        { label: 'Remaining (h)', data: subjects.map(s => +items.filter(i => i.subjectId === s.id).reduce((a, b) => a + b.remaining, 0).toFixed(1)), backgroundColor: subjects.map(s => s.color), borderRadius: 6 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, title: { display: true, text: 'hours' } } }, plugins: { legend: { position: 'bottom' } } },
  });

  /* ----- today's plan from saved schedule ----- */
  const todaySlots = schedule.filter(s => s.date === today).sort((a, b) => a.start_time.localeCompare(b.start_time));
  const tl = document.getElementById('today-list');
  tl.innerHTML = todaySlots.length ? todaySlots.map(s => `
    <div class="list-item ${s.done ? 'done' : ''}" style="border-left:4px solid ${s.color}">
      <div class="small" style="min-width:95px;font-weight:600;color:var(--muted)">${s.start_time} – ${s.end_time}</div>
      <div class="grow"><div class="title" ${s.done ? 'style="text-decoration:line-through;opacity:.6"' : ''}>${esc(s.topic_name)}</div><div class="sub">${esc(s.subject_name)} · ${s.hours}h</div></div>
      ${s.done ? '<span class="badge badge-completed"><i class="fa-solid fa-check"></i> done</span>' : '<span class="badge badge-pending">planned</span>'}
    </div>`).join('')
    : `<div class="empty"><i class="fa-solid fa-calendar-plus"></i>No plan saved for today. <a href="timetable.html">Generate your timetable</a>.</div>`;
})();
