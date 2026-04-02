import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Create a new booking
export const createBooking = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const { propertyId, checkIn, checkOut, guests, totalPrice } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!propertyId || !checkIn || !checkOut) {
      return res.status(400).json({ message: "Missing required fields: propertyId, checkIn, checkOut" });
    }

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        bookings: {
          where: {
            status: { in: ["pending", "approved"] },
            AND: [
              { startDate: { lt: new Date(checkOut) } },
              { endDate: { gt: new Date(checkIn) } }
            ]
          }
        }
      }
    });

    if (!property) {
      return res.status(404).json({ message: "Property not found" });
    }

    // Check for conflicting bookings
    if (property.bookings.length > 0) {
      return res.status(400).json({ 
        message: "Property is not available for selected dates",
        conflicts: property.bookings
      });
    }

    // Create the booking
    const booking = await prisma.booking.create({
      data: {
        renterId: userId,
        propertyId,
        startDate: new Date(checkIn),
        endDate: new Date(checkOut),
        status: "pending",
      },
      include: {
        property: {
          select: {
            title: true,
            location: true,
            monthlyPrice: true,
            media: {
              take: 1,
              select: { mediaUrl: true }
            }
          }
        }
      }
    });

    res.status(201).json({ success: true, data: booking });
  } catch (error: any) {
    console.error("Error creating booking:", error);
    res.status(500).json({ message: error.message || "Failed to create booking" });
  }
};

// Get all bookings for the current user
export const getUserBookings = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;

    const bookings = await prisma.booking.findMany({
      where: { renterId: userId },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            monthlyPrice: true,
            media: {
              take: 1,
              select: { mediaUrl: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, data: bookings });
  } catch (error: any) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ message: "Failed to fetch bookings" });
  }
};

// Get a single booking by ID
export const getBookingById = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const id = req.params.id as string;

    const booking = await prisma.booking.findFirst({
      where: { id, renterId: userId },
      include: {
        property: {
          include: {
            owner: {
              select: { fullName: true, email: true }
            },
            media: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    res.json({ success: true, data: booking });
  } catch (error: any) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ message: "Failed to fetch booking" });
  }
};

// Cancel a booking
export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const id = req.params.id as string;

    const booking = await prisma.booking.updateMany({
        where: { id , renterId: userId },
      data: { status: "cancelled" }
    });

    if (booking.count === 0) {
      return res.status(404).json({ message: "Booking not found or unauthorized" });
    }

    res.json({ success: true, message: "Booking cancelled successfully" });
  } catch (error: any) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({ message: "Failed to cancel booking" });
  }
};
