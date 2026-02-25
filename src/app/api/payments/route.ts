import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getUser } from "@/lib/api-middleware";
import { hasPermission } from "@/lib/permissions";

// GET - Barcha to'lovlarni olish
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const search = searchParams.get("search") || "";
    const paymentType = searchParams.get("paymentType") || "";
    const method = searchParams.get("method") || "";
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    // Filter shartlarini tuzish
    const where: any = {};

    if (studentId) {
      where.studentId = studentId;
    }

    if (search) {
      where.student = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search } },
        ],
      };
    }

    if (paymentType) {
      where.paymentType = paymentType;
    }

    if (method) {
      where.method = method;
    }

    if (dateFrom || dateTo) {
      where.paymentDate = {};
      if (dateFrom) {
        where.paymentDate.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.paymentDate.lte = new Date(dateTo + "T23:59:59");
      }
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
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
        orderBy: { paymentDate: "desc" },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    // Frontend uchun ma'lumotlarni formatlaymiz
    const formattedPayments = payments.map((payment) => ({
      id: payment.id,
      amount: Number(payment.amount),
      paymentType: payment.paymentType,
      method: payment.method,
      description: payment.description,
      paymentDate: payment.paymentDate.toISOString(),
      student: payment.student,
      createdBy: {
        id: payment.createdBy.id,
        name: payment.createdBy.fullName,
      },
    }));

    console.log(`GET /api/payments - ${formattedPayments.length} ta to'lov yuklandi`);

    return NextResponse.json({
      payments: formattedPayments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Payments GET error:", error);
    return NextResponse.json(
      { error: "To'lovlarni olishda xatolik" },
      { status: 500 }
    );
  }
});

// POST - Yangi to'lov qo'shish
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const user = getUser(request);

    if (!user) {
      return NextResponse.json({ error: "Avtorizatsiya kerak" }, { status: 401 });
    }

    // Role-based permission check
    if (!hasPermission(user.role, "payments", "create")) {
      console.error("POST /api/payments - Ruxsat yo'q:", user.role);
      return NextResponse.json(
        { error: "Sizda to'lov qabul qilish huquqi yo'q" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { studentId, amount, paymentType, method, description, groupId, forMonth, forYear } = body;

    // Validatsiya
    if (!studentId || !amount || !paymentType || !method) {
      return NextResponse.json(
        { error: "Talaba, summa, to'lov turi va usuli majburiy" },
        { status: 400 }
      );
    }

    // Student mavjudligini tekshirish
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Talaba topilmadi" },
        { status: 404 }
      );
    }

    // Guruh mavjudligini tekshirish (agar berilgan bo'lsa)
    if (groupId) {
      const group = await prisma.group.findUnique({ where: { id: groupId } });
      if (!group) {
        return NextResponse.json({ error: "Guruh topilmadi" }, { status: 404 });
      }
    }

    const payment = await prisma.payment.create({
      data: {
        studentId,
        amount,
        paymentType,
        method,
        description: description || null,
        groupId: groupId || null,
        forMonth: forMonth || null,
        forYear: forYear ? Number(forYear) : null,
        createdById: user.userId,
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
          select: {
            id: true,
            name: true,
            course: { select: { name: true } },
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

    console.log("POST /api/payments - To'lov yaratildi:", payment.id);

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        amount: Number(payment.amount),
        paymentType: payment.paymentType,
        method: payment.method,
        description: payment.description,
        groupId: payment.groupId,
        group: payment.group,
        forMonth: payment.forMonth,
        forYear: payment.forYear,
        paymentDate: payment.paymentDate.toISOString(),
        student: payment.student,
        createdBy: {
          id: payment.createdBy.id,
          name: payment.createdBy.fullName,
        },
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Payment POST error:", error);
    return NextResponse.json(
      { error: "To'lov qo'shishda xatolik" },
      { status: 500 }
    );
  }
});
