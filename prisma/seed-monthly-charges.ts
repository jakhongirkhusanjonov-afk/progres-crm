/**
 * One-time migration seed script
 * Bu skript mavjud barcha aktiv talabalar uchun MonthlyCharge yozuvlarini yaratadi.
 * 
 * Ishlatish: npx ts-node prisma/seed-monthly-charges.ts
 * yoki: npx tsx prisma/seed-monthly-charges.ts
 */

import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

function compareMonthYear(aMonth: number, aYear: number, bMonth: number, bYear: number): number {
  if (aYear !== bYear) return aYear < bYear ? -1 : 1
  if (aMonth !== bMonth) return aMonth < bMonth ? -1 : 1
  return 0
}

async function main() {
  console.log('🔄 MonthlyCharge yozuvlarini yaratish boshlandi...')

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  // Barcha aktiv guruh-talaba juftlarini olish
  const activeGroupStudents = await prisma.groupStudent.findMany({
    where: {
      status: 'ACTIVE',
      student: { status: 'ACTIVE' },
      group: { status: 'ACTIVE' },
    },
    include: {
      group: {
        select: {
          id: true,
          price: true,
          startDate: true,
          course: { select: { price: true } },
        },
      },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  })

  console.log(`📋 Jami ${activeGroupStudents.length} ta aktiv guruh-talaba topildi`)

  let totalCreated = 0
  let processedCount = 0

  for (const gs of activeGroupStudents) {
    const price = Number(gs.price || gs.group.price || gs.group.course.price || 0)
    if (price === 0) continue

    const enrollDate = new Date(gs.enrollDate)
    const groupStartDate = new Date(gs.group.startDate)
    const startPoint = enrollDate > groupStartDate ? enrollDate : groupStartDate

    const startMonth = startPoint.getMonth() + 1
    const startYear = startPoint.getFullYear()

    const charges: Prisma.MonthlyChargeCreateManyInput[] = []
    let m = startMonth
    let y = startYear

    while (compareMonthYear(m, y, currentMonth, currentYear) <= 0) {
      charges.push({
        groupId: gs.groupId,
        studentId: gs.studentId,
        month: m,
        year: y,
        amount: new Prisma.Decimal(price.toString()),
      })
      m++
      if (m > 12) {
        m = 1
        y++
      }
    }

    if (charges.length > 0) {
      const result = await prisma.monthlyCharge.createMany({
        data: charges,
        skipDuplicates: true,
      })
      totalCreated += result.count
    }

    processedCount++
    if (processedCount % 10 === 0) {
      console.log(`  ✅ ${processedCount}/${activeGroupStudents.length} talaba qayta ishlandi...`)
    }
  }

  console.log(`\n✅ Tayyor! Jami ${totalCreated} ta MonthlyCharge yozuvi yaratildi.`)
  console.log(`📊 ${processedCount} ta talaba qayta ishlandi.`)
}

main()
  .catch((e) => {
    console.error('❌ Xatolik:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
