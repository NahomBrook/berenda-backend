// backend/src/modules/properties/property-availability.controller.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Added Promise<any> to satisfy Express async handler types
export const checkPropertyEligibility = async (req: Request, res: Response): Promise<any> => {
  try {
    // FIX 1: Explicitly cast 'id' as a string to fix the TS2322 error
    const id = req.params.id as string;
    
    // Explicitly cast variables from the body
    const checkIn = req.body.checkIn as string;
    const checkOut = req.body.checkOut as string;
    const guests = Number(req.body.guests) || 1;

    console.log("Checking availability for property:", id, { checkIn, checkOut, guests });

    // Validate input
    if (!checkIn || !checkOut) {
      return res.status(400).json({
        eligible: false,
        message: "Check-in and check-out dates are required"
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({
        eligible: false,
        message: "Invalid date format"
      });
    }

    if (checkInDate >= checkOutDate) {
      return res.status(400).json({
        eligible: false,
        message: "Check-out date must be after check-in date"
      });
    }

    // Get property details with bookings
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        bookings: {
          where: {
            status: { in: ["pending", "approved"] },
            AND: [
              { startDate: { lt: checkOutDate } },
              { endDate: { gt: checkInDate } }
            ]
          }
        }
      }
    });

    if (!property) {
      return res.status(404).json({
        eligible: false,
        message: "Property not found"
      });
    }

    // FIX 2: Cast property to 'any' so TypeScript stops complaining about 
    // the 'bookings' property missing from the Prisma schema generated on Render
    const propertyData = property as any;

    // Check if property is available using the bypassed type
    const hasConflictingBookings = propertyData.bookings && propertyData.bookings.length > 0;
    const isAvailable = propertyData.isAvailable && !hasConflictingBookings;

    // Check guests limit
    const maxGuests = propertyData.maxGuests || 10;
    const guestsValid = guests <= maxGuests;

    // Calculate price
    const days = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    const dailyRate = propertyData.monthlyPrice / 30;
    const totalPrice = days * dailyRate;

    let message = "";
    if (!isAvailable) {
      message = hasConflictingBookings 
        ? "Property is not available for the selected dates" 
        : "Property is currently unavailable";
    } else if (!guestsValid) {
      message = `This property can accommodate up to ${maxGuests} guests`;
    } else {
      message = "Property is available for booking";
    }

    const result = {
      eligible: isAvailable && guestsValid,
      message: message,
      availableDates: isAvailable ? [{ start: checkIn, end: checkOut }] : [],
      price: {
        dailyRate: Number(dailyRate.toFixed(2)),
        nights: days,
        total: Number(totalPrice.toFixed(2))
      },
      property: {
        id: propertyData.id,
        title: propertyData.title,
        maxGuests: propertyData.maxGuests,
        monthlyPrice: propertyData.monthlyPrice
      }
    };

    return res.json(result);
  } catch (error) {
    console.error("Error checking availability:", error);
    return res.status(500).json({
      eligible: false,
      message: "Failed to check availability. Please try again."
    });
  }
};