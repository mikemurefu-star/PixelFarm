import { NextRequest, NextResponse } from 'next/server';
import ee from '@google/earthengine';

// Validate GeoJSON Polygon
function validateGeometry(geometry: any): [boolean, string] {
  if (!geometry) return [false, 'Geometry is required'];
  if (geometry.type !== 'Polygon') return [false, 'Geometry must be a Polygon'];
  if (!Array.isArray(geometry.coordinates)) return [false, 'Invalid coordinates'];
  if (geometry.coordinates.length < 1 || geometry.coordinates[0].length < 4)
    return [false, 'Polygon must have at least 3 points'];
  for (const coord of geometry.coordinates[0]) {
    if (!Array.isArray(coord) || coord.length !== 2)
      return [false, 'Invalid coordinate format'];
    const [lng, lat] = coord;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90)
      return [false, `Invalid coordinates: longitude ${lng}, latitude ${lat}`];
  }
  return [true, 'Valid geometry'];
}

// Standard API response format
function createResponse(success: boolean, message: string, data?: any) {
  return {
    success,
    message,
    timestamp: new Date().toISOString(),
    ...(data !== undefined ? { data } : {}),
  };
}

// POST handler
export async function POST(req: NextRequest) {
  try {
    const privateKey = process.env.GEE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.GEE_CLIENT_EMAIL;
    const GEE_PROJECT_ID = process.env.GEE_PROJECT_ID;

    if (!privateKey || !clientEmail || !GEE_PROJECT_ID)
      throw new Error('Missing required GEE credentials');

    // Parse request
    if (req.headers.get('content-type') !== 'application/json') {
      return NextResponse.json(createResponse(false, 'Request must be JSON'), { status: 400 });
    }

    const data = await req.json();
    if (!data || !data.geometry)
      return NextResponse.json(createResponse(false, 'No geometry provided'), { status: 400 });

    // Validate geometry
    const [isValid, validationMsg] = validateGeometry(data.geometry);
    if (!isValid)
      return NextResponse.json(createResponse(false, validationMsg), { status: 400 });

    // Authenticate EE SDK with service account
    await new Promise<void>((resolve, reject) => {
      ee.data.authenticateViaPrivateKey(
        { private_key: privateKey, client_email: clientEmail },
        () => ee.initialize(null, null, resolve, reject),
        reject
      );
    });

    // Create EE geometry
    const field = new ee.Geometry.Polygon(data.geometry.coordinates);

    // Build NDVI analysis
    const collection = ee.ImageCollection('COPERNICUS/S2_SR')
      .filterBounds(field)
      .filterDate('2025-01-01', '2025-12-31')
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

    const ndvi = collection.median().normalizedDifference(['B8', 'B4']).rename('NDVI');

    const meanDict = ndvi.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: field,
      scale: 10,
      maxPixels: 1e9,
    });

    const ndviValue = await meanDict.getInfo().then((d: any) => d.NDVI ?? null);

    const recommendations =
      ndviValue !== null && ndviValue > 0.5
        ? ['Good vegetation health.']
        : ['Monitor for stress.'];

    return NextResponse.json(
      createResponse(true, 'Analysis completed', {
        summary: { ndvi: ndviValue },
        recommendations,
      })
    );
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      createResponse(false, error.message || 'Internal server error'),
      { status: 500 }
    );
  }
}
