import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

// Oylar sonini hisoblash yordamchi funksiyasi
// startDate dan hozirgi oygacha (shu oy ham kiradi)
function monthsElapsed(startDate: Date, now: Date): number {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth(); // 0-indexed
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth(); // 0-indexed
  const months = (nowYear - startYear) * 12 + (nowMonth - startMonth) + 1;
  return Math.max(1, months); // Kamida 1 oy
}

// GET - Qarzdorlar ro'yxati
// Formula: Qarzdorlik = (Oylar soni × Guruh narxi) - (Shu guruh uchun to'langan summa)
// Oylar soni = enrollDate (yoki group.startDate, qaysi kechroq bo'lsa) dan bugungi oygacha
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
      monthsElapsed: number;
      expectedTotal: number;
      paidAmount: number;
      debtAmount: number;
      lastPaymentDate: string | null;
    }[] = [];

    for (const gs of activeGroupStudents) {
      const monthlyFee = Number(gs.price || gs.group.price || gs.group.course.price || 0);
      if (monthlyFee === 0) continue;

      // Boshlanish nuqtasi: enrollDate vs group.startDate — qaysi keyinroq bo'lsa
      const enrollDate = new Date(gs.enrollDate);
      const groupStartDate = new Date(gs.group.startDate);
      const startPoint = enrollDate > groupStartDate ? enrollDate : groupStartDate;

      // Oylar soni (shu oy ham kiradi)
      const months = monthsElapsed(startPoint, now);

      // Kutilayotgan jami summa
      const expectedTotal = months * monthlyFee;

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
          monthsElapsed: months,
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
