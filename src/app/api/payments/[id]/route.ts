import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Bitta to'lovni olish
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "To'lov topilmadi" },
        { status: 404 }
      );
    }

    return NextResponse.json(payment);
  } catch (error) {
    console.error("Payment GET error:", error);
    return NextResponse.json(
      { error: "To'lovni olishda xatolik" },
      { status: 500 }
    );
  }
}

// DELETE - To'lovni o'chirish
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const payment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "To'lov topilmadi" },
        { status: 404 }
      );
    }

    await prisma.payment.delete({
      where: { id },
    });

    return NextResponse.json({ message: "To'lov o'chirildi" });
  } catch (error) {
    console.error("Payment DELETE error:", error);
    return NextResponse.json(
      { error: "To'lovni o'chirishda xatolik" },
      { status: 500 }
    );
  }
}
