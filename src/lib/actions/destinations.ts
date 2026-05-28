"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { isDestinationLinkable } from "@/db/queries/destinations";
import { requireCreator } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { normalizeTourColor } from "@/lib/tour-styling";
import type { Locale } from "@/lib/locales";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const coordinateSchema = z
  .union([z.string().length(0), z.coerce.number()])
  .optional()
  .transform((v) => (typeof v === "number" ? v.toString() : undefined));

const createSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  lat: coordinateSchema,
  lng: coordinateSchema,
  description: z.string().max(2000).optional(),
  website: z
    .union([z.string().url().max(500), z.string().length(0)])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  // Already normalized by parseFormData (preset hex or null). The schema
  // just gates on shape; the normalize helper enforces preset membership.
  tourArrowColor: z.string().nullable().optional(),
  tourPinColor: z.string().nullable().optional(),
  lang: z.enum(["en", "es"]),
});

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  lang: z.enum(["en", "es"]),
});

const replaceHeroSchema = z.object({
  id: z.string().uuid(),
  heroMediaId: z.string().uuid().nullable(),
  lang: z.enum(["en", "es"]),
});

const replaceProfileSchema = z.object({
  id: z.string().uuid(),
  profileMediaId: z.string().uuid().nullable(),
  lang: z.enum(["en", "es"]),
});

const replacePinIconSchema = z.object({
  id: z.string().uuid(),
  pinIconMediaId: z.string().uuid().nullable(),
  lang: z.enum(["en", "es"]),
});

const replaceTourArrowSchema = z.object({
  id: z.string().uuid(),
  tourArrowMediaId: z.string().uuid().nullable(),
  lang: z.enum(["en", "es"]),
});

const setPublicSchema = z.object({
  id: z.string().uuid(),
  isPublic: z.boolean(),
  lang: z.enum(["en", "es"]),
});

const setCreatorAllowExternalLinkingSchema = z.object({
  value: z.boolean(),
  lang: z.enum(["en", "es"]),
});

const setDestinationAllowExternalLinkingOverrideSchema = z.object({
  id: z.string().uuid(),
  // null = inherit account default, true/false = per-destination override
  value: z.boolean().nullable(),
  lang: z.enum(["en", "es"]),
});

const setDestinationNextDestinationSchema = z.object({
  id: z.string().uuid(),
  nextDestinationId: z.string().uuid().nullable(),
  lang: z.enum(["en", "es"]),
});

const setDefaultStartSceneSchema = z.object({
  id: z.string().uuid(),
  // `null` (empty form value) means "auto" — clear the override and
  // fall back to oldest-scene-by-createdAt at tour-assembly time.
  defaultStartSceneId: z.string().uuid().nullable(),
  lang: z.enum(["en", "es"]),
});

function parseFormData(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim() || undefined,
    country: String(formData.get("country") ?? "").trim() || undefined,
    city: String(formData.get("city") ?? "").trim() || undefined,
    lat: String(formData.get("lat") ?? "").trim(),
    lng: String(formData.get("lng") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    website: String(formData.get("website") ?? "").trim(),
    tourArrowColor: normalizeTourColor(String(formData.get("tourArrowColor") ?? "")),
    tourPinColor: normalizeTourColor(String(formData.get("tourPinColor") ?? "")),
    lang: String(formData.get("lang") ?? "en") as Locale,
  };
}

export async function createDestination(formData: FormData): Promise<Result<{ id: string }>> {
  const parsed = createSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireCreator(parsed.data.lang);

  const slug = parsed.data.slug ?? slugify(parsed.data.name);
  if (!slug) {
    return { ok: false, error: "Name is too short for a slug", code: "invalid_slug" };
  }

  const [row] = await db
    .insert(schema.destinations)
    .values({
      slug,
      name: parsed.data.name,
      country: parsed.data.country,
      city: parsed.data.city,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      description: parsed.data.description,
      website: parsed.data.website,
      tourArrowColor: parsed.data.tourArrowColor ?? null,
      tourPinColor: parsed.data.tourPinColor ?? null,
    })
    .returning({ id: schema.destinations.id });

  if (!row) {
    return { ok: false, error: "Failed to create destination", code: "db_insert_failed" };
  }

  revalidatePath(`/${parsed.data.lang}/creator/destinations`);
  return { ok: true, data: { id: row.id } };
}

export async function updateDestination(formData: FormData): Promise<Result<{ id: string }>> {
  const body = { ...parseFormData(formData), id: String(formData.get("id") ?? "") };
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireCreator(parsed.data.lang);

  const slug = parsed.data.slug ?? slugify(parsed.data.name);

  await db
    .update(schema.destinations)
    .set({
      slug,
      name: parsed.data.name,
      country: parsed.data.country,
      city: parsed.data.city,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      description: parsed.data.description,
      website: parsed.data.website ?? null,
      tourArrowColor: parsed.data.tourArrowColor ?? null,
      tourPinColor: parsed.data.tourPinColor ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.destinations.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/destinations`);
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}`);
  // Public tour route caches RSC; without this revalidation a styling
  // edit doesn't surface to the live tour page until the next deploy.
  revalidatePath(`/${parsed.data.lang}/tours/${slug}`);
  return { ok: true, data: { id: parsed.data.id } };
}

export async function replaceDestinationHeroMedia(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const rawHero = String(formData.get("heroMediaId") ?? "");
  const parsed = replaceHeroSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    heroMediaId: rawHero.length > 0 ? rawHero : null,
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  if (parsed.data.heroMediaId) {
    const [mediaRow] = await db
      .select({
        id: schema.mediaAssets.id,
        kind: schema.mediaAssets.kind,
        status: schema.mediaAssets.status,
      })
      .from(schema.mediaAssets)
      .where(
        and(
          eq(schema.mediaAssets.id, parsed.data.heroMediaId),
          eq(schema.mediaAssets.ownerId, user.id),
          isNull(schema.mediaAssets.deletedAt),
        ),
      )
      .limit(1);

    if (!mediaRow) {
      return {
        ok: false,
        error: "Hero media not found or not owned by you",
        code: "media_not_found",
      };
    }
    if (mediaRow.status !== "ready") {
      return { ok: false, error: "Hero media is still processing", code: "media_not_ready" };
    }
    if (mediaRow.kind !== "image" && mediaRow.kind !== "photo_360") {
      return {
        ok: false,
        error: "Hero media must be an image or 360° photo",
        code: "invalid_media_kind",
      };
    }
  }

  await db
    .update(schema.destinations)
    .set({
      heroMediaId: parsed.data.heroMediaId,
      updatedAt: new Date(),
    })
    .where(eq(schema.destinations.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}`);
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}/edit`);
  return { ok: true, data: { id: parsed.data.id } };
}

/**
 * Per-destination profile / card-thumbnail picker. Same eligibility
 * rules as the hero media (creator-owned, ready, image or photo_360);
 * renders on narrow-card surfaces (tours catalog, search results,
 * future map popups) that benefit from a portrait/square crop
 * separate from the wide hero on the detail page.
 */
export async function replaceDestinationProfileMedia(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const rawProfile = String(formData.get("profileMediaId") ?? "");
  const parsed = replaceProfileSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    profileMediaId: rawProfile.length > 0 ? rawProfile : null,
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  if (parsed.data.profileMediaId) {
    const [mediaRow] = await db
      .select({
        id: schema.mediaAssets.id,
        kind: schema.mediaAssets.kind,
        status: schema.mediaAssets.status,
      })
      .from(schema.mediaAssets)
      .where(
        and(
          eq(schema.mediaAssets.id, parsed.data.profileMediaId),
          eq(schema.mediaAssets.ownerId, user.id),
          isNull(schema.mediaAssets.deletedAt),
        ),
      )
      .limit(1);

    if (!mediaRow) {
      return { ok: false, error: "Profile media not found or not owned by you", code: "media_not_found" };
    }
    if (mediaRow.status !== "ready") {
      return { ok: false, error: "Profile media is still processing", code: "media_not_ready" };
    }
    if (mediaRow.kind !== "image" && mediaRow.kind !== "photo_360") {
      return { ok: false, error: "Profile media must be an image or 360° photo", code: "invalid_media_kind" };
    }
  }

  const [destRow] = await db
    .select({ slug: schema.destinations.slug })
    .from(schema.destinations)
    .where(eq(schema.destinations.id, parsed.data.id))
    .limit(1);

  await db
    .update(schema.destinations)
    .set({
      profileMediaId: parsed.data.profileMediaId,
      updatedAt: new Date(),
    })
    .where(eq(schema.destinations.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}`);
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}/edit`);
  revalidatePath(`/${parsed.data.lang}/tours`);
  if (destRow?.slug) {
    revalidatePath(`/${parsed.data.lang}/tours/${destRow.slug}`);
  }
  return { ok: true, data: { id: parsed.data.id } };
}

export async function replaceDestinationPinIcon(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const rawIcon = String(formData.get("pinIconMediaId") ?? "");
  const parsed = replacePinIconSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    pinIconMediaId: rawIcon.length > 0 ? rawIcon : null,
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  if (parsed.data.pinIconMediaId) {
    const [mediaRow] = await db
      .select({
        id: schema.mediaAssets.id,
        kind: schema.mediaAssets.kind,
        status: schema.mediaAssets.status,
      })
      .from(schema.mediaAssets)
      .where(
        and(
          eq(schema.mediaAssets.id, parsed.data.pinIconMediaId),
          eq(schema.mediaAssets.ownerId, user.id),
          isNull(schema.mediaAssets.deletedAt),
        ),
      )
      .limit(1);

    if (!mediaRow) {
      return {
        ok: false,
        error: "Pin icon media not found or not owned by you",
        code: "media_not_found",
      };
    }
    if (mediaRow.status !== "ready") {
      return { ok: false, error: "Pin icon media is still processing", code: "media_not_ready" };
    }
    // Restrict to flat images. photo_360 panoramas are huge equirectangular
    // files and would render as a tiny smear at marker scale; screenshots
    // live in a separate folder by convention.
    if (mediaRow.kind !== "image") {
      return {
        ok: false,
        error: "Pin icon must be a flat image",
        code: "invalid_media_kind",
      };
    }
  }

  const [destRow] = await db
    .select({ slug: schema.destinations.slug })
    .from(schema.destinations)
    .where(eq(schema.destinations.id, parsed.data.id))
    .limit(1);

  await db
    .update(schema.destinations)
    .set({
      pinIconMediaId: parsed.data.pinIconMediaId,
      updatedAt: new Date(),
    })
    .where(eq(schema.destinations.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}`);
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}/edit`);
  if (destRow?.slug) {
    revalidatePath(`/${parsed.data.lang}/tours/${destRow.slug}`);
  }
  return { ok: true, data: { id: parsed.data.id } };
}

export async function replaceDestinationTourArrow(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const rawArrow = String(formData.get("tourArrowMediaId") ?? "");
  const parsed = replaceTourArrowSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    tourArrowMediaId: rawArrow.length > 0 ? rawArrow : null,
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  if (parsed.data.tourArrowMediaId) {
    const [mediaRow] = await db
      .select({
        id: schema.mediaAssets.id,
        kind: schema.mediaAssets.kind,
        status: schema.mediaAssets.status,
      })
      .from(schema.mediaAssets)
      .where(
        and(
          eq(schema.mediaAssets.id, parsed.data.tourArrowMediaId),
          eq(schema.mediaAssets.ownerId, user.id),
          isNull(schema.mediaAssets.deletedAt),
        ),
      )
      .limit(1);

    if (!mediaRow) {
      return {
        ok: false,
        error: "Tour arrow media not found or not owned by you",
        code: "media_not_found",
      };
    }
    if (mediaRow.status !== "ready") {
      return {
        ok: false,
        error: "Tour arrow media is still processing",
        code: "media_not_ready",
      };
    }
    // Same constraint as pinIcon: flat images only. Equirectangular
    // photos render as a smear at arrow scale; transparent SVG/PNG is
    // what the renderer expects.
    if (mediaRow.kind !== "image") {
      return {
        ok: false,
        error: "Tour arrow must be a flat image",
        code: "invalid_media_kind",
      };
    }
  }

  const [destRow] = await db
    .select({ slug: schema.destinations.slug })
    .from(schema.destinations)
    .where(eq(schema.destinations.id, parsed.data.id))
    .limit(1);

  await db
    .update(schema.destinations)
    .set({
      tourArrowMediaId: parsed.data.tourArrowMediaId,
      updatedAt: new Date(),
    })
    .where(eq(schema.destinations.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}`);
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}/edit`);
  if (destRow?.slug) {
    revalidatePath(`/${parsed.data.lang}/tours/${destRow.slug}`);
  }
  return { ok: true, data: { id: parsed.data.id } };
}

export async function setDestinationPublic(
  formData: FormData,
): Promise<Result<{ id: string; isPublic: boolean }>> {
  const parsed = setPublicSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    isPublic: String(formData.get("isPublic") ?? "") === "true",
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireCreator(parsed.data.lang);

  const [row] = await db
    .update(schema.destinations)
    .set({ isPublic: parsed.data.isPublic, updatedAt: new Date() })
    .where(eq(schema.destinations.id, parsed.data.id))
    .returning({ slug: schema.destinations.slug });

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}`);
  // Flipping the public flag changes whether /tours/<slug> 404s or
  // renders, so the cached page must be invalidated either way.
  if (row?.slug) {
    revalidatePath(`/${parsed.data.lang}/tours/${row.slug}`);
  }
  return { ok: true, data: { id: parsed.data.id, isPublic: parsed.data.isPublic } };
}

export async function setDestinationDefaultStartScene(
  formData: FormData,
): Promise<Result<{ id: string; defaultStartSceneId: string | null }>> {
  const rawScene = String(formData.get("defaultStartSceneId") ?? "");
  const parsed = setDefaultStartSceneSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    defaultStartSceneId: rawScene.length > 0 ? rawScene : null,
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireCreator(parsed.data.lang);

  // Guard: a scene set as the destination's default must actually live
  // at that destination. Mismatch would otherwise let a creator point
  // a public tour at an unrelated scene (cross-destination leak) — or
  // at a since-deleted scene the FK ON DELETE SET NULL hasn't cleared
  // yet (e.g., between request and write).
  if (parsed.data.defaultStartSceneId) {
    const [sceneRow] = await db
      .select({ id: schema.scenes.id })
      .from(schema.scenes)
      .where(
        and(
          eq(schema.scenes.id, parsed.data.defaultStartSceneId),
          eq(schema.scenes.destinationId, parsed.data.id),
        ),
      )
      .limit(1);
    if (!sceneRow) {
      return {
        ok: false,
        error: "Selected scene does not belong to this destination",
        code: "scene_mismatch",
      };
    }
  }

  const [row] = await db
    .update(schema.destinations)
    .set({
      defaultStartSceneId: parsed.data.defaultStartSceneId,
      updatedAt: new Date(),
    })
    .where(eq(schema.destinations.id, parsed.data.id))
    .returning({ slug: schema.destinations.slug });

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}`);
  if (row?.slug) {
    revalidatePath(`/${parsed.data.lang}/tours/${row.slug}`);
  }
  return {
    ok: true,
    data: { id: parsed.data.id, defaultStartSceneId: parsed.data.defaultStartSceneId },
  };
}

/**
 * Cross-tour linking: account-level opt-in. When true, other creators
 * can link to this user's public destinations from their own tours
 * (subject to per-destination override). The destination override
 * (allowExternalLinkingOverride) inherits from this when null.
 */
export async function setCreatorAllowExternalLinking(
  formData: FormData,
): Promise<Result<{ value: boolean }>> {
  const parsed = setCreatorAllowExternalLinkingSchema.safeParse({
    value: String(formData.get("value") ?? "") === "true",
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  await db
    .update(schema.users)
    .set({
      allowExternalLinkingDefault: parsed.data.value,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, user.id));

  revalidatePath(`/${parsed.data.lang}/account`);
  revalidatePath(`/${parsed.data.lang}/creator`);
  return { ok: true, data: { value: parsed.data.value } };
}

/**
 * Cross-tour linking: per-destination override. Null clears the
 * override (back to account default). True/false explicitly allows or
 * blocks external linking for this destination regardless of the
 * account default.
 */
export async function setDestinationAllowExternalLinkingOverride(
  formData: FormData,
): Promise<Result<{ id: string; value: boolean | null }>> {
  const rawValue = String(formData.get("value") ?? "");
  const value =
    rawValue === "" || rawValue === "null"
      ? null
      : rawValue === "true";
  const parsed = setDestinationAllowExternalLinkingOverrideSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    value,
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireCreator(parsed.data.lang);

  const [row] = await db
    .update(schema.destinations)
    .set({
      allowExternalLinkingOverride: parsed.data.value,
      updatedAt: new Date(),
    })
    .where(eq(schema.destinations.id, parsed.data.id))
    .returning({ slug: schema.destinations.slug });

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}`);
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}/edit`);
  if (row?.slug) {
    revalidatePath(`/${parsed.data.lang}/tours/${row.slug}`);
  }
  return { ok: true, data: { id: parsed.data.id, value: parsed.data.value } };
}

/**
 * Cross-tour linking: destination-level "next tour" CTA target.
 * Validates target ≠ self AND target is currently linkable per the
 * isLinkable rule (owner's account default with per-destination
 * override). Null clears the CTA.
 */
export async function setDestinationNextDestination(
  formData: FormData,
): Promise<Result<{ id: string; nextDestinationId: string | null }>> {
  const rawTarget = String(formData.get("nextDestinationId") ?? "");
  const parsed = setDestinationNextDestinationSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    nextDestinationId: rawTarget.length > 0 ? rawTarget : null,
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireCreator(parsed.data.lang);

  if (parsed.data.nextDestinationId === parsed.data.id) {
    return {
      ok: false,
      error: "A tour cannot point its CTA at itself",
      code: "self_reference",
    };
  }

  if (parsed.data.nextDestinationId) {
    // Resolve isLinkable via the shared helper — handles multi-creator
    // destinations correctly (bool_or across scene owners) and applies
    // override semantics. Block the write if the target isn't linkable.
    const linkable = await isDestinationLinkable(parsed.data.nextDestinationId);
    if (!linkable) {
      return {
        ok: false,
        error: "Target destination is not currently linkable from external tours",
        code: "target_not_linkable",
      };
    }
  }

  const [row] = await db
    .update(schema.destinations)
    .set({
      nextDestinationId: parsed.data.nextDestinationId,
      updatedAt: new Date(),
    })
    .where(eq(schema.destinations.id, parsed.data.id))
    .returning({ slug: schema.destinations.slug });

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}`);
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}/edit`);
  if (row?.slug) {
    revalidatePath(`/${parsed.data.lang}/tours/${row.slug}`);
  }
  return {
    ok: true,
    data: { id: parsed.data.id, nextDestinationId: parsed.data.nextDestinationId },
  };
}

export async function deleteDestination(formData: FormData): Promise<Result<null>> {
  const parsed = deleteSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireCreator(parsed.data.lang);

  await db.delete(schema.destinations).where(eq(schema.destinations.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/destinations`);
  return { ok: true, data: null };
}
