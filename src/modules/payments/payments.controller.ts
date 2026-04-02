// backend/src/modules/payments/payments.controller.ts
import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

// Payment methods mapping (used by the frontend)
export const PAYMENT_METHODS = {
  TELEBIRR: "telebirr",
  CBE: "cbe",
  CARD: "card",
  BANK: "bank",
} as const;

const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY || "";
const CHAPA_WEBHOOK_SECRET = process.env.CHAPA_WEBHOOK_SECRET || CHAPA_SECRET_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

// Chapa direct-charge type values (these differ slightly from our frontend labels)
const CHAPA_DIRECT_CHARGE_TYPE = {
  [PAYMENT_METHODS.TELEBIRR]: "telebirr",
  [PAYMENT_METHODS.CBE]: "cbebirr",
} as const;

// 1. Initialize Payment
export const initializePayment = async (req: Request, res: Response) => {
  try {
    const {
      propertyId,
      startDate,
      endDate,
      guests,
      totalPrice,
      paymentMethod,
      customer,
      fullName,
      email,
      phoneNumber,
      notes,
    } = req.body as {
      propertyId?: string;
      startDate?: string;
      endDate?: string;
      guests?: number;
      totalPrice?: number | string;
      paymentMethod?: (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];
      customer?: { fullName?: string; email?: string; phoneNumber?: string; notes?: string };
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      notes?: string;
    };

    const renterId = (req as any).user?.userId || (req as any).user?.id;

    if (!propertyId || !startDate || !endDate || guests === undefined || totalPrice === undefined) {
      return res.status(400).json({ success: false, message: "Missing required booking details" });
    }
    if (!renterId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const amount = Number(totalPrice);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid total price" });
    }

    const effectivePaymentMethod = paymentMethod || PAYMENT_METHODS.TELEBIRR;

    const customerFullName = customer?.fullName || fullName || "";
    const customerEmail = customer?.email || email || "";
    const customerPhone = customer?.phoneNumber || phoneNumber || "";
    const customerNotes = customer?.notes || notes || "";

    if (!customerFullName.trim() || !customerEmail.trim()) {
      return res.status(400).json({ success: false, message: "Full name and email are required" });
    }

    const isDirectCharge = effectivePaymentMethod === PAYMENT_METHODS.TELEBIRR || effectivePaymentMethod === PAYMENT_METHODS.CBE;
    if (isDirectCharge && !customerPhone.trim()) {
      return res.status(400).json({ success: false, message: "Phone number is required for Telebirr/CBE payments" });
    }

    const renter = await prisma.user.findUnique({ where: { id: renterId } });
    const property = await prisma.property.findUnique({ where: { id: propertyId } });

    if (!renter || !property) {
      return res.status(404).json({ success: false, message: "User or Property not found" });
    }

    if (property.ownerId === renterId) {
      return res.status(400).json({ success: false, message: "You cannot rent your own property" });
    }

    // Concurrency Check: Prevent booking if dates overlap with a confirmed booking
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const conflictingBooking = await prisma.booking.findFirst({
      where: {
        propertyId,
        status: { in: ["confirmed", "completed"] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } }
        ]
      }
    });

    if (conflictingBooking) {
      return res.status(400).json({ success: false, message: "Property is already booked for these dates." });
    }

    // Create Booking with pending_payment status
    const booking = await prisma.booking.create({
      data: {
        propertyId,
        renterId,
        startDate: start,
        endDate: end,
        totalPrice: amount,
        status: "pending_payment"
      }
    });

    // Create Payment Record
    const txRef = `ber-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        txRef,
        amount,
        status: "pending"
      }
    });

    if (!CHAPA_SECRET_KEY) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      await prisma.booking.update({ where: { id: booking.id }, data: { status: "failed" } });
      return res.status(500).json({
        success: false,
        message: "Chapa is not configured. Please set CHAPA_SECRET_KEY in environment variables.",
      });
    }

    const chapaReturnUrl = `${FRONTEND_URL}/payment/verify?tx_ref=${encodeURIComponent(txRef)}`;
    const chapaCallbackUrl = `${BACKEND_URL}/api/payments/webhook`;

    const [firstName, ...rest] = customerFullName.trim().split(/\s+/);
    const lastName = rest.join(" ") || "Guest";
    const renterEmail = customerEmail || renter?.email || "";
    const renterPhone = customerPhone || renter?.phone || "";

    // Normalize mobile: keep digits only (Chapa expects 09/07 formats)
    const mobile = renterPhone.replace(/\D/g, "");

    // Call Chapa APIs based on method
    let chapaData: any;
    try {
      if (effectivePaymentMethod === PAYMENT_METHODS.TELEBIRR || effectivePaymentMethod === PAYMENT_METHODS.CBE) {
        const chapaType = CHAPA_DIRECT_CHARGE_TYPE[effectivePaymentMethod];

        const form = new FormData();
        form.append("amount", String(amount));
        form.append("currency", "ETB");
        form.append("mobile", mobile);
        form.append("tx_ref", txRef);
        form.append("email", renterEmail);
        form.append("first_name", firstName);
        form.append("last_name", lastName);
        form.append("callback_url", chapaCallbackUrl);
        form.append("return_url", chapaReturnUrl);

        const chapaResponse = await fetch(`https://api.chapa.co/v1/charges?type=${encodeURIComponent(chapaType)}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
          },
          body: form,
        });

        const chapaJson: any = await chapaResponse.json();
        chapaData = chapaJson;
      } else {
        // Card / Bank (use Chapa transaction initialize checkout)
        const payload = {
          amount: String(amount),
          currency: "ETB",
          email: renterEmail,
          first_name: firstName,
          last_name: lastName,
          tx_ref: txRef,
          phone_number: renterPhone || undefined,
          callback_url: chapaCallbackUrl,
          return_url: chapaReturnUrl,
          customization: {
            title: "Berenda Booking",
            description: `Booking for ${property.title}`,
          },
          meta: {
            bookingId: booking.id,
            paymentMethod: effectivePaymentMethod,
            notes: customerNotes || undefined,
          },
        };

        const chapaResponse = await fetch("https://api.chapa.co/v1/transaction/initialize", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CHAPA_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const chapaJson: any = await chapaResponse.json();
        chapaData = chapaJson;
      }
    } catch (err: any) {
      console.error("Chapa request failed:", err);
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      await prisma.booking.update({ where: { id: booking.id }, data: { status: "failed" } });
      return res.status(503).json({
        success: false,
        message: "Payment provider is temporarily unavailable. Please try again in a few minutes.",
      });
    }

    const checkoutUrl = (chapaData && (chapaData.data?.checkout_url || chapaData.checkout_url || chapaData.data?.url)) || undefined;

    const chapaSuccess = !!(chapaData && (chapaData.status === "success" || chapaData?.data?.status === "success"));

    if (!chapaSuccess || !checkoutUrl) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "failed", chapaResponse: chapaData as any },
      });
      await prisma.booking.update({ where: { id: booking.id }, data: { status: "failed" } });

      return res.status(400).json({
        success: false,
        message: "Failed to initialize payment gateway",
        error: chapaData,
      });
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { checkoutUrl, chapaResponse: chapaData as any },
    });

    return res.status(200).json({
      success: true,
      message: "Payment initialized successfully",
      checkoutUrl,
      txRef,
    });
  } catch (error: any) {
    console.error("Payment Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 2. Verify Payment Callback
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const txRef  = req.params.txRef as string;
    

    const payment = await prisma.payment.findUnique({
      where: { txRef },
      include: { booking: { include: { property: true } } }
    });

    if (!payment) return res.status(404).json({ success: false, message: "Payment transaction not found" });
    if (payment.status === "success") return res.status(200).json({ success: true, message: "Already verified", data: payment });

    const chapaResponse = await fetch(`https://api.chapa.co/v1/transaction/verify/${txRef}`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${CHAPA_SECRET_KEY}` }
    });

    const chapaData: any = await chapaResponse.json();

    const verifiedSuccess = !!(chapaData && (chapaData.status === "success" || chapaData?.data?.status === "success"));

    if (verifiedSuccess) {
      // Mark successful
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "success", chapaResponse: chapaData as any } });
      await prisma.booking.update({ where: { id: payment.bookingId }, data: { status: "confirmed" } });

      // Fetch the complete booking with relations (FIXED: use bookingId instead of payment.booking)
      const bookingWithDetails = await prisma.booking.findUnique({
        where: { id: payment.bookingId },
        include: {
          property: { include: { owner: true } },
          renter: true
        }
      });

      if (bookingWithDetails) {
        // Notify host automatically! Use Chat system
        let chat = await prisma.chat.findFirst({
          where: {
            AND: [
              { participants: { some: { userId: bookingWithDetails.renterId } } },
              { participants: { some: { userId: bookingWithDetails.property.ownerId } } }
            ]
          }
        });
        if (!chat) {
          chat = await prisma.chat.create({
            data: {
              participants: {
                create: [
                  { userId: bookingWithDetails.renterId },
                  { userId: bookingWithDetails.property.ownerId }
                ]
              }
            }
          });
        }
        // Automate Booking Message
        await prisma.message.create({
          data: {
            chatId: chat.id,
            senderId: bookingWithDetails.renterId,
            message: `Booking Confirmed! I have successfully booked and paid for "${bookingWithDetails.property.title}".`,
            isAi: false
          }
        });
      }

      return res.status(200).json({ success: true, message: "Payment verified successfully", data: payment });
    } else {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed", chapaResponse: chapaData as any } });
      await prisma.booking.update({ where: { id: payment.bookingId }, data: { status: "failed" } });
      return res.status(400).json({ success: false, message: "Payment not successful", error: chapaData });
    }
  } catch (error: any) {
    console.error("Verification Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 3. Server Webhook from Chapa
export const chapaWebhook = async (req: Request, res: Response) => {
  try {
    const signature = req.headers["chapa-signature"];
    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body ?? {});

    const hash = crypto.createHmac("sha256", CHAPA_WEBHOOK_SECRET).update(rawBody).digest("hex");
    if (typeof signature === "string" && hash !== signature) {
      return res.status(400).send("Invalid Signature");
    }

    const event = typeof rawBody === "string" ? JSON.parse(rawBody) : req.body;
    const txRef = event?.tx_ref || event?.data?.tx_ref || event?.data?.trx_ref || event?.trx_ref;
    const eventName = event?.event || event?.type;

    const isSuccess =
      eventName === "charge.success" ||
      eventName === "transaction.success" ||
      eventName === "payment.success" ||
      event?.status === "success";

    if (isSuccess && txRef) {
      const payment = await prisma.payment.findUnique({ where: { txRef }, include: { booking: true } });
      if (payment && payment.status === "pending") {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: "success" } });
        await prisma.booking.update({ where: { id: payment.bookingId }, data: { status: "confirmed" } });
      }
    }
    return res.status(200).send("OK");
  } catch (error) {
    return res.status(500).send("Error");
  }
};