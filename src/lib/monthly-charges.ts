import { Prisma, PrismaClient } from '@prisma/client'
import { prisma as defaultPrisma } from '@/lib/prisma'

/**
 * Oy va yilni solishtirish uchun yordamchi
 * @returns -1, 0, yoki 1 (a < b, a == b, a > b)
 */
function compareMonthYear(aMonth: number, aYear: number, bMonth: number, bYear: number): number {
  if (aYear !== bYear) return aYear < bYear ? -1 : 1
  if (aMonth !== bMonth) return aMonth < bMonth ? -1 : 1
  return 0
}

/**
 * Berilgan sana qaysi oy-yilga to'g'ri kelishini aniqlaydi
 */
function getMonthYear(date: Date): { month: number; year: number } {
  return {
    month: date.getMonth() + 1, // 1-12
    year: date.getFullYear(),
  }
}

/**
 * Talaba-guruh jufti uchun MonthlyCharge yozuvlarini yaratadi.
 * - enrollDate dan (yoki group.startDate, qaysi kechroq bo'lsa) hozirgi oygacha
 * - Mavjud yozuvlarni o'zgartirmaydi (skipDuplicates)
 * 
 * @param groupId - Guruh ID
 * @param studentId - Talaba ID
 * @param enrollDate - Talabaning guruhga qo'shilgan sanasi
 * @param groupStartDate - Guruhning boshlanish sanasi
 * @param price - Har oylik narx (Decimal)
 * @param tx - Prisma transaction (ixtiyoriy)
 */
export async function ensureMonthlyCharges(
  groupId: string,
  studentId: string,
  enrollDate: Date,
  groupStartDate: Date,
  price: Prisma.Decimal | number,
  tx?: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
): Promise<void> {
  const db = tx || defaultPrisma

  const startPoint = enrollDate > groupStartDate ? enrollDate : groupStartDate
  const { month: startMonth, year: startYear } = getMonthYear(startPoint)

  const now = new Date()
  const { month: currentMonth, year: currentYear } = getMonthYear(now)

  // Oylar bo'yicha iteratsiya: startPoint dan currentMonth gacha
  const charges: Prisma.MonthlyChargeCreateManyInput[] = []
  let m = startMonth
  let y = startYear

  while (compareMonthYear(m, y, currentMonth, currentYear) <= 0) {
    charges.push({
      groupId,
      studentId,
      month: m,
      year: y,
      amount: new Prisma.Decimal(price.toString()),
    })

    // Keyingi oy
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }

  if (charges.length > 0) {
    await db.monthlyCharge.createMany({
      data: charges,
      skipDuplicates: true,
    })
  }
}

/**
 * Guruh narxini yangilash va MonthlyCharge yozuvlarini yangilash.
 * 
 * - effectiveMonth/Year dan boshlab barcha mavjud MonthlyCharge'larni o'chiradi
 * - Yangi narx bilan qaytadan yaratadi (effectiveMonth dan current month gacha)
 * - Group.price ni yangilaydi
 * 
 * @param groupId - Guruh ID
 * @param newPrice - Yangi narx
 * @param effectiveMonth - Qaysi oydan boshlab (1-12)
 * @param effectiveYear - Qaysi yildan boshlab
 */
export async function updateGroupPrice(
  groupId: string,
  newPrice: number,
  effectiveMonth: number,
  effectiveYear: number,
): Promise<{ updatedStudents: number }> {
  return await defaultPrisma.$transaction(async (tx) => {
    // 1. Guruhni va faol talabalarni olish
    const group = await tx.group.findUnique({
      where: { id: groupId },
      include: {
        groupStudents: {
          where: { status: 'ACTIVE' },
          select: {
            studentId: true,
            enrollDate: true,
            price: true, // Individual narx
          },
        },
      },
    })

    if (!group) {
      throw new Error('Guruh topilmadi')
    }

    // 2. Group.price ni yangilash
    await tx.group.update({
      where: { id: groupId },
      data: { price: newPrice },
    })

    // 3. Effective oy/yildan boshlab eski MonthlyCharge'larni o'chirish
    // Faqat shu guruhga tegishli va effective sanadan keyingi yozuvlar
    await tx.monthlyCharge.deleteMany({
      where: {
        groupId,
        OR: [
          { year: { gt: effectiveYear } },
          {
            year: effectiveYear,
            month: { gte: effectiveMonth },
          },
        ],
      },
    })

    // 4. Har bir faol talaba uchun yangi narx bilan MonthlyCharge yaratish
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    let updatedStudents = 0

    for (const gs of group.groupStudents) {
      // Individual narxi bor talabalar uchun individual narxni saqlaymiz
      // Faqat individual narxi yo'q talabalar yangi guruh narxiga o'tadi
      const studentPrice = gs.price ? Number(gs.price) : newPrice

      const charges: Prisma.MonthlyChargeCreateManyInput[] = []
      let m = effectiveMonth
      let y = effectiveYear

      // effectiveMonth dan current month gacha
      while (compareMonthYear(m, y, currentMonth, currentYear) <= 0) {
        // Faqat enrollDate dan keyingi oylar uchun
        const enrollDate = new Date(gs.enrollDate)
        const enrollMonth = enrollDate.getMonth() + 1
        const enrollYear = enrollDate.getFullYear()
        const groupStartMonth = group.startDate.getMonth() + 1
        const groupStartYear = group.startDate.getFullYear()

        // Start point = max(enrollDate, groupStartDate)
        const startMonth = enrollDate > group.startDate ? enrollMonth : groupStartMonth
        const startYear_val = enrollDate > group.startDate ? enrollYear : groupStartYear

        // Bu oy startPoint dan keyin bo'lishi kerak
        if (compareMonthYear(m, y, startMonth, startYear_val) >= 0) {
          charges.push({
            groupId,
            studentId: gs.studentId,
            month: m,
            year: y,
            amount: new Prisma.Decimal(studentPrice.toString()),
          })
        }

        m++
        if (m > 12) {
          m = 1
          y++
        }
      }

      if (charges.length > 0) {
        await tx.monthlyCharge.createMany({
          data: charges,
          skipDuplicates: true,
        })
        updatedStudents++
      }
    }

    return { updatedStudents }
  })
}
