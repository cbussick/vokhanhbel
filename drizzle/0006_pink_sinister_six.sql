CREATE TABLE "audio_playback_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_hash" text NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audio_playback_attempts_session_time_idx" ON "audio_playback_attempts" USING btree ("session_hash","attempted_at");