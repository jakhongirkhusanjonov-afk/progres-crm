import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

// GET - To'lovlar statistikasi
// OPTIMIZED: Batch aggregation queries instead of per-student N+1 loops
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayPayments,
      monthPayments,
      totalPayments,
      // Batch debt calculation
      totalCharges,
      totalTuitionPaid,
      debtorCount,
    ] = await Promise.all([
      // 1. Bugungi to'lovlar
      prisma.payment.aggregate({
        where: { paymentDate: { gte: todayStart } },
        _sum: { amount: true },
        _count: true,
      }),

      // 2. Bu oylik to'lovlar
      prisma.payment.aggregate({
        where: { paymentDate: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),

      // 3. Jami to'lovlar
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
      }),

      // 4. Jami MonthlyCharge SUM (faol talabalar, faol guruhlar)
      prisma.monthlyCharge.aggregate({
        where: {
          group: { status: "ACTIVE" },
          student: { status: "ACTIVE" },
        },
        _sum: { amount: true },
      }),

      // 5. Jami TUITION to'lovlar SUM (guruhga bog'langan)
      prisma.payment.aggregate({
        where: {
          paymentType: "TUITION",
          groupId: { not: null },
          student: { status: "ACTIVE" },
        },
        _sum: { amount: true },
      }),

      // 6. Qarzdorlar soni — groupBy orqali debt > 0 bo'lganlarni sanash
      // Bu yerda raw SQL ishlatamiz chunki Prisma having clause qo'llab-quvvatlamaydi
      prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(DISTINCT sub."studentId")::bigint as count FROM (
          SELECT mc."studentId", mc."groupId",
            COALESCE(SUM(mc.amount), 0) - COALESCE(
              (SELECT SUM(p.amount) FROM "Payment" p
               WHERE p."studentId" = mc."studentId"
               AND p."groupId" = mc."groupId"
               AND p."paymentType" = 'TUITION'),
              0
            ) as debt
          FROM "MonthlyCharge" mc
          JOIN "GroupStudent" gs ON gs."studentId" = mc."studentId" AND gs."groupId" = mc."groupId" AND gs.status = 'ACTIVE'
          JOIN "Group" g ON g.id = mc."groupId" AND g.status = 'ACTIVE'
          JOIN "Student" s ON s.id = mc."studentId" AND s.status = 'ACTIVE'
          GROUP BY mc."studentId", mc."groupId"
          HAVING COALESCE(SUM(mc.amount), 0) - COALESCE(
            (SELECT SUM(p.amount) FROM "Payment" p
             WHERE p."studentId" = mc."studentId"
             AND p."groupId" = mc."groupId"
             AND p."paymentType" = 'TUITION'),
            0
          ) > 0
        ) sub`
      ),
    ]);

    const totalDebt = Math.max(
      0,
      Number(totalCharges._sum.amount || 0) - Number(totalTuitionPaid._sum.amount || 0)
    );

    const debtorCountNum = Number(debtorCount[0]?.count || 0);

    console.log(`GET /api/payments/stats - Qarzdorlar: ${debtorCountNum}, Jami qarz: ${totalDebt}`);

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
        count: debtorCountNum,
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
