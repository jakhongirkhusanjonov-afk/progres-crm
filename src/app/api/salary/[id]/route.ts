import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Maosh to'lovini olish
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params

    const payment = await prisma.salaryPayment.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json(
        { error: "To'lov topilmadi" },
        { status: 404 }
      )
    }

    return NextResponse.json({ payment })
  } catch (error) {
    console.error('Get salary payment error:', error)
    return NextResponse.json(
      { error: "To'lovni yuklashda xatolik" },
      { status: 500 }
    )
  }
})

// Maosh to'lovini yangilash
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const user = getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    const { id } = await params

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Noto'g'ri JSON format" },
        { status: 400 }
      )
    }

    const { amount, paymentDate, method, notes } = body

    // To'lov mavjudligini tekshirish
    const existingPayment = await prisma.salaryPayment.findUnique({
      where: { id },
    })

    if (!existingPayment) {
      return NextResponse.json(
        { error: "To'lov topilmadi" },
        { status: 404 }
      )
    }

    // Yangilash
    const updateData: any = {}
    if (amount !== undefined) updateData.amount = amount
    if (paymentDate !== undefined) updateData.paymentDate = new Date(paymentDate)
    if (method !== undefined) updateData.method = method
    if (notes !== undefined) updateData.notes = notes

    const payment = await prisma.salaryPayment.update({
      where: { id },
      data: updateData,
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "To'lov yangilandi",
      payment,
    })
  } catch (error: any) {
    console.error('Update salary payment error:', error)
    return NextResponse.json(
      { error: `To'lovni yangilashda xatolik: ${error?.message || "Noma'lum xato"}` },
      { status: 500 }
    )
  }
})

// Maosh to'lovini o'chirish
export const DELETE = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const user = getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    const { id } = await params

    // To'lov mavjudligini tekshirish
    const existingPayment = await prisma.salaryPayment.findUnique({
      where: { id },
    })

    if (!existingPayment) {
      return NextResponse.json(
        { error: "To'lov topilmadi" },
        { status: 404 }
      )
    }

    // O'chirish
    await prisma.salaryPayment.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: "To'lov o'chirildi",
    })
  } catch (error: any) {
    console.error('Delete salary payment error:', error)
    return NextResponse.json(
      { error: `To'lovni o'chirishda xatolik: ${error?.message || "Noma'lum xato"}` },
      { status: 500 }
    )
  }
})
