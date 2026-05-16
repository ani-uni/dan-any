CREATE TABLE "chunk_danmakus" (
	"id" bigserial PRIMARY KEY,
	"chunkID" integer NOT NULL,
	"DMID" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "danmakus" DROP CONSTRAINT "danmakus_chunkID_chunks_id_fkey";--> statement-breakpoint
ALTER TABLE "danmakus" DROP COLUMN "chunkID";--> statement-breakpoint
ALTER TABLE "danmakus" ADD PRIMARY KEY ("DMID");--> statement-breakpoint
ALTER TABLE "chunk_danmakus" ADD CONSTRAINT "chunk_danmakus_chunkID_chunks_id_fkey" FOREIGN KEY ("chunkID") REFERENCES "chunks"("id");--> statement-breakpoint
ALTER TABLE "chunk_danmakus" ADD CONSTRAINT "chunk_danmakus_DMID_danmakus_DMID_fkey" FOREIGN KEY ("DMID") REFERENCES "danmakus"("DMID");