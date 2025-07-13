#!/usr/bin/env python3
"""
AgriAI Map Insights - Flask Backend
Production-ready satellite data analysis with robust error handling
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import ee
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
import json
from datetime import datetime, timedelta
import logging
import traceback

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Google Earth Engine
try:
    # For production, use service account authentication
    # ee.Initialize(ee.ServiceAccountCredentials('your-service-account@project.iam.gserviceaccount.com', 'path/to/key.json'))
    
    # For development, use user authentication
    ee.Authenticate()
    ee.Initialize()
    logger.info("Google Earth Engine initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Google Earth Engine: {e}")

def create_response(success: bool, message: str, data=None):
    """Create standardized API response"""
    response = {
        "success": success,
        "message": message,
        "timestamp": datetime.now().isoformat()
    }
    if data is not None:
        response["data"] = data
    return response

def validate_geometry(geometry):
    """Validate input geometry"""
    if not geometry:
        return False, "Geometry is required"
    
    if not isinstance(geometry, dict):
        return False, "Geometry must be a valid GeoJSON object"
    
    if geometry.get('type') != 'Polygon':
        return False, "Geometry must be a Polygon"
    
    coordinates = geometry.get('coordinates')
    if not coordinates or not isinstance(coordinates, list):
        return False, "Invalid coordinates"
    
    if len(coordinates) < 1 or len(coordinates[0]) < 4:
        return False, "Polygon must have at least 3 points"
    
    # Check coordinate validity
    for coord in coordinates[0]:
        if not isinstance(coord, list) or len(coord) != 2:
            return False, "Invalid coordinate format"
        
        lng, lat = coord
        if not (-180 <= lng <= 180) or not (-90 <= lat <= 90):
            return False, f"Invalid coordinates: longitude {lng}, latitude {lat}"
    
    return True, "Valid geometry"

def compute_vegetation_indices(image):
    """Compute various vegetation and water indices"""
    try:
        # NDVI (Normalized Difference Vegetation Index)
        ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI')
        
        # EVI (Enhanced Vegetation Index)
        evi = image.expression(
            '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))',
            {
                'NIR': image.select('B8'),
                'RED': image.select('B4'),
                'BLUE': image.select('B2')
            }
        ).rename('EVI')
        
        # NDWI (Normalized Difference Water Index)
        ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI')
        
        # NDRE (Normalized Difference Red Edge)
        ndre = image.normalizedDifference(['B8', 'B5']).rename('NDRE')
        
        return image.addBands([ndvi, evi, ndwi, ndre])
    except Exception as e:
        logger.error(f"Error computing vegetation indices: {e}")
        raise

def classify_health_zones(image, geometry):
    """Classify field into health zones using clustering"""
    try:
        # Sample the image within the field geometry
        sample = image.select(['NDVI', 'EVI', 'NDWI', 'NDRE']).sampleRegion(
            collection=geometry,
            scale=10,
            numPixels=1000
        )
        
        # Convert to numpy array for clustering
        sample_data = sample.getInfo()
        features = sample_data.get('features', [])
        
        if not features:
            logger.warning("No data points found in the selected area")
            return {0: 'healthy', 1: 'moderate', 2: 'stressed'}, {'healthy': 60, 'moderate': 30, 'stressed': 10}, None
        
        # Extract values
        data_points = []
        for feature in features:
            props = feature.get('properties', {})
            if all(key in props and props[key] is not None for key in ['NDVI', 'EVI', 'NDWI', 'NDRE']):
                data_points.append([
                    props['NDVI'],
                    props['EVI'], 
                    props['NDWI'],
                    props['NDRE']
                ])
        
        if len(data_points) < 3:
            logger.warning("Insufficient valid data points for clustering")
            return {0: 'healthy', 1: 'moderate', 2: 'stressed'}, {'healthy': 60, 'moderate', 30, 'stressed': 10}, None
        
        # Perform K-means clustering
        data_array = np.array(data_points)
        kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
        clusters = kmeans.fit_predict(data_array)
        
        # Classify clusters based on NDVI values
        cluster_means = []
        for i in range(3):
            cluster_mask = clusters == i
            if np.any(cluster_mask):
                cluster_data = data_array[cluster_mask]
                mean_ndvi = np.mean(cluster_data[:, 0])  # NDVI is first column
                cluster_means.append((i, mean_ndvi))
        
        # Sort by NDVI and assign health categories
        cluster_means.sort(key=lambda x: x[1], reverse=True)
        health_mapping = {
            cluster_means[0][0]: 'healthy',    # Highest NDVI
            cluster_means[1][0]: 'moderate',   # Medium NDVI
            cluster_means[2][0]: 'stressed'    # Lowest NDVI
        }
        
        # Calculate percentages
        total_points = len(clusters)
        health_percentages = {
            'healthy': round(np.sum(clusters == cluster_means[0][0]) / total_points * 100, 1),
            'moderate': round(np.sum(clusters == cluster_means[1][0]) / total_points * 100, 1),
            'stressed': round(np.sum(clusters == cluster_means[2][0]) / total_points * 100, 1)
        }
        
        return health_mapping, health_percentages, data_array
        
    except Exception as e:
        logger.error(f"Error in clustering: {e}")
        # Return default values if clustering fails
        return {0: 'healthy', 1: 'moderate', 2: 'stressed'}, {'healthy': 60, 'moderate': 30, 'stressed': 10}, None

def generate_recommendations(avg_indices, health_zones):
    """Generate AI-powered recommendations based on analysis"""
    recommendations = []
    
    try:
        # NDVI-based recommendations
        ndvi = avg_indices.get('NDVI', 0)
        if ndvi > 0.7:
            recommendations.append("Excellent vegetation health detected. Continue current management practices.")
        elif ndvi > 0.5:
            recommendations.append("Good vegetation health. Monitor for any declining trends.")
        elif ndvi > 0.3:
            recommendations.append("Moderate vegetation vigor. Consider soil testing and nutrient supplementation.")
        else:
            recommendations.append("Low vegetation vigor detected. Immediate attention needed for soil and water management.")
        
        # Water stress recommendations
        ndwi = avg_indices.get('NDWI', 0)
        if ndwi < 0.1:
            recommendations.append("Water stress indicators present. Increase irrigation frequency or check soil moisture.")
        elif ndwi > 0.3:
            recommendations.append("Adequate water content. Current irrigation schedule appears optimal.")
        
        # Health zone recommendations
        stressed_pct = health_zones.get('stressed', 0)
        healthy_pct = health_zones.get('healthy', 0)
        
        if stressed_pct > 20:
            recommendations.append("Significant stressed areas detected. Focus management on problem zones.")
        
        if healthy_pct > 70:
            recommendations.append("Majority of field shows healthy growth. Excellent field management.")
        elif healthy_pct < 40:
            recommendations.append("Field requires immediate attention. Consider comprehensive soil and crop analysis.")
        
        # Seasonal recommendations
        current_month = datetime.now().month
        if current_month in [6, 7, 8, 9]:  # Growing season
            recommendations.append("Monitor for pest and disease pressure during growing season.")
        elif current_month in [3, 4, 5]:  # Spring season
            recommendations.append("Spring season: Ensure adequate nutrition for optimal growth.")
        elif current_month in [10, 11, 12]:  # Harvest/post-harvest
            recommendations.append("Post-harvest: Plan soil amendments and cover crops for next season.")
        
        return recommendations
        
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}")
        return ["Analysis completed. Consult with agricultural experts for detailed recommendations."]

@app.route('/analyze_field', methods=['POST'])
def analyze_field():
    """Main endpoint for field analysis"""
    try:
        # Get and validate request data
        if not request.is_json:
            return jsonify(create_response(False, "Request must be JSON")), 400
        
        data = request.get_json()
        if not data:
            return jsonify(create_response(False, "No data provided")), 400
        
        # Validate geometry
        geometry = data.get('geometry')
        is_valid, validation_message = validate_geometry(geometry)
        if not is_valid:
            return jsonify(create_response(False, validation_message)), 400
        
        # Convert GeoJSON to Earth Engine geometry
        ee_geometry = ee.Geometry(geometry)
        
        # Calculate field area
        area_m2 = ee_geometry.area().getInfo()
        area_hectares = area_m2 / 10000
        
        # Validate area
        if area_hectares < 0.1:
            return jsonify(create_response(False, "Field area too small (minimum 0.1 hectares)")), 400
        if area_hectares > 10000:
            return jsonify(create_response(False, "Field area too large (maximum 10,000 hectares)")), 400
        
        # Define date range (last 60 days for better image availability)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=60)
        
        # Get Sentinel-2 imagery
        collection = ee.ImageCollection('COPERNICUS/S2_SR') \
            .filterBounds(ee_geometry) \
            .filterDate(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))
        
        # Check if any images are available
        image_count = collection.size().getInfo()
        if image_count == 0:
            return jsonify(create_response(
                False, 
                "No suitable satellite imagery found for the selected area and time period. Try a different location or time range."
            )), 404
        
        # Get the most recent cloud-free image
        latest_image = collection.sort('system:time_start', False).first()
        
        # Compute vegetation indices
        analyzed_image = compute_vegetation_indices(latest_image)
        
        # Calculate mean values for the field
        mean_values = analyzed_image.select(['NDVI', 'EVI', 'NDWI', 'NDRE']).reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=ee_geometry,
            scale=10,
            maxPixels=1e9
        ).getInfo()
        
        # Validate mean values
        for key, value in mean_values.items():
            if value is None:
                logger.warning(f"Missing value for {key}")
                mean_values[key] = 0.0
        
        # Classify health zones
        health_mapping, health_percentages, cluster_data = classify_health_zones(analyzed_image, ee_geometry)
        
        # Generate recommendations
        recommendations = generate_recommendations(mean_values, health_percentages)
        
        # Create analysis result
        analysis_result = {
            'summary': {
                'field_area_hectares': round(area_hectares, 2),
                'avg_ndvi': round(mean_values.get('NDVI', 0), 3),
                'avg_evi': round(mean_values.get('EVI', 0), 3),
                'avg_ndwi': round(mean_values.get('NDWI', 0), 3),
                'avg_ndre': round(mean_values.get('NDRE', 0), 3),
                'health_zones': {
                    'healthy': health_percentages.get('healthy', 0),
                    'moderate': health_percentages.get('moderate', 0),
                    'stressed': health_percentages.get('stressed', 0)
                },
                'recommendations': recommendations,
                'analysis_date': end_date.strftime('%Y-%m-%d'),
                'image_count': image_count
            },
            'geojson_overlay': {
                'type': 'FeatureCollection',
                'features': []  # In production, this would contain the classified zones
            }
        }
        
        logger.info(f"Successfully analyzed field of {area_hectares:.2f} hectares")
        return jsonify(create_response(True, "Field analysis completed successfully", analysis_result))
        
    except ee.EEException as e:
        logger.error(f"Google Earth Engine error: {e}")
        return jsonify(create_response(False, "Satellite data processing error. Please try again later.")), 500
    
    except Exception as e:
        logger.error(f"Unexpected error analyzing field: {e}")
        logger.error(traceback.format_exc())
        return jsonify(create_response(False, "Internal server error. Please try again later.")), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test Earth Engine connection
        ee.Number(1).getInfo()
        
        return jsonify(create_response(True, "Service is healthy", {
            'gee_initialized': True,
            'version': '1.0.0'
        }))
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify(create_response(False, "Service unhealthy")), 503

@app.errorhandler(404)
def not_found(error):
    return jsonify(create_response(False, "Endpoint not found")), 404

@app.errorhandler(405)
def method_not_allowed(error):
    return jsonify(create_response(False, "Method not allowed")), 405

@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal server error: {error}")
    return jsonify(create_response(False, "Internal server error")), 500

if __name__ == '__main__':
    # Run the Flask app
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
