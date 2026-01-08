import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'

// Public route'lar - autentifikatsiya talab qilinmaydi
const publicRoutes = ['/', '/login', '/register']

// Protected route'lar - autentifikatsiya talab qilinadi
const protectedRoutes = ['/dashboard', '/admin', '/teacher', '/student']

// API route'lar
const apiRoutes = '/api'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API route'lar uchun alohida tekshiruv
  if (pathname.startsWith(apiRoutes)) {
    // Auth API'lar uchun tekshiruv qilmaymiz
    if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/register')) {
      return NextResponse.next()
    }

    // Boshqa barcha API'lar uchun token tekshiramiz
    const token = request.cookies.get('token')?.value ||
                  request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: 'Autentifikatsiya talab qilinadi', success: false },
        { status: 401 }
      )
    }

    const decoded = verifyToken(token)

    if (!decoded) {
      return NextResponse.json(
        { error: 'Token yaroqsiz yoki muddati tugagan', success: false },
        { status: 401 }
      )
    }

    // Token ma'lumotlarini header'ga qo'shamiz
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', decoded.userId)
    requestHeaders.set('x-user-email', decoded.email)
    requestHeaders.set('x-user-role', decoded.role)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  // Public route'lar uchun tekshiruv qilmaymiz
  if (publicRoutes.includes(pathname)) {
    const token = request.cookies.get('token')?.value

    // Agar foydalanuvchi allaqachon tizimga kirgan bo'lsa, login/register sahifalariga kirishni oldini olamiz
    if (token && (pathname === '/login' || pathname === '/register')) {
      const decoded = verifyToken(token)
      if (decoded) {
        // Role'ga qarab dashboard'ga yo'naltiramiz
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }

    return NextResponse.next()
  }

  // Protected route'lar uchun token tekshiramiz
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute) {
    const token = request.cookies.get('token')?.value

    if (!token) {
      // Token yo'q bo'lsa login sahifasiga yo'naltiramiz
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const decoded = verifyToken(token)

    if (!decoded) {
      // Token yaroqsiz bo'lsa login sahifasiga yo'naltiramiz
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      const response = NextResponse.redirect(loginUrl)

      // Yaroqsiz tokenni o'chiramiz
      response.cookies.delete('token')

      return response
    }

    // Role-based access control (ixtiyoriy)
    // Agar kerak bo'lsa, role'ga qarab ruxsatni tekshirish mumkin
    const userRole = decoded.role as string

    // Admin route'larga faqat ADMIN kirishi mumkin
    if (pathname.startsWith('/admin') && userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Teacher route'larga faqat TEACHER va ADMIN kirishi mumkin
    if (pathname.startsWith('/teacher') && !['TEACHER', 'ADMIN'].includes(userRole)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Student route'larga faqat STUDENT va ADMIN kirishi mumkin
    if (pathname.startsWith('/student') && !['STUDENT', 'ADMIN'].includes(userRole)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Token ma'lumotlarini header'ga qo'shamiz (ixtiyoriy)
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', decoded.userId)
    requestHeaders.set('x-user-email', decoded.email)
    requestHeaders.set('x-user-role', decoded.role)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  // Boshqa barcha route'lar uchun davom etamiz
  return NextResponse.next()
}

// Middleware qaysi route'larda ishlashini belgilaymiz
export const config = {
  matcher: [
    /*
     * Quyidagi route'lardan tashqari barcha route'larda ishlaydi:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
