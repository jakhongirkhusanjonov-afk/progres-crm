import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// O'qituvchi o'z maoshini ko'rish
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const user = getUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    // Faqat TEACHER role uchun
    if (user.role !== 'TEACHER') {
      return NextResponse.json(
        { error: "Sizda bu ma'lumotlarga kirish huquqi yo'q" },
        { status: 403 }
      )
    }

    // teacherId ni olish
    const teacherId = user.teacherId

    if (!teacherId) {
      return NextResponse.json(
        { error: "O'qituvchi profili topilmadi" },
        { status: 404 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

    const [year, monthNum] = month.split('-').map(Number)
    const monthStart = new Date(year, monthNum - 1, 1)
    const monthEnd = new Date(year, monthNum, 1)

    console.log('\n========== O\'QITUVCHI MAOSHI (MY-SALARY) ==========')
    console.log(`TeacherId: ${teacherId}`)
    console.log(`Oy: ${month}`)

    // O'qituvchi ma'lumotlarini olish
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
          orderBy: {
            paymentDate: 'desc',
          },
        },
      },
    })

    if (!teacher) {
      return NextResponse.json(
        { error: "O'qituvchi topilmadi" },
        { status: 404 }
      )
    }

    console.log(`O'qituvchi: ${teacher.lastName} ${teacher.firstName}`)
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

        // Talabalar narxlari
        let totalStudentPayments = 0
        const studentPrices: { name: string; price: number }[] = []

        for (const gs of group.groupStudents) {
          const studentPrice = gs.price !== null ? Number(gs.price) : Number(groupDefaultPrice)
          totalStudentPayments += studentPrice

          const studentName = `${gs.student.lastName} ${gs.student.firstName}`
          studentPrices.push({ name: studentName, price: studentPrice })
        }

        console.log(`Jami to'lov: ${totalStudentPayments.toLocaleString()} so'm`)

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

        // Jami kutilgan darslar
        const scheduleDays = group.scheduleDays?.split(',').length || 2
        const expectedLessons = Math.ceil(scheduleDays * 4)

        console.log(`O'tilgan darslar: ${lessonsCount} / ${expectedLessons}`)

        // Davomat koeffitsienti
        const attendanceCoefficient = expectedLessons > 0
          ? Math.min(lessonsCount / expectedLessons, 1)
          : 0

        // O'qituvchi ulushi
        const teacherShare = (totalStudentPayments * teacherPercentage) / 100

        // Oylik maosh
        const monthlySalary = teacherShare * attendanceCoefficient

        console.log(`Oylik maosh: ${Math.round(monthlySalary).toLocaleString()} so'm`)

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
          studentPrices,
        }
      })
    )

    // Jami maosh
    const totalSalary = groupDetails.reduce((sum, g) => sum + g.monthlySalary, 0)
    const totalTeacherShare = groupDetails.reduce((sum, g) => sum + g.teacherShare, 0)
    const totalStudentPayments = groupDetails.reduce((sum, g) => sum + g.totalStudentPayments, 0)

    // To'langan summa
    const paidAmount = teacher.salaryPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0
    )

    // Qarz
    const debt = Math.max(totalSalary - paidAmount, 0)

    console.log('\n========== YAKUNIY HISOBOT ==========')
    console.log(`Jami maosh: ${totalSalary.toLocaleString()} so'm`)
    console.log(`To'langan: ${paidAmount.toLocaleString()} so'm`)
    console.log(`Qarz: ${debt.toLocaleString()} so'm`)
    console.log('======================================\n')

    return NextResponse.json({
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
      payments: teacher.salaryPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        paymentDate: p.paymentDate.toISOString(),
        method: p.method,
        notes: p.notes,
      })),
    })
  } catch (error) {
    console.error('My salary error:', error)
    return NextResponse.json(
      { error: "Maosh ma'lumotlarini yuklashda xatolik" },
      { status: 500 }
    )
  }
})
