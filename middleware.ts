import { NextRequest, NextResponse } from 'next/server'

// Public route'lar - autentifikatsiya talab qilinmaydi
const publicRoutes = ['/', '/login', '/register']

// Protected route'lar - autentifikatsiya talab qilinadi
const protectedRoutes = ['/dashboard', '/admin', '/teacher', '/student']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ═══════════════════════════════════════════
  // API ROUTE'LAR - middleware token tekshirmaydi
  // Har bir API route o'zining withAuth wrapper'i orqali tekshiradi
  // (Node.js Runtime'da ishlaydi, jsonwebtoken to'g'ri ishlaydi)
  // ═══════════════════════════════════════════
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // ═══════════════════════════════════════════
  // PUBLIC ROUTE'LAR
  // ═══════════════════════════════════════════
  if (publicRoutes.includes(pathname)) {
    // Login sahifasida cookie bor bo'lsa dashboard'ga yo'naltirish
    if (pathname === '/login' || pathname === '/register') {
      const token = request.cookies.get('token')?.value
      if (token) {
        // Token borligini tekshiramiz (Edge'da JWT verify qilmaymiz)
        // Dashboard'ga yo'naltiramiz, u yerda API orqali token tekshiriladi
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
    return NextResponse.next()
  }

  // ═══════════════════════════════════════════
  // PROTECTED ROUTE'LAR (Dashboard, etc.)
  // ═══════════════════════════════════════════
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute) {
    const token = request.cookies.get('token')?.value

    if (!token) {
      // Token yo'q - login sahifasiga yo'naltirish
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Token bor - davom etamiz
    // API so'rovlari orqali token validligi tekshiriladi
    return NextResponse.next()
  }

  return NextResponse.next()
}

// Middleware qaysi route'larda ishlashini belgilaymiz
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
