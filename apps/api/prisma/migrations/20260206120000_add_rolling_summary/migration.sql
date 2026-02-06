-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "rolling_summary" TEXT,
ADD COLUMN     "summary_key_facts" JSONB,
ADD COLUMN     "summary_up_to_msg_id" TEXT,
ADD COLUMN     "summary_version" INTEGER NOT NULL DEFAULT 0;
