import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'

// Parolni o'zgartirish
export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const currentUser = getUser(request)

    if (!currentUser) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    const body = await request.json()
    const { currentPassword, newPassword, confirmPassword } = body

    // Tekshirishlar
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: 'Barcha maydonlarni to\'ldiring' },
        { status: 400 }
      )
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: 'Yangi parollar mos emas' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Yangi parol kamida 6 ta belgidan iborat bo\'lishi kerak' },
        { status: 400 }
      )
    }

    // Joriy foydalanuvchini topish
    const user = await prisma.user.findUnique({
      where: { id: currentUser.userId },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Foydalanuvchi topilmadi' },
        { status: 404 }
      )
    }

    // Joriy parolni tekshirish
    const isValidPassword = await verifyPassword(currentPassword, user.password)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Joriy parol noto\'g\'ri' },
        { status: 400 }
      )
    }

    // Yangi parolni hash va encrypt qilish
    const hashedPassword = await hashPassword(newPassword)
    const encryptedPassword = encrypt(newPassword)

    // Parolni yangilash
    await prisma.user.update({
      where: { id: currentUser.userId },
      data: {
        password: hashedPassword,
        plainPassword: encryptedPassword,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Parol muvaffaqiyatli o\'zgartirildi',
    })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { error: 'Parolni o\'zgartirishda xatolik' },
      { status: 500 }
    )
  }
})
