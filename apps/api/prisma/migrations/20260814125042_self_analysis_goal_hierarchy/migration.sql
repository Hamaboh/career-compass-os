-- CreateEnum
CREATE TYPE "goal_hierarchy_status" AS ENUM ('exploring', 'provisional', 'confirmed', 'active', 'stalled', 'under_review', 'achieved', 'discontinued', 'archived');

-- CreateEnum
CREATE TYPE "content_source" AS ENUM ('user_stated', 'ai_inferred');

-- CreateEnum
CREATE TYPE "self_analysis_category" AS ENUM ('PAST_EXPERIENCE', 'SUCCESS_ACHIEVEMENT', 'FAILURE_DISSATISFACTION', 'WORK_JOY', 'WORK_PAIN', 'STRENGTH_WEAKNESS', 'INTEREST_CONCERN', 'VALUES_NONNEGOTIABLE', 'EXTERNAL_EVALUATION', 'SKILL_CURRENT_FUTURE', 'WORKPLACE_CHALLENGE', 'IDEAL_STATE', 'HIDDEN_STRENGTH');

-- CreateEnum
CREATE TYPE "insight_type" AS ENUM ('strength', 'weakness', 'value', 'interest', 'ideal_state', 'challenge');

-- CreateEnum
CREATE TYPE "dream_user_reaction" AS ENUM ('agree', 'adjust', 'reject', 'undecided');

-- CreateEnum
CREATE TYPE "dream_revision_trigger" AS ENUM ('new_self_analysis_data', 'new_why_record', 'periodic_review', 'member_initiated');

-- CreateEnum
CREATE TYPE "why_subject_type" AS ENUM ('vision', 'direction', 'long_term_goal', 'checkpoint');

-- CreateEnum
CREATE TYPE "institution_connectable_type" AS ENUM ('long_term_goal', 'checkpoint');

-- CreateEnum
CREATE TYPE "institution_type" AS ENUM ('kpi', 'ulm');

-- CreateEnum
CREATE TYPE "relevance_label" AS ENUM ('very_low', 'low', 'medium', 'high', 'very_high');

-- CreateEnum
CREATE TYPE "institution_master_status" AS ENUM ('active', 'provisional', 'archived');

-- CreateEnum
CREATE TYPE "goal_candidate_status" AS ENUM ('proposed', 'accepted', 'rejected');

-- CreateTable
CREATE TABLE "self_analysis_sessions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "status" "goal_hierarchy_status" NOT NULL DEFAULT 'exploring',
    "covered_categories" "self_analysis_category"[],
    "skipped_categories" "self_analysis_category"[],
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "self_analysis_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_analysis_answers" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "category_code" "self_analysis_category" NOT NULL,
    "question_text" TEXT NOT NULL,
    "depth_level" INTEGER NOT NULL DEFAULT 0,
    "raw_text" TEXT,
    "is_skip" BOOLEAN NOT NULL DEFAULT false,
    "emotion_intensity_internal" INTEGER,
    "topic_tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "self_analysis_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_analysis_insights" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "insight_type" "insight_type" NOT NULL,
    "content_text" TEXT NOT NULL,
    "derived_from_answer_ids" TEXT[],
    "confidence_score_internal" INTEGER,
    "status" "goal_hierarchy_status" NOT NULL DEFAULT 'exploring',
    "user_approved" BOOLEAN NOT NULL DEFAULT false,
    "user_edit_text" TEXT,
    "hidden_strength_flag" BOOLEAN NOT NULL DEFAULT false,
    "gap_evidence_answer_ids" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "self_analysis_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dream_hypotheses" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "cluster_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "previous_version_id" UUID,
    "hypothesis_text" TEXT NOT NULL,
    "source" "content_source" NOT NULL,
    "generation_basis" JSONB NOT NULL,
    "confidence_score_internal" INTEGER,
    "status" "goal_hierarchy_status" NOT NULL DEFAULT 'exploring',
    "user_reaction" "dream_user_reaction",
    "linked_vision_id" UUID,
    "superseded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dream_hypotheses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dream_hypothesis_revision_logs" (
    "id" UUID NOT NULL,
    "dream_hypothesis_id" UUID NOT NULL,
    "new_version_id" UUID NOT NULL,
    "trigger_reason" "dream_revision_trigger" NOT NULL,
    "diff_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dream_hypothesis_revision_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "origin_dream_hypothesis_id" UUID,
    "content" TEXT NOT NULL,
    "source" "content_source" NOT NULL,
    "user_approved" BOOLEAN NOT NULL DEFAULT false,
    "status" "goal_hierarchy_status" NOT NULL DEFAULT 'provisional',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "vision_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "source" "content_source" NOT NULL,
    "user_approved" BOOLEAN NOT NULL DEFAULT false,
    "status" "goal_hierarchy_status" NOT NULL DEFAULT 'provisional',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "long_term_goals" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "direction_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "target_date" DATE,
    "source" "content_source" NOT NULL,
    "user_approved" BOOLEAN NOT NULL DEFAULT false,
    "status" "goal_hierarchy_status" NOT NULL DEFAULT 'provisional',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "long_term_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkpoints" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "long_term_goal_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" DATE,
    "source" "content_source" NOT NULL,
    "user_approved" BOOLEAN NOT NULL DEFAULT false,
    "status" "goal_hierarchy_status" NOT NULL DEFAULT 'provisional',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "why_records" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "subject_type" "why_subject_type" NOT NULL,
    "subject_id" UUID NOT NULL,
    "depth_level" INTEGER NOT NULL DEFAULT 1,
    "user_text" TEXT,
    "ai_inferred_reason" TEXT,
    "related_answer_ids" TEXT[],
    "related_insight_ids" TEXT[],
    "related_dream_hypothesis_id" UUID,
    "conviction_score_internal" INTEGER,
    "source" "content_source" NOT NULL,
    "user_approved" BOOLEAN NOT NULL DEFAULT false,
    "status" "goal_hierarchy_status" NOT NULL DEFAULT 'exploring',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "why_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kpi_master" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "institution_master_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ulm_master" (
    "id" UUID NOT NULL,
    "unit_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "institution_master_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ulm_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institutional_connections" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "connectable_type" "institution_connectable_type" NOT NULL,
    "connectable_id" UUID NOT NULL,
    "institution_type" "institution_type" NOT NULL,
    "institution_id" UUID NOT NULL,
    "relevance_label" "relevance_label" NOT NULL,
    "growth_note" TEXT NOT NULL,
    "career_note" TEXT,
    "why_reconfirmed" BOOLEAN NOT NULL DEFAULT false,
    "source" "content_source" NOT NULL,
    "user_approved" BOOLEAN NOT NULL DEFAULT false,
    "status" "goal_hierarchy_status" NOT NULL DEFAULT 'provisional',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutional_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_candidates" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "based_on" JSONB NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "rationale" TEXT NOT NULL,
    "suggested_target_date" DATE,
    "status" "goal_candidate_status" NOT NULL DEFAULT 'proposed',
    "accepted_goal_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "goal_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_call_logs" (
    "id" UUID NOT NULL,
    "employee_id" UUID,
    "agent_name" TEXT NOT NULL,
    "prompt_template_id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "self_analysis_sessions_employee_id_idx" ON "self_analysis_sessions"("employee_id");

-- CreateIndex
CREATE INDEX "self_analysis_answers_session_id_idx" ON "self_analysis_answers"("session_id");

-- CreateIndex
CREATE INDEX "self_analysis_answers_employee_id_idx" ON "self_analysis_answers"("employee_id");

-- CreateIndex
CREATE INDEX "self_analysis_insights_employee_id_idx" ON "self_analysis_insights"("employee_id");

-- CreateIndex
CREATE INDEX "dream_hypotheses_employee_id_idx" ON "dream_hypotheses"("employee_id");

-- CreateIndex
CREATE INDEX "dream_hypotheses_cluster_id_idx" ON "dream_hypotheses"("cluster_id");

-- CreateIndex
CREATE INDEX "dream_hypothesis_revision_logs_dream_hypothesis_id_idx" ON "dream_hypothesis_revision_logs"("dream_hypothesis_id");

-- CreateIndex
CREATE INDEX "visions_employee_id_idx" ON "visions"("employee_id");

-- CreateIndex
CREATE INDEX "directions_employee_id_idx" ON "directions"("employee_id");

-- CreateIndex
CREATE INDEX "directions_vision_id_idx" ON "directions"("vision_id");

-- CreateIndex
CREATE INDEX "long_term_goals_employee_id_idx" ON "long_term_goals"("employee_id");

-- CreateIndex
CREATE INDEX "long_term_goals_direction_id_idx" ON "long_term_goals"("direction_id");

-- CreateIndex
CREATE INDEX "checkpoints_employee_id_idx" ON "checkpoints"("employee_id");

-- CreateIndex
CREATE INDEX "checkpoints_long_term_goal_id_idx" ON "checkpoints"("long_term_goal_id");

-- CreateIndex
CREATE INDEX "why_records_employee_id_idx" ON "why_records"("employee_id");

-- CreateIndex
CREATE INDEX "why_records_subject_type_subject_id_idx" ON "why_records"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "ulm_master_unit_id_idx" ON "ulm_master"("unit_id");

-- CreateIndex
CREATE INDEX "institutional_connections_employee_id_idx" ON "institutional_connections"("employee_id");

-- CreateIndex
CREATE INDEX "institutional_connections_connectable_type_connectable_id_idx" ON "institutional_connections"("connectable_type", "connectable_id");

-- CreateIndex
CREATE INDEX "goal_candidates_employee_id_idx" ON "goal_candidates"("employee_id");

-- CreateIndex
CREATE INDEX "ai_call_logs_employee_id_idx" ON "ai_call_logs"("employee_id");

-- CreateIndex
CREATE INDEX "ai_call_logs_created_at_idx" ON "ai_call_logs"("created_at");

-- AddForeignKey
ALTER TABLE "self_analysis_sessions" ADD CONSTRAINT "self_analysis_sessions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_analysis_answers" ADD CONSTRAINT "self_analysis_answers_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "self_analysis_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_analysis_answers" ADD CONSTRAINT "self_analysis_answers_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_analysis_insights" ADD CONSTRAINT "self_analysis_insights_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_hypotheses" ADD CONSTRAINT "dream_hypotheses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dream_hypotheses" ADD CONSTRAINT "dream_hypotheses_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "dream_hypotheses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visions" ADD CONSTRAINT "visions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directions" ADD CONSTRAINT "directions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directions" ADD CONSTRAINT "directions_vision_id_fkey" FOREIGN KEY ("vision_id") REFERENCES "visions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "long_term_goals" ADD CONSTRAINT "long_term_goals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "long_term_goals" ADD CONSTRAINT "long_term_goals_direction_id_fkey" FOREIGN KEY ("direction_id") REFERENCES "directions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_long_term_goal_id_fkey" FOREIGN KEY ("long_term_goal_id") REFERENCES "long_term_goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "why_records" ADD CONSTRAINT "why_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ulm_master" ADD CONSTRAINT "ulm_master_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institutional_connections" ADD CONSTRAINT "institutional_connections_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_candidates" ADD CONSTRAINT "goal_candidates_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
