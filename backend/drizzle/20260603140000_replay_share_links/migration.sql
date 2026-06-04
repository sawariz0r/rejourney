CREATE TABLE IF NOT EXISTS "replay_share_links" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "public_id" varchar(64) NOT NULL,
    "session_id" varchar(64) NOT NULL,
    "project_id" uuid NOT NULL,
    "team_id" uuid NOT NULL,
    "created_by_user_id" uuid,
    "visibility" varchar(32) DEFAULT 'replay_only' NOT NULL,
    "expiration_preset" varchar(16) DEFAULT '7d' NOT NULL,
    "expires_at" timestamp,
    "revoked_at" timestamp,
    "last_accessed_at" timestamp,
    "access_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    CONSTRAINT "replay_share_links_public_id_unique" UNIQUE("public_id"),
    CONSTRAINT "replay_share_links_session_id_sessions_id_fk"
        FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE cascade,
    CONSTRAINT "replay_share_links_project_id_projects_id_fk"
        FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE cascade,
    CONSTRAINT "replay_share_links_team_id_teams_id_fk"
        FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE cascade,
    CONSTRAINT "replay_share_links_created_by_user_id_users_id_fk"
        FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE set null
);

CREATE INDEX IF NOT EXISTS "replay_share_links_session_idx"
    ON "replay_share_links" ("session_id", "revoked_at", "expires_at");

CREATE INDEX IF NOT EXISTS "replay_share_links_team_created_idx"
    ON "replay_share_links" ("team_id", "created_at");

CREATE INDEX IF NOT EXISTS "replay_share_links_active_reuse_idx"
    ON "replay_share_links" ("session_id", "visibility", "expiration_preset", "expires_at")
    WHERE "revoked_at" IS NULL;
