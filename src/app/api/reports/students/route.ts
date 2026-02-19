import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRole, getUser } from '@/lib/api-middleware'

// Talabalar ro'yxati hisobotini olish - faqat SUPER_ADMIN
async function handleGET(request: NextRequest) {
  try {
    const user = getUser(request)
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Ruxsat yo\'q' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')
    const status = searchParams.get('status')

    const students = await prisma.student.findMany({
      where: {
        ...(groupId && {
          groupStudents: {
            some: { groupId }
          }
        }),
        ...(status && { status: status as any })
      },
      include: {
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: {
            group: {
              select: {
                name: true,
                course: { select: { name: true } },
                teacher: { select: { firstName: true, lastName: true } }
              }
            }
          }
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 1
        }
      },
      orderBy: [
        { lastName: 'asc' },
        { firstName: 'asc' }
      ]
    })

    // Excel uchun formatlash
    const data = students.map((s, index) => ({
      '№': index + 1,
      'Familiya': s.lastName,
      'Ism': s.firstName,
      'Telefon': s.phone,
      'Ota-ona telefoni': s.parentPhone || '-',
      'Tug\'ilgan sana': s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('uz-UZ') : '-',
      'Jinsi': s.gender === 'MALE' ? 'Erkak' : s.gender === 'FEMALE' ? 'Ayol' : '-',
      'Guruhlar': s.groupStudents.map(gs => gs.group.name).join(', ') || '-',
      'Kurslar': s.groupStudents.map(gs => gs.group.course.name).join(', ') || '-',
      'Holat': getStatusLabel(s.status),
      'Ro\'yxatga olish': new Date(s.enrollmentDate).toLocaleDateString('uz-UZ'),
      'Oxirgi to\'lov': s.payments[0]
        ? new Date(s.payments[0].paymentDate).toLocaleDateString('uz-UZ')
        : '-'
    }))

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Reports/Students GET] Error:', error)
    return NextResponse.json(
      { error: 'Hisobotni yuklashda xatolik' },
      { status: 500 }
    )
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'ACTIVE': 'Faol',
    'GRADUATED': 'Bitirgan',
    'SUSPENDED': 'To\'xtatilgan',
    'DROPPED': 'Chiqib ketgan'
  }
  return labels[status] || status
}

export const GET = withRole(['SUPER_ADMIN'], handleGET)
