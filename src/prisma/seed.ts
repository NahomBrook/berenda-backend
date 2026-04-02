import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding roles...");
  const adminRole = await prisma.role.upsert({
    where: { name: "admin" },
    update: {},
    create: { name: "admin" },
  });

  const userRole = await prisma.role.upsert({
    where: { name: "user" },
    update: {},
    create: { name: "user" },
  });

  console.log("Seeding users...");
  const admin = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      fullName: "Admin User",
      email: "admin@demo.com",
      username: "adminuser",
      passwordHash: "hashedpassword", // replace with real hash in production
      roles: {
        create: {
          role: { connect: { id: adminRole.id } },
        },
      },
    },
  });

  const user = await prisma.user.upsert({
    where: { email: "user@demo.com" },
    update: {},
    create: {
      fullName: "Normal User",
      email: "user@demo.com",
      username: "normaluser",
      passwordHash: "hashedpassword",
      roles: {
        create: {
          role: { connect: { id: userRole.id } },
        },
      },
    },
  });

  console.log("Seeding amenities...");
  const wifi = await prisma.amenity.upsert({ where: { name: "Wi-Fi" }, update: {}, create: { name: "Wi-Fi" } });
  const ac = await prisma.amenity.upsert({ where: { name: "Air Conditioning" }, update: {}, create: { name: "Air Conditioning" } });

  console.log("Seeding properties...");
  const property1 = await prisma.property.create({
    data: {
      ownerId: admin.id,
      title: "Luxury Apartment",
      description: "A modern luxury apartment in the city center.",
      location: "Downtown",
      latitude: 9.03,
      longitude: 38.74,
      monthlyPrice: 1200,
      amenities: {
        create: [
          { amenityId: wifi.id },
          { amenityId: ac.id },
        ],
      },
      media: {
        create: [
          { mediaUrl: "https://placeimg.com/640/480/arch", mediaType: "image" },
          { mediaUrl: "https://placeimg.com/640/480/arch", mediaType: "image" },
        ],
      },
    },
  });

  const property2 = await prisma.property.create({
    data: {
      ownerId: user.id,
      title: "Cozy Studio",
      description: "A cozy studio apartment near public transport.",
      location: "Suburbs",
      latitude: 9.04,
      longitude: 38.75,
      monthlyPrice: 600,
      amenities: {
        create: [
          { amenityId: wifi.id },
        ],
      },
      media: {
        create: [
          { mediaUrl: "https://placeimg.com/640/480/arch", mediaType: "image" },
        ],
      },
    },
  });

  console.log("Seeding bookings...");
  const booking1 = await prisma.booking.create({
    data: {
      renterId: user.id,
      propertyId: property1.id,
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
      status: "pending",
    },
  });

  console.log("Seeding favorites...");
  await prisma.favorite.create({
    data: {
      userId: user.id,
      propertyId: property1.id,
    },
  });

  console.log("Seeding reviews...");
  await prisma.review.create({
    data: {
      reviewerId: user.id,
      propertyId: property1.id,
      rating: 5,
      comment: "Amazing place!",
    },
  });

  console.log("Seeding chat...");
  const chat = await prisma.chat.create({
    data: {
      participants: {
        create: [
          { userId: admin.id },
          { userId: user.id },
        ],
      },
      messages: {
        create: [
          { senderId: admin.id, message: "Welcome to the platform!" },
          { senderId: user.id, message: "Thanks! Happy to be here." },
        ],
      },
    },
  });

  console.log("✅ Seeding finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });