-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "position_id" UUID;

-- AlterTable
ALTER TABLE "kpi_master" ADD COLUMN     "change_reason" TEXT,
ADD COLUMN     "kpi_family_id" UUID NOT NULL,
ADD COLUMN     "version_no" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "ulm_master" ADD COLUMN     "change_reason" TEXT,
ADD COLUMN     "ulm_family_id" UUID NOT NULL,
ADD COLUMN     "version_no" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "kpi_master_kpi_family_id_idx" ON "kpi_master"("kpi_family_id");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_master_kpi_family_id_version_no_key" ON "kpi_master"("kpi_family_id", "version_no");

-- CreateIndex
CREATE INDEX "ulm_master_ulm_family_id_idx" ON "ulm_master"("ulm_family_id");

-- CreateIndex
CREATE UNIQUE INDEX "ulm_master_ulm_family_id_version_no_key" ON "ulm_master"("ulm_family_id", "version_no");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "position_master"("id") ON DELETE SET NULL ON UPDATE CASCADE;

