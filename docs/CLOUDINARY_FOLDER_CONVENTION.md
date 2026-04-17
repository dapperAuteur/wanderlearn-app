# Cloudinary folder + tag convention (ecosystem)

Wanderlearn and Fly.WitUS share a single Cloudinary tenant. Other WitUS
apps may join later. Without a convention, the tenant becomes a
free-for-all: one app can overwrite another's `public_id`, the
support-attachment folder gets mixed with learner-facing media, and
webhook consumers can't tell which app owns a given upload.

This doc defines the top-level namespace each app owns, the sub-folder
layout inside each namespace, the `public_id` rule, the `context`
metadata keys every upload must set, and the tagging pattern for
cross-cutting queries.

**Status:** draft, adopted by Wanderlearn. Fly.WitUS v3 spec should
import this doc by reference before shipping its upload pipeline.

---

## 1. Top-level namespace (one per app)

Every Cloudinary asset lives under exactly one top-level folder. The
top-level folder names the owning app. No app reads or writes outside
its own top-level folder without an explicit integration contract.

| Prefix | Owner | Notes |
|---|---|---|
| `wanderlearn/` | Wanderlearn | Courses, destinations, scenes, support attachments |
| `bvc/` | Fly.WitUS | BVC (Before-Visiting Checklist) drone footage + mission photos |
| `tour/` | Tour Manager OS | Reserved. EPK media + stage plots when Tour ships to Cloudinary |
| `cent/` | CentenarianOS | Reserved. Academy lesson media if Academy moves to Cloudinary |

**Reserved prefixes** are placeholders — those apps are not on
Cloudinary yet, but claiming the namespace now prevents a collision
later.

**Why not one shared `media/` prefix?** Because webhook consumers need
an O(1) check to know whether an upload is theirs. Prefix match is the
cheapest possible dispatch. A shared prefix would force every consumer
to parse deeper context to filter.

---

## 2. Sub-folder layout (inside each app's namespace)

Each app decides its own sub-folders. Wanderlearn uses:

| Path | What lives here |
|---|---|
| `wanderlearn/media` | Default bucket for all learner-facing media — photos, videos, 360° captures, drone footage, audio |
| `wanderlearn/transcripts` | Text tracks attached to videos (VTT, SRT, etc.) |
| `wanderlearn/support` | Support-chat attachments (screenshots, screen recordings) — not learner-facing, shorter TTL is fine |

This is implemented in [src/lib/cloudinary-urls.ts](src/lib/cloudinary-urls.ts) (`folderFor(kind)`).
Adding a new sub-folder means editing that one function and no other
code paths.

**Rule of thumb:** a sub-folder earns its own path only if it has a
distinct lifecycle, retention policy, or access pattern. Don't create
sub-folders per-course or per-user — those dimensions belong in tags
or in the DB row, not the folder tree.

### Fly.WitUS sub-folder proposal (not binding until Fly.WitUS v3 adopts)

| Path | Purpose |
|---|---|
| `bvc/missions` | Raw mission photos + video (drone + handheld) |
| `bvc/reports` | Generated PDFs, flight logs, filed reports |
| `bvc/shared-with-wanderlearn` | Inbox folder whose contents Wanderlearn's webhook picks up (see §6) |

Fly.WitUS should confirm or amend these when it starts wiring Cloudinary.

---

## 3. `public_id` rule

The `public_id` is the DB row id of the owning app's media table.

- Wanderlearn: `media_assets.id` (uuid v4).
- Fly.WitUS: its media table id. Whatever it is, must be globally
  unique.

Why the row id and not a filename? Filenames aren't unique, aren't
stable under rename, and leak user-typed content into URLs. The row id
is opaque, stable, unique, and lets every webhook consumer look up the
DB row in a single indexed query.

The full stored identifier becomes
`<namespace>/<subfolder>/<row-id>`. Example:

```
wanderlearn/media/7f2c3b18-9e4d-4c2e-9a5e-12c7e8b4d9aa
```

Apps MUST NOT reuse `public_id` across deletes — Cloudinary enforces
uniqueness per folder, but re-using a deleted id across apps
(especially under a shared sub-folder) is asking for cache-invalidation
bugs. Pick a new uuid on re-upload.

---

## 4. `context` metadata (required on every upload)

Every upload sets three `context` keys. These travel with the asset in
the webhook payload and in the admin UI, so every consumer can filter
without re-fetching the DB.

| Key | Value | Example |
|---|---|---|
| `app` | Owning app's short slug (matches the top-level folder without the trailing slash) | `wanderlearn`, `bvc` |
| `type` | Domain kind, app-specific | `photo_360`, `video_360`, `standard_video`, `transcript`, `mission_raw` |
| `owner_id` | DB user id of the uploader (server-derived, not client-trusted) | `u_3f2c…` |

Wanderlearn currently sets `type` (see `signUpload` in [src/lib/cloudinary.ts](src/lib/cloudinary.ts)).
Adding `app` + `owner_id` is a follow-up when the Fly.WitUS integration
starts — harmless before then.

**Why not also store `course_id` / `mission_id`?** Those change over
time (a media asset can move between courses). Keep `context` to the
append-only facts about the upload itself. Mutable joins belong in the
DB.

---

## 5. Tags (optional, for cross-cutting queries)

Cloudinary tags are the only searchable attribute in the free tier
outside of folders. Use them for queries that span folders or apps.

**Shape:** lowercase, colon-namespaced. No spaces.

| Tag | When to apply |
|---|---|
| `app:wanderlearn` | Every Wanderlearn upload. Lets admin filter across sub-folders |
| `app:bvc` | Every Fly.WitUS upload |
| `shared:wanderlearn` | Fly.WitUS sets this on footage it intends Wanderlearn to pick up (alternative to the `bvc/shared-with-wanderlearn` folder) |
| `env:production` / `env:preview` / `env:development` | Set automatically by the signer based on `process.env.VERCEL_ENV` |

The `env:` tag is the one that prevents preview uploads from
masquerading as production assets in the shared dashboard. Without it,
you can't reliably clean preview-deploy junk.

---

## 6. Cross-app hand-off: BVC footage → Wanderlearn (planned)

The only cross-app data flow currently planned. Documenting the
contract here so Fly.WitUS and Wanderlearn can implement against the
same spec without coordination meetings.

1. **Fly.WitUS uploads** a BVC mission asset under
   `bvc/missions/<fly-row-id>` with `context` keys
   `app=bvc, type=mission_raw, owner_id=<fly-user-id>` and tags
   `app:bvc, env:<env>`.
2. **Fly.WitUS pushes** a mission to Wanderlearn by copying (or
   tagging) the asset into `bvc/shared-with-wanderlearn/<fly-row-id>`
   AND adding tag `shared:wanderlearn`. Copy vs. tag is Fly.WitUS's
   call — both work.
3. **Wanderlearn's webhook** (`/api/webhooks/cloudinary`) already
   verifies signatures. The handler will extend to:
   - short-circuit if the folder starts with `bvc/` AND the tag
     `shared:wanderlearn` is absent (not meant for us — ignore);
   - if shared, insert a row in `media_assets` with
     `provider='cloudinary'`, `status='ready'`, the Cloudinary
     `public_id`, a reference back to Fly.WitUS via a new
     `external_source` column (`{ app: "bvc", id: "<fly-row-id>" }`).
4. **The Wanderlearn creator** sees the asset in their media library
   flagged as "imported from Fly.WitUS" and can attach it to a course
   the same way as any other asset.

Wanderlearn never writes into `bvc/`. Fly.WitUS never writes into
`wanderlearn/`. The only cross-app surface is the shared-intent tag
and the inbox sub-folder.

---

## 7. Retention + cleanup

- **Wanderlearn**: no automatic deletion. Creators delete via the
  media library UI, which marks the row `deletedAt` in the DB AND
  deletes the Cloudinary asset.
- **Preview / dev environments**: every preview deploy's uploads are
  tagged `env:preview`. A nightly admin job (not yet built) can purge
  anything older than 7 days with `env:preview`.
- **Support-chat attachments** (`wanderlearn/support/…`): 90-day TTL
  once the thread is resolved. Deleted from Cloudinary AND the DB.

Fly.WitUS retention is Fly.WitUS's call, but same pattern applies:
tag preview uploads so they can be reaped.

---

## 8. Signer enforcement (Wanderlearn)

The sign endpoint ([src/app/api/media/cloudinary-sign/route.ts](src/app/api/media/cloudinary-sign/route.ts))
already locks every upload to a `wanderlearn/…` folder because
`folderFor(kind)` is the only source of the `folder` param in the
signed request. Cloudinary rejects any upload whose runtime `folder`
doesn't match the signed value.

This means a compromised Wanderlearn client CANNOT upload into `bvc/`
or any other app's namespace without a new signature from Fly.WitUS's
own signer. Signer-scoped folder enforcement is the security guarantee
that makes the shared-tenant model safe.

When `app` + `owner_id` context keys ship (§4), they'll also be
included in the signed params, so a client can't spoof them either.

---

## 9. Checklist for new apps joining the tenant

Before an app writes its first Cloudinary asset in the shared tenant:

- [ ] Choose a top-level folder prefix. Update §1 in this doc via PR.
- [ ] Define sub-folders. Update §2 in this doc.
- [ ] Signer hard-codes the folder prefix — never accept it from
      client input.
- [ ] Upload's `public_id` is the app's DB row id.
- [ ] `context` sets at least `app`, `type`, `owner_id`.
- [ ] Every upload tagged `app:<slug>` and `env:<env>`.
- [ ] If the app will push content to another app, agree on a
      `shared:<target>` tag or an inbox sub-folder. Document it in §6.
- [ ] Webhook consumer short-circuits on prefix + tag before touching
      the DB.

---

## 10. What this doc does NOT cover

- **Pricing / plan limits**: tracked in the account billing, not here.
- **Delivery-URL transforms** (`f_auto,q_auto,w_…`): see the
  per-kind helpers in [src/lib/cloudinary-urls.ts](src/lib/cloudinary-urls.ts).
- **Upload-signing mechanics**: see [docs/CLOUDINARY_SETUP.md](docs/CLOUDINARY_SETUP.md) §3.
- **Per-app schema for `media_assets`-style tables**: that's each
  app's own DB concern; the only ecosystem contract is the `public_id`
  rule in §3.
