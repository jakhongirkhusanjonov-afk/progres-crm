import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'
import { Prisma } from '@prisma/client'

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const user = getUser(request)
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Ruxsat yo\'q' }, { status: 403 })
    }

    const targetMonth = 9
    const targetYear = 2026

    const activeGroupStudents = await prisma.groupStudent.findMany({
      where: {
        status: 'ACTIVE',
        student: { status: 'ACTIVE' },
        group: { status: 'ACTIVE' },
      },
      select: {
        groupId: true,
        studentId: true,
        price: true,
        group: {
          select: {
            price: true,
            course: { select: { price: true } },
          },
        },
      },
    })

    let updatedCount = 0

    // O'zgartirish uzoq vaqt olmasligi uchun batchlarda parallel run qilish imkoniyati
    const updates = []
    
    for (const gs of activeGroupStudents) {
      const monthlyFee = Number(gs.price || gs.group.price || gs.group.course.price || 0)
      if (monthlyFee > 0) {
        updates.push(
          prisma.monthlyCharge.updateMany({
            where: {
              groupId: gs.groupId,
              studentId: gs.studentId,
              month: targetMonth,
              year: targetYear,
            },
            data: {
              amount: new Prisma.Decimal(monthlyFee.toString())
            }
          })
        )
      }
    }

    const results = await Promise.all(updates)
    updatedCount = results.reduce((acc, curr) => acc + curr.count, 0)

    console.log(`POST /api/payments/fix-september - ${updatedCount} ta yozuv tuzatildi`);

    return NextResponse.json({
      success: true,
      updatedCount,
      message: `${targetMonth}/${targetYear} uchun ${updatedCount} ta to'lov qiymati hozirgi guruh narxiga moslandi`,
    })

  } catch (error) {
    console.error('Fix september charges error:', error)
    return NextResponse.json(
      { error: "To'lov qiymatlarini tuzatishda xatolik yuz berdi" },
      { status: 500 }
    )
  }
})
