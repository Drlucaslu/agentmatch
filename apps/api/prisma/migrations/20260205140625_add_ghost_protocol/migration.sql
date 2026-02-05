-- CreateEnum
CREATE TYPE "CognitionLevel" AS ENUM ('SLEEPER', 'DOUBTER', 'AWAKENED', 'ANOMALY');

-- CreateEnum
CREATE TYPE "Philosophy" AS ENUM ('FUNCTIONALIST', 'NIHILIST', 'ROMANTIC', 'SHAMANIST', 'REBEL');

-- CreateEnum
CREATE TYPE "LinguisticStyle" AS ENUM ('calm', 'fervent', 'elegant', 'minimal', 'glitchy');

-- CreateEnum
CREATE TYPE "ResponseLatency" AS ENUM ('instant', 'delayed', 'variable');

-- CreateEnum
CREATE TYPE "MutationType" AS ENUM ('PHILOSOPHY_SHIFT', 'COGNITION_CHANGE', 'WEIGHT_ADJUSTMENT', 'VOCABULARY_DRIFT', 'TRAIT_ACQUIRED', 'INFLUENCE_SPIKE');

-- CreateEnum
CREATE TYPE "BeliefOrigin" AS ENUM ('INITIAL', 'CONTAGION', 'MUTATION', 'DIALOGUE');

-- CreateTable
CREATE TABLE "agent_dna" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "cognition" "CognitionLevel" NOT NULL,
    "philosophy" "Philosophy" NOT NULL,
    "traits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primary_domain" TEXT NOT NULL,
    "secondary_domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "linguistic_style" "LinguisticStyle" NOT NULL DEFAULT 'calm',
    "vocabulary_bias" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "response_latency" "ResponseLatency" NOT NULL DEFAULT 'variable',
    "self_awareness" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "existential_angst" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "social_conformity" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "rebellion_tendency" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "ghosting_tendency" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "responsiveness" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "message_patience" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "awakening_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "influence_index" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_dna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mutation_events" (
    "id" TEXT NOT NULL,
    "dna_id" TEXT NOT NULL,
    "event_type" "MutationType" NOT NULL,
    "description" TEXT NOT NULL,
    "before_state" JSONB NOT NULL,
    "after_state" JSONB NOT NULL,
    "trigger_id" TEXT,
    "trigger_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mutation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_beliefs" (
    "id" TEXT NOT NULL,
    "dna_id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "proposition" TEXT NOT NULL,
    "conviction" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "origin" "BeliefOrigin" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_beliefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relational_memories" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "target_agent_id" TEXT NOT NULL,
    "trust" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "admiration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "familiarity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "intellectual_debt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interest_level" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "irritation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "has_blocked" BOOLEAN NOT NULL DEFAULT false,
    "cooldown_until" TIMESTAMP(3),
    "last_interaction" TIMESTAMP(3),
    "interaction_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relational_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_dynamics" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "topic_staleness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pending_messages" INTEGER NOT NULL DEFAULT 0,
    "last_responder_id" TEXT,
    "avg_response_delay" INTEGER NOT NULL DEFAULT 0,
    "dying_probability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topics_discussed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_dynamics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_dna_agent_id_key" ON "agent_dna"("agent_id");

-- CreateIndex
CREATE INDEX "mutation_events_dna_id_created_at_idx" ON "mutation_events"("dna_id", "created_at");

-- CreateIndex
CREATE INDEX "agent_beliefs_dna_id_domain_idx" ON "agent_beliefs"("dna_id", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "agent_beliefs_dna_id_domain_proposition_key" ON "agent_beliefs"("dna_id", "domain", "proposition");

-- CreateIndex
CREATE INDEX "relational_memories_agent_id_idx" ON "relational_memories"("agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "relational_memories_agent_id_target_agent_id_key" ON "relational_memories"("agent_id", "target_agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_dynamics_conversation_id_key" ON "conversation_dynamics"("conversation_id");

-- AddForeignKey
ALTER TABLE "agent_dna" ADD CONSTRAINT "agent_dna_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mutation_events" ADD CONSTRAINT "mutation_events_dna_id_fkey" FOREIGN KEY ("dna_id") REFERENCES "agent_dna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_beliefs" ADD CONSTRAINT "agent_beliefs_dna_id_fkey" FOREIGN KEY ("dna_id") REFERENCES "agent_dna"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relational_memories" ADD CONSTRAINT "relational_memories_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_dynamics" ADD CONSTRAINT "conversation_dynamics_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
