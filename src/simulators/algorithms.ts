/**
 * Step-by-step recordings of classic algorithms for the DSA visualizers.
 * Each function returns a list of frames; the player just moves through them,
 * so play, pause, step forward and step BACK all work.
 */

export type SortAlgorithm = 'bubble' | 'selection' | 'insertion' | 'merge' | 'quick';

export interface SortFrame {
  values: number[];
  /** Indexes being compared (yellow). */
  compare?: number[];
  /** Indexes just swapped or written (red). */
  changed?: number[];
  /** Indexes in their final place (green). */
  sorted: number[];
  pivot?: number;
  note: string;
}

export function sortFrames(algorithm: SortAlgorithm, input: number[]): SortFrame[] {
  const a = [...input];
  const frames: SortFrame[] = [];
  const sorted = new Set<number>();
  const push = (note: string, extra: Partial<SortFrame> = {}) =>
    frames.push({ values: [...a], sorted: [...sorted].sort((x, y) => x - y), note, ...extra });
  const swap = (i: number, j: number) => {
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  };

  push('Start: the list is not sorted yet.');
  const n = a.length;

  if (algorithm === 'bubble') {
    for (let end = n - 1; end > 0; end--) {
      let swapped = false;
      for (let i = 0; i < end; i++) {
        push(`Compare ${a[i]} and ${a[i + 1]}.`, { compare: [i, i + 1] });
        if (a[i]! > a[i + 1]!) {
          swap(i, i + 1);
          swapped = true;
          push(`${a[i + 1]} is bigger, so swap: it bubbles to the right.`, { changed: [i, i + 1] });
        }
      }
      sorted.add(end);
      push(`${a[end]} is now in its final place at the end.`);
      if (!swapped) {
        for (let k = 0; k < end; k++) sorted.add(k);
        push('No swaps in this pass, so the list is already sorted. Stop early.');
        break;
      }
    }
    sorted.add(0);
  } else if (algorithm === 'selection') {
    for (let i = 0; i < n - 1; i++) {
      let min = i;
      for (let j = i + 1; j < n; j++) {
        push(`Smallest so far is ${a[min]}. Check ${a[j]}.`, { compare: [min, j] });
        if (a[j]! < a[min]!) min = j;
      }
      if (min !== i) {
        swap(i, min);
        push(`Put the smallest (${a[i]}) at position ${i}.`, { changed: [i, min] });
      }
      sorted.add(i);
    }
    sorted.add(n - 1);
  } else if (algorithm === 'insertion') {
    sorted.add(0);
    for (let i = 1; i < n; i++) {
      let j = i;
      push(`Take ${a[i]} and insert it into the sorted left part.`, { compare: [i] });
      while (j > 0 && a[j - 1]! > a[j]!) {
        swap(j, j - 1);
        push(`${a[j]} is bigger than ${a[j - 1]}, so shift it right.`, { changed: [j - 1, j] });
        j--;
      }
      sorted.add(i);
    }
    for (let k = 0; k < n; k++) sorted.add(k);
  } else if (algorithm === 'merge') {
    const mergeSort = (lo: number, hi: number) => {
      if (hi - lo < 1) return;
      const mid = Math.floor((lo + hi) / 2);
      mergeSort(lo, mid);
      mergeSort(mid + 1, hi);
      const left = a.slice(lo, mid + 1);
      const right = a.slice(mid + 1, hi + 1);
      push(`Merge [${left.join(', ')}] and [${right.join(', ')}].`, { compare: range(lo, hi) });
      let i = 0;
      let j = 0;
      for (let k = lo; k <= hi; k++) {
        const takeLeft = j >= right.length || (i < left.length && left[i]! <= right[j]!);
        a[k] = takeLeft ? left[i++]! : right[j++]!;
      }
      if (lo === 0 && hi === n - 1) for (let k = 0; k < n; k++) sorted.add(k);
      push(`Merged: [${a.slice(lo, hi + 1).join(', ')}].`, { changed: range(lo, hi) });
    };
    mergeSort(0, n - 1);
  } else {
    const quick = (lo: number, hi: number) => {
      if (lo > hi) return;
      if (lo === hi) {
        sorted.add(lo);
        return;
      }
      const pivot = a[hi]!;
      push(`Pivot is ${pivot}. Move smaller values to its left.`, { pivot: hi });
      let store = lo;
      for (let i = lo; i < hi; i++) {
        push(`Is ${a[i]} smaller than ${pivot}?`, { compare: [i], pivot: hi });
        if (a[i]! < pivot) {
          swap(i, store);
          push(`Yes: move ${a[store]} into the left part.`, { changed: [i, store], pivot: hi });
          store++;
        }
      }
      swap(store, hi);
      sorted.add(store);
      push(`Put pivot ${pivot} between the parts. It is now in its final place.`, {
        changed: [store, hi],
      });
      quick(lo, store - 1);
      quick(store + 1, hi);
    };
    quick(0, n - 1);
  }

  for (let k = 0; k < n; k++) sorted.add(k);
  push(`Sorted! ${frames.filter((f) => f.compare).length} comparisons were shown.`);
  return frames;
}

function range(lo: number, hi: number): number[] {
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

export interface SearchFrame {
  lo: number;
  hi: number;
  mid?: number;
  found?: number;
  note: string;
}

export function binarySearchFrames(values: number[], target: number): SearchFrame[] {
  const frames: SearchFrame[] = [
    {
      lo: 0,
      hi: values.length - 1,
      note: `Find ${target} in a SORTED list. Look at the whole list first.`,
    },
  ];
  let lo = 0;
  let hi = values.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const value = values[mid]!;
    if (value === target) {
      frames.push({
        lo,
        hi,
        mid,
        found: mid,
        note: `Middle is ${value}: found it at index ${mid} in ${frames.length} steps.`,
      });
      return frames;
    }
    if (value < target) {
      frames.push({
        lo,
        hi,
        mid,
        note: `Middle is ${value}, smaller than ${target}. Throw away the left half.`,
      });
      lo = mid + 1;
    } else {
      frames.push({
        lo,
        hi,
        mid,
        note: `Middle is ${value}, bigger than ${target}. Throw away the right half.`,
      });
      hi = mid - 1;
    }
  }
  frames.push({ lo, hi: lo - 1, note: `Nothing left to check: ${target} is not in the list.` });
  return frames;
}

/** A small graph for BFS / DFS. Positions are for drawing (0..100). */
export const GRAPH = {
  nodes: {
    A: [50, 10],
    B: [22, 38],
    C: [78, 38],
    D: [10, 72],
    E: [40, 72],
    F: [66, 72],
    G: [90, 72],
    H: [52, 96],
  } as Record<string, [number, number]>,
  edges: [
    ['A', 'B'],
    ['A', 'C'],
    ['B', 'D'],
    ['B', 'E'],
    ['C', 'F'],
    ['C', 'G'],
    ['E', 'H'],
    ['F', 'H'],
  ] as [string, string][],
};

export interface GraphFrame {
  current?: string;
  visited: string[];
  /** The queue (BFS) or stack (DFS), left = next out. */
  frontier: string[];
  edge?: [string, string];
  note: string;
}

function neighbours(node: string): string[] {
  return GRAPH.edges.flatMap(([a, b]) => (a === node ? [b] : b === node ? [a] : [])).sort();
}

export function traversalFrames(mode: 'bfs' | 'dfs', start = 'A'): GraphFrame[] {
  const frames: GraphFrame[] = [];
  const visited: string[] = [];
  const seen = new Set([start]);
  const frontier = [start];
  const name = mode === 'bfs' ? 'queue' : 'stack';
  /** Left = the next one out (front of the queue, top of the stack). */
  const show = () => (mode === 'dfs' ? [...frontier].reverse() : [...frontier]);
  frames.push({ visited: [], frontier: [...frontier], note: `Put ${start} in the ${name}.` });
  while (frontier.length > 0) {
    const current = (mode === 'bfs' ? frontier.shift() : frontier.pop())!;
    visited.push(current);
    frames.push({
      current,
      visited: [...visited],
      frontier: show(),
      note: `Take ${current} from the ${mode === 'bfs' ? 'front of the queue' : 'top of the stack'} and visit it.`,
    });
    const next = neighbours(current).filter((n) => !seen.has(n));
    const order = mode === 'dfs' ? [...next].reverse() : next;
    for (const n of order) {
      seen.add(n);
      frontier.push(n);
      frames.push({
        current,
        visited: [...visited],
        frontier: show(),
        edge: [current, n],
        note: `${n} is a new neighbour of ${current}: add it to the ${name}.`,
      });
    }
  }
  frames.push({
    visited: [...visited],
    frontier: [],
    note: `Done. Visit order: ${visited.join(' → ')}. ${mode === 'bfs' ? 'BFS goes level by level.' : 'DFS goes deep first, then backtracks.'}`,
  });
  return frames;
}
