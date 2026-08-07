-- CreateIndex
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");

-- CreateIndex
CREATE INDEX "Attendance_groupId_idx" ON "Attendance"("groupId");

-- CreateIndex
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");

-- CreateIndex
CREATE INDEX "GroupStudent_studentId_idx" ON "GroupStudent"("studentId");

-- CreateIndex
CREATE INDEX "GroupStudent_status_idx" ON "GroupStudent"("status");

-- CreateIndex
CREATE INDEX "MonthlyCharge_studentId_idx" ON "MonthlyCharge"("studentId");

-- CreateIndex
CREATE INDEX "MonthlyCharge_groupId_studentId_idx" ON "MonthlyCharge"("groupId", "studentId");

-- CreateIndex
CREATE INDEX "Payment_studentId_idx" ON "Payment"("studentId");

-- CreateIndex
CREATE INDEX "Payment_groupId_idx" ON "Payment"("groupId");

-- CreateIndex
CREATE INDEX "Payment_paymentDate_idx" ON "Payment"("paymentDate");

-- CreateIndex
CREATE INDEX "Payment_studentId_groupId_idx" ON "Payment"("studentId", "groupId");
