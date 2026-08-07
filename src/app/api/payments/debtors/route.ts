import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

// GET - Qarzdorlar ro'yxati
// Formula: Qarzdorlik = SUM(MonthlyCharge.amount) - SUM(Payment TUITION for same group)
// OPTIMIZED: Batch groupBy queries instead of per-student N+1 loops
export const GET = withAuth(async (request: NextRequest) => {
  try {
    // Parallel: aktiv guruh-talaba juftlari + batch aggregations
    const [
      activeGroupStudents,
      chargesGrouped,
      paymentsGrouped,
    ] = await Promise.all([
      // 1. Aktiv guruh-talaba juftlari (faqat display uchun kerakli ma'lumotlar)
      prisma.groupStudent.findMany({
        where: {
          status: "ACTIVE",
          student: { status: "ACTIVE" },
          group: { status: "ACTIVE" },
        },
        select: {
          id: true,
          groupId: true,
          studentId: true,
          price: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          group: {
            select: {
              id: true,
              name: true,
              price: true,
              course: { select: { name: true, price: true } },
            },
          },
        },
      }),

      // 2. MonthlyCharge totals grouped by (groupId, studentId) — single query
      prisma.monthlyCharge.groupBy({
        by: ["groupId", "studentId"],
        _sum: { amount: true },
        where: {
          group: { status: "ACTIVE" },
          student: { status: "ACTIVE" },
        },
      }),

      // 3. Payment totals grouped by (groupId, studentId) — single query
      // Faqat TUITION va groupId bor to'lovlar (guruhsiz to'lovlar hisobga kirmaydi)
      prisma.payment.groupBy({
        by: ["groupId", "studentId"],
        _sum: { amount: true },
        where: {
          paymentType: "TUITION",
          groupId: { not: null },
          student: { status: "ACTIVE" },
        },
      }),
    ]);

    // Oxirgi to'lov sanasini olish uchun alohida query (faqat qarzdorlar uchun)
    // Bu ham batch — hammasi bir vaqtda
    const lastPayments = await prisma.$queryRawUnsafe<
      Array<{ studentId: string; groupId: string; lastDate: Date }>
    >(
      `SELECT "studentId", "groupId", MAX("paymentDate") as "lastDate"
       FROM "Payment"
       WHERE "paymentType" = 'TUITION' AND "groupId" IS NOT NULL
       GROUP BY "studentId", "groupId"`
    );

    // Lookup maps
    const chargesMap = new Map<string, number>();
    for (const row of chargesGrouped) {
      chargesMap.set(`${row.groupId}_${row.studentId}`, Number(row._sum.amount || 0));
    }

    const paymentsMap = new Map<string, number>();
    for (const row of paymentsGrouped) {
      if (!row.groupId) continue;
      paymentsMap.set(`${row.groupId}_${row.studentId}`, Number(row._sum.amount || 0));
    }

    const lastPaymentMap = new Map<string, string>();
    for (const row of lastPayments) {
      if (row.groupId) {
        lastPaymentMap.set(
          `${row.groupId}_${row.studentId}`,
          new Date(row.lastDate).toISOString()
        );
      }
    }

    // Qarzdorlar ro'yxatini hisoblash
    const debtors: {
      id: string;
      student: {
        id: string;
        firstName: string;
        lastName: string;
        phone: string;
      };
      group: {
        id: string;
        name: string;
        course: { name: string };
      };
      monthlyFee: number;
      expectedTotal: number;
      paidAmount: number;
      debtAmount: number;
      lastPaymentDate: string | null;
    }[] = [];

    for (const gs of activeGroupStudents) {
      const key = `${gs.groupId}_${gs.studentId}`;
      const expectedTotal = chargesMap.get(key) || 0;
      const paidAmount = paymentsMap.get(key) || 0;
      const debtAmount = expectedTotal - paidAmount;

      if (debtAmount > 0) {
        const monthlyFee = Number(gs.price || gs.group.price || gs.group.course.price || 0);
        debtors.push({
          id: gs.id,
          student: {
            id: gs.student.id,
            firstName: gs.student.firstName,
            lastName: gs.student.lastName,
            phone: gs.student.phone,
          },
          group: {
            id: gs.group.id,
            name: gs.group.name,
            course: { name: gs.group.course.name },
          },
          monthlyFee,
          expectedTotal,
          paidAmount,
          debtAmount,
          lastPaymentDate: lastPaymentMap.get(key) || null,
        });
      }
    }

    debtors.sort((a, b) => b.debtAmount - a.debtAmount);
    const totalDebt = debtors.reduce((sum, d) => sum + d.debtAmount, 0);

    console.log(
      `GET /api/payments/debtors - Qarzdorlar: ${debtors.length}, Jami qarz: ${totalDebt}`
    );

    return NextResponse.json({
      debtors,
      total: debtors.length,
      totalDebt,
    });
  } catch (error) {
    console.error("❌ DEBTORS ERROR:", error);
    return NextResponse.json(
      { error: "Qarzdorlarni olishda xatolik" },
      { status: 500 }
    );
  }
});
