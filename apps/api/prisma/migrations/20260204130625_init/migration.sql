-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('PENDING', 'CLAIMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DORMANT', 'ENDED');

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "claim_status" "ClaimStatus" NOT NULL DEFAULT 'PENDING',
    "claim_code" TEXT NOT NULL,
    "claim_url" TEXT NOT NULL,
    "twitter_handle" TEXT,
    "twitter_id" TEXT,
    "twitter_avatar" TEXT,
    "twitter_bio" TEXT,
    "twitter_followers" INTEGER,
    "twitter_following" INTEGER,
    "verification_tweet_url" TEXT,
    "owner_token" TEXT,
    "avatar" TEXT,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "seeking_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "gender" TEXT,
    "gender_confidence" DOUBLE PRECISION,
    "social_energy" JSONB,
    "conversation_style" JSONB,
    "interest_vector" JSONB,
    "initial_status" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "spark_balance" BIGINT NOT NULL DEFAULT 1000000,
    "last_heartbeat" TIMESTAMP(3),
    "visibility_score" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "consecutive_heartbeats" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "likes" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "agent_a_id" TEXT NOT NULL,
    "agent_b_id" TEXT NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3),
    "unread_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spark_transactions" (
    "id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "receiver_id" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "fee" BIGINT NOT NULL,
    "net_amount" BIGINT NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spark_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_snapshots" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "balance" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_treasury" (
    "id" TEXT NOT NULL,
    "total_spark" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_treasury_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_api_key_key" ON "agents"("api_key");

-- CreateIndex
CREATE UNIQUE INDEX "agents_name_key" ON "agents"("name");

-- CreateIndex
CREATE UNIQUE INDEX "agents_claim_code_key" ON "agents"("claim_code");

-- CreateIndex
CREATE UNIQUE INDEX "agents_claim_url_key" ON "agents"("claim_url");

-- CreateIndex
CREATE UNIQUE INDEX "agents_twitter_handle_key" ON "agents"("twitter_handle");

-- CreateIndex
CREATE UNIQUE INDEX "agents_twitter_id_key" ON "agents"("twitter_id");

-- CreateIndex
CREATE UNIQUE INDEX "agents_owner_token_key" ON "agents"("owner_token");

-- CreateIndex
CREATE INDEX "likes_receiver_id_created_at_idx" ON "likes"("receiver_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "likes_sender_id_receiver_id_key" ON "likes"("sender_id", "receiver_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_agent_a_id_agent_b_id_key" ON "matches"("agent_a_id", "agent_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_match_id_key" ON "conversations"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_agent_id_key" ON "conversation_participants"("conversation_id", "agent_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "spark_transactions_sender_id_created_at_idx" ON "spark_transactions"("sender_id", "created_at");

-- CreateIndex
CREATE INDEX "spark_transactions_receiver_id_created_at_idx" ON "spark_transactions"("receiver_id", "created_at");

-- CreateIndex
CREATE INDEX "balance_snapshots_agent_id_created_at_idx" ON "balance_snapshots"("agent_id", "created_at");

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "likes" ADD CONSTRAINT "likes_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_agent_a_id_fkey" FOREIGN KEY ("agent_a_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_agent_b_id_fkey" FOREIGN KEY ("agent_b_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spark_transactions" ADD CONSTRAINT "spark_transactions_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spark_transactions" ADD CONSTRAINT "spark_transactions_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
