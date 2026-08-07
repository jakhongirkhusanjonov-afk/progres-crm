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
        course: { select: { price: true } },
        groupStudents: {
          where: { status: 'ACTIVE' },
          select: {
            studentId: true,
            enrollDate: true,
            price: true, // Individual narx (null = guruh narxidan foydalanadi)
          },
        },
      },
    })

    if (!group) {
      throw new Error('Guruh topilmadi')
    }

    const oldGroupPrice = Number(group.price || group.course.price || 0)

    // 2. Group.price ni yangilash
    await tx.group.update({
      where: { id: groupId },
      data: { price: newPrice },
    })

    // 3. GroupStudent.price ni yangilash — UI da individual narx ko'rsatiladi
    //    Individual chegirma/narxi bo'lgan talabalar o'zgarmaydi
    //    price = null (guruh narxini ishlatadi) YOKI price = eski guruh narxi bo'lganlar yangilanadi
    await tx.groupStudent.updateMany({
      where: {
        groupId,
        status: 'ACTIVE',
        OR: [
          { price: null },
          { price: oldGroupPrice },
        ],
      },
      data: { price: newPrice },
    })

    // 4. Effective oy/yildan boshlab BARCHA MonthlyCharge'larni O'CHIRISH
    //    Bu zaruriy — eski narx bilan yaratilgan yozuvlar to'liq o'chiriladi
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

    // 5. Har bir faol talaba uchun yangi narx bilan MonthlyCharge QAYTADAN YARATISH
    //    effectiveMonth dan hozirgi oygacha
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()

    let updatedStudents = 0
    const allCharges: Prisma.MonthlyChargeCreateManyInput[] = []

    for (const gs of group.groupStudents) {
      // Individual narxi bor talabalar — ularning narxi O'ZGARMAYDI
      // Individual narxi yo'q (null) talabalar — yangi guruh narxiga o'tadi
      // Individual narxi eski guruh narxiga teng bo'lsa — bu "guruh narxini kuzatadi" degan ma'no
      const hasIndividualPrice = gs.price !== null && Number(gs.price) !== oldGroupPrice
      const studentPrice = hasIndividualPrice ? Number(gs.price) : newPrice

      const enrollDate = new Date(gs.enrollDate)
      const groupStartDate = group.startDate
      const startPoint = enrollDate > groupStartDate ? enrollDate : groupStartDate
      const { month: startMonth, year: startYear } = getMonthYear(startPoint)

      let m = effectiveMonth
      let y = effectiveYear

      let studentHasCharges = false

      // effectiveMonth dan current month gacha
      while (compareMonthYear(m, y, currentMonth, currentYear) <= 0) {
        // Bu oy talabaning startPoint dan keyin bo'lishi kerak
        if (compareMonthYear(m, y, startMonth, startYear) >= 0) {
          allCharges.push({
            groupId,
            studentId: gs.studentId,
            month: m,
            year: y,
            amount: new Prisma.Decimal(studentPrice.toString()),
          })
          studentHasCharges = true
        }

        m++
        if (m > 12) {
          m = 1
          y++
        }
      }

      if (studentHasCharges) updatedStudents++
    }

    // Batch insert — barcha talabalar uchun bir vaqtda
    if (allCharges.length > 0) {
      await tx.monthlyCharge.createMany({
        data: allCharges,
        skipDuplicates: true, // Xavfsizlik uchun, lekin delete qilingan yozuvlar qaytadan yaratiladi
      })
    }

    return { updatedStudents }
  })
}


/**
 * Batch: Barcha faol (GroupStudent, Group) juftlari uchun MonthlyCharge yozuvlarini
 * hozirgi oygacha yaratadi. Dashboard o'rniga admin endpoint yoki cron job orqali chaqiriladi.
 * 
 * Bu funksiya skipDuplicates ishlatadi, shuning uchun mavjud yozuvlar o'zgarmaydi.
 */
export async function ensureMonthlyChargesForAll(): Promise<{ processedCount: number }> {
  const db = defaultPrisma

  // Barcha faol guruh-talaba juftlarini olish
  const activeGroupStudents = await db.groupStudent.findMany({
    where: {
      status: 'ACTIVE',
      student: { status: 'ACTIVE' },
      group: { status: 'ACTIVE' },
    },
    select: {
      groupId: true,
      studentId: true,
      enrollDate: true,
      price: true,
      group: {
        select: {
          startDate: true,
          price: true,
          course: { select: { price: true } },
        },
      },
    },
  })

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // Barcha charges ni bir massivda yig'ib, bitta createMany bilan yaratish
  const allCharges: Prisma.MonthlyChargeCreateManyInput[] = []

  for (const gs of activeGroupStudents) {
    const monthlyFee = Number(gs.price || gs.group.price || gs.group.course.price || 0)
    if (monthlyFee === 0) continue

    const startPoint = gs.enrollDate > gs.group.startDate ? gs.enrollDate : gs.group.startDate
    const { month: startMonth, year: startYear } = getMonthYear(startPoint)

    let m = startMonth
    let y = startYear

    while (compareMonthYear(m, y, currentMonth, currentYear) <= 0) {
      allCharges.push({
        groupId: gs.groupId,
        studentId: gs.studentId,
        month: m,
        year: y,
        amount: new Prisma.Decimal(monthlyFee.toString()),
      })

      m++
      if (m > 12) {
        m = 1
        y++
      }
    }
  }

  if (allCharges.length > 0) {
    // Batch insert with skipDuplicates — faqat yangi yozuvlar yaratiladi
    // Katta hajmdagi ma'lumotlar uchun 1000 tadan ​bo'lib yuboramiz
    const BATCH_SIZE = 1000
    for (let i = 0; i < allCharges.length; i += BATCH_SIZE) {
      const batch = allCharges.slice(i, i + BATCH_SIZE)
      await db.monthlyCharge.createMany({
        data: batch,
        skipDuplicates: true,
      })
    }
  }

  return { processedCount: activeGroupStudents.length }
}
