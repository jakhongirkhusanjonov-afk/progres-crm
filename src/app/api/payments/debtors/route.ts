import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";
import { ensureMonthlyCharges } from "@/lib/monthly-charges";

// GET - Qarzdorlar ro'yxati
// Formula: Qarzdorlik = SUM(MonthlyCharge.amount) - (Shu guruh uchun to'langan summa)
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const now = new Date();

    // Aktiv guruh-talaba juftlarini olamiz
    const activeGroupStudents = await prisma.groupStudent.findMany({
      where: {
        status: "ACTIVE",
        student: { status: "ACTIVE" },
        group: { status: "ACTIVE" },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        group: {
          include: {
            course: true,
            // Faqat shu guruhga tegishli TUITION to'lovlar
            payments: {
              where: { paymentType: "TUITION" },
              select: {
                id: true,
                studentId: true,
                amount: true,
                paymentDate: true,
              },
            },
          },
        },
      },
    });

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
      const charges = await prisma.monthlyCharge.findMany({
        where: {
          groupId: gs.groupId,
          studentId: gs.studentId,
        },
        select: { amount: true },
      });

      const expectedTotal = charges.reduce(
        (sum, c) => sum + Number(c.amount),
        0
      );

      // Faqat shu guruhga va shu talabaga tegishli to'lovlar
      const groupPaymentsForStudent = gs.group.payments.filter(
        (p) => p.studentId === gs.studentId
      );

      const paidAmount = groupPaymentsForStudent.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      const debtAmount = expectedTotal - paidAmount;

      if (debtAmount > 0) {
        // Oxirgi to'lov sanasini topish (shu guruh uchun)
        const sortedPayments = groupPaymentsForStudent
          .slice()
          .sort(
            (a, b) =>
              new Date(b.paymentDate).getTime() -
              new Date(a.paymentDate).getTime()
          );

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
          lastPaymentDate:
            sortedPayments[0]?.paymentDate.toISOString() || null,
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
