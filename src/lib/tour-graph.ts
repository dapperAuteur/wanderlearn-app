/**
 * Pure graph analysis over a destination's scenes and links.
 *
 * No "server-only", no DB imports — synchronous functions over ids, so this is
 * trivially unit-testable once the Vitest setup lands (plans/future/06) and safe
 * to call from anywhere.
 */

export interface SceneGraphStats {
  sceneId: string;
  /** All outgoing rows, duplicates included. */
  outgoing: number;
  incoming: number;
  isStart: boolean;
  /** No incoming links and not the start — nothing leads here. */
  isOrphan: boolean;
  /** No outgoing links — a visitor arriving here is stuck. */
  isDeadEnd: boolean;
  /** Not reachable walking links from the start scene. */
  isUnreachable: boolean;
  /** Outgoing links with no placed arrow (null yaw/pitch) — invisible to visitors. */
  needsPlacement: number;
  /** Target scene ids that appear more than once from this scene. */
  duplicateTargets: string[];
}

export interface TourGraphInput {
  sceneIds: string[];
  links: { fromSceneId: string; toSceneId: string; placed: boolean }[];
  /**
   * The effective start: destination.defaultStartSceneId when set and present,
   * else the oldest scene (assemble-tour's fallback). Caller resolves; null when
   * the destination has no scenes.
   */
  startSceneId: string | null;
}

export function analyzeTourGraph(input: TourGraphInput): Map<string, SceneGraphStats> {
  const inSet = new Set(input.sceneIds);
  const out = new Map<string, SceneGraphStats>();
  for (const id of input.sceneIds) {
    out.set(id, {
      sceneId: id,
      outgoing: 0,
      incoming: 0,
      isStart: id === input.startSceneId,
      isOrphan: false,
      isDeadEnd: false,
      isUnreachable: false,
      needsPlacement: 0,
      duplicateTargets: [],
    });
  }

  // Adjacency for BFS uses only edges whose BOTH endpoints are at this
  // destination — cross-destination links count in `outgoing` (they exist and
  // the creator should see them) but are never traversed for reachability.
  const adjacency = new Map<string, string[]>();
  const targetCounts = new Map<string, Map<string, number>>();
  for (const link of input.links) {
    const from = out.get(link.fromSceneId);
    if (from) {
      from.outgoing += 1;
      if (!link.placed) from.needsPlacement += 1;
      const counts = targetCounts.get(link.fromSceneId) ?? new Map<string, number>();
      counts.set(link.toSceneId, (counts.get(link.toSceneId) ?? 0) + 1);
      targetCounts.set(link.fromSceneId, counts);
    }
    const to = out.get(link.toSceneId);
    if (to) to.incoming += 1;
    if (inSet.has(link.fromSceneId) && inSet.has(link.toSceneId)) {
      const list = adjacency.get(link.fromSceneId) ?? [];
      list.push(link.toSceneId);
      adjacency.set(link.fromSceneId, list);
    }
  }

  for (const [sceneId, counts] of targetCounts) {
    const stats = out.get(sceneId);
    if (!stats) continue;
    stats.duplicateTargets = [...counts.entries()]
      .filter(([, n]) => n > 1)
      .map(([target]) => target);
  }

  // BFS from the start for reachability.
  const visited = new Set<string>();
  if (input.startSceneId && inSet.has(input.startSceneId)) {
    const queue = [input.startSceneId];
    visited.add(input.startSceneId);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
  }

  for (const stats of out.values()) {
    stats.isOrphan = stats.incoming === 0 && !stats.isStart;
    stats.isDeadEnd = stats.outgoing === 0;
    stats.isUnreachable = input.startSceneId !== null && !visited.has(stats.sceneId);
  }
  return out;
}

/**
 * Deterministic BFS-layered layout onto a normalized 0..1 canvas.
 *
 * x = BFS depth from the start (unreachable scenes go in trailing columns),
 * y = position within the layer. Deterministic by construction — same graph,
 * same layout — so the map does not reshuffle between visits, which is the
 * failure mode that makes force-directed layouts wrong for a you-are-here map.
 * Margins keep pins inside the image. Meant as a starting arrangement the
 * creator then adjusts with the normal placement controls.
 */
export function layoutTourGraph(input: TourGraphInput): Map<string, { x: number; y: number }> {
  const inSet = new Set(input.sceneIds);
  const adjacency = new Map<string, string[]>();
  for (const link of input.links) {
    if (inSet.has(link.fromSceneId) && inSet.has(link.toSceneId)) {
      const list = adjacency.get(link.fromSceneId) ?? [];
      list.push(link.toSceneId);
      adjacency.set(link.fromSceneId, list);
    }
  }

  const depth = new Map<string, number>();
  if (input.startSceneId && inSet.has(input.startSceneId)) {
    const queue = [input.startSceneId];
    depth.set(input.startSceneId, 0);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const d = depth.get(current)!;
      for (const next of adjacency.get(current) ?? []) {
        if (depth.has(next)) continue;
        depth.set(next, d + 1);
        queue.push(next);
      }
    }
  }

  // Unreachable scenes: stable trailing column so they are visible, not lost.
  const maxDepth = Math.max(0, ...depth.values());
  for (const id of input.sceneIds) {
    if (!depth.has(id)) depth.set(id, maxDepth + 1);
  }

  const layers = new Map<number, string[]>();
  // input.sceneIds order (caller passes a stable order) decides within-layer order.
  for (const id of input.sceneIds) {
    const d = depth.get(id)!;
    const layer = layers.get(d) ?? [];
    layer.push(id);
    layers.set(d, layer);
  }

  const MARGIN = 0.1;
  const span = 1 - MARGIN * 2;
  const columnCount = layers.size;
  const positions = new Map<string, { x: number; y: number }>();
  const sortedDepths = [...layers.keys()].sort((a, b) => a - b);
  sortedDepths.forEach((d, columnIndex) => {
    const layer = layers.get(d)!;
    const x = columnCount === 1 ? 0.5 : MARGIN + (span * columnIndex) / (columnCount - 1);
    layer.forEach((id, rowIndex) => {
      const y =
        layer.length === 1 ? 0.5 : MARGIN + (span * rowIndex) / (layer.length - 1);
      positions.set(id, { x: round4(x), y: round4(y) });
    });
  });
  return positions;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
