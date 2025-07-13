import { NextRequest, NextResponse } from 'next/server';
import { JWT } from 'google-auth-library';

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

// Obtain a short-lived OAuth2 access token for the service account.
async function getEarthEngineToken() {
  const privateKey = process.env.GEE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.GEE_CLIENT_EMAIL;

  if (!privateKey || !clientEmail) {
    throw new Error('Missing GEE credentials. Ensure GEE_PRIVATE_KEY and GEE_CLIENT_EMAIL are set.');
  }

  const jwt = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/earthengine'],
  });

  const { access_token } = await jwt.authorize();
  if (!access_token) {
    throw new Error('Failed to acquire Earth Engine access token');
  }
  return access_token;
}

export async function POST(req: NextRequest) {
  try {
    const token = await getEarthEngineToken();
    const GEE_PROJECT_ID = process.env.GEE_PROJECT_ID;

    if (!GEE_PROJECT_ID) {
        throw new Error('Missing GEE_PROJECT_ID environment variable.');
    }

    if (req.headers.get('content-type') !== 'application/json') {
      return NextResponse.json(createResponse(false, 'Request must be JSON'), { status: 400 });
    }

    const data = await req.json();
    if (!data) return NextResponse.json(createResponse(false, 'No data provided'), { status: 400 });

    const geometry = data.geometry;
    const [isValid, validationMessage] = validateGeometry(geometry);
    if (!isValid) return NextResponse.json(createResponse(false, validationMessage), { status: 400 });

    // Build an Earth Engine expression that computes mean NDVI over the user field.
    const expression = `
      var field = ee.Geometry(${JSON.stringify(geometry)});
      var collection = ee.ImageCollection('COPERNICUS/S2_SR')
        .filterBounds(field)
        .filterDate('2025-01-01', '2025-12-31')
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
      var image = collection.median();
      var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
      var mean = ndvi.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: field,
        scale: 10,
        maxPixels: 1e9
      }).get('NDVI');
      return mean;
    `;

    // Call the Earth Engine REST API directly.
    const response = await fetch(`https://earthengine.googleapis.com/v1alpha/projects/${GEE_PROJECT_ID}/value:compute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ expression }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Earth Engine API error: ${response.status} - ${errText}`);
    }

    const resultJson: any = await response.json();
    const ndviValue = resultJson.result?.value ?? null;

    const analysisResult = {
      summary: {
        ndvi: ndviValue,
      },
      recommendations: ndviValue !== null && ndviValue > 0.5 ? ['Good vegetation health.'] : ['Monitor for stress.'],
    };

    return NextResponse.json(createResponse(true, 'Field analysis completed successfully', analysisResult));
  } catch (e: any) {
    console.error('Analyze field error:', e);
    return NextResponse.json(createResponse(false, e.message || 'Internal server error'), { status: 500 });
  }
}