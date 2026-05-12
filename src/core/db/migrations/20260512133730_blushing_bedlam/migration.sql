CREATE TYPE "dm_attr" AS ENUM('Protect', 'FromLive', 'HighLike', 'Compatible', 'Reported', 'Unchecked', 'HasEvent', 'Hide');--> statement-breakpoint
CREATE TYPE "mode" AS ENUM('Normal', 'Bottom', 'Top', 'Reverse', 'Ext');--> statement-breakpoint
CREATE TYPE "pool" AS ENUM('Def', 'Sub', 'Adv', 'Ix');--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" serial PRIMARY KEY,
	"fromConverted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "danmakus" (
	"SOID" text NOT NULL,
	"chunkID" serial,
	"DMID" text,
	"progress" integer NOT NULL,
	"mode" "mode" NOT NULL,
	"fontsize" smallint NOT NULL,
	"color" integer NOT NULL,
	"senderID" text NOT NULL,
	"content" text NOT NULL,
	"ctime" timestamp NOT NULL,
	"weight" smallint NOT NULL,
	"pool" "pool" NOT NULL,
	"attr" "dm_attr"[] NOT NULL,
	"platform" text,
	"extra" jsonb,
	CONSTRAINT "danmakus_pkey" PRIMARY KEY("DMID","chunkID")
);
--> statement-breakpoint
ALTER TABLE "danmakus" ADD CONSTRAINT "danmakus_chunkID_chunks_id_fkey" FOREIGN KEY ("chunkID") REFERENCES "chunks"("id");