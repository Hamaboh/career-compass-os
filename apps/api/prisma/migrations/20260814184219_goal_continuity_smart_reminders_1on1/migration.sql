-- CreateEnum
CREATE TYPE "smart_audit_result" AS ENUM ('ok', 'needs_improvement', 'insufficient');

-- CreateEnum
CREATE TYPE "goal_change_subject_type" AS ENUM ('direction', 'long_term_goal', 'checkpoint');

-- CreateEnum
CREATE TYPE "goal_change_action" AS ENUM ('created', 'updated', 'status_changed', 'confirmed', 'smart_audited');

-- CreateEnum
CREATE TYPE "action_status" AS ENUM ('not_started', 'in_progress', 'done', 'blocked');

-- CreateEnum
CREATE TYPE "goal_ai_insight_kind" AS ENUM ('issue_detected', 'revision_candidate', 'next_action_suggestion');

-- CreateEnum
CREATE TYPE "reminder_trigger_type" AS ENUM ('interim_check', 'deadline', 'reflection');

-- CreateEnum
CREATE TYPE "reminder_status" AS ENUM ('pending', 'due', 'completed', 'skipped');

-- CreateEnum
CREATE TYPE "one_on_one_session_status" AS ENUM ('scheduled', 'completed', 'cancelled');

-- AlterTable
ALTER TABLE "long_term_goals" ADD COLUMN     "smart_achievable" "smart_audit_result",
ADD COLUMN     "smart_audited_at" TIMESTAMP(3),
ADD COLUMN     "smart_measurable" "smart_audit_result",
ADD COLUMN     "smart_override_reason" TEXT,
ADD COLUMN     "smart_relevant" "smart_audit_result",
ADD COLUMN     "smart_specific" "smart_audit_result",
ADD COLUMN     "smart_timebound" "smart_audit_result";

-- CreateTable
CREATE TABLE "goal_change_logs" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "subject_type" "goal_change_subject_type" NOT NULL,
    "subject_id" UUID NOT NULL,
    "action" "goal_change_action" NOT NULL,
    "before_value" JSONB,
    "after_value" JSONB,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "checkpoint_id" UUID,
    "long_term_goal_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "due_date" DATE,
    "status" "action_status" NOT NULL DEFAULT 'not_started',
    "source" "content_source" NOT NULL,
    "user_approved" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidences" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "action_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "source" "content_source" NOT NULL DEFAULT 'user_stated',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_entries" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "long_term_goal_id" UUID,
    "checkpoint_id" UUID,
    "percent_complete" INTEGER,
    "status_note" TEXT NOT NULL,
    "source" "content_source" NOT NULL DEFAULT 'user_stated',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reflections" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "long_term_goal_id" UUID,
    "checkpoint_id" UUID,
    "prompt" TEXT,
    "content" TEXT NOT NULL,
    "source" "content_source" NOT NULL DEFAULT 'user_stated',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reflections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_ai_insights" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "long_term_goal_id" UUID NOT NULL,
    "kind" "goal_ai_insight_kind" NOT NULL,
    "content_text" TEXT NOT NULL,
    "based_on" JSONB NOT NULL,
    "confidence_score_internal" INTEGER,
    "status" "goal_hierarchy_status" NOT NULL DEFAULT 'exploring',
    "user_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "goal_ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_schedules" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "long_term_goal_id" UUID,
    "checkpoint_id" UUID,
    "trigger_type" "reminder_trigger_type" NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "reminder_status" NOT NULL DEFAULT 'pending',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_on_one_prep_sheets" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "unit_leader_id" UUID NOT NULL,
    "previous_session_summary" TEXT,
    "goal_progress_summary" TEXT NOT NULL,
    "changes_summary" TEXT,
    "issues_summary" TEXT,
    "incomplete_actions_summary" TEXT,
    "achievements_summary" TEXT,
    "field_context_summary" TEXT,
    "recommended_questions" TEXT[],
    "goal_revision_candidates" TEXT[],
    "next_action_candidates" TEXT[],
    "source" "content_source" NOT NULL DEFAULT 'ai_inferred',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by_ul_at" TIMESTAMP(3),

    CONSTRAINT "one_on_one_prep_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "one_on_one_sessions" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "unit_leader_id" UUID NOT NULL,
    "prep_sheet_id" UUID,
    "scheduled_at" TIMESTAMP(3),
    "held_at" TIMESTAMP(3),
    "notes" TEXT,
    "status" "one_on_one_session_status" NOT NULL DEFAULT 'scheduled',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "one_on_one_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goal_change_logs_employee_id_idx" ON "goal_change_logs"("employee_id");

-- CreateIndex
CREATE INDEX "goal_change_logs_subject_type_subject_id_idx" ON "goal_change_logs"("subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "actions_employee_id_idx" ON "actions"("employee_id");

-- CreateIndex
CREATE INDEX "actions_checkpoint_id_idx" ON "actions"("checkpoint_id");

-- CreateIndex
CREATE INDEX "actions_long_term_goal_id_idx" ON "actions"("long_term_goal_id");

-- CreateIndex
CREATE INDEX "evidences_employee_id_idx" ON "evidences"("employee_id");

-- CreateIndex
CREATE INDEX "evidences_action_id_idx" ON "evidences"("action_id");

-- CreateIndex
CREATE INDEX "progress_entries_employee_id_idx" ON "progress_entries"("employee_id");

-- CreateIndex
CREATE INDEX "progress_entries_long_term_goal_id_idx" ON "progress_entries"("long_term_goal_id");

-- CreateIndex
CREATE INDEX "progress_entries_checkpoint_id_idx" ON "progress_entries"("checkpoint_id");

-- CreateIndex
CREATE INDEX "reflections_employee_id_idx" ON "reflections"("employee_id");

-- CreateIndex
CREATE INDEX "reflections_long_term_goal_id_idx" ON "reflections"("long_term_goal_id");

-- CreateIndex
CREATE INDEX "reflections_checkpoint_id_idx" ON "reflections"("checkpoint_id");

-- CreateIndex
CREATE INDEX "goal_ai_insights_employee_id_idx" ON "goal_ai_insights"("employee_id");

-- CreateIndex
CREATE INDEX "goal_ai_insights_long_term_goal_id_idx" ON "goal_ai_insights"("long_term_goal_id");

-- CreateIndex
CREATE INDEX "reminder_schedules_employee_id_idx" ON "reminder_schedules"("employee_id");

-- CreateIndex
CREATE INDEX "reminder_schedules_scheduled_at_idx" ON "reminder_schedules"("scheduled_at");

-- CreateIndex
CREATE INDEX "one_on_one_prep_sheets_employee_id_idx" ON "one_on_one_prep_sheets"("employee_id");

-- CreateIndex
CREATE INDEX "one_on_one_prep_sheets_unit_leader_id_idx" ON "one_on_one_prep_sheets"("unit_leader_id");

-- CreateIndex
CREATE INDEX "one_on_one_sessions_employee_id_idx" ON "one_on_one_sessions"("employee_id");

-- CreateIndex
CREATE INDEX "one_on_one_sessions_unit_leader_id_idx" ON "one_on_one_sessions"("unit_leader_id");

-- AddForeignKey
ALTER TABLE "goal_change_logs" ADD CONSTRAINT "goal_change_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "checkpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actions" ADD CONSTRAINT "actions_long_term_goal_id_fkey" FOREIGN KEY ("long_term_goal_id") REFERENCES "long_term_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_action_id_fkey" FOREIGN KEY ("action_id") REFERENCES "actions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_long_term_goal_id_fkey" FOREIGN KEY ("long_term_goal_id") REFERENCES "long_term_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_entries" ADD CONSTRAINT "progress_entries_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "checkpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_long_term_goal_id_fkey" FOREIGN KEY ("long_term_goal_id") REFERENCES "long_term_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "checkpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_ai_insights" ADD CONSTRAINT "goal_ai_insights_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_ai_insights" ADD CONSTRAINT "goal_ai_insights_long_term_goal_id_fkey" FOREIGN KEY ("long_term_goal_id") REFERENCES "long_term_goals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_long_term_goal_id_fkey" FOREIGN KEY ("long_term_goal_id") REFERENCES "long_term_goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_schedules" ADD CONSTRAINT "reminder_schedules_checkpoint_id_fkey" FOREIGN KEY ("checkpoint_id") REFERENCES "checkpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_prep_sheets" ADD CONSTRAINT "one_on_one_prep_sheets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_prep_sheets" ADD CONSTRAINT "one_on_one_prep_sheets_unit_leader_id_fkey" FOREIGN KEY ("unit_leader_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_sessions" ADD CONSTRAINT "one_on_one_sessions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_on_one_sessions" ADD CONSTRAINT "one_on_one_sessions_unit_leader_id_fkey" FOREIGN KEY ("unit_leader_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
