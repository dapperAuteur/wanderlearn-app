-- Per-destination share gate. When true, the /[lang]/tours/<slug> public
-- route renders the destination's full tour (including any ?scene=<id>
-- deep-link). False by default so existing destinations stay private
-- until the creator opts them in.
ALTER TABLE "destinations" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;
