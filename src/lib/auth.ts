import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export interface TokenPayload {
  userId: string
  username: string
  role: string
  teacherId?: string
  studentId?: string
}

export function generateToken(
  userId: string,
  username: string,
  role: string,
  teacherId?: string,
  studentId?: string
): string {
  const payload: TokenPayload = {
    userId,
    username,
    role,
    ...(teacherId && { teacherId }),
    ...(studentId && { studentId }),
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
  } catch {
    return null
  }
}

// Token'dan user ma'lumotlarini olish
export function getTokenPayload(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token) as TokenPayload
    return decoded
  } catch {
    return null
  }
}
