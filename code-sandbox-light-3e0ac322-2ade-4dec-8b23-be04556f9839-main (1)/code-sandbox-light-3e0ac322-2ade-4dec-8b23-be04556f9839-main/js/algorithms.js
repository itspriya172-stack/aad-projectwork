/* =====================================================================
   Smart Study Planner — Core DAA module (js/algorithms.js)
   ---------------------------------------------------------------------
   Everything algorithmic lives in this single file so it can be read,
   analysed and tested independently from the UI.

   Contents
     1. Date helpers
     2. Priority formula                      -> computePriority()
     3. Max-Heap priority queue               -> class MaxHeap
     4. Merge sort (Divide & Conquer)          -> mergeSort()
     5. Prerequisite graph check (Kahn)        -> detectPrerequisiteCycle()
     6. Work-item preparation                 -> buildWorkItems()
     7. Greedy slot scheduler                 -> generateSchedule()
     8. 0/1 Knapsack DP topic selection       -> knapsackSelect()
        Greedy density selection (comparison) -> greedySelect()
     9. Rescheduling helpers                  -> findMissedSlots()
    10. Validation                            -> validateSchedule()

   The same logic is mirrored in python/algorithms.py.
   ===================================================================== */

const Algo = (() => {
  'use strict';

  /* ------------------------------------------------------------------
     1. DATE HELPERS  (all dates handled as local 'YYYY-MM-DD' strings)
  ------------------------------------------------------------------ */
  const DAY_MS = 24 * 60 * 60 * 1000;

  function parseDate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  function fmtDate(date) {
    const p = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  }
  function addDays(dateStr, n) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() + n);
    return fmtDate(d);
  }
  /** Whole days from a -> b (positive when b is after a). */
  function daysBetween(aStr, bStr) {
    return Math.round((parseDate(bStr) - parseDate(aStr)) / DAY_MS);
  }
  function todayStr() { return fmtDate(new Date()); }

  /** "09:00" + 2.5 hours -> "11:30" */
  function addHoursToTime(timeStr, hours) {
    const [h, m] = timeStr.split(':').map(Number);
    const total = Math.round(h * 60 + m + hours * 60);
    const p = (n) => String(n).padStart(2, '0');
    return `${p(Math.floor(total / 60) % 24)}:${p(total % 60)}`;
  }

  /* ------------------------------------------------------------------
     2. PRIORITY FORMULA
     ------------------------------------------------------------------
     Priority(t, day) = (2·Importance + Difficulty) × Urgency(daysLeft)
     Urgency(d)       = 1 + 10 / (d + 1)

       • Importance (1-5) is weighted twice as much as Difficulty (1-5)
         because exam marks depend more on what is asked than on how
         hard the topic is.  Base weight therefore ranges 3 … 15.
       • Urgency is a hyperbolic function of the days remaining: it is
         11 on the day before an exam, 2.25 one week out and ≈1.3 one
         month out.  It never reaches 0, so far-away exams still get
         studied when nothing urgent is left.
       • If the exam has already passed, priority = 0 (nothing to gain).

     Cost: O(1).
  ------------------------------------------------------------------ */
  function urgency(daysLeft) {
    return 1 + 10 / (Math.max(daysLeft, 0) + 1);
  }
  function computePriority(importance, difficulty, daysLeft) {
    if (daysLeft < 0) return 0;
    const base = 2 * Number(importance) + Number(difficulty);
    return +(base * urgency(daysLeft)).toFixed(2);
  }

  /* ------------------------------------------------------------------
     3. MAX-HEAP PRIORITY QUEUE
     ------------------------------------------------------------------
     Binary heap stored in an array.  Parent of i = ⌊(i-1)/2⌋,
     children = 2i+1 and 2i+2.
        push()  O(log n)   — sift up
        pop()   O(log n)   — swap root with last, sift down
        peek()  O(1)
     Space O(n).
  ------------------------------------------------------------------ */
  class MaxHeap {
    /** @param {(a,b)=>number} compare  returns >0 if a has HIGHER priority than b */
    constructor(compare) {
      this.a = [];
      this.compare = compare;
      this.comparisons = 0;           // instrumentation for analysis page
    }
    get size() { return this.a.length; }
    peek() { return this.a[0]; }

    push(item) {
      this.a.push(item);
      this._siftUp(this.a.length - 1);
    }
    pop() {
      if (this.a.length === 0) return undefined;
      const top = this.a[0];
      const last = this.a.pop();
      if (this.a.length > 0) {
        this.a[0] = last;
        this._siftDown(0);
      }
      return top;
    }
    _higher(i, j) {
      this.comparisons++;
      return this.compare(this.a[i], this.a[j]) > 0;
    }
    _siftUp(i) {
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (this._higher(i, parent)) {
          [this.a[i], this.a[parent]] = [this.a[parent], this.a[i]];
          i = parent;
        } else break;
      }
    }
    _siftDown(i) {
      const n = this.a.length;
      while (true) {
        const l = 2 * i + 1, r = l + 1;
        let best = i;
        if (l < n && this._higher(l, best)) best = l;
        if (r < n && this._higher(r, best)) best = r;
        if (best === i) break;
        [this.a[i], this.a[best]] = [this.a[best], this.a[i]];
        i = best;
      }
    }
    /** Build-heap from an array in O(n) (Floyd's method). */
    static heapify(items, compare) {
      const h = new MaxHeap(compare);
      h.a = items.slice();
      for (let i = (h.a.length >> 1) - 1; i >= 0; i--) h._siftDown(i);
      return h;
    }
  }

  /* ------------------------------------------------------------------
     4. MERGE SORT  (Divide & Conquer)
     ------------------------------------------------------------------
     T(n) = 2T(n/2) + Θ(n)  ⇒  Θ(n log n) in best, average and worst case.
     Space Θ(n) auxiliary.  Stable — important so that topics with equal
     priority keep their deadline order after a second sort pass.
  ------------------------------------------------------------------ */
  function mergeSort(arr, compare) {
    const stats = { comparisons: 0 };
    function sort(a) {
      if (a.length <= 1) return a;
      const mid = a.length >> 1;
      return merge(sort(a.slice(0, mid)), sort(a.slice(mid)));
    }
    function merge(left, right) {
      const out = [];
      let i = 0, j = 0;
      while (i < left.length && j < right.length) {
        stats.comparisons++;
        if (compare(left[i], right[j]) <= 0) out.push(left[i++]);
        else out.push(right[j++]);
      }
      while (i < left.length) out.push(left[i++]);
      while (j < right.length) out.push(right[j++]);
      return out;
    }
    const sorted = sort(arr);
    sorted.comparisons = stats.comparisons;
    return sorted;
  }

  /** Comparator used throughout: higher priority first, then earlier exam,
      then more remaining hours, then name (stable, deterministic). */
  function byPriorityDesc(a, b) {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
    if (b.remaining !== a.remaining) return b.remaining - a.remaining;
    return a.name.localeCompare(b.name);
  }
  /** Earliest deadline first, then priority. */
  function byDeadline(a, b) {
    if (a.examDate !== b.examDate) return a.examDate < b.examDate ? -1 : 1;
    return byPriorityDesc(a, b);
  }

  /* ------------------------------------------------------------------
     5. PREREQUISITE GRAPH  —  Kahn's topological sort to detect cycles
     ------------------------------------------------------------------
     Topics form a DAG via `prerequisite_id`.  A cycle (A needs B, B needs
     A) would make both topics unschedulable, so we detect it up-front.
     O(V + E) time, O(V) space.
  ------------------------------------------------------------------ */
  function detectPrerequisiteCycle(topics) {
    const ids = new Set(topics.map(t => t.id));
    const indeg = new Map(), adj = new Map();
    topics.forEach(t => { indeg.set(t.id, 0); adj.set(t.id, []); });
    topics.forEach(t => {
      if (t.prerequisite_id && ids.has(t.prerequisite_id)) {
        adj.get(t.prerequisite_id).push(t.id);
        indeg.set(t.id, indeg.get(t.id) + 1);
      }
    });
    const queue = [...indeg].filter(([, d]) => d === 0).map(([id]) => id);
    let visited = 0;
    while (queue.length) {
      const u = queue.shift();
      visited++;
      for (const v of adj.get(u)) {
        indeg.set(v, indeg.get(v) - 1);
        if (indeg.get(v) === 0) queue.push(v);
      }
    }
    if (visited === topics.length) return null;
    return topics.filter(t => indeg.get(t.id) > 0).map(t => t.id); // nodes stuck in a cycle
  }

  /* ------------------------------------------------------------------
     6. WORK ITEMS — join topics with subjects and compute remaining work
  ------------------------------------------------------------------ */
  function buildWorkItems(topics, subjects, today) {
    const subById = Object.fromEntries(subjects.map(s => [s.id, s]));
    return topics
      .filter(t => subById[t.subject_id])
      .map(t => {
        const s = subById[t.subject_id];
        const duration = Number(t.duration) || 0;
        const done = Math.min(Number(t.hours_done) || 0, duration);
        const remaining = t.status === 'completed' ? 0 : +(duration - done).toFixed(2);
        const daysLeft = daysBetween(today, s.exam_date);
        return {
          id: t.id,
          name: t.name,
          subjectId: s.id,
          subjectName: s.name,
          color: s.color,
          examDate: s.exam_date,
          importance: Number(t.importance),
          difficulty: Number(t.difficulty),
          duration,
          remaining,
          status: t.status,
          prerequisiteId: t.prerequisite_id || '',
          daysLeft,
          priority: computePriority(t.importance, t.difficulty, daysLeft),
          tier: 0,          // 0 = committed (DP/greedy selection), 1 = best-effort
        };
      });
  }

  /* ------------------------------------------------------------------
     7. GREEDY SLOT SCHEDULER  (Priority-Queue driven)
     ------------------------------------------------------------------
     For every day from `today` until the day before the last exam:
       1. Recompute each unfinished topic's priority for that day
          (urgency grows as the exam approaches).
       2. Build a max-heap of ELIGIBLE topics:
            remaining > 0  AND  exam is still in the future  AND
            prerequisite satisfied (fully scheduled, completed, or expired).
       3. Repeatedly pop the top topic and give it a block of hours
          = min(remaining, hoursLeftToday, perTopicDailyCap).
          The cap (⌈dailyHours / 2⌉) spreads a day over ≥2 topics so a
          student does not sit 5 h on one topic; a second pass lifts the
          cap if hours would otherwise be wasted.
       4. When a topic reaches remaining = 0 its dependants become
          eligible and are pushed into the heap (Kahn-style unlock).
     Topics still unfinished when their exam arrives are reported as
     "insufficient time".

     Let n = topics, D = days in horizon.
       Each day: heapify O(n) + ≤ n pops/pushes O(log n)  ⇒ O(n log n)
       Total   : O(D · n log n)   time,  O(n + D·k) space (k slots/day)
  ------------------------------------------------------------------ */
  function generateSchedule({ topics, subjects, settings, today = todayStr(), committedIds = null }) {
    const dailyHours = Math.max(0.5, Number(settings.daily_hours) || 4);
    const slotSize = Number(settings.slot_size) || 1;
    const startTime = settings.start_time || '09:00';
    const perTopicCap = Math.max(slotSize, Math.ceil(dailyHours / 2));

    const warnings = [];
    const cycle = detectPrerequisiteCycle(topics);
    if (cycle) warnings.push({ type: 'cycle', message: 'Prerequisite cycle detected — the involved topics were scheduled ignoring prerequisites.', ids: cycle });

    const items = buildWorkItems(topics, subjects, today);
    if (committedIds) items.forEach(it => { it.tier = committedIds.has(it.id) ? 0 : 1; });
    const byId = Object.fromEntries(items.map(i => [i.id, i]));

    // topics whose exam already passed but are unfinished
    items.filter(i => i.remaining > 0 && i.daysLeft <= 0).forEach(i =>
      warnings.push({ type: 'expired', message: `"${i.name}" (${i.subjectName}) — exam date has passed; ${i.remaining}h left unstudied.`, ids: [i.id] }));

    const work = items.filter(i => i.remaining > 0 && i.daysLeft > 0);
    const horizon = work.length ? Math.max(...work.map(i => i.daysLeft)) : 0;

    // dependants map for O(1) unlocking
    const dependants = new Map();
    work.forEach(i => {
      if (i.prerequisiteId) {
        if (!dependants.has(i.prerequisiteId)) dependants.set(i.prerequisiteId, []);
        dependants.get(i.prerequisiteId).push(i);
      }
    });
    const prereqSatisfied = (it) => {
      if (!it.prerequisiteId || (cycle && cycle.includes(it.id))) return true;
      const p = byId[it.prerequisiteId];
      if (!p) return true;                          // dangling reference
      return p.remaining <= 0 || p.daysLeft <= 0;   // done / scheduled / expired
    };

    // comparator: committed tier first, then priority, deadline, remaining
    const cmp = (a, b) => {
      if (a.tier !== b.tier) return b.tier - a.tier;       // tier 0 beats tier 1
      return -byPriorityDesc(a, b);                        // heap wants >0 when a is higher
    };

    const days = [];
    let heapOps = 0, slotCount = 0;

    for (let d = 0; d < horizon; d++) {
      const date = addDays(today, d);
      const day = { date, dayIndex: d, slots: [], used: 0, free: dailyHours };
      let hoursLeft = dailyHours;
      let clock = startTime;
      const todayHours = new Map();      // topic id -> hours already given today

      // refresh priorities for this day (urgency changes daily)
      work.forEach(i => {
        i.daysLeft = daysBetween(date, i.examDate);
        i.priority = computePriority(i.importance, i.difficulty, i.daysLeft);
      });

      const eligible = (i, capped) => i.remaining > 0 && i.daysLeft > 0 && prereqSatisfied(i) &&
        (!capped || (todayHours.get(i.id) || 0) < perTopicCap);

      // pass 0: capped per-topic hours; pass 1: lift cap to avoid wasted time
      for (const capped of [true, false]) {
        if (hoursLeft <= 0) break;
        const heap = MaxHeap.heapify(work.filter(i => eligible(i, capped)), cmp);
        const inHeap = new Set(heap.a.map(i => i.id));

        while (hoursLeft > 0 && heap.size) {
          const t = heap.pop(); heapOps++;
          const capLeft = capped ? perTopicCap - (todayHours.get(t.id) || 0) : Infinity;
          let block = Math.min(t.remaining, hoursLeft, capLeft);
          // snap to slot granularity when possible
          if (block > slotSize) block = Math.floor(block / slotSize) * slotSize;
          block = +block.toFixed(2);
          if (block <= 0) continue;

          const end = addHoursToTime(clock, block);
          day.slots.push({
            id: `slot-${d}-${slotCount++}`,
            date, day_index: d, start_time: clock, end_time: end,
            topic_id: t.id, topic_name: t.name, subject_name: t.subjectName,
            color: t.color, hours: block, priority: t.priority, done: false, rescheduled: false,
          });
          clock = end;
          hoursLeft = +(hoursLeft - block).toFixed(2);
          t.remaining = +(t.remaining - block).toFixed(2);
          todayHours.set(t.id, (todayHours.get(t.id) || 0) + block);

          // unlock dependants once prerequisite fully scheduled
          if (t.remaining <= 0 && dependants.has(t.id)) {
            for (const dep of dependants.get(t.id)) {
              if (!inHeap.has(dep.id) && eligible(dep, capped)) { heap.push(dep); inHeap.add(dep.id); heapOps++; }
            }
          }
        }
      }
      day.used = +(dailyHours - hoursLeft).toFixed(2);
      day.free = +hoursLeft.toFixed(2);
      days.push(day);
    }

    // anything still unfinished could not fit before its exam
    const unscheduled = work.filter(i => i.remaining > 0).map(i => ({
      id: i.id, name: i.name, subjectName: i.subjectName, color: i.color,
      examDate: i.examDate, hoursShort: i.remaining, priority: computePriority(i.importance, i.difficulty, daysBetween(today, i.examDate)),
    }));
    unscheduled.forEach(u => warnings.push({ type: 'insufficient', message: `Insufficient time: "${u.name}" (${u.subjectName}) is short by ${u.hoursShort}h before its exam on ${u.examDate}.`, ids: [u.id] }));

    const slots = days.flatMap(d => d.slots);
    const totalPlanned = +slots.reduce((s, x) => s + x.hours, 0).toFixed(2);
    return {
      days, slots, unscheduled, warnings,
      stats: {
        topics: work.length, horizonDays: horizon, totalPlannedHours: totalPlanned,
        totalAvailableHours: horizon * dailyHours, utilisation: horizon ? +(totalPlanned / (horizon * dailyHours) * 100).toFixed(1) : 0,
        heapOperations: heapOps, slots: slots.length,
      },
    };
  }

  /* ------------------------------------------------------------------
     8. 0/1 KNAPSACK — Dynamic Programming topic selection
     ------------------------------------------------------------------
     When the total study budget H is smaller than the hours needed,
     which topics should be COMMITTED to (finished completely) so that
     the total priority value is maximised?

        maximise  Σ priority_i · x_i
        s.t.      Σ hours_i · x_i ≤ H,   x_i ∈ {0,1}

     dp[i][w] = best value using first i topics within w hour-units.
     dp[i][w] = max( dp[i-1][w],  dp[i-1][w - h_i] + v_i  if h_i ≤ w )

     Time  Θ(n · W)   (pseudo-polynomial, W = H / slotSize)
     Space Θ(n · W)   with the keep[][] table for reconstruction
           Θ(W)       if only the optimal value is required.
  ------------------------------------------------------------------ */
  function knapsackSelect(items, capacityHours, slotSize = 1) {
    const W = Math.max(0, Math.round(capacityHours / slotSize));
    const n = items.length;
    const weight = items.map(it => Math.max(1, Math.round(it.remaining / slotSize)));
    const value = items.map(it => it.priority);

    // dp as (n+1) × (W+1) table so the choice can be reconstructed
    const dp = Array.from({ length: n + 1 }, () => new Float64Array(W + 1));
    let cells = 0;
    for (let i = 1; i <= n; i++) {
      const h = weight[i - 1], v = value[i - 1];
      for (let w = 0; w <= W; w++) {
        cells++;
        dp[i][w] = dp[i - 1][w];
        if (h <= w && dp[i - 1][w - h] + v > dp[i][w]) dp[i][w] = dp[i - 1][w - h] + v;
      }
    }
    // reconstruct chosen set by walking back through the table
    const selected = new Set();
    let w = W;
    for (let i = n; i >= 1; i--) {
      if (dp[i][w] !== dp[i - 1][w]) { selected.add(items[i - 1].id); w -= weight[i - 1]; }
    }
    const usedHours = items.filter(it => selected.has(it.id)).reduce((s, it) => s + it.remaining, 0);
    return { selected, value: +dp[n][W].toFixed(2), usedHours: +usedHours.toFixed(2), capacity: W, cellsComputed: cells, tableSize: `${n + 1} × ${W + 1}` };
  }

  /** Greedy 0/1 selection by value density (priority per hour).  Fast
      O(n log n) but NOT guaranteed optimal — used for the comparison. */
  function greedySelect(items, capacityHours) {
    const sorted = mergeSort(items, (a, b) => (b.priority / Math.max(b.remaining, 0.5)) - (a.priority / Math.max(a.remaining, 0.5)));
    const selected = new Set();
    let left = capacityHours, value = 0;
    for (const it of sorted) {
      if (it.remaining <= left) { selected.add(it.id); left -= it.remaining; value += it.priority; }
    }
    return { selected, value: +value.toFixed(2), usedHours: +(capacityHours - left).toFixed(2), comparisons: sorted.comparisons };
  }

  /** Full pipeline for the DP mode: budget = Σ daily hours over horizon. */
  function planWithDP({ topics, subjects, settings, today = todayStr() }) {
    const items = buildWorkItems(topics, subjects, today).filter(i => i.remaining > 0 && i.daysLeft > 0);
    const horizon = items.length ? Math.max(...items.map(i => i.daysLeft)) : 0;
    const budget = horizon * (Number(settings.daily_hours) || 4);
    const needed = +items.reduce((s, i) => s + i.remaining, 0).toFixed(2);
    const dp = knapsackSelect(items, budget, Number(settings.slot_size) || 1);
    const gr = greedySelect(items, budget);
    const schedule = generateSchedule({ topics, subjects, settings, today, committedIds: dp.selected });
    const deferred = items.filter(i => !dp.selected.has(i.id)).map(i => ({ id: i.id, name: i.name, subjectName: i.subjectName, color: i.color, remaining: i.remaining, priority: i.priority }));
    return { ...schedule, dp: { ...dp, selectedCount: dp.selected.size }, greedy: { ...gr, selectedCount: gr.selected.size }, budget, needed, deferred, allFit: needed <= budget };
  }

  /* ------------------------------------------------------------------
     9. RESCHEDULING
     A slot is "missed" if its date is before today and it was never
     marked done.  Because generateSchedule() always works from the
     topics' *remaining* hours, simply regenerating from today carries
     every unfinished topic forward.  We flag the affected topics so
     the UI can highlight the moved slots.   O(S) in number of slots.
  ------------------------------------------------------------------ */
  function findMissedSlots(slots, today = todayStr()) {
    return slots.filter(s => s.date < today && !s.done);
  }

  /* ------------------------------------------------------------------
     10. VALIDATION  — used by the automated test-suite
  ------------------------------------------------------------------ */
  function validateSchedule(result, settings, items) {
    const errors = [];
    const dailyHours = Number(settings.daily_hours);
    const byId = Object.fromEntries(items.map(i => [i.id, i]));
    for (const day of result.days) {
      if (day.used > dailyHours + 1e-9) errors.push(`${day.date}: ${day.used}h exceeds daily limit ${dailyHours}h`);
      // no overlapping time slots on the same day
      const sorted = [...day.slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].start_time < sorted[i - 1].end_time) errors.push(`${day.date}: overlapping slots ${sorted[i - 1].topic_name} / ${sorted[i].topic_name}`);
      }
      // nothing scheduled on/after its exam day
      for (const s of day.slots) {
        const it = byId[s.topic_id];
        if (it && s.date >= it.examDate) errors.push(`${s.topic_name} scheduled on ${s.date} but exam is ${it.examDate}`);
      }
    }
    // prerequisite order: first slot of dependant must come after last slot of prerequisite
    const first = {}, last = {};
    for (const s of result.slots) {
      const key = `${s.date}T${s.start_time}`;
      if (!first[s.topic_id] || key < first[s.topic_id]) first[s.topic_id] = key;
      if (!last[s.topic_id] || key > last[s.topic_id]) last[s.topic_id] = key;
    }
    for (const it of items) {
      if (it.prerequisiteId && first[it.id] && last[it.prerequisiteId] && first[it.id] < last[it.prerequisiteId]) {
        errors.push(`${it.name} starts before its prerequisite finishes`);
      }
    }
    // no topic over-scheduled
    const given = {};
    result.slots.forEach(s => given[s.topic_id] = (given[s.topic_id] || 0) + s.hours);
    for (const id in given) if (byId[id] && given[id] > byId[id].remaining + 1e-9) errors.push(`${byId[id].name} over-scheduled`);
    return errors;
  }

  return {
    // helpers
    parseDate, fmtDate, addDays, daysBetween, todayStr, addHoursToTime,
    // algorithms
    urgency, computePriority, MaxHeap, mergeSort, byPriorityDesc, byDeadline,
    detectPrerequisiteCycle, buildWorkItems, generateSchedule,
    knapsackSelect, greedySelect, planWithDP, findMissedSlots, validateSchedule,
  };
})();

if (typeof module !== 'undefined') module.exports = Algo;
