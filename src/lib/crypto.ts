import CryptoJS from 'crypto-js'
import bcrypt from 'bcryptjs'

const SECRET = process.env.ENCRYPTION_SECRET || 'default-secret-key-change-in-production'

// AES shifrlash
export function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, SECRET).toString()
}

// AES deshifrlash
export function decrypt(ciphertext: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET)
    return bytes.toString(CryptoJS.enc.Utf8)
  } catch {
    return ''
  }
}

// Parolni hash qilish (bcrypt)
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10)
}

// Parolni tekshirish
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash)
}

// Tasodifiy parol yaratish
export function generatePassword(length = 8): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const nums = '0123456789'
  const all = upper + lower + nums

  let pwd = ''
  // Kamida 1 ta katta harf, 1 ta kichik harf, 1 ta raqam
  pwd += upper[Math.floor(Math.random() * upper.length)]
  pwd += lower[Math.floor(Math.random() * lower.length)]
  pwd += nums[Math.floor(Math.random() * nums.length)]

  // Qolgan belgilar
  for (let i = 3; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)]
  }

  // Aralashtirish
  return pwd.split('').sort(() => 0.5 - Math.random()).join('')
}

// Username yaratish (ism va familiyadan)
export function generateUsername(firstName: string, lastName: string): string {
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const cleanLast = lastName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const random = Math.floor(Math.random() * 100)
  return `${cleanFirst}.${cleanLast}${random}`
}
