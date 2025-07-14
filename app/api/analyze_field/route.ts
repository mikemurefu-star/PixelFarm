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

    // Calculate indices using Earth Engine
    const medianImage = collection.median();
    const ndvi = medianImage.normalizedDifference(["B8", "B4"]).rename("NDVI");
    const evi = medianImage.expression(
      '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))',
      {
        NIR: medianImage.select("B8"),
        RED: medianImage.select("B4"),
        BLUE: medianImage.select("B2"),
      }
    ).rename("EVI");
    const ndwi = medianImage.normalizedDifference(["B3", "B8"]).rename("NDWI");
    const ndre = medianImage.normalizedDifference(["B8", "B5"]).rename("NDRE");

    // Reduce region for each index
    const [ndviDict, eviDict, ndwiDict, ndreDict, ndviHistDict] = await Promise.all([
      ndvi.reduceRegion({ reducer: ee.Reducer.mean(), geometry: field, scale: 10, maxPixels: 1e9 }).getInfo(),
      evi.reduceRegion({ reducer: ee.Reducer.mean(), geometry: field, scale: 10, maxPixels: 1e9 }).getInfo(),
      ndwi.reduceRegion({ reducer: ee.Reducer.mean(), geometry: field, scale: 10, maxPixels: 1e9 }).getInfo(),
      ndre.reduceRegion({ reducer: ee.Reducer.mean(), geometry: field, scale: 10, maxPixels: 1e9 }).getInfo(),
      ndvi.reduceRegion({ reducer: ee.Reducer.histogram({maxBuckets: 20, minBucketWidth: 0.05}), geometry: field, scale: 10, maxPixels: 1e9 }).getInfo(),
    ]);

    const avg_ndvi = ndviDict.NDVI ?? null;
    const avg_evi = eviDict.constant ?? eviDict.EVI ?? null;
    const avg_ndwi = ndwiDict.NDWI ?? null;
    const avg_ndre = ndreDict.NDRE ?? null;

    // Dynamic Health Zones using NDVI histogram
    let healthy = 0, moderate = 0, stressed = 0, health_zones: any = null;
    let noNDVIData = false;
    // Debug logging
    console.log('NDVI mean:', ndviDict);
    console.log('NDVI histogram:', ndviHistDict);
    if (ndviHistDict && ndviHistDict.NDVI) {
      const bucketMeans = Array.isArray(ndviHistDict.NDVI.bucketMeans) ? ndviHistDict.NDVI.bucketMeans : [];
      const counts = Array.isArray(ndviHistDict.NDVI.histogram) ? ndviHistDict.NDVI.histogram : [];
      let total = 0;
      for (const c of counts) total += c;
      console.log('NDVI bucketMeans:', bucketMeans);
      console.log('NDVI counts:', counts);
      console.log('NDVI histogram total:', total);
      if (total > 0) {
        for (let i = 0; i < Math.min(bucketMeans.length, counts.length); i++) {
          const mean = bucketMeans[i];
          const count = counts[i];
          if (mean > 0.3) healthy += count;
          else if (mean > 0.15) moderate += count;
          else stressed += count;
        }
        healthy = Math.round((healthy / total) * 100);
        moderate = Math.round((moderate / total) * 100);
        stressed = Math.round((stressed / total) * 100);
        health_zones = { healthy, moderate, stressed };
      }
    }
    // Only set noNDVIData if both mean and histogram are missing/empty
    if ((avg_ndvi === null || typeof avg_ndvi !== 'number') && (!ndviHistDict || !ndviHistDict.NDVI || !ndviHistDict.NDVI.histogram || !ndviHistDict.NDVI.histogram.counts || ndviHistDict.NDVI.histogram.counts.reduce((a: number, b: number) => a + b, 0) === 0)) {
      noNDVIData = true;
      health_zones = null;
    }

    // Smarter AI Recommendations
    let recommendations: string[] = [];
    // If health_zones exists and healthy > 90, give a positive message
    if (health_zones && health_zones.healthy > 90) {
      recommendations.push("Your field looks great! No major issues detected. Keep up the good work and continue regular monitoring.");
    } else if (noNDVIData || avg_ndvi === null) {
      recommendations.push("No NDVI data available for this field. Try a different area or date.");
    } else {
      if (avg_ndvi < 0.3) {
        recommendations.push("Increase irrigation and check for crop stress. Consider soil testing and replanting if low NDVI persists.");
      } else if (avg_ndvi > 0.6) {
        recommendations.push("Field is healthy. Maintain current practices and monitor for pests.");
      } else {
        recommendations.push("Monitor field regularly. Apply fertilizer if needed and check for emerging stress.");
      }
      if (avg_ndwi !== null) {
        if (avg_ndwi < 0.2) {
          recommendations.push("Increase watering. Soil or crop may be dry.");
        } else if (avg_ndwi > 0.5) {
          recommendations.push("Field is well-watered. Avoid over-irrigation.");
        }
      }
      if (avg_ndre !== null && avg_ndre < 0.2) {
        recommendations.push("Low NDRE: Check for nutrient deficiencies, especially nitrogen.");
      }
      if (avg_evi !== null && avg_evi < 0.2) {
        recommendations.push("Low EVI: Vegetation is sparse or stressed.");
      }
    }
    if (recommendations.length === 0) {
      recommendations.push("No specific issues detected. Continue regular monitoring.");
    }

    let overlay_url = null;

    const result = {
      summary: {
        field_area_hectares: 8.7, // You can calculate this dynamically if needed
        avg_ndvi,
        avg_evi,
        avg_ndwi,
        avg_ndre,
        health_zones: health_zones, // null if no NDVI data, or { healthy, moderate, stressed } if available
        recommendations,
        analysis_date: new Date().toISOString().slice(0, 10),
        image_count: 12,
        overlay_url,
      },
      geojson_overlay: data.geometry,
    };



    return NextResponse.json(
      createResponse(true, 'Analysis completed', result)
    );
  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      createResponse(false, error.message || 'Internal server error'),
      { status: 500 }
    );
  }
}
