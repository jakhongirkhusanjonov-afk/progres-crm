import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username va parolni kiriting' },
        { status: 400 }
      )
    }

    // User'ni topish (username yoki email bilan)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username.toLowerCase() },
          { email: username.toLowerCase() }
        ],
      },
      include: {
        teacher: {
          select: { id: true, firstName: true, lastName: true }
        },
        student: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Username yoki parol noto\'g\'ri' },
        { status: 401 }
      )
    }

    // Parolni tekshirish
    const isPasswordValid = await verifyPassword(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Username yoki parol noto\'g\'ri' },
        { status: 401 }
      )
    }

    // Active holatini tekshirish
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Accountingiz bloklangan. Administrator bilan bog\'laning.' },
        { status: 403 }
      )
    }

    // lastLogin yangilash
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    })

    // Teacher yoki Student ID olish
    const teacherId = user.teacher?.id
    const studentId = user.student?.id

    // Token yaratish
    const token = generateToken(
      user.id,
      user.username,
      user.role,
      teacherId,
      studentId
    )

    // Redirect URL aniqlash
    let redirectUrl = '/dashboard'
    if (user.role === 'TEACHER' && teacherId) {
      redirectUrl = `/dashboard/teachers/${teacherId}`
    } else if (user.role === 'STUDENT' && studentId) {
      redirectUrl = `/dashboard/students/${studentId}`
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName || (user.teacher ? `${user.teacher.firstName} ${user.teacher.lastName}` : user.student ? `${user.student.firstName} ${user.student.lastName}` : null),
        role: user.role,
        teacherId,
        studentId,
      },
      token,
      redirectUrl,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Tizimga kirishda xatolik yuz berdi' },
      { status: 500 }
    )
  }
}
