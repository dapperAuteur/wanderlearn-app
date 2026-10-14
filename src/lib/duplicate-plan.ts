/**
 * Pure plans for "Duplicate scene" and "Duplicate tour": given the source rows,
 * the rows to insert, with fresh ids and every reference re-pointed at the copy.
 *
 * Rows are copied by spreading the source and overriding only what must differ,
 * so a column added later (hotspot media, say) is carried over without anyone
 * remembering to add it here. Anything that must NOT carry over is overridden
 * explicitly below, with the reason.
 */

type Ids = { newId: () => string; ownerId: string; now: Date };

export function planSceneCopy<
  S extends { id: string; name: string },
  H extends { id: string; sceneId: string },
  L extends { id: string; fromSceneId: string },
  P extends { id: string; sceneId: string },
>(
  src: { scene: S; hotspots: H[]; outgoingLinks: L[]; momentPhotos: P[] },
  opts: Ids & { name: string },
) {
  const sceneId = opts.newId();
  return {
    scene: {
      ...src.scene,
      id: sceneId,
      name: opts.name,
      ownerId: opts.ownerId,
      // A copy is work in progress: hidden until its creator publishes it.
      status: "draft" as const,
      publishedAt: null,
      // Not placed on the floor plan or in the explicit order: it would sit on
      // top of the original's pin and share its stop number.
      mapX: null,
      mapY: null,
      orderIndex: null,
      createdAt: opts.now,
      updatedAt: opts.now,
    },
    hotspots: src.hotspots.map((h) => ({ ...h, id: opts.newId(), sceneId, createdAt: opts.now, updatedAt: opts.now })),
    // Same doorways out (same panorama, same positions). Links INTO the original
    // are not copied: which door should lead to the copy is the creator's call.
    links: src.outgoingLinks.map((l) => ({ ...l, id: opts.newId(), fromSceneId: sceneId, createdAt: opts.now })),
    momentPhotos: src.momentPhotos.map((p) => ({ ...p, id: opts.newId(), sceneId, createdAt: opts.now, updatedAt: opts.now })),
  };
}

export function planTourCopy<
  D extends { id: string; defaultStartSceneId: string | null; peakSceneId: string | null },
  S extends { id: string },
  L extends { id: string; fromSceneId: string; toSceneId: string },
  H extends { id: string; sceneId: string; momentId: string | null },
  M extends { id: string },
  P extends { id: string; sceneId: string; momentId: string },
>(
  src: { destination: D; scenes: S[]; links: L[]; hotspots: H[]; moments: M[]; momentPhotos: P[] },
  opts: Ids & { slug: string; name: string },
) {
  const destinationId = opts.newId();
  const sceneIds = new Map(src.scenes.map((s) => [s.id, opts.newId()] as const));
  const momentIds = new Map(src.moments.map((m) => [m.id, opts.newId()] as const));
  const sceneOf = (id: string | null) => (id ? (sceneIds.get(id) ?? null) : null);

  return {
    destination: {
      ...src.destination,
      id: destinationId,
      slug: opts.slug,
      name: opts.name,
      // The copy starts private, unshared and unplaced on /tours, whatever the original was.
      isPublic: false,
      shareToken: null,
      indexPosition: null,
      defaultStartSceneId: sceneOf(src.destination.defaultStartSceneId),
      peakSceneId: sceneOf(src.destination.peakSceneId),
      createdAt: opts.now,
      updatedAt: opts.now,
    },
    moments: src.moments.map((m) => ({ ...m, id: momentIds.get(m.id)!, destinationId, createdAt: opts.now, updatedAt: opts.now })),
    scenes: src.scenes.map((s) => ({
      ...s,
      id: sceneIds.get(s.id)!,
      destinationId,
      ownerId: opts.ownerId,
      createdAt: opts.now,
      updatedAt: opts.now,
    })),
    // Only links between copied scenes; one to a scene left behind would be an
    // arrow into another tour.
    links: src.links
      .filter((l) => sceneIds.has(l.fromSceneId) && sceneIds.has(l.toSceneId))
      .map((l) => ({ ...l, id: opts.newId(), fromSceneId: sceneIds.get(l.fromSceneId)!, toSceneId: sceneIds.get(l.toSceneId)!, createdAt: opts.now })),
    hotspots: src.hotspots
      .filter((h) => sceneIds.has(h.sceneId))
      .map((h) => ({
        ...h,
        id: opts.newId(),
        sceneId: sceneIds.get(h.sceneId)!,
        momentId: h.momentId ? (momentIds.get(h.momentId) ?? null) : null,
        createdAt: opts.now,
        updatedAt: opts.now,
      })),
    momentPhotos: src.momentPhotos
      .filter((p) => sceneIds.has(p.sceneId) && momentIds.has(p.momentId))
      .map((p) => ({ ...p, id: opts.newId(), sceneId: sceneIds.get(p.sceneId)!, momentId: momentIds.get(p.momentId)!, createdAt: opts.now, updatedAt: opts.now })),
  };
}

/** "Patina Gallery (copy)", then "(copy 2)", … against names already taken. */
export function copyName(name: string, suffix: string, taken: ReadonlySet<string>): string {
  const first = `${name} (${suffix})`;
  if (!taken.has(first)) return first;
  for (let n = 2; n < 1000; n++) {
    const next = `${name} (${suffix} ${n})`;
    if (!taken.has(next)) return next;
  }
  return `${name} (${suffix} ${Date.now()})`;
}

/** "patina-gallery-copy", then "-copy-2", … against slugs already taken. */
export function copySlug(slug: string, taken: ReadonlySet<string>): string {
  const first = `${slug}-copy`;
  if (!taken.has(first)) return first;
  for (let n = 2; n < 1000; n++) {
    if (!taken.has(`${first}-${n}`)) return `${first}-${n}`;
  }
  return `${first}-${Date.now()}`;
}
