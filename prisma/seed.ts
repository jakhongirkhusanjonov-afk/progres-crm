import { PrismaClient, Gender, StudentStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";
import CryptoJS from "crypto-js";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ENCRYPTION_SECRET =
  process.env.ENCRYPTION_SECRET || "default-secret-key-change-in-production";

function encrypt(text: string): string {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_SECRET).toString();
}

async function main() {
  console.log("Seed boshlandi...\n");

  // ═══════════════════════════════════════════
  // 1. SUPER ADMIN
  // ═══════════════════════════════════════════
  const superAdminPassword = "admin123";
  const superAdmin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      email: "admin@NURMAKON.uz",
      username: "admin",
      password: await bcrypt.hash(superAdminPassword, 10),
      plainPassword: encrypt(superAdminPassword),
      fullName: "Super Admin",
      role: "SUPER_ADMIN",
      phone: "+998901000000",
    },
  });
  console.log("SUPER_ADMIN yaratildi: admin / admin123");

  // ═══════════════════════════════════════════
  // 2. ADMIN (Resepshn)
  // ═══════════════════════════════════════════
  const receptionPassword = "reception123";
  const receptionUser = await prisma.user.upsert({
    where: { username: "reception" },
    update: {},
    create: {
      email: "reception@NURMAKON.uz",
      username: "reception",
      password: await bcrypt.hash(receptionPassword, 10),
      plainPassword: encrypt(receptionPassword),
      fullName: "Nodira Azimova",
      role: "ADMIN",
      phone: "+998901000001",
    },
  });

  await prisma.admin.upsert({
    where: { userId: receptionUser.id },
    update: {},
    create: {
      firstName: "Nodira",
      lastName: "Azimova",
      phone: "+998901000001",
      email: "reception@NURMAKON.uz",
      userId: receptionUser.id,
    },
  });
  console.log("ADMIN (Resepshn) yaratildi: reception / reception123");

  // ═══════════════════════════════════════════
  // 3. O'QITUVCHILAR (3 ta)
  // ═══════════════════════════════════════════
  const teachersData = [
    {
      firstName: "Abdulloh",
      lastName: "Karimov",
      phone: "+998901100001",
      email: "abdulloh@NURMAKON.uz",
      specialization: "Ingliz tili",
      experience: 5,
      education: "TDPU - Ingliz tili va adabiyoti",
      salary: 5000000,
      username: "abdulloh.k",
      password: "teacher123",
    },
    {
      firstName: "Sevara",
      lastName: "Rustamova",
      phone: "+998901100002",
      email: "sevara@NURMAKON.uz",
      specialization: "Matematika",
      experience: 3,
      education: "TATU - Amaliy matematika",
      salary: 4500000,
      username: "sevara.r",
      password: "teacher123",
    },
    {
      firstName: "Javohir",
      lastName: "Toshmatov",
      phone: "+998901100003",
      email: "javohir@NURMAKON.uz",
      specialization: "Dasturlash (Python/JS)",
      experience: 4,
      education: "TATU - Dasturiy injiniring",
      salary: 6000000,
      username: "javohir.t",
      password: "teacher123",
    },
  ];

  for (const t of teachersData) {
    const teacherUser = await prisma.user.upsert({
      where: { username: t.username },
      update: {},
      create: {
        email: t.email,
        username: t.username,
        password: await bcrypt.hash(t.password, 10),
        plainPassword: encrypt(t.password),
        fullName: `${t.firstName} ${t.lastName}`,
        role: "TEACHER",
        phone: t.phone,
      },
    });

    const existingTeacher = await prisma.teacher.findFirst({
      where: { userId: teacherUser.id },
    });

    if (!existingTeacher) {
      await prisma.teacher.create({
        data: {
          firstName: t.firstName,
          lastName: t.lastName,
          phone: t.phone,
          email: t.email,
          specialization: t.specialization,
          experience: t.experience,
          education: t.education,
          salary: t.salary,
          userId: teacherUser.id,
          createdById: superAdmin.id,
        },
      });
    }

    console.log(
      `O'qituvchi yaratildi: ${t.username} / ${t.password}  (${t.firstName} ${t.lastName} - ${t.specialization})`,
    );
  }

  // ═══════════════════════════════════════════
  // 4. O'QUVCHILAR (10 ta)
  // ═══════════════════════════════════════════
  const studentsData = [
    {
      firstName: "Aziz",
      lastName: "Rahimov",
      phone: "+998931200001",
      parentPhone: "+998901200001",
      gender: Gender.MALE,
      dateOfBirth: new Date("2007-03-15"),
    },
    {
      firstName: "Dilnoza",
      lastName: "Karimova",
      phone: "+998931200002",
      parentPhone: "+998901200002",
      gender: Gender.FEMALE,
      dateOfBirth: new Date("2008-07-22"),
    },
    {
      firstName: "Jasur",
      lastName: "Yuldashev",
      phone: "+998931200003",
      parentPhone: "+998901200003",
      gender: Gender.MALE,
      dateOfBirth: new Date("2006-11-08"),
    },
    {
      firstName: "Malika",
      lastName: "Toshmatova",
      phone: "+998931200004",
      parentPhone: "+998901200004",
      gender: Gender.FEMALE,
      dateOfBirth: new Date("2007-05-30"),
    },
    {
      firstName: "Sardor",
      lastName: "Normatov",
      phone: "+998931200005",
      parentPhone: "+998901200005",
      gender: Gender.MALE,
      dateOfBirth: new Date("2005-09-12"),
    },
    {
      firstName: "Nigora",
      lastName: "Abdullayeva",
      phone: "+998931200006",
      parentPhone: "+998901200006",
      gender: Gender.FEMALE,
      dateOfBirth: new Date("2008-01-25"),
    },
    {
      firstName: "Bekzod",
      lastName: "Sobirov",
      phone: "+998931200007",
      parentPhone: "+998901200007",
      gender: Gender.MALE,
      dateOfBirth: new Date("2006-04-18"),
    },
    {
      firstName: "Shaxlo",
      lastName: "Mirzayeva",
      phone: "+998931200008",
      parentPhone: "+998901200008",
      gender: Gender.FEMALE,
      dateOfBirth: new Date("2007-12-03"),
    },
    {
      firstName: "Otabek",
      lastName: "Xasanov",
      phone: "+998931200009",
      parentPhone: "+998901200009",
      gender: Gender.MALE,
      dateOfBirth: new Date("2006-08-14"),
    },
    {
      firstName: "Kamola",
      lastName: "Ismoilova",
      phone: "+998931200010",
      parentPhone: "+998901200010",
      gender: Gender.FEMALE,
      dateOfBirth: new Date("2007-10-07"),
    },
  ];

  for (const s of studentsData) {
    const existing = await prisma.student.findFirst({
      where: { phone: s.phone },
    });

    if (!existing) {
      await prisma.student.create({
        data: {
          firstName: s.firstName,
          lastName: s.lastName,
          phone: s.phone,
          parentPhone: s.parentPhone,
          gender: s.gender,
          dateOfBirth: s.dateOfBirth,
          status: StudentStatus.ACTIVE,
          createdById: superAdmin.id,
        },
      });
    }

    console.log(`O'quvchi yaratildi: ${s.firstName} ${s.lastName}`);
  }

  console.log("\n════════════════════════════════════════════");
  console.log("  SEED MUVAFFAQIYATLI YAKUNLANDI!");
  console.log("════════════════════════════════════════════");
  console.log("\nLogin ma'lumotlari:");
  console.log("──────────────────────────────────────────");
  console.log("  SUPER ADMIN:  admin / admin123");
  console.log("  RESEPSHN:     reception / reception123");
  console.log("  O'qituvchi 1: abdulloh.k / teacher123");
  console.log("  O'qituvchi 2: sevara.r / teacher123");
  console.log("  O'qituvchi 3: javohir.t / teacher123");
  console.log("──────────────────────────────────────────");
  console.log("  O'quvchilar: 10 ta (login yo'q)\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
