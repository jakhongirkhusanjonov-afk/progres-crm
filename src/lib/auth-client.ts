/**
 * Client-side auth utility functions
 * Cookie va localStorage bilan ishlash uchun funksiyalar
 */

/**
 * Tokenni cookie va localStorage'ga saqlash
 */
export function saveToken(token: string, maxAge: number = 7 * 24 * 60 * 60) {
  // Cookie'ga saqlash
  document.cookie = `token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`

  // localStorage'ga ham saqlash (ixtiyoriy, backup uchun)
  localStorage.setItem('token', token)
}

/**
 * User ma'lumotlarini localStorage'ga saqlash
 */
export function saveUser(user: any) {
  localStorage.setItem('user', JSON.stringify(user))
}

/**
 * Cookie'dan tokenni olish
 */
export function getTokenFromCookie(): string | null {
  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === 'token') {
      return value
    }
  }
  return null
}

/**
 * localStorage'dan tokenni olish
 */
export function getTokenFromLocalStorage(): string | null {
  return localStorage.getItem('token')
}

/**
 * Token olish (cookie va localStorage'dan)
 */
export function getToken(): string | null {
  return getTokenFromCookie() || getTokenFromLocalStorage()
}

/**
 * User ma'lumotlarini olish
 */
export function getUser(): any | null {
  const userStr = localStorage.getItem('user')
  if (!userStr) return null

  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

/**
 * Logout - barcha auth ma'lumotlarini o'chirish
 */
export function logout() {
  // Cookie'dan tokenni o'chirish
  document.cookie = 'token=; path=/; max-age=0'

  // localStorage'dan ma'lumotlarni o'chirish
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

/**
 * Foydalanuvchi tizimga kirganmi?
 */
export function isAuthenticated(): boolean {
  return !!getToken()
}
