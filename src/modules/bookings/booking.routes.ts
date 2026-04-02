import { Router } from "express";
import { verifyToken } from "../../middlewares/auth.middleware";
import { 
  createBooking, 
  getUserBookings, 
  getBookingById, 
  cancelBooking 
} from "./booking.controller";

const router = Router();

// All booking routes require authentication
router.use(verifyToken);

// Create a new booking
router.post("/", createBooking);

// Get all bookings for current user
router.get("/", getUserBookings);

// Get a specific booking
router.get("/:id", getBookingById);

// Cancel a booking
router.patch("/:id/cancel", cancelBooking);

export default router;
