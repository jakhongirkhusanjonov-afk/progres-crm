import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRole } from '@/lib/api-middleware'
import { hashPassword } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'

// Adminlarni olish (faqat SUPER_ADMIN)
export const GET = withRole(['SUPER_ADMIN'], async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Filter shartlarini tuzish
    const where: any = {
      role: 'ADMIN',
    }

    // Qidiruv - ism, telefon bo'yicha
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
        { username: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    // Umumiy sonni olish
    const total = await prisma.user.count({ where })

    // Pagination
    const skip = (page - 1) * limit

    const admins = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        email: true,
        isActive: true,
        lastLogin: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    return NextResponse.json({
      admins,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get admins error:', error)
    return NextResponse.json(
      { error: 'Adminlarni yuklashda xatolik' },
      { status: 500 }
    )
  }
})

// Yangi admin qo'shish (faqat SUPER_ADMIN)
export const POST = withRole(['SUPER_ADMIN'], async (request: NextRequest) => {
  try {
    const body = await request.json()
    const {
      firstName,
      lastName,
      phone,
      email,
      username,
      password,
    } = body

    // Majburiy maydonlarni tekshirish
    if (!firstName || !lastName || !phone) {
      return NextResponse.json(
        { error: 'Ism, familiya va telefon raqam majburiy' },
        { status: 400 }
      )
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username va parol kiritilishi shart' },
        { status: 400 }
      )
    }

    // Telefon raqam formatini tekshirish
    const phoneRegex = /^\+998\d{9}$/
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: 'Telefon raqam +998XXXXXXXXX formatida bo\'lishi kerak' },
        { status: 400 }
      )
    }

    // Telefon raqam unique tekshiruvi olib tashlandi
    // Bir xil telefon bilan bir nechta admin bo'lishi mumkin

    // Username formatini tekshirish
    const usernameRegex = /^[a-z0-9_\.]+$/
    if (!usernameRegex.test(username.toLowerCase())) {
      return NextResponse.json(
        { error: 'Username faqat kichik harflar, raqamlar, _ va . dan iborat bo\'lishi kerak' },
        { status: 400 }
      )
    }

    // Username unique ekanligini tekshirish
    const existingUsername = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    })

    if (existingUsername) {
      return NextResponse.json(
        { error: 'Bu username allaqachon band' },
        { status: 400 }
      )
    }

    // Parol uzunligini tekshirish
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' },
        { status: 400 }
      )
    }

    // Parolni hash va encrypt qilish
    const hashedPassword = await hashPassword(password)
    const encryptedPassword = encrypt(password)

    // Yangi admin (User) yaratish
    const newAdmin = await prisma.user.create({
      data: {
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        phone,
        email: email || null,
        username: username.toLowerCase(),
        password: hashedPassword,
        plainPassword: encryptedPassword,
        role: 'ADMIN',
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        phone: true,
        email: true,
        isActive: true,
        role: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      admin: newAdmin,
      credentials: {
        username: username.toLowerCase(),
        password,
      },
    })
  } catch (error) {
    console.error('POST /api/admins - Xatolik:', error)
    return NextResponse.json(
      { error: 'Admin qo\'shishda xatolik yuz berdi' },
      { status: 500 }
    )
  }
})
