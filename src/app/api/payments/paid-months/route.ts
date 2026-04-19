import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api-middleware";

// GET - Berilgan talaba + guruh + yil uchun to'langan oylarni qaytarish
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const groupId = searchParams.get("groupId");
    const year = searchParams.get("year");

    if (!studentId || !groupId) {
      return NextResponse.json(
        { error: "studentId va groupId majburiy" },
        { status: 400 }
      );
    }

    const where: any = {
      studentId,
      groupId,
      paymentType: "TUITION",
      forMonth: { not: null },
    };

    if (year) {
      where.forYear = Number(year);
    }

    const payments = await prisma.payment.findMany({
      where,
      select: {
        forMonth: true,
        forYear: true,
      },
    });

    // To'langan oy-yillarni qaytarish
    const paidMonths = payments
      .filter((p) => p.forMonth)
      .map((p) => ({ month: p.forMonth!, year: p.forYear }));

    return NextResponse.json({ paidMonths });
  } catch (error) {
    console.error("Paid months GET error:", error);
    return NextResponse.json(
      { error: "Ma'lumotlarni olishda xatolik" },
      { status: 500 }
    );
  }
});
