import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'
import { hasPermission } from '@/lib/permissions'
import { updateGroupPrice } from '@/lib/monthly-charges'

// POST - Guruh narxini yangilash (effectiveMonth dan boshlab)
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const user = getUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    // Role-based permission check
    if (!hasPermission(user.role, 'groups', 'update')) {
      return NextResponse.json(
        { error: 'Sizda guruh narxini yangilash huquqi yo\'q' },
        { status: 403 }
      )
    }

    const { id: groupId } = await params
    const body = await request.json()

    const { newPrice, effectiveMonth, effectiveYear } = body

    // Validatsiya
    if (!newPrice || newPrice <= 0) {
      return NextResponse.json(
        { error: 'Yangi narx ijobiy son bo\'lishi kerak' },
        { status: 400 }
      )
    }

    if (!effectiveMonth || effectiveMonth < 1 || effectiveMonth > 12) {
      return NextResponse.json(
        { error: 'Oy 1-12 orasida bo\'lishi kerak' },
        { status: 400 }
      )
    }

    if (!effectiveYear || effectiveYear < 2020 || effectiveYear > 2030) {
      return NextResponse.json(
        { error: 'Yil 2020-2030 orasida bo\'lishi kerak' },
        { status: 400 }
      )
    }

    // Guruh mavjudligini tekshirish
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, name: true, price: true },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Guruh topilmadi' },
        { status: 404 }
      )
    }

    // Narxni yangilash
    const result = await updateGroupPrice(groupId, newPrice, effectiveMonth, effectiveYear)

    const UZ_MONTHS: Record<number, string> = {
      1: 'Yanvar', 2: 'Fevral', 3: 'Mart', 4: 'Aprel',
      5: 'May', 6: 'Iyun', 7: 'Iyul', 8: 'Avgust',
      9: 'Sentabr', 10: 'Oktabr', 11: 'Noyabr', 12: 'Dekabr',
    }

    console.log(
      `POST /api/groups/${groupId}/update-price - Narx yangilandi: ${Number(group.price)} -> ${newPrice}, ` +
      `${UZ_MONTHS[effectiveMonth]} ${effectiveYear} dan boshlab, ${result.updatedStudents} ta talaba yangilandi`
    )

    return NextResponse.json({
      success: true,
      message: `Narx ${UZ_MONTHS[effectiveMonth]} ${effectiveYear} dan boshlab ${newPrice.toLocaleString()} so'mga yangilandi. ${result.updatedStudents} ta talaba yangilandi.`,
      oldPrice: Number(group.price),
      newPrice,
      effectiveMonth,
      effectiveYear,
      updatedStudents: result.updatedStudents,
    })
  } catch (error: any) {
    console.error('Update price error:', error)
    return NextResponse.json(
      { error: error?.message || 'Narxni yangilashda xatolik' },
      { status: 500 }
    )
  }
})
