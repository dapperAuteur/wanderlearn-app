// Granular permissions for site_manager users. Empty / absent values
// mean "not granted" — every check defaults to deny. Only an admin
// can write to this shape (via the admin users page or the db:promote
// script with --permissions). Read by canManage() in src/lib/rbac.ts.
//
// "tours" is a separate bucket from "destinations" because BAM's mental
// model treats them as distinct surfaces, even though the data model
// today renders a tour from a destination's scenes. tours.update is
// "edit tour-render settings on a destination" (arrow color, pin
// color); destinations.update is the full destination form. Keeping
// them separate now means we don't have to migrate the permissions
// shape if tours ever become a first-class entity.

export const RESOURCES = [
  "media",
  "destinations",
  "tours",
  "courses",
  "scenes",
  "hotspots",
  "sceneLinks",
] as const;

export const ACTIONS = ["create", "read", "update", "delete", "upload"] as const;

export type Resource = (typeof RESOURCES)[number];
export type Action = (typeof ACTIONS)[number];

export type UserPermissions = Partial<Record<Resource, Partial<Record<Action, boolean>>>>;

export const EMPTY_PERMISSIONS: UserPermissions = {};

export function hasPermission(
  permissions: UserPermissions | null | undefined,
  resource: Resource,
  action: Action,
): boolean {
  if (!permissions) return false;
  return permissions[resource]?.[action] === true;
}

/**
 * Normalize untrusted JSON (admin form input, --permissions CLI flag)
 * into a UserPermissions object with only the known keys. Anything
 * unrecognized is dropped silently. Returns an empty object on
 * malformed input — never throws — so a typo can't 500 an admin save.
 */
export function sanitizePermissions(input: unknown): UserPermissions {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const out: UserPermissions = {};
  for (const resource of RESOURCES) {
    const block = (input as Record<string, unknown>)[resource];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const sanitized: Partial<Record<Action, boolean>> = {};
    for (const action of ACTIONS) {
      const value = (block as Record<string, unknown>)[action];
      if (value === true) sanitized[action] = true;
    }
    if (Object.keys(sanitized).length > 0) {
      out[resource] = sanitized;
    }
  }
  return out;
}
