import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRole, getUser } from '@/lib/api-middleware'

// Admin ma'lumotlarini olish
export const GET = withRole(['SUPER_ADMIN'], async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params

    const admin = await prisma.admin.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            isActive: true,
            lastLogin: true,
            role: true,
            createdAt: true,
          },
        },
      },
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin topilmadi' },
        { status: 404 }
      )
    }

    return NextResponse.json({ admin })
  } catch (error) {
    console.error('Get admin error:', error)
    return NextResponse.json(
      { error: 'Admin ma\'lumotlarini olishda xatolik' },
      { status: 500 }
    )
  }
})

// Admin ma'lumotlarini yangilash
export const PUT = withRole(['SUPER_ADMIN'], async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const body = await request.json()
    const { firstName, lastName, phone, email, isActive } = body

    const admin = await prisma.admin.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin topilmadi' },
        { status: 404 }
      )
    }

    // Telefon raqam unique ekanligini tekshirish
    if (phone && phone !== admin.phone) {
      const existingAdmin = await prisma.admin.findFirst({
        where: {
          phone,
          id: { not: id },
        },
      })

      if (existingAdmin) {
        return NextResponse.json(
          { error: 'Bu telefon raqam bilan boshqa admin mavjud' },
          { status: 400 }
        )
      }
    }

    // Transaction bilan yangilash
    const result = await prisma.$transaction(async (tx) => {
      // Admin ma'lumotlarini yangilash
      const updatedAdmin = await tx.admin.update({
        where: { id },
        data: {
          firstName: firstName?.trim() || admin.firstName,
          lastName: lastName?.trim() || admin.lastName,
          phone: phone || admin.phone,
          email: email || admin.email,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              isActive: true,
              role: true,
            },
          },
        },
      })

      // Agar isActive berilgan bo'lsa, user statusini yangilash
      if (admin.userId && typeof isActive === 'boolean') {
        await tx.user.update({
          where: { id: admin.userId },
          data: {
            isActive,
            fullName: `${firstName || admin.firstName} ${lastName || admin.lastName}`,
          },
        })
      }

      return updatedAdmin
    })

    return NextResponse.json({
      success: true,
      admin: result,
    })
  } catch (error) {
    console.error('Update admin error:', error)
    return NextResponse.json(
      { error: 'Admin ma\'lumotlarini yangilashda xatolik' },
      { status: 500 }
    )
  }
})

// Adminni o'chirish
export const DELETE = withRole(['SUPER_ADMIN'], async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const user = getUser(request)

    const admin = await prisma.admin.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin topilmadi' },
        { status: 404 }
      )
    }

    // O'zini o'chirish mumkin emas
    if (admin.userId === user?.userId) {
      return NextResponse.json(
        { error: 'O\'zingizni o\'chira olmaysiz' },
        { status: 400 }
      )
    }

    // Transaction bilan o'chirish
    await prisma.$transaction(async (tx) => {
      // Admin yozuvini o'chirish
      await tx.admin.delete({
        where: { id },
      })

      // Agar user bog'langan bo'lsa, uni ham o'chirish (yoki deactivate qilish)
      if (admin.userId) {
        await tx.user.update({
          where: { id: admin.userId },
          data: { isActive: false },
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Admin muvaffaqiyatli o\'chirildi',
    })
  } catch (error) {
    console.error('Delete admin error:', error)
    return NextResponse.json(
      { error: 'Adminni o\'chirishda xatolik' },
      { status: 500 }
    )
  }
})

// Admin statusini o'zgartirish (Block/Unblock)
export const PATCH = withRole(['SUPER_ADMIN'], async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const body = await request.json()
    const { action } = body // 'block' or 'unblock'
    const user = getUser(request)

    const admin = await prisma.admin.findUnique({
      where: { id },
      include: { user: true },
    })

    if (!admin) {
      return NextResponse.json(
        { error: 'Admin topilmadi' },
        { status: 404 }
      )
    }

    // O'zini block qilish mumkin emas
    if (admin.userId === user?.userId && action === 'block') {
      return NextResponse.json(
        { error: 'O\'zingizni block qila olmaysiz' },
        { status: 400 }
      )
    }

    if (!admin.userId) {
      return NextResponse.json(
        { error: 'Bu admin uchun user account mavjud emas' },
        { status: 400 }
      )
    }

    const isActive = action === 'unblock'

    await prisma.user.update({
      where: { id: admin.userId },
      data: { isActive },
    })

    return NextResponse.json({
      success: true,
      message: isActive ? 'Admin faollashtirildi' : 'Admin bloklandi',
      isActive,
    })
  } catch (error) {
    console.error('Toggle admin status error:', error)
    return NextResponse.json(
      { error: 'Admin statusini o\'zgartirishda xatolik' },
      { status: 500 }
    )
  }
})
