import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';
import ee from '@google/earthengine';

// Helper: Validate GeoJSON Polygon
function validateGeometry(geometry: any): [boolean, string] {
  if (!geometry) return [false, 'Geometry is required'];
  if (geometry.type !== 'Polygon') return [false, 'Geometry must be a Polygon'];
  if (!Array.isArray(geometry.coordinates)) return [false, 'Invalid coordinates'];
  if (geometry.coordinates.length < 1 || geometry.coordinates[0].length < 4) return [false, 'Polygon must have at least 3 points'];
  for (const coord of geometry.coordinates[0]) {
    if (!Array.isArray(coord) || coord.length !== 2) return [false, 'Invalid coordinate format'];
    const [lng, lat] = coord;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return [false, `Invalid coordinates: longitude ${lng}, latitude ${lat}`];
  }
  return [true, 'Valid geometry'];
}

// Helper: Standardized API response
function createResponse(success: boolean, message: string, data?: any) {
  return {
    success,
    message,
    timestamp: new Date().toISOString(),
    ...(data !== undefined ? { data } : {}),
  };
}

// Initialize Google Earth Engine (service account)
let geeInitialized = false;
async function initializeGEE() {
  if (geeInitialized) return;
  const privateKey = process.env.GEE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GEE_CLIENT_EMAIL;
  if (!privateKey || !clientEmail) throw new Error('Missing GEE credentials');
  const jwt = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/earthengine'],
  });
  await new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(
      { client_email: clientEmail, private_key: privateKey },
      () => {
        ee.initialize(null, null, () => {
          geeInitialized = true;
          resolve(true);
        }, reject);
      },
      reject
    );
  });
}

export async function POST(req: NextRequest) {
  try {
    await initializeGEE();
    if (req.headers.get('content-type') !== 'application/json') {
      return NextResponse.json(createResponse(false, 'Request must be JSON'), { status: 400 });
    }
    const data = await req.json();
    if (!data) return NextResponse.json(createResponse(false, 'No data provided'), { status: 400 });
    const geometry = data.geometry;
    const [isValid, validationMessage] = validateGeometry(geometry);
    if (!isValid) return NextResponse.json(createResponse(false, validationMessage), { status: 400 });

    // Example: Calculate NDVI for the polygon using Sentinel-2
    const field = ee.Geometry.Polygon(geometry.coordinates);
    const collection = ee.ImageCollection('COPERNICUS/S2_SR')
      .filterBounds(field)
      .filterDate('2024-01-01', '2024-12-31')
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
    const image = collection.median();
    const ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
    const meanDict = ndvi.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: field,
      scale: 10,
      maxPixels: 1e9,
    });
    const ndviValue = await new Promise<number>((resolve, reject) => {
      meanDict.getInfo((result: any, err: any) => {
        if (err) reject(err);
        else resolve(result.NDVI);
      });
    });
    // Example result (expand as needed)
    const analysisResult = {
      summary: {
        field_area_hectares: field.area().divide(10000).getInfo(),
        ndvi: ndviValue,
      },
      recommendations: ndviValue > 0.5 ? ['Good vegetation health.'] : ['Monitor for stress.'],
    };
    return NextResponse.json(createResponse(true, 'Field analysis completed successfully', analysisResult));
  } catch (e: any) {
    return NextResponse.json(createResponse(false, e.message || 'Internal server error'), { status: 500 });
  }
}
