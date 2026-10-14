/* Documentation page logic — js/docs.js
   • runs the automated test-suite and shows results in the table
   • generates the sample timetable live from the sample dataset */
renderShell('docs.html');

function runTests() {
  const results = StudyPlannerTests.run();
  const rows = document.querySelectorAll('#test-table tbody tr');
  results.forEach((r, i) => {
    const cell = rows[i]?.querySelector('.r');
    if (cell) cell.innerHTML = r.pass
      ? `<span class="test-pass"><i class="fa-solid fa-circle-check"></i> PASS</span> <span class="muted small">${r.ms} ms</span>`
      : `<span class="test-fail"><i class="fa-solid fa-circle-xmark"></i> FAIL</span><div class="small muted">${esc(r.error)}</div>`;
  });
  const passed = results.filter(r => r.pass).length;
  document.getElementById('test-summary').textContent = `${passed}/${results.length} passed`;
  toast(`${passed}/${results.length} tests passed`, passed === results.length ? 'success' : 'error');
  document.getElementById('tests').scrollIntoView({ behavior: 'smooth' });
}
document.getElementById('btn-run-tests').onclick = runTests;
document.getElementById('btn-run-tests-2').onclick = runTests;

/* ---- live sample timetable ---- */
(function renderSample() {
  const today = Algo.todayStr();
  const { subjects, topics } = buildSampleData(today);
  const settings = { daily_hours: 5, start_time: '09:00', slot_size: 1 };
  const greedy = Algo.generateSchedule({ topics, subjects, settings, today });
  const dp = Algo.planWithDP({ topics, subjects, settings, today });
  const items = Algo.buildWorkItems(topics, subjects, today);
  const errors = Algo.validateSchedule(greedy, settings, items);

  const ranked = Algo.mergeSort(items.filter(i => i.remaining > 0), Algo.byPriorityDesc);
  const el = document.getElementById('sample-output');
  el.innerHTML = `
    <h3>Topic priorities on day 0 (merge-sorted, top 8)</h3>
    <table><thead><tr><th>#</th><th>Topic</th><th>Subject</th><th>I</th><th>D</th><th>Days left</th><th>Hours left</th><th>Priority</th></tr></thead>
    <tbody>${ranked.slice(0, 8).map((i, k) => `<tr><td>${k + 1}</td><td>${esc(i.name)}</td><td>${esc(i.subjectName)}</td><td>${i.importance}</td><td>${i.difficulty}</td><td>${i.daysLeft}</td><td>${i.remaining}</td><td><b>${i.priority}</b></td></tr>`).join('')}</tbody></table>

    <h3>Greedy timetable (first 6 days)</h3>
    <table><thead><tr><th>Day</th><th>Date</th><th>Slots (time · topic · subject · priority at that day)</th><th>Used</th></tr></thead>
    <tbody>${greedy.days.slice(0, 6).map(d => `<tr><td>${d.dayIndex + 1}</td><td>${fmtDay(d.date)}</td><td>${d.slots.map(s => `<div class="small"><span class="dot" style="background:${s.color}"></span> ${s.start_time}–${s.end_time} <b>${esc(s.topic_name)}</b> <span class="muted">(${esc(s.subject_name)}, P=${s.priority})</span></div>`).join('')}</td><td>${d.used}h</td></tr>`).join('')}</tbody></table>

    <div class="grid grid-4 mt mb">
      <div class="kpi"><b>${greedy.stats.horizonDays}</b><span>days planned</span></div>
      <div class="kpi"><b>${greedy.stats.totalPlannedHours}h / ${greedy.stats.totalAvailableHours}h</b><span>scheduled / available (${greedy.stats.utilisation}%)</span></div>
      <div class="kpi"><b>${greedy.unscheduled.length}</b><span>topics short on time</span></div>
      <div class="kpi"><b>${errors.length === 0 ? 'valid ✓' : errors.length + ' errors'}</b><span>schedule validator</span></div>
    </div>
    <p class="small muted">Greedy + DP mode on the same data: knapsack value ${dp.dp.value} (${dp.dp.selectedCount} topics, ${dp.dp.cellsComputed} cells) vs greedy-by-density ${dp.greedy.value} (${dp.greedy.selectedCount} topics). Needed ${dp.needed}h within a ${dp.budget}h budget — ${dp.allFit ? 'everything fits, so both select all topics.' : 'not everything fits.'}</p>
    ${greedy.warnings.length ? `<div class="alert alert-warning"><i class="fa-solid fa-triangle-exclamation"></i><div>${greedy.warnings.map(w => esc(w.message)).join('<br>')}</div></div>` : ''}`;
})();
