// backend/src/modules/locations/location.controller.ts
import { Request, Response } from "express";
import prisma from "../../lib/prisma";


// Define types for Nominatim API responses
interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  country?: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

interface NominatimReverseResult {
  display_name: string;
  address?: NominatimAddress;
}

// Helper to fetch real locations from Nominatim
async function fetchFromNominatim(query: string): Promise<NominatimResult[]> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1`
  );
  const data = await response.json();
  return data as NominatimResult[];
}

export const searchLocations = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    
    console.log('🔍 Searching locations for:', q);
    
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Search from OpenStreetMap Nominatim first
    let locations: any[] = [];
    
    try {
      const results = await fetchFromNominatim(q);
      locations = results.map((result: NominatimResult) => ({
        id: result.place_id.toString(),
        name: result.display_name.split(',')[0],
        city: result.address?.city || result.address?.town || result.address?.village || '',
        country: result.address?.country || '',
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        display_name: result.display_name
      }));
      console.log(`📍 Found ${locations.length} matching locations from Nominatim`);
    } catch (error) {
      console.error('Nominatim search failed, falling back to local database:', error);
    }

    // If Nominatim returns no results, try local database
    if (locations.length === 0) {
      const properties = await prisma.property.findMany({
        where: {
          OR: [
            { location: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } }
          ],
          deletedAt: null,
          approvalStatus: 'approved'
        },
        select: {
          location: true,
          latitude: true,
          longitude: true,
          title: true
        },
        distinct: ['location'],
        take: 10
      });

      locations = properties.map(prop => {
        const parts = prop.location.split(',').map(p => p.trim());
        return {
          id: prop.location,
          name: parts[0] || prop.location,
          city: parts[1] || '',
          country: parts[2] || '',
          latitude: prop.latitude,
          longitude: prop.longitude
        };
      });
      console.log(`📍 Found ${locations.length} matching locations from local database`);
    }

    res.status(200).json({ success: true, data: locations });
  } catch (error: any) {
    console.error('Error searching locations:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to search locations' 
    });
  }
};

// Get location details by coordinates
export const getLocationByCoordinates = async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: "Latitude and longitude are required" });
    }
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
    );
    const data = await response.json() as NominatimReverseResult;
    
    res.status(200).json({ 
      success: true, 
      data: {
        address: data.display_name,
        city: data.address?.city || data.address?.town || data.address?.village,
        country: data.address?.country
      }
    });
  } catch (error: any) {
    console.error('Error getting location by coordinates:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};