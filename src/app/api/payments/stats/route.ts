import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

// Oylar sonini hisoblash
function monthsElapsed(startDate: Date, now: Date): number {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  const months = (nowYear - startYear) * 12 + (nowMonth - startMonth) + 1;
  return Math.max(1, months);
}

// GET - To'lovlar statistikasi
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayPayments,
      monthPayments,
      totalPayments,
      activeGroupStudents,
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: { paymentDate: { gte: todayStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { paymentDate: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
      }),
      prisma.groupStudent.findMany({
        where: {
          status: "ACTIVE",
          student: { status: "ACTIVE" },
          group: { status: "ACTIVE" },
        },
        include: {
          student: { select: { id: true } },
          group: {
            include: {
              course: true,
              payments: {
                where: { paymentType: "TUITION" },
                select: { studentId: true, amount: true },
              },
            },
          },
        },
      }),
    ]);

    // Har bir (guruh, talaba) jufti uchun oyma-oy yig'ilib boruvchi qarz
    let totalDebt = 0;
    const debtorSet = new Set<string>(); // unique qarzdorlar

    for (const gs of activeGroupStudents) {
      const monthlyFee = Number(gs.price || gs.group.price || gs.group.course.price || 0);
      if (monthlyFee === 0) continue;

      const enrollDate = new Date(gs.enrollDate);
      const groupStartDate = new Date(gs.group.startDate);
      const startPoint = enrollDate > groupStartDate ? enrollDate : groupStartDate;

      const months = monthsElapsed(startPoint, now);
      const expectedTotal = months * monthlyFee;

      const paidAmount = gs.group.payments
        .filter((p) => p.studentId === gs.studentId)
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const debt = expectedTotal - paidAmount;
      if (debt > 0) {
        totalDebt += debt;
        debtorSet.add(gs.studentId);
      }
    }

    const debtorCount = debtorSet.size;

    console.log(`GET /api/payments/stats - Qarzdorlar: ${debtorCount}, Jami qarz: ${totalDebt}`);

    return NextResponse.json({
      today: {
        amount: Number(todayPayments._sum.amount || 0),
        count: todayPayments._count,
      },
      month: {
        amount: Number(monthPayments._sum.amount || 0),
        count: monthPayments._count,
      },
      total: {
        amount: Number(totalPayments._sum.amount || 0),
        count: totalPayments._count,
      },
      debt: {
        amount: totalDebt,
        count: debtorCount,
      },
    });
  } catch (error) {
    console.error("Payments stats error:", error);
    return NextResponse.json(
      { error: "Statistikani olishda xatolik" },
      { status: 500 }
    );
  }
});
