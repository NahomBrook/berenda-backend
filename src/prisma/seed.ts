/**
 * Production seed script
 * Run: npx prisma db seed
 *
 * Creates:
 *  - Roles:  USER | ADMIN | SUPER_ADMIN
 *  - Users:  admin@berenda.com (ADMIN) — password: Admin123!
 *  - Amenities for property creation
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting production seed…");

  // ── 1. Roles ─────────────────────────────────────────────────────────────
  const [userRole, adminRole, superAdminRole] = await Promise.all([
    prisma.role.upsert({
      where: { name: "USER" },
      update: {},
      create: { name: "USER" },
    }),
    prisma.role.upsert({
      where: { name: "ADMIN" },
      update: {},
      create: { name: "ADMIN" },
    }),
    prisma.role.upsert({
      where: { name: "SUPER_ADMIN" },
      update: {},
      create: { name: "SUPER_ADMIN" },
    }),
  ]);
  console.log("✅ Roles seeded:", userRole.name, adminRole.name, superAdminRole.name);

  // ── 2. Admin user ────────────────────────────────────────────────────────
  const adminEmail = "admin@berenda.com";
  const adminPassword = "Admin123!";
  const adminHash = await bcrypt.hash(adminPassword, 12);

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const admin = await prisma.user.create({
      data: {
        fullName: "Berenda Admin",
        email: adminEmail,
        username: "berenda_admin",
        passwordHash: adminHash,
        isVerified: true,
        roles: {
          create: [
            { roleId: adminRole.id },
          ],
        },
      },
    });
    console.log("✅ Admin user created:", admin.email);
  } else {
    // Ensure the admin user has the ADMIN role
    const hasAdminRole = await prisma.userRole.findFirst({
      where: { userId: existingAdmin.id, roleId: adminRole.id },
    });
    if (!hasAdminRole) {
      await prisma.userRole.create({
        data: { userId: existingAdmin.id, roleId: adminRole.id },
      });
    }
    // Update password hash in case it was the old placeholder
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { passwordHash: adminHash, isVerified: true },
    });
    console.log("✅ Admin user updated:", adminEmail);
  }

  // ── 3. Amenities ─────────────────────────────────────────────────────────
  const amenities = [
    "WiFi",
    "Air Conditioning",
    "Heating",
    "Kitchen",
    "Washer",
    "Dryer",
    "Free Parking",
    "Pool",
    "TV",
    "Pet Friendly",
    "Gym",
    "Security Guard",
    "Backup Generator",
    "Water Tank",
    "Elevator",
  ];

  for (const name of amenities) {
    await prisma.amenity.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`✅ ${amenities.length} amenities seeded`);

  console.log("🎉 Seed complete!");
  console.log(`   Admin login → ${adminEmail} / ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
