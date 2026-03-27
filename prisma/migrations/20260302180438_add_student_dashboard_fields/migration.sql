-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "totalMessages" INTEGER,
ADD COLUMN     "totalTimeSeconds" INTEGER;

-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN     "code" TEXT,
ADD COLUMN     "semester" TEXT,
ADD COLUMN     "year" INTEGER;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "studentNumber" TEXT;
