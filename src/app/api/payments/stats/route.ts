import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { ensureMonthlyCharges } from "@/lib/monthly-charges";

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

    // Har bir (guruh, talaba) jufti uchun MonthlyCharge asosida qarz hisoblash
    let totalDebt = 0;
    const debtorSet = new Set<string>(); // unique qarzdorlar

    for (const gs of activeGroupStudents) {
      const monthlyFee = Number(gs.price || gs.group.price || gs.group.course.price || 0);
      if (monthlyFee === 0) continue;

      // MonthlyCharge yozuvlari mavjudligini ta'minlash
      await ensureMonthlyCharges(
        gs.groupId,
        gs.studentId,
        new Date(gs.enrollDate),
        new Date(gs.group.startDate),
        monthlyFee,
      );

      // MonthlyCharge dan kutilayotgan jami summani hisoblash
      const chargesResult = await prisma.monthlyCharge.aggregate({
        where: {
          groupId: gs.groupId,
          studentId: gs.studentId,
        },
        _sum: { amount: true },
      });

      const expectedTotal = Number(chargesResult._sum.amount || 0);

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
