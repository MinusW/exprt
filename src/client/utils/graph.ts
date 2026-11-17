/**
 * Computes the transitive reduction of a directed prerequisite graph.
 * Given edges (from -> to), removes redundant direct edges like A -> C
 * when a longer path A -> B -> C already exists.
 */
export function reduceTransitiveEdges(
  edges: ReadonlyArray<{ from: string; to: string }>
): Array<{ from: string; to: string }> {
  const adj = new Map<string, Set<string>>();
  const uniqueEdges: Array<{ from: string; to: string }> = [];
  const seenEdge = new Set<string>();

  for (const { from, to } of edges) {
    if (!from || !to || from === to) continue;
    const key = `${from}\0${to}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    uniqueEdges.push({ from, to });

    let neighbors = adj.get(from);
    if (!neighbors) {
      neighbors = new Set();
      adj.set(from, neighbors);
    }
    neighbors.add(to);
  }

  // Cache nodes reachable from each `from` via paths of length >= 2
  const indirectCache = new Map<string, Set<string>>();

  const getIndirectReachable = (start: string): Set<string> => {
    const cached = indirectCache.get(start);
    if (cached) return cached;

    const indirect = new Set<string>();
    const directNeighbors = adj.get(start);
    if (!directNeighbors) {
      indirectCache.set(start, indirect);
      return indirect;
    }

    const queue: string[] = [];
    for (const neighbor of directNeighbors) {
      const twoHop = adj.get(neighbor);
      if (!twoHop) continue;
      for (const next of twoHop) {
        if (next !== start && !indirect.has(next)) {
          indirect.add(next);
          queue.push(next);
        }
      }
    }

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const nextSet = adj.get(curr);
      if (!nextSet) continue;
      for (const next of nextSet) {
        if (next !== start && !indirect.has(next)) {
          indirect.add(next);
          queue.push(next);
        }
      }
    }

    indirectCache.set(start, indirect);
    return indirect;
  };

  return uniqueEdges.filter(({ from, to }) => !getIndirectReachable(from).has(to));
}
