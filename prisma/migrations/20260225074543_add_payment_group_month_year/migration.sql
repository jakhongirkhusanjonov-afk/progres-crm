-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "forMonth" TEXT,
ADD COLUMN     "forYear" INTEGER,
ADD COLUMN     "groupId" TEXT;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
