import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Maosh hisoblash funksiyasi
async function calculateTeacherSalary(teacherId: string, month: string) {
  const [year, monthNum] = month.split('-').map(Number)
  const monthStart = new Date(year, monthNum - 1, 1)
  const monthEnd = new Date(year, monthNum, 1)

  console.log('\n========== MAOSH HISOBLASH ==========')
  console.log(`Oy: ${month}`)

  // O'qituvchi ma'lumotlari
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: {
      groups: {
        where: { status: 'ACTIVE' },
        include: {
          course: true,
          groupStudents: {
            where: { status: 'ACTIVE' },
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          _count: {
            select: { groupStudents: true },
          },
        },
      },
      teacherCourses: {
        include: {
          course: true,
        },
      },
      salaryPayments: {
        where: {
          period: month,
        },
      },
    },
  })

  if (!teacher) {
    return null
  }

  console.log(`\nO'qituvchi: ${teacher.lastName} ${teacher.firstName}`)
  console.log(`Guruhlar soni: ${teacher.groups.length}`)

  // Har bir guruh uchun maosh hisoblash
  const groupDetails = await Promise.all(
    teacher.groups.map(async (group) => {
      console.log(`\n--- Guruh: ${group.name} ---`)

      // O'qituvchi foizini olish
      const teacherCourse = teacher.teacherCourses.find(
        (tc) => tc.courseId === group.courseId
      )
      const teacherPercentage = teacherCourse?.percentage || 50
      console.log(`O'qituvchi foizi: ${teacherPercentage}%`)

      // Guruh default narxi
      const groupDefaultPrice = group.price || group.course.price
      console.log(`Guruh default narxi: ${Number(groupDefaultPrice).toLocaleString()} so'm`)

      // === TALABALAR INDIVIDUAL NARXLARI ===
      console.log(`\nTalabalar narxlari:`)
      let totalStudentPayments = 0
      const studentPrices: { name: string; price: number }[] = []

      for (const gs of group.groupStudents) {
        // Individual narx yoki guruh default narxi
        const studentPrice = gs.price !== null ? Number(gs.price) : Number(groupDefaultPrice)
        totalStudentPayments += studentPrice

        const studentName = `${gs.student.lastName} ${gs.student.firstName}`
        studentPrices.push({ name: studentName, price: studentPrice })

        console.log(`  - ${studentName}: ${studentPrice.toLocaleString()} so'm ${gs.price !== null ? '(individual)' : '(default)'}`)
      }

      console.log(`\nJami to'lov (SUM): ${totalStudentPayments.toLocaleString()} so'm`)

      // O'tilgan darslar soni (shu oy uchun unique sanalar)
      const lessons = await prisma.attendance.findMany({
        where: {
          groupId: group.id,
          date: {
            gte: monthStart,
            lt: monthEnd,
          },
        },
        select: {
          date: true,
        },
        distinct: ['date'],
      })
      const lessonsCount = lessons.length

      // Jami kutilgan darslar (oyda taxminan 8-12 dars)
      const scheduleDays = group.scheduleDays?.split(',').length || 2
      const expectedLessons = Math.ceil(scheduleDays * 4) // Oyda taxminan 4 hafta

      console.log(`O'tilgan darslar: ${lessonsCount} / ${expectedLessons} (kutilgan)`)

      // Davomat koeffitsienti
      const attendanceCoefficient = expectedLessons > 0
        ? Math.min(lessonsCount / expectedLessons, 1)
        : 0
      console.log(`Davomat koeffitsienti: ${attendanceCoefficient.toFixed(2)}`)

      // O'qituvchi ulushi = Jami to'lov × (Foiz / 100)
      const teacherShare = (totalStudentPayments * teacherPercentage) / 100
      console.log(`O'qituvchi ulushi: ${totalStudentPayments.toLocaleString()} × ${teacherPercentage}% = ${Math.round(teacherShare).toLocaleString()} so'm`)

      // Oylik maosh = Ulush × Davomat koeffitsienti
      const monthlySalary = teacherShare * attendanceCoefficient
      console.log(`Oylik maosh: ${Math.round(teacherShare).toLocaleString()} × ${attendanceCoefficient.toFixed(2)} = ${Math.round(monthlySalary).toLocaleString()} so'm`)

      return {
        group: {
          id: group.id,
          name: group.name,
          course: group.course.name,
        },
        studentCount: group._count.groupStudents,
        groupPrice: Number(groupDefaultPrice),
        totalStudentPayments,
        teacherPercentage,
        lessonsCount,
        expectedLessons,
        attendanceCoefficient: Math.round(attendanceCoefficient * 100) / 100,
        teacherShare: Math.round(teacherShare),
        monthlySalary: Math.round(monthlySalary),
        studentPrices, // Har bir talabaning narxi
      }
    })
  )

  // Jami maosh
  const totalSalary = groupDetails.reduce((sum, g) => sum + g.monthlySalary, 0)
  const totalTeacherShare = groupDetails.reduce((sum, g) => sum + g.teacherShare, 0)
  const totalStudentPayments = groupDetails.reduce((sum, g) => sum + g.totalStudentPayments, 0)

  // To'langan summa (shu oy uchun)
  const paidAmount = teacher.salaryPayments.reduce(
    (sum, p) => sum + Number(p.amount),
    0
  )

  // Qarz
  const debt = Math.max(totalSalary - paidAmount, 0)

  // === YAKUNIY HISOBOT ===
  console.log('\n========== YAKUNIY HISOBOT ==========')
  console.log(`O'qituvchi: ${teacher.lastName} ${teacher.firstName}`)
  console.log(`Davr: ${month}`)
  console.log(`Guruhlar soni: ${teacher.groups.length}`)
  console.log(`Jami talabalar to'lovi: ${totalStudentPayments.toLocaleString()} so'm`)
  console.log(`Jami o'qituvchi ulushi: ${totalTeacherShare.toLocaleString()} so'm`)
  console.log(`Jami oylik maosh: ${totalSalary.toLocaleString()} so'm`)
  console.log(`To'langan: ${paidAmount.toLocaleString()} so'm`)
  console.log(`Qarz: ${debt.toLocaleString()} so'm`)
  console.log('======================================\n')

  return {
    teacher: {
      id: teacher.id,
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      phone: teacher.phone,
    },
    period: month,
    groupsCount: teacher.groups.length,
    groupDetails,
    summary: {
      totalStudentPayments,
      totalTeacherShare,
      totalSalary,
      paidAmount,
      debt,
    },
    payments: teacher.salaryPayments,
  }
}

// Barcha o'qituvchilar maoshi
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)
    const status = searchParams.get('status') || 'ACTIVE'

    // Barcha o'qituvchilarni olish
    const teachers = await prisma.teacher.findMany({
      where: status ? { status: status as any } : {},
      include: {
        groups: {
          where: { status: 'ACTIVE' },
          include: {
            course: true,
            _count: {
              select: { groupStudents: true },
            },
          },
        },
        teacherCourses: true,
        salaryPayments: {
          where: {
            period: month,
          },
        },
      },
      orderBy: { lastName: 'asc' },
    })

    // Har bir o'qituvchi uchun maosh hisoblash
    const salaries = await Promise.all(
      teachers.map(async (teacher) => {
        const salaryData = await calculateTeacherSalary(teacher.id, month)
        return salaryData
      })
    )

    // Null bo'lganlarni filter qilish
    const validSalaries = salaries.filter((s) => s !== null)

    // Umumiy statistika
    const totalSalary = validSalaries.reduce((sum, s) => sum + (s?.summary.totalSalary || 0), 0)
    const totalPaid = validSalaries.reduce((sum, s) => sum + (s?.summary.paidAmount || 0), 0)
    const totalDebt = validSalaries.reduce((sum, s) => sum + (s?.summary.debt || 0), 0)

    return NextResponse.json({
      salaries: validSalaries,
      period: month,
      stats: {
        teachersCount: validSalaries.length,
        totalSalary,
        totalPaid,
        totalDebt,
      },
    })
  } catch (error) {
    console.error('Get salaries error:', error)
    return NextResponse.json(
      { error: "Maoshlarni yuklashda xatolik" },
      { status: 500 }
    )
  }
})

// Maosh to'lash
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const user = getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Noto'g'ri JSON format" },
        { status: 400 }
      )
    }

    const { teacherId, amount, paymentDate, period, method, notes } = body

    // Validatsiya
    if (!teacherId) {
      return NextResponse.json(
        { error: "O'qituvchi ID si kerak" },
        { status: 400 }
      )
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "To'lov summasi noto'g'ri" },
        { status: 400 }
      )
    }

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { error: "Davr formati noto'g'ri (YYYY-MM)" },
        { status: 400 }
      )
    }

    if (!method || !['CASH', 'CARD', 'BANK_TRANSFER', 'PAYME', 'CLICK', 'UZUM'].includes(method)) {
      return NextResponse.json(
        { error: "To'lov usuli noto'g'ri" },
        { status: 400 }
      )
    }

    // O'qituvchi mavjudligini tekshirish
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
    })

    if (!teacher) {
      return NextResponse.json(
        { error: "O'qituvchi topilmadi" },
        { status: 404 }
      )
    }

    // To'lovni yaratish
    const payment = await prisma.salaryPayment.create({
      data: {
        teacherId,
        amount,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        period,
        method,
        notes: notes || null,
      },
      include: {
        teacher: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Maosh to'lovi muvaffaqiyatli saqlandi",
      payment,
    })
  } catch (error: any) {
    console.error('Create salary payment error:', error)
    return NextResponse.json(
      { error: `Maosh to'lashda xatolik: ${error?.message || "Noma'lum xato"}` },
      { status: 500 }
    )
  }
})
