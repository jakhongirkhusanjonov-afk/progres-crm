import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'

// ⚠️ Bu route FAQAT bir martalik setup uchun! Ishlatgandan so'ng o'chiring!
// Ishlatish: GET /api/setup-admin

const ADMIN_USERNAME = 'superadmin'
const ADMIN_PASSWORD = 'Admin@12345'
const ADMIN_FULL_NAME = 'Super Admin'
const ADMIN_FIRST_NAME = 'Super'
const ADMIN_LAST_NAME = 'Admin'
const ADMIN_PHONE = '+998901234567'

export async function GET() {
  try {
    // Avval mavjudligini tekshirish
    const existingUser = await prisma.user.findUnique({
      where: { username: ADMIN_USERNAME },
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'Admin mavjud' },
        { status: 200 }
      )
    }

    // Parolni hashlash (bcryptjs, salt=10)
    const hashedPassword = await hashPassword(ADMIN_PASSWORD)

    // User (SUPER_ADMIN) yaratish
    const user = await prisma.user.create({
      data: {
        username: ADMIN_USERNAME,
        password: hashedPassword,
        fullName: ADMIN_FULL_NAME,
        role: 'SUPER_ADMIN',
        phone: ADMIN_PHONE,
        isActive: true,
      },
    })

    // Admin modeli bilan bog'lash
    await prisma.admin.create({
      data: {
        firstName: ADMIN_FIRST_NAME,
        lastName: ADMIN_LAST_NAME,
        phone: ADMIN_PHONE,
        userId: user.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Super Admin muvaffaqiyatli yaratildi!',
      credentials: {
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD, // ⚠️ Faqat bir martalik ko'rsatish uchun
      },
    })
  } catch (error) {
    console.error('Setup admin error:', error)
    return NextResponse.json(
      { success: false, message: 'Xatolik yuz berdi', error: String(error) },
      { status: 500 }
    )
  }
}
