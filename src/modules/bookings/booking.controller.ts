// backend/src/modules/bookings/booking.controller.ts
import { Request, Response } from "express";
import prisma from "../../lib/prisma";


// Helper to safely get ID from params
const getIdParam = (param: any): string | undefined => {
  if (param === undefined || param === null) return undefined;
  if (Array.isArray(param)) return String(param[0]);
  return String(param);
};

// Create a new booking
export const createBooking = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const { propertyId, checkIn, checkOut, guests, totalPrice } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!propertyId || !checkIn || !checkOut) {
      return res.status(400).json({ 
        success: false, 
        message: "Missing required fields: propertyId, checkIn, checkOut" 
      });
    }

    // Check if property exists
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        bookings: {
          where: {
            status: { in: ["pending", "approved", "confirmed"] },
            AND: [
              { startDate: { lt: new Date(checkOut) } },
              { endDate: { gt: new Date(checkIn) } }
            ]
          }
        }
      }
    });

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found" });
    }

    // Check for conflicting bookings
    if (property.bookings.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: "Property is not available for selected dates",
        conflicts: property.bookings
      });
    }

    // Calculate total price if not provided
    const nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24));
    const calculatedTotalPrice = totalPrice || (property.monthlyPrice / 30) * nights;

    // Create the booking
    const booking = await prisma.booking.create({
      data: {
        renterId: userId,
        propertyId,
        startDate: new Date(checkIn),
        endDate: new Date(checkOut),
        totalPrice: calculatedTotalPrice,
        status: "pending",
      },
      include: {
        property: {
          select: {
            title: true,
            location: true,
            monthlyPrice: true,
            media: {
              where: { mediaType: 'image' },
              take: 1,
              select: { mediaUrl: true }
            }
          }
        }
      }
    });

    // Notify the property owner about the new booking
    try {
      const fullProperty = await prisma.property.findUnique({
        where: { id: propertyId },
        select: { ownerId: true, title: true },
      });
      const renter = await prisma.user.findUnique({
        where: { id: userId },
        select: { fullName: true, email: true, phone: true },
      });
      if (fullProperty && renter) {
        const contactLine = renter.phone
          ? `\nContact: ${renter.email} | ${renter.phone}`
          : `\nContact: ${renter.email}`;
        await prisma.notification.create({
          data: {
            userId: fullProperty.ownerId,
            title: "New Booking Request",
            message: `${renter.fullName} has requested to book "${fullProperty.title}".${contactLine}`,
            link: "/profile?tab=hosting",
          },
        });
      }
    } catch (notifErr) {
      console.error("Failed to create notification:", notifErr);
      // Non-fatal — booking was already created
    }

    res.status(201).json({ success: true, data: booking });
  } catch (error: any) {
    console.error("Error creating booking:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to create booking" });
  }
};

// Get all bookings for the current user
export const getUserBookings = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const bookings = await prisma.booking.findMany({
      where: { renterId: userId, deletedAt: null },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            monthlyPrice: true,
            media: {
              where: { mediaType: 'image' },
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
    res.status(500).json({ success: false, message: "Failed to fetch bookings" });
  }
};

// Get a single booking by ID
export const getBookingById = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const id = getIdParam(req.params.id);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    const booking = await prisma.booking.findFirst({
      where: { id, renterId: userId, deletedAt: null },
      include: {
        property: {
          include: {
            owner: {
              select: { fullName: true, email: true, phone: true }
            },
            media: true
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    res.json({ success: true, data: booking });
  } catch (error: any) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ success: false, message: "Failed to fetch booking" });
  }
};

// Cancel a booking
export const cancelBooking = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const id = getIdParam(req.params.id);

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    // Check if booking exists and belongs to user
    const existingBooking = await prisma.booking.findFirst({
      where: { id, renterId: userId, deletedAt: null }
    });

    if (!existingBooking) {
      return res.status(404).json({ success: false, message: "Booking not found or unauthorized" });
    }

    // Check if booking can be cancelled (e.g., not already completed or cancelled)
    if (existingBooking.status === 'completed') {
      return res.status(400).json({ success: false, message: "Cannot cancel completed booking" });
    }

    if (existingBooking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: "Booking already cancelled" });
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: { status: "cancelled" }
    });

    res.json({ success: true, message: "Booking cancelled successfully", data: booking });
  } catch (error: any) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({ success: false, message: "Failed to cancel booking" });
  }
};

// Get bookings for properties owned by the user (for hosts)
export const getHostBookings = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const bookings = await prisma.booking.findMany({
      where: {
        property: {
          ownerId: userId
        },
        deletedAt: null
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            location: true,
            media: {
              where: { mediaType: 'image' },
              take: 1,
              select: { mediaUrl: true }
            }
          }
        },
        renter: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    res.json({ success: true, data: bookings });
  } catch (error: any) {
    console.error("Error fetching host bookings:", error);
    res.status(500).json({ success: false, message: "Failed to fetch bookings" });
  }
};

// Update booking status (for hosts/admins)
export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const userFromToken = (req as any).user;
    const userId = userFromToken?.userId || userFromToken?.id;
    const id = getIdParam(req.params.id);
    const { status } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!id) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    if (!status || !['pending', 'approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    // Check if user owns the property
    const booking = await prisma.booking.findFirst({
      where: { id },
      include: {
        property: {
          select: { ownerId: true }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.property.ownerId !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to update this booking" });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status }
    });

    res.json({ 
      success: true, 
      message: `Booking status updated to ${status}`,
      data: updatedBooking 
    });
  } catch (error: any) {
    console.error("Error updating booking status:", error);
    res.status(500).json({ success: false, message: "Failed to update booking status" });
  }
};