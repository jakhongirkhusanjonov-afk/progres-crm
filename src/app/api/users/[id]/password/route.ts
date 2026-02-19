import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTokenFromRequest } from '@/lib/api-middleware'
import { decrypt } from '@/lib/crypto'
import { isSuperAdmin } from '@/lib/permissions'

// Parolni ko'rish (faqat SUPER_ADMIN)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Debug: Request headers
    console.log('=== Password API Debug ===')
    console.log('x-user-id:', request.headers.get('x-user-id'))
    console.log('x-user-role:', request.headers.get('x-user-role'))
    console.log('Authorization header exists:', !!request.headers.get('authorization'))
    console.log('Cookie token exists:', !!request.cookies.get('token')?.value)

    // Token tekshirish
    const currentUser = verifyTokenFromRequest(request)
    console.log('Current user from token:', JSON.stringify(currentUser, null, 2))

    if (!currentUser) {
      console.log('ERROR: No user found from token')
      return NextResponse.json(
        {
          error: 'Autentifikatsiya talab qilinadi',
          debug: {
            hasAuthHeader: !!request.headers.get('authorization'),
            hasCookie: !!request.cookies.get('token')?.value,
            hasXUserHeaders: !!request.headers.get('x-user-id')
          }
        },
        { status: 401 }
      )
    }

    const { id } = await params
    console.log('Requested user ID:', id)
    console.log('Current user role:', currentUser.role)

    // SUPER_ADMIN tekshirish
    if (!isSuperAdmin(currentUser.role)) {
      console.log('ERROR: User is not SUPER_ADMIN, role:', currentUser.role)
      return NextResponse.json(
        {
          error: 'Bu amal uchun ruxsat yo\'q. Faqat SUPER_ADMIN ruxsat berilgan.',
          yourRole: currentUser.role
        },
        { status: 403 }
      )
    }

    console.log('Access granted for SUPER_ADMIN')

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        fullName: true,
        plainPassword: true,
        role: true,
        teacher: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        student: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        admin: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!user) {
      console.log('ERROR: User not found with ID:', id)
      return NextResponse.json(
        { error: 'Foydalanuvchi topilmadi' },
        { status: 404 }
      )
    }

    console.log('User found:', user.username)

    // Parolni deshifrlash
    let decryptedPassword = null
    if (user.plainPassword) {
      try {
        decryptedPassword = decrypt(user.plainPassword)
        console.log('Password decrypted successfully')
      } catch (decryptError) {
        console.error('Decrypt error:', decryptError)
        decryptedPassword = null
      }
    }

    // Ism-familiya
    const userWithAdmin = user as typeof user & { admin?: { firstName: string; lastName: string } | null }
    const displayName =
      userWithAdmin.fullName ||
      (userWithAdmin.teacher
        ? `${userWithAdmin.teacher.firstName} ${userWithAdmin.teacher.lastName}`
        : userWithAdmin.student
          ? `${userWithAdmin.student.firstName} ${userWithAdmin.student.lastName}`
          : userWithAdmin.admin
            ? `${userWithAdmin.admin.firstName} ${userWithAdmin.admin.lastName}`
            : userWithAdmin.username)

    console.log('=== Password API Success ===')

    return NextResponse.json({
      username: user.username,
      password: decryptedPassword || '(Parol mavjud emas)',
      role: user.role,
      displayName,
    })
  } catch (error) {
    console.error('Get password error:', error)
    return NextResponse.json(
      {
        error: 'Parolni olishda xatolik',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
