-- Create game_history table to store completed game records per player
CREATE TABLE IF NOT EXISTS "public"."game_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  "user_id" uuid NOT NULL REFERENCES "auth"."users" ("id") ON DELETE CASCADE,
  "played_at" timestamptz NOT NULL DEFAULT now (),
  "my_role" text NOT NULL, -- Role the user played e.g. 'Merlin'
  "did_win" boolean NOT NULL,
  "player_count" int NOT NULL,
  "duration_ms" bigint, -- null if timing data unavailable
  "room_snapshot" jsonb NOT NULL -- full sanitized Room object for replaying GameOverScreen
);

ALTER TABLE "public"."game_history" OWNER TO "postgres";

COMMENT ON TABLE "public"."game_history" IS 'Completed game history records, one row per human player per game';

-- Indexes
CREATE INDEX "game_history_user_id_played_at_idx" ON "public"."game_history" ("user_id", "played_at" DESC);

-- Row-level security
ALTER TABLE "public"."game_history" ENABLE ROW LEVEL SECURITY;

-- Users can only read their own history rows
CREATE POLICY "Users can view own game history" ON "public"."game_history" FOR
SELECT
  TO "authenticated" USING (
    (
      SELECT
        auth.uid ()
    ) = "user_id"
  );

-- Only the service role (server) may insert
CREATE POLICY "Service role can insert game history" ON "public"."game_history" FOR INSERT TO "service_role"
WITH
  CHECK (true);

-- Grant table access
GRANT
SELECT
  ON TABLE "public"."game_history" TO "authenticated";

GRANT ALL ON TABLE "public"."game_history" TO "service_role";
