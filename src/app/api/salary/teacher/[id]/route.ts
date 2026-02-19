import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

// Maosh hisoblash funksiyasi (batafsil)
async function calculateTeacherSalaryDetailed(teacherId: string, month: string) {
  const [year, monthNum] = month.split('-').map(Number)
  const monthStart = new Date(year, monthNum - 1, 1)
  const monthEnd = new Date(year, monthNum, 1)

  console.log('\n========== BATAFSIL MAOSH HISOBLASH ==========')
  console.log(`Oy: ${month}`)
  console.log(`O'qituvchi ID: ${teacherId}`)

  // O'qituvchi ma'lumotlari
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    include: {
      groups: {
        where: { status: 'ACTIVE' },
        include: {
          course: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
          groupStudents: {
            where: { status: 'ACTIVE' },
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  phone: true,
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
          course: {
            select: {
              id: true,
              name: true,
              price: true,
            },
          },
        },
      },
      salaryPayments: {
        where: {
          period: month,
        },
        orderBy: { paymentDate: 'desc' },
      },
    },
  })

  if (!teacher) {
    console.log('O\'qituvchi topilmadi!')
    return null
  }

  console.log(`\nO'qituvchi: ${teacher.lastName} ${teacher.firstName}`)
  console.log(`Guruhlar soni: ${teacher.groups.length}`)

  // Har bir guruh uchun batafsil hisob
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
      const groupPrice = group.price || group.course.price
      console.log(`Guruh default narxi: ${Number(groupPrice).toLocaleString()} so'm`)

      // Talabalar ro'yxati va ularning to'lovlari
      console.log(`\nTalabalar narxlari:`)
      const students = group.groupStudents.map((gs) => {
        const studentPrice = gs.price !== null ? Number(gs.price) : Number(groupPrice)
        const isIndividual = gs.price !== null

        console.log(`  - ${gs.student.lastName} ${gs.student.firstName}: ${studentPrice.toLocaleString()} so'm ${isIndividual ? '(individual)' : '(default)'}`)

        return {
          id: gs.student.id,
          name: `${gs.student.lastName} ${gs.student.firstName}`,
          phone: gs.student.phone,
          price: studentPrice,
          discountReason: gs.discountReason,
        }
      })

      // Talabalardan jami to'lov
      const totalStudentPayments = students.reduce((sum, s) => sum + s.price, 0)
      console.log(`\nJami to'lov (SUM): ${totalStudentPayments.toLocaleString()} so'm`)

      // O'tilgan darslar (shu oy uchun)
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
          status: true,
        },
        distinct: ['date'],
        orderBy: { date: 'desc' },
      })

      // Har bir dars uchun davomat statistikasi
      const lessonsWithStats = await Promise.all(
        lessons.map(async (lesson) => {
          const nextDay = new Date(lesson.date)
          nextDay.setDate(nextDay.getDate() + 1)

          const stats = await prisma.attendance.groupBy({
            by: ['status'],
            where: {
              groupId: group.id,
              date: {
                gte: lesson.date,
                lt: nextDay,
              },
            },
            _count: true,
          })

          const present = stats.find((s) => s.status === 'PRESENT')?._count || 0
          const late = stats.find((s) => s.status === 'LATE')?._count || 0
          const absent = stats.find((s) => s.status === 'ABSENT')?._count || 0

          return {
            date: lesson.date,
            present: present + late,
            absent,
            total: present + late + absent,
          }
        })
      )

      const lessonsCount = lessons.length

      // Kutilgan darslar
      const scheduleDays = group.scheduleDays?.split(',').length || 2
      const expectedLessons = Math.ceil(scheduleDays * 4)

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
          course: {
            id: group.course.id,
            name: group.course.name,
          },
          scheduleDays: group.scheduleDays,
        },
        students,
        studentCount: group._count.groupStudents,
        groupPrice: Number(groupPrice),
        totalStudentPayments,
        teacherPercentage,
        lessons: lessonsWithStats,
        lessonsCount,
        expectedLessons,
        attendanceCoefficient: Math.round(attendanceCoefficient * 100) / 100,
        teacherShare: Math.round(teacherShare),
        monthlySalary: Math.round(monthlySalary),
      }
    })
  )

  // Jami hisob-kitob
  const totalStudentPayments = groupDetails.reduce((sum, g) => sum + g.totalStudentPayments, 0)
  const totalTeacherShare = groupDetails.reduce((sum, g) => sum + g.teacherShare, 0)
  const totalSalary = groupDetails.reduce((sum, g) => sum + g.monthlySalary, 0)
  const totalLessons = groupDetails.reduce((sum, g) => sum + g.lessonsCount, 0)

  // To'langan summa
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
  console.log(`Jami darslar: ${totalLessons}`)
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
      middleName: teacher.middleName,
      phone: teacher.phone,
      status: teacher.status,
    },
    period: month,
    periodDisplay: `${monthNum < 10 ? '0' + monthNum : monthNum}.${year}`,
    groupDetails,
    summary: {
      groupsCount: teacher.groups.length,
      totalStudents: groupDetails.reduce((sum, g) => sum + g.studentCount, 0),
      totalStudentPayments,
      totalTeacherShare,
      totalLessons,
      totalSalary,
      paidAmount,
      debt,
      isPaid: debt === 0 && paidAmount > 0,
    },
    payments: teacher.salaryPayments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      paymentDate: p.paymentDate,
      method: p.method,
      notes: p.notes,
    })),
  }
}

// O'qituvchi maoshini olish
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: teacherId } = await params
    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

    const salaryData = await calculateTeacherSalaryDetailed(teacherId, month)

    if (!salaryData) {
      return NextResponse.json(
        { error: "O'qituvchi topilmadi" },
        { status: 404 }
      )
    }

    return NextResponse.json(salaryData)
  } catch (error) {
    console.error('Get teacher salary error:', error)
    return NextResponse.json(
      { error: "O'qituvchi maoshini yuklashda xatolik" },
      { status: 500 }
    )
  }
})
