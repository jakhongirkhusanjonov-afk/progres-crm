import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// Talabalarni olish (qidiruv va filter bilan)
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    // URL dan query parametrlarni olish
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const gender = searchParams.get('gender') || ''

    // Filter shartlarini tuzish
    const where: any = {}

    // Qidiruv - ism, familiya, telefon bo'yicha
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Status bo'yicha filter
    if (status) {
      where.status = status
    }

    // Jinsi bo'yicha filter
    if (gender) {
      where.gender = gender
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        createdBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
        groupStudents: {
          include: {
            group: {
              include: {
                course: true,
              },
            },
          },
        },
        _count: {
          select: {
            payments: true,
            attendances: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({ students })
  } catch (error) {
    console.error('Get students error:', error)
    return NextResponse.json(
      { error: 'Talabalarni yuklashda xatolik' },
      { status: 500 }
    )
  }
}

// Yangi talaba qo'shish
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const decoded = verifyToken(token || '')

    if (!decoded) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    const body = await request.json()
    const {
      firstName,
      lastName,
      middleName,
      phone,
      parentPhone,
      email,
      dateOfBirth,
      gender,
      address,
      passportSeries,
      passportNumber,
      notes,
    } = body

    // Majburiy maydonlarni tekshirish
    if (!firstName || !lastName || !phone) {
      return NextResponse.json(
        { error: 'Ism, familiya va telefon raqam majburiy' },
        { status: 400 }
      )
    }

    // Telefon raqam unique ekanligini tekshirish
    const existingStudent = await prisma.student.findUnique({
      where: { phone },
    })

    if (existingStudent) {
      return NextResponse.json(
        { error: 'Bu telefon raqam bilan talaba allaqachon ro\'yxatdan o\'tgan' },
        { status: 400 }
      )
    }

    // Yangi talaba yaratish
    const student = await prisma.student.create({
      data: {
        firstName,
        lastName,
        middleName,
        phone,
        parentPhone,
        email,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        address,
        passportSeries,
        passportNumber,
        notes,
        createdById: decoded.userId,
      },
      include: {
        createdBy: {
          select: {
            fullName: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, student })
  } catch (error) {
    console.error('Create student error:', error)
    return NextResponse.json(
      { error: 'Talaba qo\'shishda xatolik' },
      { status: 500 }
    )
  }
}
