/**
 * API Middleware ishlatish misollari
 *
 * Bu faylda middleware'larni qanday ishlatish kerakligi ko'rsatilgan
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withRole, withAuthAndRole, getUser, isAdmin } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

// ============================================
// MISOL 1: Oddiy autentifikatsiya
// ============================================
// Faqat login qilgan foydalanuvchilar kirishlari mumkin

export const GET_Example1 = withAuth(async (request: NextRequest) => {
  const user = getUser(request)

  return NextResponse.json({
    message: 'Siz tizimga kirgan foydalanuvchisiz',
    user: user,
  })
})

// ============================================
// MISOL 2: Role-based ruxsat
// ============================================
// Faqat SUPER_ADMIN va ADMIN kirishi mumkin

export const POST_Example2 = withRole(
  ['SUPER_ADMIN', 'ADMIN'],
  async (request: NextRequest) => {
    const user = getUser(request)
    const body = await request.json()

    return NextResponse.json({
      message: 'Siz admin huquqiga egasiz',
      user: user,
      data: body,
    })
  }
)

// ============================================
// MISOL 3: Bir nechta role
// ============================================
// TEACHER, ADMIN va SUPER_ADMIN kirishi mumkin

export const GET_Example3 = withRole(
  ['SUPER_ADMIN', 'ADMIN', 'TEACHER'],
  async (request: NextRequest) => {
    const user = getUser(request)

    return NextResponse.json({
      message: 'Siz o\'qituvchi yoki admin rolida kirgansiz',
      user: user,
    })
  }
)

// ============================================
// MISOL 4: Auth va Role birga
// ============================================
// withAuthAndRole yordamida ikkalasini birlashtirish

export const DELETE_Example4 = withAuthAndRole(
  ['SUPER_ADMIN'],
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const user = getUser(request)

    // Faqat SUPER_ADMIN to'liq o'chirish huquqiga ega
    await prisma.student.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      message: 'Talaba to\'liq o\'chirildi',
      deletedBy: user,
    })
  }
)

// ============================================
// MISOL 5: Conditional logic
// ============================================
// Har xil role'lar uchun turli mantiq

export const PUT_Example5 = withAuth(async (request: NextRequest) => {
  const user = getUser(request)
  const body = await request.json()

  // SUPER_ADMIN va ADMIN barcha maydonlarni o'zgartirishi mumkin
  if (isAdmin(request)) {
    // To'liq tahrirlash
    return NextResponse.json({
      message: 'Admin tomonidan to\'liq tahrirlandi',
      canEditAll: true,
    })
  }

  // TEACHER faqat ba'zi maydonlarni o'zgartirishi mumkin
  if (user?.role === 'TEACHER') {
    return NextResponse.json({
      message: 'O\'qituvchi tomonidan cheklangan tahrirlash',
      canEditAll: false,
    })
  }

  // Boshqa rollar uchun ruxsat yo'q
  return NextResponse.json(
    { error: 'Sizda tahrirlash huquqi yo\'q' },
    { status: 403 }
  )
})

// ============================================
// MISOL 6: Xato bilan ishlash
// ============================================

export const POST_Example6 = withAuthAndRole(
  ['SUPER_ADMIN', 'ADMIN'],
  async (request: NextRequest) => {
    try {
      const user = getUser(request)
      const body = await request.json()

      // Biznes logika
      // ...

      return NextResponse.json({
        success: true,
        data: body,
      })
    } catch (error) {
      console.error('Error:', error)
      return NextResponse.json(
        { error: 'Xatolik yuz berdi' },
        { status: 500 }
      )
    }
  }
)

// ============================================
// MISOL 7: Dynamic params bilan
// ============================================

export const GET_Example7_WithParams = withAuth(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const user = getUser(request)

  const data = await prisma.student.findUnique({
    where: { id: params.id },
  })

  if (!data) {
    return NextResponse.json(
      { error: 'Topilmadi' },
      { status: 404 }
    )
  }

  return NextResponse.json({ data })
})
