# API Middleware Dokumentatsiyasi

Bu faylda API middleware'larni qanday ishlatish haqida to'liq ma'lumot berilgan.

## Mavjud Middleware'lar

### 1. `withAuth` - Autentifikatsiya Middleware

Foydalanuvchi tizimga kirganligini tekshiradi. Token mavjud va valid bo'lishi kerak.

**Foydalanish:**

```typescript
import { withAuth, getUser } from '@/lib/api-middleware'

export const GET = withAuth(async (request: NextRequest) => {
  const user = getUser(request)

  // user.userId, user.email, user.role mavjud

  return NextResponse.json({ data: 'something' })
})
```

**Javoblar:**
- ✅ Token valid bo'lsa → Handler'ga o'tadi
- ❌ Token yo'q yoki invalid → 401 Unauthorized

---

### 2. `withRole` - Role-based Authorization

Foydalanuvchi ma'lum bir rolga ega ekanligini tekshiradi.

**Foydalanish:**

```typescript
import { withRole, getUser } from '@/lib/api-middleware'

// Faqat SUPER_ADMIN va ADMIN kirishi mumkin
export const DELETE = withRole(
  ['SUPER_ADMIN', 'ADMIN'],
  async (request: NextRequest) => {
    const user = getUser(request)

    // Bu yerda faqat SUPER_ADMIN yoki ADMIN bo'ladi

    return NextResponse.json({ success: true })
  }
)
```

**Parametrlar:**
- `allowedRoles: string[]` - Ruxsat berilgan rollar ro'yxati

**Javoblar:**
- ✅ Role mos kelsa → Handler'ga o'tadi
- ❌ Token yo'q → 401 Unauthorized
- ❌ Role mos kelmasa → 403 Forbidden

**Mavjud Rollar:**
- `SUPER_ADMIN` - Super admin
- `ADMIN` - Admin
- `MANAGER` - Menejer
- `ACCOUNTANT` - Buxgalter

---

### 3. `withAuthAndRole` - Auth + Role birga

Autentifikatsiya va role-based authorization'ni birlashtiradi.

**Foydalanish:**

```typescript
import { withAuthAndRole, getUser } from '@/lib/api-middleware'

// Faqat SUPER_ADMIN kirishi mumkin
export const DELETE = withAuthAndRole(
  ['SUPER_ADMIN'],
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const user = getUser(request)

    // Bu yerda faqat SUPER_ADMIN bo'ladi

    return NextResponse.json({ success: true })
  }
)
```

---

## Helper Functions

### `getUser(request: NextRequest): TokenPayload | null`

Request'dan foydalanuvchi ma'lumotlarini oladi.

**Foydalanish:**

```typescript
const user = getUser(request)

if (user) {
  console.log(user.userId)   // string
  console.log(user.email)    // string
  console.log(user.role)     // string
}
```

---

### `isAdmin(request: NextRequest): boolean`

Foydalanuvchi SUPER_ADMIN yoki ADMIN ekanligini tekshiradi.

**Foydalanish:**

```typescript
if (isAdmin(request)) {
  // Admin huquqlariga ega
}
```

---

### `isSuperAdmin(request: NextRequest): boolean`

Foydalanuvchi SUPER_ADMIN ekanligini tekshiradi.

**Foydalanish:**

```typescript
if (isSuperAdmin(request)) {
  // Super admin huquqlariga ega
}
```

---

## To'liq Misollar

### 1. Oddiy GET request - Autentifikatsiya bilan

```typescript
// src/app/api/students/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, getUser } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (request: NextRequest) => {
  const user = getUser(request)

  const students = await prisma.student.findMany({
    where: { createdById: user?.userId }
  })

  return NextResponse.json({ students })
})
```

---

### 2. POST request - Faqat adminlar

```typescript
// src/app/api/teachers/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withRole, getUser } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const POST = withRole(
  ['SUPER_ADMIN', 'ADMIN'],
  async (request: NextRequest) => {
    const user = getUser(request)
    const body = await request.json()

    const teacher = await prisma.teacher.create({
      data: {
        ...body,
        createdById: user?.userId
      }
    })

    return NextResponse.json({ success: true, teacher })
  }
)
```

---

### 3. DELETE request - Faqat SUPER_ADMIN

```typescript
// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuthAndRole, getUser } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const DELETE = withAuthAndRole(
  ['SUPER_ADMIN'],
  async (
    request: NextRequest,
    { params }: { params: { id: string } }
  ) => {
    const user = getUser(request)

    await prisma.user.delete({
      where: { id: params.id }
    })

    return NextResponse.json({
      success: true,
      message: 'User o\'chirildi',
      deletedBy: user?.email
    })
  }
)
```

---

### 4. Conditional logic - Har xil rollar uchun

```typescript
// src/app/api/payments/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, getUser, isAdmin } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (request: NextRequest) => {
  const user = getUser(request)

  // Admin barcha to'lovlarni ko'rishi mumkin
  if (isAdmin(request)) {
    const payments = await prisma.payment.findMany()
    return NextResponse.json({ payments })
  }

  // Buxgalter faqat o'z yaratgan to'lovlarini ko'rishi mumkin
  if (user?.role === 'ACCOUNTANT') {
    const payments = await prisma.payment.findMany({
      where: { createdById: user.userId }
    })
    return NextResponse.json({ payments })
  }

  // Boshqa rollar uchun ruxsat yo'q
  return NextResponse.json(
    { error: 'Sizda to\'lovlarni ko\'rish huquqi yo\'q' },
    { status: 403 }
  )
})
```

---

### 5. Query parametrlar bilan

```typescript
// src/app/api/students/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { withAuth, getUser } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'

export const GET = withAuth(async (request: NextRequest) => {
  const user = getUser(request)

  // Query parametrlarni olish
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''

  const students = await prisma.student.findMany({
    where: {
      AND: [
        search ? {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } }
          ]
        } : {},
        status ? { status } : {}
      ]
    }
  })

  return NextResponse.json({ students })
})
```

---

## Xatolar bilan Ishlash

Middleware avtomatik ravishda quyidagi xatolarni qaytaradi:

### 401 Unauthorized
Token yo'q yoki invalid bo'lganda:

```json
{
  "error": "Autentifikatsiya talab qilinadi",
  "success": false
}
```

### 403 Forbidden
Role mos kelmagan bo'lganda:

```json
{
  "error": "Sizda bu amalni bajarish uchun ruxsat yo'q",
  "success": false,
  "requiredRoles": ["SUPER_ADMIN", "ADMIN"],
  "yourRole": "MANAGER"
}
```

---

## Best Practices

### 1. Har doim getUser() ishlatish

```typescript
// ✅ To'g'ri
export const GET = withAuth(async (request: NextRequest) => {
  const user = getUser(request)
  console.log(user?.userId)
})

// ❌ Noto'g'ri
export const GET = withAuth(async (request: NextRequest) => {
  // @ts-ignore
  console.log(request.user?.userId) // TypeScript xatosi berishi mumkin
})
```

---

### 2. Role'larni to'g'ri tanlash

```typescript
// ✅ To'g'ri - Faqat kerakli rollar
export const DELETE = withRole(['SUPER_ADMIN'], handler)

// ❌ Noto'g'ri - Ortiqcha ruxsatlar
export const DELETE = withRole(['SUPER_ADMIN', 'ADMIN', 'MANAGER'], handler)
```

---

### 3. Error handling

```typescript
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json()
    // ...
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Xatolik yuz berdi' },
      { status: 500 }
    )
  }
})
```

---

## Testing

Token bilan test qilish:

```bash
# Bearer token bilan
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:3000/api/students

# Cookie bilan (avtomatik)
# Browser'dan so'rov yuborilganda cookie avtomatik qo'shiladi
```

---

## Savollar

### Token qayerdan olinadi?

Middleware 3 joydan tokenni qidiradi:

1. **Authorization header**: `Bearer YOUR_TOKEN`
2. **Cookie**: `token=YOUR_TOKEN`
3. **Middleware headers**: `x-user-id`, `x-user-email`, `x-user-role` (root middleware tomonidan qo'shilgan)

### Middleware qanday ishlaydi?

1. Request keladi
2. Middleware tokenni qidiradi va tekshiradi
3. Agar valid bo'lsa → handler'ga o'tadi
4. Agar invalid bo'lsa → 401/403 xatosi qaytaradi

### withAuth va withRole farqi nima?

- `withAuth` - Faqat login qilganligini tekshiradi
- `withRole` - Login qilganligini VA ma'lum rolga ega ekanligini tekshiradi

---

## Qo'shimcha Ma'lumotlar

- Middleware'lar Next.js 15 App Router'da ishlaydi
- JWT_SECRET .env fayldan olinadi
- Token 7 kun amal qiladi (login paytida)
- Barcha xatolar JSON formatda qaytariladi
