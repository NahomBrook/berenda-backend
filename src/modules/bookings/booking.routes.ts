// backend/src/modules/bookings/booking.routes.ts
import { Router } from "express";
import { verifyToken } from "../../middlewares/auth.middleware";
import * as bookingController from "./booking.controller";

const router = Router();

// All booking routes require authentication
router.use(verifyToken);

// Create a new booking
router.post("/", bookingController.createBooking);

// Get all bookings for current user (as renter)
router.get("/", bookingController.getUserBookings);

// Get bookings for properties owned by the user (as host)
router.get("/host", bookingController.getHostBookings);

// Get a specific booking
router.get("/:id", bookingController.getBookingById);

// Cancel a booking (as renter)
router.patch("/:id/cancel", bookingController.cancelBooking);

// Update booking status (as host)
router.patch("/:id/status", bookingController.updateBookingStatus);

export default router;