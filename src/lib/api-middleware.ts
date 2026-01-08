import { NextRequest, NextResponse } from 'next/server'
import { verifyToken as verifyJWT } from '@/lib/auth'

// Token payload interfeysi
export interface TokenPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

// Request'ga user ma'lumotlarini qo'shish uchun
export interface AuthenticatedRequest extends NextRequest {
  user?: TokenPayload
}

/**
 * Request header'dan tokenni olish va tekshirish
 */
export function extractToken(request: NextRequest): string | null {
  // Authorization header'dan token olish
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '')
  }

  // Cookie'dan token olish (middleware tomonidan qo'shilgan header)
  const cookieToken = request.headers.get('cookie')
    ?.split(';')
    .find(c => c.trim().startsWith('token='))
    ?.split('=')[1]

  if (cookieToken) {
    return cookieToken
  }

  // Middleware tomonidan qo'shilgan x-user-* headerlar mavjud bo'lsa, token valid deb hisoblaymiz
  const userId = request.headers.get('x-user-id')
  if (userId) {
    // Bu holda middleware allaqachon tekshirgan, tokenni qayta tekshirishga hojat yo'q
    return 'valid-from-middleware'
  }

  return null
}

/**
 * Tokenni tekshirish va payload olish
 */
export function verifyTokenFromRequest(request: NextRequest): TokenPayload | null {
  // Avval middleware tomonidan qo'shilgan headerlarni tekshiramiz
  const userId = request.headers.get('x-user-id')
  const userEmail = request.headers.get('x-user-email')
  const userRole = request.headers.get('x-user-role')

  if (userId && userEmail && userRole) {
    // Middleware allaqachon tokenni tekshirgan
    return {
      userId,
      email: userEmail,
      role: userRole,
    }
  }

  // Agar middleware'dan o'tmagan bo'lsa, tokenni o'zimiz tekshiramiz
  const token = extractToken(request)
  if (!token || token === 'valid-from-middleware') {
    return null
  }

  const decoded = verifyJWT(token)
  return decoded as TokenPayload | null
}

/**
 * Authentication middleware
 * Token borligini va validligini tekshiradi
 */
export function withAuth(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      const user = verifyTokenFromRequest(request)

      if (!user) {
        return NextResponse.json(
          {
            error: 'Autentifikatsiya talab qilinadi',
            success: false,
          },
          { status: 401 }
        )
      }

      // User ma'lumotlarini request'ga qo'shamiz (TypeScript uchun)
      // @ts-ignore - NextRequest'ni extend qilamiz
      request.user = user

      return handler(request, context)
    } catch (error) {
      console.error('Auth middleware error:', error)
      return NextResponse.json(
        {
          error: 'Autentifikatsiya xatosi',
          success: false,
        },
        { status: 401 }
      )
    }
  }
}

/**
 * Role-based authorization middleware
 * Foydalanuvchi rolini tekshiradi
 */
export function withRole(
  allowedRoles: string[],
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      const user = verifyTokenFromRequest(request)

      if (!user) {
        return NextResponse.json(
          {
            error: 'Autentifikatsiya talab qilinadi',
            success: false,
          },
          { status: 401 }
        )
      }

      // Role tekshiruvi
      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json(
          {
            error: 'Sizda bu amalni bajarish uchun ruxsat yo\'q',
            success: false,
            requiredRoles: allowedRoles,
            yourRole: user.role,
          },
          { status: 403 }
        )
      }

      // User ma'lumotlarini request'ga qo'shamiz
      // @ts-ignore
      request.user = user

      return handler(request, context)
    } catch (error) {
      console.error('Role middleware error:', error)
      return NextResponse.json(
        {
          error: 'Avtorizatsiya xatosi',
          success: false,
        },
        { status: 403 }
      )
    }
  }
}

/**
 * Authentication va Role middleware birga
 * Ikkala tekshiruvni ham amalga oshiradi
 */
export function withAuthAndRole(
  allowedRoles: string[],
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>
) {
  return withAuth(withRole(allowedRoles, handler))
}

/**
 * Helper function - Request'dan user ma'lumotlarini olish
 */
export function getUser(request: NextRequest): TokenPayload | null {
  // @ts-ignore
  return request.user || verifyTokenFromRequest(request)
}

/**
 * Helper function - User SUPER_ADMIN yoki ADMIN ekanligini tekshirish
 */
export function isAdmin(request: NextRequest): boolean {
  const user = getUser(request)
  return user ? ['SUPER_ADMIN', 'ADMIN'].includes(user.role) : false
}

/**
 * Helper function - User SUPER_ADMIN ekanligini tekshirish
 */
export function isSuperAdmin(request: NextRequest): boolean {
  const user = getUser(request)
  return user ? user.role === 'SUPER_ADMIN' : false
}
