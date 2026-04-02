// backend/src/modules/admin/admin.routes.ts
import { Router } from "express";
import { verifyToken, isAdmin } from "../../middlewares/auth.middleware";
import {
  getAdminDashboard,
  getAllUsers,
  getUserById,
  updateUserRole,
  deleteUser,
  getAllProperties,
  approveProperty,
  rejectProperty,
  deleteProperty,
  getAllBookings,
  updateBookingStatus,
  getAdminActions,
} from "./admin.controller";

const router = Router();

// All admin routes require both authentication and admin role
router.use(verifyToken);
router.use(isAdmin);

// Dashboard
router.get("/dashboard", getAdminDashboard);

// User management
router.get("/users", getAllUsers);
router.get("/users/:userId", getUserById);
router.patch("/users/:userId/role", updateUserRole);
router.delete("/users/:userId", deleteUser);

// Property management
router.get("/properties", getAllProperties);
router.patch("/properties/:propertyId/approve", approveProperty);
router.patch("/properties/:propertyId/reject", rejectProperty);
router.delete("/properties/:propertyId", deleteProperty);

// Booking management
router.get("/bookings", getAllBookings);
router.patch("/bookings/:bookingId/status", updateBookingStatus);

// Admin actions log
router.get("/actions", getAdminActions);

export default router;