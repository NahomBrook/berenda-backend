import { Request, Response } from "express";
import prisma from "../../config/prisma";

export const uploadPropertyImage = async (req: Request, res: Response) => {
  try {
        const propertyId = req.params.propertyId as string;
    const file = req.file as any;

    if (!file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    // MATCHING YOUR SCHEMA: 
    // - Use 'propertyMedia' (camelCase from the model name)
    // - Use 'mediaUrl' instead of 'url'
    // - Use 'mediaType' instead of 'type'
    // - Use 'image' (lowercase) to match your Enum
    const newMedia = await prisma.propertyMedia.create({
      data: {
        propertyId,
        mediaUrl: file.path, 
        mediaType: "image", 
      },
    });

    res.status(201).json({
      success: true,
      message: "Image uploaded and saved to DB",
      data: newMedia
    });
  } catch (error: any) {
    console.error("Prisma Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};