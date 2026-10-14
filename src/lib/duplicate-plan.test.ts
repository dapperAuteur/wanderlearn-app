import { describe, expect, it } from "vitest";
import { copyName, copySlug, planSceneCopy, planTourCopy } from "./duplicate-plan";

const ids = () => {
  let n = 0;
  return () => `new-${++n}`;
};
const now = new Date("2026-10-13T12:00:00Z");

describe("planSceneCopy", () => {
  const plan = planSceneCopy(
    {
      // Nullable like the real columns, so the plan's nulls type-check.
      scene: {
        id: "s1",
        name: "Lobby",
        status: "published" as string,
        publishedAt: new Date(0) as Date | null,
        mapX: 0.3 as number | null,
        mapY: 0.4 as number | null,
        orderIndex: 2 as number | null,
        startYaw: 1.2,
      },
      hotspots: [{ id: "h1", sceneId: "s1", title: "Desk", momentId: "m1" }],
      outgoingLinks: [{ id: "l1", fromSceneId: "s1", toSceneId: "s2", arrowRotation: 45 }],
      momentPhotos: [{ id: "p1", sceneId: "s1", momentId: "m1", mediaId: "x" }],
    },
    { newId: ids(), ownerId: "me", now, name: "Lobby (copy)" },
  );
  it("makes a hidden, unplaced draft owned by the duplicator, keeping the view settings", () => {
    expect(plan.scene).toMatchObject({ name: "Lobby (copy)", ownerId: "me", status: "draft", publishedAt: null, mapX: null, mapY: null, orderIndex: null, startYaw: 1.2 });
    expect(plan.scene.id).not.toBe("s1");
  });
  it("copies hotspots, outgoing links (same targets) and moment photos onto the copy", () => {
    expect(plan.hotspots[0]).toMatchObject({ sceneId: plan.scene.id, title: "Desk", momentId: "m1" });
    expect(plan.links[0]).toMatchObject({ fromSceneId: plan.scene.id, toSceneId: "s2", arrowRotation: 45 });
    expect(plan.momentPhotos[0]).toMatchObject({ sceneId: plan.scene.id, momentId: "m1", mediaId: "x" });
    expect(new Set([plan.hotspots[0].id, plan.links[0].id, plan.momentPhotos[0].id]).size).toBe(3);
  });
});

describe("planTourCopy", () => {
  const plan = planTourCopy(
    {
      destination: {
        id: "d1",
        slug: "gallery",
        name: "Gallery",
        isPublic: true as boolean,
        shareToken: "secret" as string | null,
        indexPosition: 3 as number | null,
        defaultStartSceneId: "s1" as string | null,
        peakSceneId: "s2" as string | null,
        tourLinks: [{ label: "Donate" }],
      },
      scenes: [{ id: "s1", destinationId: "d1" }, { id: "s2", destinationId: "d1" }],
      links: [
        { id: "l1", fromSceneId: "s1", toSceneId: "s2" },
        { id: "l2", fromSceneId: "s2", toSceneId: "s-not-copied" },
      ],
      hotspots: [
        { id: "h1", sceneId: "s1", momentId: "m1" },
        { id: "h2", sceneId: "s-not-copied", momentId: null },
      ],
      moments: [{ id: "m1", destinationId: "d1", label: "1998" }],
      momentPhotos: [{ id: "p1", sceneId: "s2", momentId: "m1" }],
    },
    { newId: ids(), ownerId: "me", now, slug: "gallery-copy", name: "Gallery (copy)" },
  );
  const sceneMap = new Map([["s1", plan.scenes[0].id], ["s2", plan.scenes[1].id]]);

  it("starts private, unshared and unplaced, and keeps the tour's settings", () => {
    expect(plan.destination).toMatchObject({ slug: "gallery-copy", name: "Gallery (copy)", isPublic: false, shareToken: null, indexPosition: null, tourLinks: [{ label: "Donate" }] });
  });
  it("re-points start and peak scenes at the copies", () => {
    expect(plan.destination.defaultStartSceneId).toBe(sceneMap.get("s1"));
    expect(plan.destination.peakSceneId).toBe(sceneMap.get("s2"));
  });
  it("keeps only links between copied scenes, re-pointed", () => {
    expect(plan.links).toHaveLength(1);
    expect(plan.links[0]).toMatchObject({ fromSceneId: sceneMap.get("s1"), toSceneId: sceneMap.get("s2") });
  });
  it("copies the timeline and re-points hotspots and photos at the new moments", () => {
    const m = plan.moments[0];
    expect(m).toMatchObject({ destinationId: plan.destination.id, label: "1998" });
    expect(plan.hotspots).toHaveLength(1);
    expect(plan.hotspots[0].momentId).toBe(m.id);
    expect(plan.momentPhotos[0]).toMatchObject({ sceneId: sceneMap.get("s2"), momentId: m.id });
  });
  it("gives every scene to the duplicator in the new tour", () => {
    expect(plan.scenes.every((s) => s.destinationId === plan.destination.id && s.ownerId === "me")).toBe(true);
  });
});

describe("copyName / copySlug", () => {
  it("counts up past names and slugs already taken", () => {
    expect(copyName("Lobby", "copy", new Set())).toBe("Lobby (copy)");
    expect(copyName("Lobby", "copy", new Set(["Lobby (copy)"]))).toBe("Lobby (copy 2)");
    expect(copySlug("gallery", new Set(["gallery-copy", "gallery-copy-2"]))).toBe("gallery-copy-3");
  });
});
