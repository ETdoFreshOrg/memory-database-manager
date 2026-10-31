export type DiffLine = { kind: 'same' | 'add' | 'del'; text: string };

const MAX_CELLS = 4_000_000;

/** Line diff (LCS). Returns null when the inputs are too big to diff in the browser. */
export function diffLines(oldText: string, newText: string): DiffLine[] | null {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  // Trim a shared head and tail so long, mostly equal texts stay cheap.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length, endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const midA = a.slice(start, endA), midB = b.slice(start, endB);
  if ((midA.length + 1) * (midB.length + 1) > MAX_CELLS) return null;

  const n = midA.length, m = midB.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = midA[i] === midB[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const out: DiffLine[] = a.slice(0, start).map(text => ({ kind: 'same' as const, text }));
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) { out.push({ kind: 'same', text: midA[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ kind: 'del', text: midA[i++] });
    else out.push({ kind: 'add', text: midB[j++] });
  }
  while (i < n) out.push({ kind: 'del', text: midA[i++] });
  while (j < m) out.push({ kind: 'add', text: midB[j++] });
  for (const text of a.slice(endA)) out.push({ kind: 'same', text });
  return out;
}

/** Keeps changed lines plus a little context; long unchanged runs collapse into a marker. */
export function withContext(lines: DiffLine[], context = 2): (DiffLine | { kind: 'skip'; count: number })[] {
  const keep = new Array(lines.length).fill(false);
  lines.forEach((l, idx) => {
    if (l.kind !== 'same') for (let k = Math.max(0, idx - context); k <= Math.min(lines.length - 1, idx + context); k++) keep[k] = true;
  });
  const out: (DiffLine | { kind: 'skip'; count: number })[] = [];
  let skipped = 0;
  lines.forEach((l, idx) => {
    if (keep[idx]) { if (skipped) { out.push({ kind: 'skip', count: skipped }); skipped = 0; } out.push(l); }
    else skipped++;
  });
  if (skipped) out.push({ kind: 'skip', count: skipped });
  return out;
}
