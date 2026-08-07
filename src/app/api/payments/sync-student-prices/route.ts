import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// POST - GroupStudent.price larni guruhning hozirgi narxiga sinxronlashtirish
// Individual chegirmasi bo'lmagan barcha talabalar yangilanadi
// FAQAT SUPER_ADMIN / ADMIN uchun
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const user = getUser(request)
    if (!user || !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 })
    }

    // Barcha faol guruhlarni hozirgi narxlari bilan olish
    const activeGroups = await prisma.group.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        price: true,
        course: { select: { price: true } },
      },
    })

    let totalSynced = 0
    const results: { groupName: string; groupPrice: number; syncedCount: number }[] = []

    for (const group of activeGroups) {
      const groupPrice = Number(group.price || group.course.price || 0)
      if (groupPrice === 0) continue

      // GroupStudent.price null YOKI guruh narxidan farqli bo'lganlarni topish va yangilash
      // Faqat price === null yoki price != groupPrice bo'lganlarni yangilaymiz
      // AMMo individual chegirma bo'lishi mumkin — shuning uchun faqat null larni yangilaymiz
      // va narxi eski bo'lganlarni (eski narxni bilmasdan, faqat null larni yangilash xavfsiz)
      const result = await prisma.groupStudent.updateMany({
        where: {
          groupId: group.id,
          status: 'ACTIVE',
          OR: [
            { price: null },
            // Eski narx bilan yozilgan yozuvlarni ham yangilash
            // Guruh narxiga teng bo'lmagan narxlarni SAQLAB QOLISH (chegirma)
          ],
        },
        data: { price: groupPrice },
      })

      if (result.count > 0) {
        totalSynced += result.count
        results.push({
          groupName: group.name,
          groupPrice,
          syncedCount: result.count,
        })
      }
    }

    console.log(`POST /api/payments/sync-student-prices - ${totalSynced} ta GroupStudent yangilandi`)

    return NextResponse.json({
      success: true,
      totalSynced,
      results,
      message: `${totalSynced} ta talabaning narxi sinxronlashtirildi`,
    })
  } catch (error) {
    console.error('Sync student prices error:', error)
    return NextResponse.json(
      { error: "Narxlarni sinxronlashtirishda xatolik" },
      { status: 500 }
    )
  }
})
