// backend/src/prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seeding...");
  
  // Create roles (uppercase for consistency)
  const roles = await Promise.all([
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
  
  console.log(`✅ Created ${roles.length} roles:`, roles.map(r => r.name).join(", "));
  
  // Create admin user with proper password hash
  const adminEmail = "admin@berenda.com";
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("Admin123!", 10);
    
    const admin = await prisma.user.create({
      data: {
        fullName: "Super Admin",
        email: adminEmail,
        username: "superadmin",
        passwordHash: hashedPassword,
        isVerified: true,
        roles: {
          create: [
            { roleId: roles.find(r => r.name === "USER")!.id },
            { roleId: roles.find(r => r.name === "ADMIN")!.id },
            { roleId: roles.find(r => r.name === "SUPER_ADMIN")!.id },
          ],
        },
      },
    });
    console.log(`✅ Super Admin created: ${admin.email}`);
    console.log(`   Password: Admin123!`);
  } else {
    console.log(`⚠️ Admin already exists: ${adminEmail}`);
  }
  
  // Create regular user
  const userEmail = "user@berenda.com";
  const existingUser = await prisma.user.findUnique({
    where: { email: userEmail },
  });
  
  if (!existingUser) {
    const hashedPassword = await bcrypt.hash("User123!", 10);
    
    const user = await prisma.user.create({
      data: {
        fullName: "Regular User",
        email: userEmail,
        username: "regularuser",
        passwordHash: hashedPassword,
        isVerified: true,
        roles: {
          create: [
            { roleId: roles.find(r => r.name === "USER")!.id },
          ],
        },
      },
    });
    console.log(`✅ Regular User created: ${user.email}`);
    console.log(`   Password: User123!`);
  } else {
    console.log(`⚠️ User already exists: ${userEmail}`);
  }
  
  // Create amenities
  console.log("📦 Creating amenities...");
  const amenities = await Promise.all([
    prisma.amenity.upsert({ where: { name: "Wi-Fi" }, update: {}, create: { name: "Wi-Fi" } }),
    prisma.amenity.upsert({ where: { name: "Air Conditioning" }, update: {}, create: { name: "Air Conditioning" } }),
    prisma.amenity.upsert({ where: { name: "Kitchen" }, update: {}, create: { name: "Kitchen" } }),
    prisma.amenity.upsert({ where: { name: "Parking" }, update: {}, create: { name: "Parking" } }),
    prisma.amenity.upsert({ where: { name: "Pool" }, update: {}, create: { name: "Pool" } }),
  ]);
  console.log(`✅ Created ${amenities.length} amenities`);
  
  // Get users for property creation
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  const regularUser = await prisma.user.findUnique({ where: { email: userEmail } });
  
  if (admin && regularUser) {
    // Create sample properties
    console.log("🏠 Creating sample properties...");
    
    const property1 = await prisma.property.create({
      data: {
        ownerId: admin.id,
        title: "Luxury Downtown Apartment",
        description: "A stunning luxury apartment in the heart of the city with panoramic views. Features modern amenities and 24/7 security.",
        location: "Downtown, City Center",
        latitude: 9.03,
        longitude: 38.74,
        monthlyPrice: 1500,
        bedrooms: 2,
        bathrooms: 2,
        area: 120,
        maxGuests: 4,
        approvalStatus: "approved",
        amenities: {
          create: amenities.slice(0, 3).map(a => ({ amenityId: a.id })),
        },
        media: {
          create: [
            { mediaUrl: "https://placehold.co/600x400", mediaType: "image" },
            { mediaUrl: "https://placehold.co/600x400", mediaType: "image" },
          ],
        },
      },
    });
    console.log(`✅ Created property: ${property1.title}`);
    
    const property2 = await prisma.property.create({
      data: {
        ownerId: regularUser.id,
        title: "Cozy Studio Apartment",
        description: "Perfect for singles or couples. Modern studio with all essential amenities. Close to public transport.",
        location: "Suburbs",
        latitude: 9.04,
        longitude: 38.75,
        monthlyPrice: 800,
        bedrooms: 1,
        bathrooms: 1,
        area: 50,
        maxGuests: 2,
        approvalStatus: "pending",
        amenities: {
          create: amenities.slice(0, 2).map(a => ({ amenityId: a.id })),
        },
        media: {
          create: [
            { mediaUrl: "https://placehold.co/600x400", mediaType: "image" },
          ],
        },
      },
    });
    console.log(`✅ Created property: ${property2.title}`);
    
    // Create a booking
    console.log("📅 Creating sample booking...");
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 3);
    
    await prisma.booking.create({
      data: {
        renterId: regularUser.id,
        propertyId: property1.id,
        startDate,
        endDate,
        totalPrice: property1.monthlyPrice / 30 * 3,
        status: "confirmed",
      },
    });
    console.log("✅ Created booking");
    
    // Create a favorite
    await prisma.favorite.create({
      data: {
        userId: regularUser.id,
        propertyId: property1.id,
      },
    });
    console.log("✅ Created favorite");
    
    // Create a review
    await prisma.review.create({
      data: {
        reviewerId: regularUser.id,
        propertyId: property1.id,
        rating: 5,
        comment: "Amazing place! Highly recommend.",
      },
    });
    console.log("✅ Created review");
  }
  
  console.log("🎉 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });