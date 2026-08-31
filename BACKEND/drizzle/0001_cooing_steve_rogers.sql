DROP INDEX "notes_user_archived_idx";--> statement-breakpoint
CREATE INDEX "notes_user_archived_updated_idx" ON "notes" USING btree ("user_id","is_archived","updated_at");