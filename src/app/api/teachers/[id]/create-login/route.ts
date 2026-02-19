import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRole, getUser } from '@/lib/api-middleware'
import { hashPassword } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'

// O'qituvchi uchun login yaratish (faqat ADMIN va SUPER_ADMIN)
export const POST = withRole(
  ['SUPER_ADMIN', 'ADMIN'],
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    try {
      const { id: teacherId } = await params
      const user = getUser(request)

      if (!user) {
        return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
      }

      const body = await request.json()
      const { username, password } = body

      // Validation
      if (!username || !password) {
        return NextResponse.json(
          { error: 'Username va parol majburiy' },
          { status: 400 }
        )
      }

      // Username formatini tekshirish
      const usernameRegex = /^[a-z0-9_\.]+$/
      if (!usernameRegex.test(username.toLowerCase())) {
        return NextResponse.json(
          { error: 'Username faqat kichik harflar, raqamlar, _ va . dan iborat bo\'lishi kerak' },
          { status: 400 }
        )
      }

      // Username minimum uzunligi
      if (username.length < 3) {
        return NextResponse.json(
          { error: 'Username kamida 3 ta belgidan iborat bo\'lishi kerak' },
          { status: 400 }
        )
      }

      // Parol minimum uzunligi
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' },
          { status: 400 }
        )
      }

      // O'qituvchini tekshirish
      const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
        include: {
          user: true,
        },
      })

      if (!teacher) {
        return NextResponse.json(
          { error: 'O\'qituvchi topilmadi' },
          { status: 404 }
        )
      }

      // Agar allaqachon login bor bo'lsa
      if (teacher.userId) {
        return NextResponse.json(
          { error: 'Bu o\'qituvchi allaqachon login ga ega' },
          { status: 400 }
        )
      }

      // Username unique ekanligini tekshirish
      const existingUser = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'Bu username allaqachon band' },
          { status: 400 }
        )
      }

      // User yaratish va teacher ga biriktirish (transaction)
      const result = await prisma.$transaction(async (tx) => {
        // Parolni hash qilish
        const hashedPassword = await hashPassword(password)

        // Parolni shifrlash (admin ko'rishi uchun)
        const encryptedPassword = encrypt(password)

        // User yaratish
        const newUser = await tx.user.create({
          data: {
            username: username.toLowerCase(),
            password: hashedPassword,
            plainPassword: encryptedPassword,
            fullName: `${teacher.firstName} ${teacher.lastName}`,
            phone: teacher.phone,
            role: 'TEACHER',
            isActive: true,
          },
        })

        // Teacher ga user ni biriktirish
        await tx.teacher.update({
          where: { id: teacherId },
          data: { userId: newUser.id },
        })

        return newUser
      })

      console.log(`Login yaratildi - Teacher: ${teacherId}, User: ${result.id}, By: ${user.userId}`)

      return NextResponse.json({
        success: true,
        message: 'Login muvaffaqiyatli yaratildi',
        credentials: {
          username: username.toLowerCase(),
          password: password,
        },
        user: {
          id: result.id,
          username: result.username,
        },
      })
    } catch (error) {
      console.error('Create login error:', error)
      return NextResponse.json(
        { error: 'Login yaratishda xatolik yuz berdi' },
        { status: 500 }
      )
    }
  }
)
