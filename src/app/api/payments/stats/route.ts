import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

// GET - To'lovlar statistikasi
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Parallel so'rovlar
    const [
      todayPayments,
      monthPayments,
      totalPayments,
      activeGroupStudents,
    ] = await Promise.all([
      // Bugungi to'lovlar
      prisma.payment.aggregate({
        where: {
          paymentDate: { gte: todayStart },
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Bu oylik to'lovlar
      prisma.payment.aggregate({
        where: {
          paymentDate: { gte: monthStart },
        },
        _sum: { amount: true },
        _count: true,
      }),
      // Jami to'lovlar
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
      }),
      // Aktiv talabalar va ularning guruhlari (qarzdorlik hisoblash uchun)
      prisma.groupStudent.findMany({
        where: {
          status: "ACTIVE",
          student: { status: "ACTIVE" },
          group: { status: "ACTIVE" },
        },
        include: {
          student: {
            include: {
              // Barcha to'lovlarni olish (oy bo'yicha emas!)
              payments: true,
            },
          },
          group: {
            include: {
              course: true,
            },
          },
        },
      }),
    ]);

    // Talabalar bo'yicha guruhlash (bir talaba bir nechta guruhda bo'lishi mumkin)
    const studentGroups = new Map<string, typeof activeGroupStudents>();

    activeGroupStudents.forEach((gs) => {
      const studentId = gs.studentId;
      if (!studentGroups.has(studentId)) {
        studentGroups.set(studentId, []);
      }
      studentGroups.get(studentId)!.push(gs);
    });

    // Qarzdorlik hisoblash: Narx - Jami to'langan
    let totalDebt = 0;
    let debtorCount = 0;

    studentGroups.forEach((groups) => {
      // Talabaning barcha guruhlari bo'yicha jami narx
      let totalFeeForStudent = 0;
      groups.forEach((gs) => {
        const fee = Number(gs.price || gs.group.price || gs.group.course.price || 0);
        totalFeeForStudent += fee;
      });

      // Talabaning jami to'lovlari (faqat TUITION)
      const student = groups[0].student;
      const totalPaid = student.payments
        .filter(p => p.paymentType === "TUITION")
        .reduce((sum, p) => sum + Number(p.amount), 0);

      // Talabaning umumiy qarzi
      const debtAmount = totalFeeForStudent - totalPaid;

      if (debtAmount > 0) {
        totalDebt += debtAmount;
        debtorCount++;
      }
    });

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
