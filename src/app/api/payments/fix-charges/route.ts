import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// POST - Ma'lumotlarni tuzatish: MonthlyCharge yozuvlarini guruhning hozirgi narxiga moslashtirish
// Bu endpoint guruhning joriy narxini o'qib, belgilangan oy/yildan boshlab
// barcha MonthlyCharge yozuvlarini yangi narxga yangilaydi
// FAQAT SUPER_ADMIN uchun
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const user = getUser(request)
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Faqat SUPER_ADMIN ruxsati' }, { status: 403 })
    }

    const body = await request.json()
    const { groupId, month, year } = body

    // Validatsiya
    if (!month || !year) {
      return NextResponse.json(
        { error: 'month va year majburiy' },
        { status: 400 }
      )
    }

    // Agar groupId berilmagan bo'lsa — barcha guruhlar uchun tuzatish
    const targetGroups = groupId
      ? [await prisma.group.findUnique({
          where: { id: groupId },
          include: {
            course: { select: { price: true } },
            groupStudents: {
              where: { status: 'ACTIVE' },
              select: { studentId: true, price: true },
            },
          },
        })]
      : await prisma.group.findMany({
          where: { status: 'ACTIVE' },
          include: {
            course: { select: { price: true } },
            groupStudents: {
              where: { status: 'ACTIVE' },
              select: { studentId: true, price: true },
            },
          },
        })

    let totalUpdated = 0
    const corrections: { groupName: string; groupId: string; updatedCount: number; newPrice: number }[] = []

    for (const group of targetGroups) {
      if (!group) continue

      const groupPrice = Number(group.price || group.course.price || 0)
      if (groupPrice === 0) continue

      // Har bir talaba uchun shu oy/yildagi MonthlyCharge ni yangilash
      for (const gs of group.groupStudents) {
        // Individual narxi bor talabalar uchun ularning narxini ishlatish
        const studentPrice = gs.price ? Number(gs.price) : groupPrice

        // Upsert: mavjud bo'lsa yangilash, yo'q bo'lsa yaratish
        const existing = await prisma.monthlyCharge.findUnique({
          where: {
            groupId_studentId_month_year: {
              groupId: group.id,
              studentId: gs.studentId,
              month: Number(month),
              year: Number(year),
            },
          },
        })

        if (existing) {
          // Mavjud — narxni yangilash
          if (Number(existing.amount) !== studentPrice) {
            await prisma.monthlyCharge.update({
              where: { id: existing.id },
              data: { amount: studentPrice },
            })
            totalUpdated++
          }
        } else {
          // Yo'q — yangi yaratish
          await prisma.monthlyCharge.create({
            data: {
              groupId: group.id,
              studentId: gs.studentId,
              month: Number(month),
              year: Number(year),
              amount: studentPrice,
            },
          })
          totalUpdated++
        }
      }

      corrections.push({
        groupName: group.name,
        groupId: group.id,
        updatedCount: group.groupStudents.length,
        newPrice: groupPrice,
      })
    }

    console.log(`POST /api/payments/fix-charges - ${totalUpdated} ta yozuv tuzatildi, ${corrections.length} ta guruh`)

    return NextResponse.json({
      success: true,
      totalUpdated,
      corrections,
      message: `${totalUpdated} ta MonthlyCharge yozuvi tuzatildi (${month}/${year})`,
    })
  } catch (error) {
    console.error('Fix charges error:', error)
    return NextResponse.json(
      { error: "Ma'lumotlarni tuzatishda xatolik" },
      { status: 500 }
    )
  }
})
