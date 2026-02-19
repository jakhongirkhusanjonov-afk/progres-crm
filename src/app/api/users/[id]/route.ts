import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'
import { hashPassword } from '@/lib/auth'
import { encrypt, decrypt } from '@/lib/crypto'
import { isSuperAdmin } from '@/lib/permissions'

// User ma'lumotlarini olish
export const GET = withAuth(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const currentUser = getUser(request)
      const { id } = await params

      if (!currentUser) {
        return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
      }

      // Faqat SUPER_ADMIN yoki o'zini ko'ra oladi
      if (!isSuperAdmin(currentUser.role) && currentUser.userId !== id) {
        return NextResponse.json(
          { error: 'Bu amal uchun ruxsat yo\'q' },
          { status: 403 }
        )
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
          teacher: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
          admin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      })

      if (!user) {
        return NextResponse.json(
          { error: 'Foydalanuvchi topilmadi' },
          { status: 404 }
        )
      }

      return NextResponse.json({ user })
    } catch (error) {
      console.error('Get user error:', error)
      return NextResponse.json(
        { error: 'Foydalanuvchini yuklashda xatolik' },
        { status: 500 }
      )
    }
  }
)

// User ma'lumotlarini yangilash
export const PUT = withAuth(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const currentUser = getUser(request)
      const { id } = await params

      if (!currentUser) {
        return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
      }

      // Faqat SUPER_ADMIN yangilay oladi
      if (!isSuperAdmin(currentUser.role)) {
        return NextResponse.json(
          { error: 'Bu amal uchun ruxsat yo\'q' },
          { status: 403 }
        )
      }

      const body = await request.json()
      const { fullName, email, phone, isActive } = body

      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(fullName !== undefined && { fullName }),
          ...(email !== undefined && { email: email?.toLowerCase() || null }),
          ...(phone !== undefined && { phone }),
          ...(isActive !== undefined && { isActive }),
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
        },
      })

      // Agar user block qilinsa va u teacher/student bo'lsa, ularning statusini ham o'zgartirish
      if (isActive === false) {
        // Teacher statusini yangilash
        await prisma.teacher.updateMany({
          where: { userId: id },
          data: { status: 'RESIGNED' },
        })
        // Student statusini yangilash
        await prisma.student.updateMany({
          where: { userId: id },
          data: { status: 'SUSPENDED' },
        })
      }

      return NextResponse.json({ success: true, user })
    } catch (error) {
      console.error('Update user error:', error)
      return NextResponse.json(
        { error: 'Foydalanuvchini yangilashda xatolik' },
        { status: 500 }
      )
    }
  }
)

// User'ni o'chirish (yoki deaktivatsiya)
export const DELETE = withAuth(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const currentUser = getUser(request)
      const { id } = await params

      if (!currentUser || !isSuperAdmin(currentUser.role)) {
        return NextResponse.json(
          { error: 'Bu amal uchun ruxsat yo\'q' },
          { status: 403 }
        )
      }

      // O'zini o'chira olmaydi
      if (currentUser.userId === id) {
        return NextResponse.json(
          { error: 'O\'zingizni o\'chira olmaysiz' },
          { status: 400 }
        )
      }

      // Deaktivatsiya qilish (o'chirmasdan)
      const user = await prisma.user.update({
        where: { id },
        data: { isActive: false },
      })

      return NextResponse.json({ success: true, message: 'Foydalanuvchi bloklandi' })
    } catch (error) {
      console.error('Delete user error:', error)
      return NextResponse.json(
        { error: 'Foydalanuvchini o\'chirishda xatolik' },
        { status: 500 }
      )
    }
  }
)
