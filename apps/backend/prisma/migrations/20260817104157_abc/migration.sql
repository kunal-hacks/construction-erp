/*
  Warnings:

  - You are about to alter the column `budget` on the `Project` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(15,2)`.

*/
-- DropForeignKey
ALTER TABLE "MachineryLog" DROP CONSTRAINT "MachineryLog_machineryId_fkey";

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "wageForDay" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN     "taskId" TEXT;

-- AlterTable
ALTER TABLE "MachineryLog" ADD COLUMN     "clockInTime" TIMESTAMP(3),
ADD COLUMN     "clockOutTime" TIMESTAMP(3),
ADD COLUMN     "hourlyRate" DOUBLE PRECISION,
ADD COLUMN     "machineryName" TEXT,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "totalCost" DOUBLE PRECISION,
ALTER COLUMN "machineryId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Project" ALTER COLUMN "budget" SET DEFAULT 0,
ALTER COLUMN "budget" SET DATA TYPE DECIMAL(15,2);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "computedQuantity" DOUBLE PRECISION,
ADD COLUMN     "cumulativePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "dimensionsJson" JSONB,
ADD COLUMN     "floorTier" TEXT,
ADD COLUMN     "taskTypeId" TEXT,
ADD COLUMN     "totalPersonDays" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "TruckEntry" ADD COLUMN     "ratePerTrip" DOUBLE PRECISION,
ALTER COLUMN "grossWeight" SET DEFAULT 0,
ALTER COLUMN "tareWeight" SET DEFAULT 0,
ALTER COLUMN "netWeight" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "contractorId" TEXT,
ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "DailyReportWorker" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workerId" TEXT,
    "role" TEXT NOT NULL,
    "wageForDay" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyReportWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReportMaterial" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantityUsed" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "DailyReportMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectionRequest" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "currentValue" JSONB NOT NULL,
    "proposedValue" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adjustingExpenseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostTransfer" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "workerId" TEXT,
    "workerName" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "expenseId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerProject" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "WorkerProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "hasStandard" BOOLEAN NOT NULL DEFAULT true,
    "outputPerDay" DOUBLE PRECISION,
    "efficiencyFactor" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "helperRatio" DOUBLE PRECISION,
    "sourceCitation" TEXT,
    "dimensionFields" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialCoefficient" (
    "id" TEXT NOT NULL,
    "taskTypeId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "qtyPerUnit" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "MaterialCoefficient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDailyLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "reportedPercent" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDailyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDailyLogWorker" (
    "id" TEXT NOT NULL,
    "taskDailyLogId" TEXT NOT NULL,
    "workerId" TEXT,
    "newWorkerName" TEXT,
    "role" TEXT NOT NULL,
    "wageForDay" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TaskDailyLogWorker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDailyLogMaterial" (
    "id" TEXT NOT NULL,
    "taskDailyLogId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantityUsed" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TaskDailyLogMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCategory" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "module" TEXT NOT NULL,
    "category" TEXT,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relatedType" TEXT,
    "relatedId" TEXT,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostTransfer_projectId_module_idx" ON "CostTransfer"("projectId", "module");

-- CreateIndex
CREATE INDEX "CostTransfer_workerId_module_idx" ON "CostTransfer"("workerId", "module");

-- CreateIndex
CREATE INDEX "CostTransfer_workerName_module_idx" ON "CostTransfer"("workerName", "module");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProject_workerId_projectId_key" ON "WorkerProject"("workerId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentCategory_module_name_key" ON "DocumentCategory"("module", "name");

-- CreateIndex
CREATE INDEX "Upload_projectId_module_category_idx" ON "Upload"("projectId", "module", "category");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportWorker" ADD CONSTRAINT "DailyReportWorker_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportWorker" ADD CONSTRAINT "DailyReportWorker_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportMaterial" ADD CONSTRAINT "DailyReportMaterial_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DailyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReportMaterial" ADD CONSTRAINT "DailyReportMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineryLog" ADD CONSTRAINT "MachineryLog_machineryId_fkey" FOREIGN KEY ("machineryId") REFERENCES "Machinery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineryLog" ADD CONSTRAINT "MachineryLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostTransfer" ADD CONSTRAINT "CostTransfer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostTransfer" ADD CONSTRAINT "CostTransfer_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerProject" ADD CONSTRAINT "WorkerProject_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerProject" ADD CONSTRAINT "WorkerProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "TaskType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCoefficient" ADD CONSTRAINT "MaterialCoefficient_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "TaskType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCoefficient" ADD CONSTRAINT "MaterialCoefficient_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDailyLog" ADD CONSTRAINT "TaskDailyLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDailyLogWorker" ADD CONSTRAINT "TaskDailyLogWorker_taskDailyLogId_fkey" FOREIGN KEY ("taskDailyLogId") REFERENCES "TaskDailyLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDailyLogWorker" ADD CONSTRAINT "TaskDailyLogWorker_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDailyLogMaterial" ADD CONSTRAINT "TaskDailyLogMaterial_taskDailyLogId_fkey" FOREIGN KEY ("taskDailyLogId") REFERENCES "TaskDailyLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDailyLogMaterial" ADD CONSTRAINT "TaskDailyLogMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
