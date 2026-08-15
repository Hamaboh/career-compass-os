-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('action_due', 'interim_check', 'reflection_prompt', 'one_on_one_prep', 'unanswered', 'smart_incomplete', 'goal_deadline', 'goal_updated', 'ai_important_suggestion');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('in_app', 'email');

-- CreateEnum
CREATE TYPE "evaluation_period_type" AS ENUM ('quarter', 'half_year', 'fiscal_year', 'custom');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_employee_id" UUID NOT NULL,
    "notification_type" "notification_type" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "related_type" TEXT,
    "related_id" UUID,
    "channel" "notification_channel" NOT NULL DEFAULT 'in_app',
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_period_master" (
    "id" VARCHAR(30) NOT NULL,
    "period_type" "evaluation_period_type" NOT NULL,
    "period_start_date" DATE NOT NULL,
    "period_end_date" DATE NOT NULL,
    "period_label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evaluation_period_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_master" (
    "id" UUID NOT NULL,
    "competency_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_master" (
    "id" UUID NOT NULL,
    "position_name" TEXT NOT NULL,
    "position_level" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "notification_digest_enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_interim_check_days" INTEGER NOT NULL DEFAULT 14,
    "default_smart_recheck_days" INTEGER NOT NULL DEFAULT 90,
    "updated_by_employee_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_employee_id_read_at_delivered_at_idx" ON "notifications"("recipient_employee_id", "read_at", "delivered_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "competency_master_competency_name_key" ON "competency_master"("competency_name");

-- CreateIndex
CREATE UNIQUE INDEX "position_master_position_name_key" ON "position_master"("position_name");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_employee_id_fkey" FOREIGN KEY ("recipient_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

