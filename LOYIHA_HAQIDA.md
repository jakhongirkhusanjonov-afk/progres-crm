# O'quv Markazi CRM Tizimi

## Yaratilgan modullar

### ✅ 1. Loyiha strukturasi va sozlamalar
- **Next.js 16** - Zamonaviy React framework
- **TypeScript** - Xavfsiz va ishonchli kod
- **Tailwind CSS 4** - Zamonaviy dizayn
- **PostgreSQL + Prisma** - Kuchli ma'lumotlar bazasi
- Barcha kerakli paketlar o'rnatilgan va sozlangan

### ✅ 2. Ma'lumotlar bazasi sxemasi
Quyidagi jadvalar yaratildi:
- **User** - Tizim foydalanuvchilari (adminlar, menejerlar)
- **Student** - Talabalar ma'lumotlari
- **Teacher** - O'qituvchilar ma'lumotlari
- **Course** - Kurslar
- **Group** - Guruhlar
- **GroupStudent** - Talaba-guruh bog'lanishi
- **Schedule** - Dars jadvali
- **Attendance** - Davomad
- **Payment** - Talaba to'lovlari
- **SalaryPayment** - O'qituvchi ish haqi
- **TestResult** - Test natijalari
- **Notification** - SMS/Email bildirishnomalar
- **Expense** - Xarajatlar

### ✅ 3. Autentifikatsiya tizimi
- Login sahifasi - Foydalanuvchilar kirishi uchun
- JWT token asosida xavfsiz autentifikatsiya
- Parollar bcrypt bilan shifrlangan
- Session boshqaruvi (localStorage orqali)

### ✅ 4. Talabalar boshqaruvi
- Talabalar ro'yxati ko'rish
- Yangi talaba qo'shish (to'liq forma)
- Talaba ma'lumotlarini saqlash va ko'rsatish
- API route'lar (GET, POST)

## Tizimga kirish

### Admin hisob ma'lumotlari:
```
Username: admin
Email: admin@crm.uz
Parol: admin123
```

## Loyihani ishga tushirish

### 1. Ma'lumotlar bazasi serverini ishga tushirish:
```bash
npx prisma dev
```
Bu buyruq lokal PostgreSQL serverini ishga tushiradi.

### 2. Development serverini ishga tushirish:
```bash
npm run dev
```

Keyin brauzerda ochiladi: http://localhost:3000

## Loyiha tuzilishi

```
my-crm/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/          # Login va register API
│   │   │   └── students/      # Talabalar API
│   │   ├── dashboard/          # Asosiy dashboard
│   │   │   └── students/      # Talabalar sahifasi
│   │   ├── login/             # Login sahifasi
│   │   └── page.js            # Asosiy sahifa (redirect)
│   ├── lib/
│   │   ├── auth.ts            # Autentifikatsiya yordamchilari
│   │   └── prisma.ts          # Prisma client
│   └── components/            # React komponentlar
├── prisma/
│   ├── schema.prisma          # Ma'lumotlar bazasi sxemasi
│   ├── migrations/            # Migratsiyalar
│   └── seed.ts                # Test ma'lumotlar
└── .env                       # Muhit o'zgaruvchilari
```

## Qanday ishlaydi

### Autentifikatsiya:
1. Foydalanuvchi login sahifasida username va parol kiritadi
2. Server parolni tekshiradi va JWT token yaratadi
3. Token localStorage'ga saqlanadi
4. Har bir API so'rovda token tekshiriladi

### Talabalar boshqaruvi:
1. Dashboard > Talabalar sahifasiga o'tiladi
2. "Yangi talaba" tugmasi orqali forma ochiladi
3. Talaba ma'lumotlari kiritiladi va saqlanadi
4. Barcha talabalar jadval ko'rinishida ko'rsatiladi

## Keyingi qadamlar

Quyidagi modullar hali yaratilmagan:

### 🔄 5. O'qituvchilar boshqaruvi
- O'qituvchilar ro'yxati
- Yangi o'qituvchi qo'shish
- O'qituvchi profili
- Ish haqi hisoblash

### 🔄 6. Guruhlar va kurslar
- Kurslar yaratish
- Guruhlar ochish
- Talabalarn guruhlarga biriktrish
- Guruh ma'lumotlari

### 🔄 7. Dars jadvali va davomad
- Haftalik jadval yaratish
- Kunlik davomatni belgilash
- Davomad hisobotlari
- Statistika

### 🔄 8. To'lov va moliya
- To'lov qabul qilish
- Qarzdorliklar ro'yxati
- Moliyaviy hisobotlar
- Daromad va xarajatlar

### 🔄 9. Hisobotlar va statistika
- Umumiy statistika dashboard
- Grafik va diagrammalar
- Excel/PDF eksport
- Filtrlash va qidiruv

### 🔄 10. SMS/Email bildirishnomalar
- To'lov eslatmalari
- Davomad bildirishnomarlari
- Ommaviy xabarlar
- Shablon boshqaruvi

## Foydalaniladigan texnologiyalar

- **Frontend:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL (Prisma ORM)
- **Auth:** JWT, bcryptjs
- **Validation:** Zod, React Hook Form

## Qo'shimcha buyruqlar

```bash
# Yangi migratsiya yaratish
npx prisma migrate dev --name migration_nomi

# Prisma Studio (ma'lumotlar bazasini brauzerda ko'rish)
npx prisma studio

# Yangi admin yaratish
npm run seed

# Production build
npm run build
npm start
```

## Muhim eslatmalar

1. **.env fayli** - Production muhitda JWT_SECRET ni o'zgartiring
2. **Ma'lumotlar bazasi** - Production da real PostgreSQL server ishlating
3. **Xavfsizlik** - API route'larda har doim token tekshiring
4. **Backup** - Muntazam ma'lumotlar bazasini zaxiralang

## Yordam va maslahatlar

Agar loyihani davom ettirishda yordam kerak bo'lsa:

1. Har bir modul uchun avval API route'larini yarating
2. Keyin frontend sahifalarini yarating
3. Ma'lumotlar bazasi bilan ishlashda Prisma dokumentatsiyasidan foydalaning
4. UI komponentlarni qayta ishlatish uchun alohida komponentlar yarating

---

**Muvaffaqiyatlar tilaymiz! 🚀**
