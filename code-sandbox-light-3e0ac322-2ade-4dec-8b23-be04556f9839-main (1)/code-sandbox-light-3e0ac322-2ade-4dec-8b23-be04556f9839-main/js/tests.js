/* Automated test-suite for js/algorithms.js — js/tests.js
   Runs in the browser (docs.html "Run tests") and in Node:  node js/tests.js  */
(function (root) {
  const A = typeof Algo !== 'undefined' ? Algo : require('./algorithms.js');
  const T0 = '2026-10-14';
  const S = (daily_hours = 5) => ({ daily_hours, start_time: '09:00', slot_size: 1 });
  const sub = (id, exam, name = id) => ({ id, name, code: id.toUpperCase(), exam_date: exam, color: '#6366f1' });
  const top = (id, subject_id, duration, importance = 3, difficulty = 3, prerequisite_id = '', hours_done = 0, status = 'pending') =>
    ({ id, subject_id, name: id, duration, importance, difficulty, prerequisite_id, hours_done, status });

  const tests = [];
  const test = (name, fn) => tests.push({ name, fn });
  const eq = (a, b, msg = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
  const ok = (c, msg = 'assertion failed') => { if (!c) throw new Error(msg); };

  /* ---- TC1 priority formula ---- */
  test('TC1  Priority formula: (2I+D)×(1+10/(d+1))', () => {
    eq(A.computePriority(5, 5, 0), 165, 'exam tomorrow-ish (d=0)');   // 15 × 11
    eq(A.computePriority(5, 5, 9), 30, 'd=9 → 15×2');
    eq(A.computePriority(1, 1, 9), 6, 'd=9 → 3×2');
    eq(A.computePriority(3, 3, -1), 0, 'exam passed → 0');
    ok(A.computePriority(5, 3, 2) > A.computePriority(3, 5, 2), 'importance weighs more than difficulty');
    ok(A.computePriority(3, 3, 1) > A.computePriority(3, 3, 10), 'closer exam → higher priority');
  });

  /* ---- TC2 max-heap ---- */
  test('TC2  MaxHeap pops in non-increasing order', () => {
    const h = new A.MaxHeap((a, b) => a - b);
    [5, 1, 9, 3, 7, 2, 8].forEach(x => h.push(x));
    const out = []; while (h.size) out.push(h.pop());
    eq(out, [9, 8, 7, 5, 3, 2, 1]);
    const h2 = A.MaxHeap.heapify([4, 10, 3, 5, 1], (a, b) => a - b);
    eq(h2.peek(), 10, 'heapify root');
  });

  /* ---- TC3 merge sort ---- */
  test('TC3  Merge sort is correct and stable', () => {
    const arr = [{ k: 3, t: 'a' }, { k: 1, t: 'b' }, { k: 3, t: 'c' }, { k: 2, t: 'd' }];
    const s = A.mergeSort(arr, (x, y) => x.k - y.k);
    eq(s.map(x => x.t), ['b', 'd', 'a', 'c']);
    const big = Array.from({ length: 1000 }, (_, i) => (i * 7919) % 1000);
    const sb = A.mergeSort(big, (x, y) => x - y);
    ok(sb.every((v, i) => i === 0 || sb[i - 1] <= v), 'sorted 1000');
    ok(sb.comparisons <= 1000 * 10, `comparisons ${sb.comparisons} ≤ n·log2 n`);
  });

  /* ---- TC4 cycle detection ---- */
  test('TC4  Prerequisite cycle detection (Kahn)', () => {
    eq(A.detectPrerequisiteCycle([top('a', 's', 1), top('b', 's', 1, 3, 3, 'a')]), null);
    const cyc = A.detectPrerequisiteCycle([top('a', 's', 1, 3, 3, 'b'), top('b', 's', 1, 3, 3, 'a'), top('c', 's', 1)]);
    eq(cyc.sort(), ['a', 'b']);
  });

  /* ---- TC5 daily limit & no overlap ---- */
  test('TC5  Daily hour limit respected, no overlapping slots', () => {
    const subjects = [sub('s1', '2026-10-20')];
    const topics = [top('a', 's1', 4), top('b', 's1', 4), top('c', 's1', 4), top('d', 's1', 4)];
    const r = A.generateSchedule({ topics, subjects, settings: S(3), today: T0 });
    r.days.forEach(d => ok(d.used <= 3 + 1e-9, `${d.date} used ${d.used}`));
    const items = A.buildWorkItems(topics, subjects, T0);
    eq(A.validateSchedule(r, S(3), items), []);
    eq(r.stats.totalPlannedHours, 16, 'everything fits: 6 days × 3h = 18 ≥ 16');
  });

  /* ---- TC6 urgency ordering ---- */
  test('TC6  Urgent exam scheduled first (greedy choice)', () => {
    const subjects = [sub('near', '2026-10-16'), sub('far', '2026-10-30')];
    const topics = [top('N', 'near', 2, 3, 3), top('F', 'far', 2, 5, 5)];
    const r = A.generateSchedule({ topics, subjects, settings: S(2), today: T0 });
    eq(r.days[0].slots[0].topic_id, 'N', 'day 1 goes to the near exam even though F has higher I and D');
  });

  /* ---- TC7 prerequisites ---- */
  test('TC7  Prerequisite finished before dependant starts', () => {
    const subjects = [sub('s1', '2026-10-24')];
    const topics = [top('basic', 's1', 3, 1, 1), top('adv', 's1', 3, 5, 5, 'basic')];
    const r = A.generateSchedule({ topics, subjects, settings: S(4), today: T0 });
    const items = A.buildWorkItems(topics, subjects, T0);
    eq(A.validateSchedule(r, S(4), items), []);
    eq(r.slots[0].topic_id, 'basic', 'adv has higher priority but must wait');
  });

  /* ---- TC8 insufficient time ---- */
  test('TC8  Insufficient time reported, highest priority kept', () => {
    const subjects = [sub('s1', '2026-10-16')];                 // 2 days × 2h = 4h budget
    const topics = [top('hi', 's1', 2, 5, 5), top('mid', 's1', 2, 3, 3), top('lo', 's1', 2, 1, 1)];
    const r = A.generateSchedule({ topics, subjects, settings: S(2), today: T0 });
    eq(r.unscheduled.map(u => u.id), ['lo']);
    ok(r.warnings.some(w => w.type === 'insufficient'));
    eq(r.stats.totalPlannedHours, 4);
  });

  /* ---- TC9 nothing after exam / expired ---- */
  test('TC9  No slot on or after exam day; expired topics flagged', () => {
    const subjects = [sub('s1', '2026-10-17'), sub('old', '2026-10-10')];
    const topics = [top('a', 's1', 10), top('z', 'old', 2)];
    const r = A.generateSchedule({ topics, subjects, settings: S(3), today: T0 });
    r.slots.forEach(s => ok(s.date < '2026-10-17'));
    ok(r.warnings.some(w => w.type === 'expired' && w.ids[0] === 'z'));
  });

  /* ---- TC10 knapsack optimality vs greedy ---- */
  test('TC10 0/1 Knapsack DP beats greedy-by-density on a classic counter-example', () => {
    // capacity 10: items (value, hours): A(60,5) B(50,4) C(50,4) D(10,1)
    // density: A=12, B=12.5, C=12.5, D=10 → greedy: B,C,D = 110 (9h)  | optimal: A,B,D? 5+4+1=10 → 120
    const items = [
      { id: 'A', priority: 60, remaining: 5 }, { id: 'B', priority: 50, remaining: 4 },
      { id: 'C', priority: 50, remaining: 4 }, { id: 'D', priority: 10, remaining: 1 },
    ];
    const dp = A.knapsackSelect(items, 10, 1);
    const gr = A.greedySelect(items, 10);
    eq(dp.value, 120); eq(gr.value, 110);
    ok(dp.value >= gr.value, 'DP optimal ≥ greedy');
    eq(dp.cellsComputed, 4 * 11, 'n×(W+1) cells');
  });

  /* ---- TC11 planWithDP pipeline ---- */
  test('TC11 DP pipeline: committed topics fully scheduled when budget is short', () => {
    const subjects = [sub('s1', '2026-10-17')];                 // 3 days × 3h = 9h
    const topics = [top('a', 's1', 4, 5, 5), top('b', 's1', 4, 4, 4), top('c', 's1', 3, 1, 1), top('d', 's1', 1, 2, 2)];
    const r = A.planWithDP({ topics, subjects, settings: S(3), today: T0 });
    eq(r.allFit, false);
    const given = {}; r.slots.forEach(s => given[s.topic_id] = (given[s.topic_id] || 0) + s.hours);
    r.dp.selected.forEach(id => eq(given[id], topics.find(t => t.id === id).duration, `committed ${id} fully scheduled`));
    ok(r.dp.usedHours <= 9);
  });

  /* ---- TC12 rescheduling ---- */
  test('TC12 Missed slots detected and remaining hours carried forward', () => {
    const slots = [{ id: 1, date: '2026-10-12', done: false, topic_id: 'a' }, { id: 2, date: '2026-10-13', done: true, topic_id: 'a' }, { id: 3, date: '2026-10-15', done: false, topic_id: 'a' }];
    eq(A.findMissedSlots(slots, T0).map(s => s.id), [1]);
    const subjects = [sub('s1', '2026-10-18')];
    const topics = [top('a', 's1', 4, 3, 3, '', 1, 'in-progress')];
    const r = A.generateSchedule({ topics, subjects, settings: S(2), today: T0 });
    eq(r.stats.totalPlannedHours, 3, 'only the 3 remaining hours are scheduled');
  });

  /* ---- TC13 empty input ---- */
  test('TC13 Empty input produces empty plan without errors', () => {
    const r = A.generateSchedule({ topics: [], subjects: [], settings: S(), today: T0 });
    eq(r.slots.length, 0); eq(r.stats.horizonDays, 0);
  });

  /* ---- runner ---- */
  function run() {
    const results = [];
    for (const t of tests) {
      const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
      try { t.fn(); results.push({ name: t.name, pass: true, ms: ((typeof performance !== 'undefined' ? performance : Date).now() - t0).toFixed(2) }); }
      catch (e) { results.push({ name: t.name, pass: false, error: e.message }); }
    }
    return results;
  }
  root.StudyPlannerTests = { run, count: tests.length };
  if (typeof module !== 'undefined' && require.main === module) {
    const res = run();
    res.forEach(r => console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.error ? '  → ' + r.error : ''}`));
    const failed = res.filter(r => !r.pass).length;
    console.log(`\n${res.length - failed}/${res.length} tests passed`);
    process.exit(failed ? 1 : 0);
  }
})(typeof window !== 'undefined' ? window : globalThis);
