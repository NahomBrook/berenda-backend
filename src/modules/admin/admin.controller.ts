// backend/src/modules/admin/admin.controller.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper to convert query params to string
const getStringParam = (param: any): string => {
  if (Array.isArray(param)) return param[0] || "";
  return param || "";
};

// Get dashboard statistics
export const getAdminDashboard = async (req: Request, res: Response) => {
  try {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    
    const [
      totalUsers,
      totalProperties,
      totalBookings,
      pendingProperties,
      monthlyRevenue,
      recentUsers,
      recentBookings,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.property.count(),
      prisma.booking.count(),
      prisma.property.count({ where: { approvalStatus: "pending" } }),
      prisma.booking.aggregate({
        where: { 
          createdAt: { gte: startOfYear }, 
          status: "confirmed" 
        },
        _sum: { totalPrice: true },
      }),
      prisma.user.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { 
          id: true, 
          fullName: true, 
          email: true, 
          createdAt: true 
        },
      }),
      prisma.booking.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: {
          property: { select: { title: true } },
          renter: { select: { fullName: true, email: true } },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        totalProperties,
        totalBookings,
        pendingProperties,
        totalRevenue: monthlyRevenue._sum.totalPrice || 0,
        recentUsers,
        recentBookings,
      },
    });
  } catch (error) {
    console.error("Error in getAdminDashboard:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get all users with pagination and search
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const page = parseInt(getStringParam(req.query.page)) || 1;
    const limit = parseInt(getStringParam(req.query.limit)) || 20;
    const search = getStringParam(req.query.search);
    const skip = (page - 1) * limit;

    let where: any = {};
    if (search) {
      where = {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { username: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          fullName: true,
          email: true,
          username: true,
          isVerified: true,
          createdAt: true,
          roles: {
            include: { role: true },
          },
          _count: {
            select: { properties: true, bookings: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getAllUsers:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Helper to safely get number from query params
const getNumberParam = (param: any, defaultValue: number = 1): number => {
  const str = getStringParam(param);
  if (!str) return defaultValue;
  const num = Number(str);
  return isNaN(num) ? defaultValue : num;
};


export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = getStringParam(req.params.userId);
    
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        properties: true,
        bookings: { include: { property: true } },
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("Error in getUserById:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Update user role
export const updateUserRole = async (req: Request, res: Response) => {
  try {
    const userId = getStringParam(req.params.userId);
    const { roleName } = req.body;
    const currentUserId = (req as any).user?.userId;

    if (!userId || !roleName) {
      return res.status(400).json({ success: false, message: "User ID and role name are required" });
    }

    // Prevent self-role demotion
    if (userId === currentUserId) {
      return res.status(403).json({ success: false, message: "Cannot change your own role" });
    }

    // Get role ID
    const role = await prisma.role.findUnique({ where: { name: roleName } });
    if (!role) {
      return res.status(404).json({ success: false, message: "Role not found" });
    }

    // Delete existing roles and add new
    await prisma.userRole.deleteMany({ where: { userId } });
    await prisma.userRole.create({
      data: { userId, roleId: role.id },
    });

    res.json({ success: true, message:  `User role updated to ${roleName}` });
  } catch (error) {
    console.error("Error in updateUserRole:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = getStringParam(req.params.userId);
    const currentUserId = (req as any).user?.userId;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    if (userId === currentUserId) {
      return res.status(403).json({ success: false, message: "Cannot delete yourself" });
    }

    await prisma.user.delete({ where: { id: userId } });

    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error in deleteUser:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get all properties with pagination and filters
export const getAllProperties = async (req: Request, res: Response) => {
  try {
    const page = getNumberParam(req.query.page, 1);
    const limit = getNumberParam(req.query.limit, 20);
    const status = getStringParam(req.query.status);
    const skip = (page - 1) * limit;

    let where: any = {};
    if (status && status !== "all") {
      where = { approvalStatus: status };
    }

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        skip,
        take: limit,
        include: {
          owner: {
            select: {
              id: true,
              fullName: true,
              email: true,
              username: true,
            },
          },
          amenities: {
            include: { amenity: true },
          },
          media: true,
          _count: {
            select: { bookings: true, favorites: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.property.count({ where }),
    ]);
 res.json({
      success: true,
      data: properties,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getAllProperties:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Approve property
export const approveProperty = async (req: Request, res: Response) => {
  try {
    const propertyId = getStringParam(req.params.propertyId);
    const adminId = (req as any).user?.userId;

    if (!propertyId) {
      return res.status(400).json({ success: false, message: "Property ID is required" });
    }

    const property = await prisma.property.update({
      where: { id: propertyId },
      data: { approvalStatus: "approved" },
      include: { owner: { select: { email: true, fullName: true } } },
    });

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminId,
        actionType: "APPROVE_PROPERTY",
        targetEntity: "Property",
        targetId: propertyId,
        notes: `Property "${property.title}" approved`,
      },
    });

    res.json({ success: true, data: property, message: "Property approved successfully" });
  } catch (error) {
    console.error("Error in approveProperty:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Reject property
export const rejectProperty = async (req: Request, res: Response) => {
  try {
    const propertyId = getStringParam(req.params.propertyId);
    const { reason } = req.body;
    const adminId = (req as any).user?.userId;

    if (!propertyId) {
      return res.status(400).json({ success: false, message: "Property ID is required" });
    }

    const property = await prisma.property.update({
      where: { id: propertyId },
      data: { approvalStatus: "rejected" },
    });

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminId,
        actionType: "REJECT_PROPERTY",
        targetEntity: "Property",
        targetId: propertyId,
        notes:  `Property "${property.title}" rejected. Reason: ${reason || "Not specified"}`,
      },
    });

    res.json({ success: true, data: property, message: "Property rejected" });
  } catch (error) {
    console.error("Error in rejectProperty:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Delete property (soft delete)
export const deleteProperty = async (req: Request, res: Response) => {
  try {
    const propertyId = getStringParam(req.params.propertyId);
    const adminId = (req as any).user?.userId;

    if (!propertyId) {
      return res.status(400).json({ success: false, message: "Property ID is required" });
    }

    const property = await prisma.property.update({
      where: { id: propertyId },
      data: { deletedAt: new Date() },
    });

    await prisma.adminAction.create({
      data: {
        adminId,
        actionType: "DELETE_PROPERTY",
        targetEntity: "Property",
        targetId: propertyId,
        notes: `Property "${property.title}" soft deleted`,
      },
    });

    res.json({ success: true, message: "Property deleted successfully" });
  } catch (error) {
    console.error("Error in deleteProperty:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get all bookings with pagination
export const getAllBookings = async (req: Request, res: Response) => {
  try {
    const page = getNumberParam(req.query.page, 1);
    const limit = getNumberParam(req.query.limit, 20);
    const status = getStringParam(req.query.status);
    const skip = (page - 1) * limit;

    let where: any = {};
    if (status && status !== "all") {
      where = { status };
    }
 const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        include: {
          property: { select: { id: true, title: true, location: true } },
          renter: { select: { id: true, fullName: true, email: true } },
          payments: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.booking.count({ where }),
    ]);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getAllBookings:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Update booking status
export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const bookingId = getStringParam(req.params.bookingId);
    const { status } = req.body;
    const adminId = (req as any).user?.userId;

    if (!bookingId || !status) {
      return res.status(400).json({ success: false, message: "Booking ID and status are required" });
    }

    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
      include: {
        property: { select: { title: true } },
        renter: { select: { email: true, fullName: true } },
      },
    });

    await prisma.adminAction.create({
      data: {
        adminId,
        actionType: "UPDATE_BOOKING",
        targetEntity: "Booking",
        targetId: bookingId,
        notes: `Booking status updated to ${status}`,
      },
    });

    res.json({ success: true, data: booking, message: "Booking status updated" });
  } catch (error) {
    console.error("Error in updateBookingStatus:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get admin actions log
export const getAdminActions = async (req: Request, res: Response) => {
  try {
    const page = getNumberParam(req.query.page, 1);
    const limit = getNumberParam(req.query.limit, 50);
    const skip = (page - 1) * limit;

    const [actions, total] = await Promise.all([
      prisma.adminAction.findMany({
        skip,
        take: limit,
        include: {
          admin: { select: { fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.adminAction.count(),
    ]);

    res.json({
      success: true,
      data: actions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error in getAdminActions:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};