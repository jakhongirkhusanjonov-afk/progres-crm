// Client-side safe crypto utilities
// Bu funksiyalar brauzerda ishlatilishi mumkin

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
