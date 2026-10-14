/* Sample dataset — js/sample-data.js
   Exam dates are generated relative to "today" so the demo always has
   upcoming exams.  Used by the "Load sample data" button. */
function buildSampleData(today) {
  const d = (n) => Algo.addDays(today, n);
  const subjects = [
    { id: 'sub-daa', name: 'Design & Analysis of Algorithms', code: 'CS301', exam_date: d(7), color: '#6366f1' },
    { id: 'sub-dbms', name: 'Database Management Systems', code: 'CS302', exam_date: d(10), color: '#10b981' },
    { id: 'sub-os', name: 'Operating Systems', code: 'CS303', exam_date: d(14), color: '#f59e0b' },
    { id: 'sub-math', name: 'Discrete Mathematics', code: 'MA201', exam_date: d(19), color: '#ec4899' },
  ];
  const T = (id, subject_id, name, difficulty, importance, duration, hours_done = 0, status = 'pending', prerequisite_id = '') =>
    ({ id, subject_id, name, difficulty, importance, duration, hours_done, status, prerequisite_id });
  const topics = [
    T('t-daa-1', 'sub-daa', 'Asymptotic Notation & Recurrences', 3, 5, 3, 3, 'completed'),
    T('t-daa-2', 'sub-daa', 'Divide & Conquer (Merge/Quick Sort)', 3, 4, 3, 1, 'in-progress', 't-daa-1'),
    T('t-daa-3', 'sub-daa', 'Greedy Algorithms', 3, 5, 3),
    T('t-daa-4', 'sub-daa', 'Dynamic Programming', 5, 5, 5, 0, 'pending', 't-daa-3'),
    T('t-daa-5', 'sub-daa', 'Graph Algorithms (BFS/DFS/Dijkstra)', 4, 4, 4),
    T('t-daa-6', 'sub-daa', 'NP-Completeness', 5, 3, 3),
    T('t-dbms-1', 'sub-dbms', 'ER Model & Relational Model', 2, 4, 2, 2, 'completed'),
    T('t-dbms-2', 'sub-dbms', 'SQL Queries & Joins', 3, 5, 4, 0, 'pending', 't-dbms-1'),
    T('t-dbms-3', 'sub-dbms', 'Normalization (1NF-BCNF)', 4, 5, 3),
    T('t-dbms-4', 'sub-dbms', 'Transactions & Concurrency', 4, 4, 3),
    T('t-dbms-5', 'sub-dbms', 'Indexing & B+ Trees', 3, 3, 2),
    T('t-os-1', 'sub-os', 'Process Management & Scheduling', 3, 5, 3),
    T('t-os-2', 'sub-os', 'Synchronization & Deadlocks', 4, 5, 4, 0, 'pending', 't-os-1'),
    T('t-os-3', 'sub-os', 'Memory Management & Paging', 4, 4, 3),
    T('t-os-4', 'sub-os', 'File Systems & I/O', 2, 3, 2),
    T('t-math-1', 'sub-math', 'Propositional & Predicate Logic', 2, 4, 2),
    T('t-math-2', 'sub-math', 'Set Theory, Relations & Functions', 2, 3, 2),
    T('t-math-3', 'sub-math', 'Combinatorics & Counting', 4, 4, 3),
    T('t-math-4', 'sub-math', 'Graph Theory & Trees', 3, 4, 3, 0, 'pending', 't-math-2'),
  ];
  return { subjects, topics };
}
