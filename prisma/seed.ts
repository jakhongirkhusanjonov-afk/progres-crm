import { PrismaClient, Gender, StudentStatus } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import 'dotenv/config'

const pool = new Pool({ connectionString: process.env.DATABASE_URL_DIRECT })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seed boshlandi...')

  const hashedPassword = await bcrypt.hash('admin123', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm.uz' },
    update: {},
    create: {
      email: 'admin@crm.uz',
      username: 'admin',
      password: hashedPassword,
      fullName: 'Admin User',
      role: 'SUPER_ADMIN',
      phone: '+998901234567',
    },
  })

  console.log('Admin foydalanuvchi yaratildi:')
  console.log('Email:', admin.email)
  console.log('Username:', admin.username)
  console.log('Parol: admin123')
  console.log()

  // Test talabalar qo'shish
  const testStudents = [
    {
      firstName: 'Aziz',
      lastName: 'Rahimov',
      middleName: 'Sharofovich',
      phone: '+998901234501',
      parentPhone: '+998901234502',
      email: 'aziz.rahimov@example.com',
      dateOfBirth: new Date('2005-03-15'),
      gender: Gender.MALE,
      address: 'Toshkent sh., Yunusobod tumani, 12-mavze, 45-uy',
      status: StudentStatus.ACTIVE,
      createdById: admin.id,
    },
    {
      firstName: 'Dilnoza',
      lastName: 'Karimova',
      middleName: 'Akmalovna',
      phone: '+998901234503',
      parentPhone: '+998901234504',
      email: 'dilnoza.karimova@example.com',
      dateOfBirth: new Date('2006-07-22'),
      gender: Gender.FEMALE,
      address: 'Toshkent sh., Chilonzor tumani, 5-kvartal, 12-uy',
      status: StudentStatus.ACTIVE,
      createdById: admin.id,
    },
    {
      firstName: 'Jasur',
      lastName: 'Yuldashev',
      middleName: 'Baxtiyorovich',
      phone: '+998901234505',
      parentPhone: '+998901234506',
      dateOfBirth: new Date('2004-11-08'),
      gender: Gender.MALE,
      address: 'Toshkent sh., Mirzo Ulug\'bek tumani, 8-mavze, 23-uy',
      status: StudentStatus.ACTIVE,
      createdById: admin.id,
    },
    {
      firstName: 'Malika',
      lastName: 'Toshmatova',
      middleName: 'Rustamovna',
      phone: '+998901234507',
      parentPhone: '+998901234508',
      email: 'malika.toshmatova@example.com',
      dateOfBirth: new Date('2005-05-30'),
      gender: Gender.FEMALE,
      address: 'Toshkent sh., Yakkasaroy tumani, 3-mavze, 67-uy',
      status: StudentStatus.ACTIVE,
      createdById: admin.id,
    },
    {
      firstName: 'Sardor',
      lastName: 'Normatov',
      middleName: 'Azimovich',
      phone: '+998901234509',
      parentPhone: '+998901234510',
      dateOfBirth: new Date('2003-09-12'),
      gender: Gender.MALE,
      address: 'Toshkent sh., Sergeli tumani, 7-mavze, 34-uy',
      status: StudentStatus.GRADUATED,
      createdById: admin.id,
    },
    {
      firstName: 'Nigora',
      lastName: 'Abdullayeva',
      middleName: 'Mahmudovna',
      phone: '+998901234511',
      parentPhone: '+998901234512',
      email: 'nigora.abdullayeva@example.com',
      dateOfBirth: new Date('2006-01-25'),
      gender: Gender.FEMALE,
      address: 'Toshkent sh., Uchtepa tumani, 15-mavze, 89-uy',
      status: StudentStatus.ACTIVE,
      createdById: admin.id,
    },
  ]

  for (const studentData of testStudents) {
    const { createdById, ...rest } = studentData
    await prisma.student.upsert({
      where: { phone: studentData.phone },
      update: {},
      create: {
        ...rest,
        createdBy: {
          connect: { id: admin.id }
        }
      },
    })
  }

  console.log(`${testStudents.length} ta test talaba qo'shildi`)
  console.log()

  console.log('Seed tugadi!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
