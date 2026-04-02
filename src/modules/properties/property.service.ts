// src/modules/properties/property.service.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

interface SearchQuery {
  location?: string;
  checkIn?: string;   // YYYY-MM-DD
  checkOut?: string;  // YYYY-MM-DD
}

export const searchProperties = async (query: SearchQuery) => {
  const { location, checkIn, checkOut } = query;

  // Build dynamic "where" filter
  const where: any = {};

  if (location) {
    where.location = {
      contains: location,
      mode: "insensitive",
    };
  }

  // Date filter
  if (checkIn && checkOut) {
    const checkInDate = new Date(checkIn + "T00:00:00Z");
    const checkOutDate = new Date(checkOut + "T23:59:59Z");

    where.AND = [
      {
        OR: [
          { bookings: { none: {} } }, // no bookings at all
          {
            bookings: {
              none: {
                startDate: { lte: checkOutDate },
                endDate: { gte: checkInDate },
              },
            },
          },
        ],
      },
    ];
  }

  const properties = await prisma.property.findMany({
    where,
    include: {
      media: true,       // property images
      amenities: true,   // property amenities
      owner: true,       // property owner info
      bookings: true,    // all bookings
      favorites: true,   // all favorites
      reviews: true,     // all reviews
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return properties;
};