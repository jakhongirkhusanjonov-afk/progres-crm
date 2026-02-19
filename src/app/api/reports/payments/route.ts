import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRole, getUser } from '@/lib/api-middleware'

// To'lovlar hisobotini olish - faqat SUPER_ADMIN
async function handleGET(request: NextRequest) {
  try {
    const user = getUser(request)
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Ruxsat yo\'q' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const groupId = searchParams.get('groupId')

    // Sana filtrlari
    const dateFilter: any = {}
    if (from) {
      dateFilter.gte = new Date(from)
    }
    if (to) {
      dateFilter.lte = new Date(to + 'T23:59:59')
    }

    // Guruh bo'yicha filter (student.groupStudents orqali)
    const groupFilter = groupId ? {
      student: {
        groupStudents: {
          some: { groupId }
        }
      }
    } : {}

    const payments = await prisma.payment.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 && { paymentDate: dateFilter }),
        ...groupFilter
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            groupStudents: {
              include: {
                group: {
                  select: { name: true }
                }
              }
            }
          }
        },
        createdBy: {
          select: { fullName: true }
        }
      },
      orderBy: { paymentDate: 'desc' }
    })

    // Excel uchun formatlash
    const data = payments.map((p, index) => ({
      '№': index + 1,
      'Talaba': `${p.student.lastName} ${p.student.firstName}`,
      'Telefon': p.student.phone,
      'Guruh': p.student.groupStudents.map(gs => gs.group.name).join(', ') || '-',
      'Summa': Number(p.amount),
      'To\'lov turi': getPaymentTypeLabel(p.paymentType),
      'To\'lov usuli': getPaymentMethodLabel(p.method),
      'Sana': new Date(p.paymentDate).toLocaleDateString('uz-UZ'),
      'Izoh': p.description || '-',
      'Qabul qildi': p.createdBy.fullName || '-'
    }))

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Reports/Payments GET] Error:', error)
    return NextResponse.json(
      { error: 'Hisobotni yuklashda xatolik' },
      { status: 500 }
    )
  }
}

function getPaymentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'TUITION': "O'qish to'lovi",
    'REGISTRATION': "Ro'yxatga olish",
    'EXAM': 'Imtihon',
    'MATERIAL': 'Material',
    'OTHER': 'Boshqa'
  }
  return labels[type] || type
}

function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    'CASH': 'Naqd',
    'CARD': 'Karta',
    'BANK_TRANSFER': "Bank o'tkazmasi",
    'PAYME': 'Payme',
    'CLICK': 'Click',
    'UZUM': 'Uzum'
  }
  return labels[method] || method
}

export const GET = withRole(['SUPER_ADMIN'], handleGET)
