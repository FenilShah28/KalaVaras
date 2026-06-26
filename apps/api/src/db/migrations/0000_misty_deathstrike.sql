CREATE TYPE "public"."media_type" AS ENUM('source_video', 'slit_scan', 'rhythm_waveform', 'clay_scan', 'card_gif');--> statement-breakpoint
CREATE TYPE "public"."processing_status" AS ENUM('pending', 'processing', 'complete', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('artisan', 'apprentice', 'researcher', 'admin');--> statement-breakpoint
CREATE TYPE "public"."sync_action_type" AS ENUM('upload_video', 'publish_card', 'submit_practice');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending', 'syncing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."tradition" AS ENUM('warli', 'kolam', 'pichwai', 'madhubani');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('private', 'community', 'public', 'research');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource_type" varchar(100),
	"resource_id" uuid,
	"ip_address" varchar(45),
	"user_agent" text,
	"details" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"stroke_card_id" uuid,
	"type" "media_type" NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"file_size_bytes" bigint,
	"duration_seconds" real,
	"processing_status" "processing_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"apprentice_id" uuid,
	"stroke_card_id" uuid NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"deviation_score" real,
	"rhythm_accuracy" real,
	"practice_video_key" text,
	"duration_seconds" real,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stroke_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"artisan_id" uuid,
	"tradition" "tradition" NOT NULL,
	"name_marathi" varchar(200) NOT NULL,
	"name_english" varchar(200),
	"description_marathi" text,
	"description_english" text,
	"difficulty" smallint,
	"atomic_units" jsonb,
	"visibility" "visibility" DEFAULT 'community' NOT NULL,
	"published_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"user_id" uuid,
	"action_type" "sync_action_type" NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "sync_status" DEFAULT 'pending' NOT NULL,
	"created_offline_at" timestamp with time zone,
	"synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"phone" varchar(15),
	"name_marathi" varchar(100) NOT NULL,
	"name_english" varchar(100),
	"role" "user_role" NOT NULL,
	"village" varchar(100),
	"district" varchar(100) DEFAULT 'Pune',
	"traditions" text[],
	"years_experience" integer,
	"avatar_url" text,
	"consent_given_at" timestamp with time zone,
	"password_hash" varchar(255),
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verification_token" varchar(255),
	"email_verification_expires" timestamp with time zone,
	"password_reset_token" varchar(255),
	"password_reset_expires" timestamp with time zone,
	"failed_login_attempts" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_ip" varchar(45),
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_stroke_card_id_stroke_cards_id_fk" FOREIGN KEY ("stroke_card_id") REFERENCES "public"."stroke_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_apprentice_id_users_id_fk" FOREIGN KEY ("apprentice_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sessions" ADD CONSTRAINT "practice_sessions_stroke_card_id_stroke_cards_id_fk" FOREIGN KEY ("stroke_card_id") REFERENCES "public"."stroke_cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stroke_cards" ADD CONSTRAINT "stroke_cards_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stroke_cards" ADD CONSTRAINT "stroke_cards_artisan_id_users_id_fk" FOREIGN KEY ("artisan_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_queue" ADD CONSTRAINT "sync_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;