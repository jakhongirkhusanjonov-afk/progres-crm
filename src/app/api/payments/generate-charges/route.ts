import { NextRequest, NextResponse } from 'next/server'
import { withAuth, getUser } from '@/lib/api-middleware'
import { ensureMonthlyChargesForAll } from '@/lib/monthly-charges'

// POST - Barcha faol talabalar uchun MonthlyCharge yozuvlarini yaratish
// Faqat SUPER_ADMIN/ADMIN tomonidan chaqirilishi mumkin
// Har oy boshida yoki yangi oy boshida ishlatiladi
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const user = getUser(request)
    if (!user || !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Ruxsat yo\'q' }, { status: 403 })
    }

    const result = await ensureMonthlyChargesForAll()

    console.log(`POST /api/payments/generate-charges - ${result.processedCount} ta talaba qayta ishlandi`)

    return NextResponse.json({
      success: true,
      processedCount: result.processedCount,
      message: `${result.processedCount} ta talaba uchun oylik to'lov yozuvlari yaratildi/yangilandi`,
    })
  } catch (error) {
    console.error('Generate charges error:', error)
    return NextResponse.json(
      { error: "Oylik to'lov yozuvlarini yaratishda xatolik" },
      { status: 500 }
    )
  }
})
