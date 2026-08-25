import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcrypt";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the admin user.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const adminEmail = process.env.ADMIN_EMAIL ?? "test_admin@yopmail.com";
const adminPassword = process.env.ADMIN_PASSWORD ?? "Password123!";
const adminFullName = process.env.ADMIN_FULL_NAME ?? "BestKid Admin";
const adminPhone = process.env.ADMIN_PHONE ?? "+359 88 000 0000";
const adminCountry = process.env.ADMIN_COUNTRY ?? "Bulgaria";
const adminAvatarUrl =
  process.env.ADMIN_AVATAR_URL ??
  `https://i.pravatar.cc/150?u=${encodeURIComponent(adminEmail)}`;

async function main() {
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const user = await prisma.baseUser.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPassword,
      role: "ADMIN",
      email_verifird: true,
      is_blocked: false,
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      role: "ADMIN",
      email_verifird: true,
      is_blocked: false,
    },
  });

  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      full_name: adminFullName,
      phone: adminPhone,
      country: adminCountry,
      avatar_url: adminAvatarUrl,
    },
    create: {
      userId: user.id,
      full_name: adminFullName,
      phone: adminPhone,
      country: adminCountry,
      avatar_url: adminAvatarUrl,
    },
  });

  await prisma.baseUser.update({
    where: { id: user.id },
    data: { profile_id: profile.id },
  });

  console.log("Admin seed complete.");
  console.log(`Email: ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error("Admin seed failed:", error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
