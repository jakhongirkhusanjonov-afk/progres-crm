import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

// GET - Qarzdorlar ro'yxati
// Formula: Qarzdorlik = Individual narx - To'langan summa
// Yangi talaba qo'shilganda DARHOL qarz paydo bo'ladi
export const GET = withAuth(async (request: NextRequest) => {
  try {
    console.log("\n" + "=".repeat(60));
    console.log("🔍 DEBTORS API - DEBUG START");
    console.log("=".repeat(60));

    // Aktiv talabalar va ularning guruhlari
    const activeGroupStudents = await prisma.groupStudent.findMany({
      where: {
        status: "ACTIVE",
        student: { status: "ACTIVE" },
        group: { status: "ACTIVE" },
      },
      include: {
        student: {
          include: {
            payments: {
              where: { paymentType: "TUITION" },
              orderBy: { paymentDate: "desc" },
            },
          },
        },
        group: {
          include: {
            course: true,
          },
        },
      },
    });

    console.log(`\n📊 TOPILGAN AKTIV GURUH-TALABALAR: ${activeGroupStudents.length} ta`);
    console.log("-".repeat(60));

    // Har bir guruh-talaba uchun batafsil log
    activeGroupStudents.forEach((gs, index) => {
      const individualPrice = gs.price ? Number(gs.price) : null;
      const groupPrice = gs.group.price ? Number(gs.group.price) : null;
      const coursePrice = Number(gs.group.course.price);
      const finalPrice = individualPrice || groupPrice || coursePrice || 0;

      const totalPayments = gs.student.payments.reduce(
        (sum, p) => sum + Number(p.amount), 0
      );

      console.log(`\n[${index + 1}] ${gs.student.lastName} ${gs.student.firstName}`);
      console.log(`    📱 Tel: ${gs.student.phone}`);
      console.log(`    🎓 Guruh: ${gs.group.name} (${gs.group.course.name})`);
      console.log(`    💰 NARXLAR:`);
      console.log(`       - Individual (GroupStudent.price): ${individualPrice !== null ? individualPrice.toLocaleString() : 'NULL'}`);
      console.log(`       - Guruh (Group.price): ${groupPrice !== null ? groupPrice.toLocaleString() : 'NULL'}`);
      console.log(`       - Kurs (Course.price): ${coursePrice.toLocaleString()}`);
      console.log(`       ➡️  FINAL NARX: ${finalPrice.toLocaleString()} so'm`);
      console.log(`    💳 TO'LOVLAR: ${gs.student.payments.length} ta`);
      gs.student.payments.forEach((p, i) => {
        console.log(`       [${i + 1}] ${Number(p.amount).toLocaleString()} so'm (${p.paymentDate.toISOString().split('T')[0]})`);
      });
      console.log(`       ➡️  JAMI TO'LANGAN: ${totalPayments.toLocaleString()} so'm`);
      console.log(`    📉 QARZDORLIK: ${finalPrice} - ${totalPayments} = ${finalPrice - totalPayments} so'm`);
    });

    // Talabalar bo'yicha guruhlash
    const studentGroups = new Map<string, typeof activeGroupStudents>();

    activeGroupStudents.forEach((gs) => {
      const studentId = gs.studentId;
      if (!studentGroups.has(studentId)) {
        studentGroups.set(studentId, []);
      }
      studentGroups.get(studentId)!.push(gs);
    });

    console.log(`\n📋 UNIQUE TALABALAR: ${studentGroups.size} ta`);

    // Qarzdorlarni hisoblash
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
      paidAmount: number;
      debtAmount: number;
      lastPaymentDate: string | null;
    }[] = [];

    console.log("\n" + "-".repeat(60));
    console.log("🧮 QARZDORLIK HISOBLASH:");
    console.log("-".repeat(60));

    studentGroups.forEach((groups, studentId) => {
      const student = groups[0].student;
      const studentName = `${student.lastName} ${student.firstName}`;

      // Jami narx
      let totalFeeForStudent = 0;
      groups.forEach((gs) => {
        const fee = Number(gs.price || gs.group.price || gs.group.course.price || 0);
        totalFeeForStudent += fee;
      });

      // Jami to'lov
      const totalPaid = student.payments.reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      const totalDebtForStudent = totalFeeForStudent - totalPaid;

      console.log(`\n👤 ${studentName}:`);
      console.log(`   Guruhlar soni: ${groups.length}`);
      console.log(`   Jami narx: ${totalFeeForStudent.toLocaleString()} so'm`);
      console.log(`   Jami to'langan: ${totalPaid.toLocaleString()} so'm`);
      console.log(`   Umumiy qarz: ${totalDebtForStudent.toLocaleString()} so'm`);

      if (totalDebtForStudent > 0) {
        console.log(`   ✅ QARZDOR - ro'yxatga qo'shiladi`);

        groups.forEach((gs) => {
          const monthlyFee = Number(gs.price || gs.group.price || gs.group.course.price || 0);
          const debtRatio = groups.length === 1 ? 1 : monthlyFee / totalFeeForStudent;
          const paidForThisGroup = Math.round(totalPaid * debtRatio);
          const debtForThisGroup = Math.max(0, monthlyFee - paidForThisGroup);

          console.log(`      - ${gs.group.name}: narx=${monthlyFee}, to'langan=${paidForThisGroup}, qarz=${debtForThisGroup}`);

          if (debtForThisGroup > 0) {
            debtors.push({
              id: gs.id,
              student: {
                id: student.id,
                firstName: student.firstName,
                lastName: student.lastName,
                phone: student.phone,
              },
              group: {
                id: gs.group.id,
                name: gs.group.name,
                course: { name: gs.group.course.name },
              },
              monthlyFee,
              paidAmount: paidForThisGroup,
              debtAmount: debtForThisGroup,
              lastPaymentDate: student.payments[0]?.paymentDate.toISOString() || null,
            });
          }
        });
      } else {
        console.log(`   ❌ QARZ YO'Q - o'tkazib yuboriladi`);
      }
    });

    debtors.sort((a, b) => b.debtAmount - a.debtAmount);
    const totalDebt = debtors.reduce((sum, d) => sum + d.debtAmount, 0);

    console.log("\n" + "=".repeat(60));
    console.log(`📊 NATIJA: ${debtors.length} ta qarzdor, jami qarz: ${totalDebt.toLocaleString()} so'm`);
    console.log("=".repeat(60) + "\n");

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
