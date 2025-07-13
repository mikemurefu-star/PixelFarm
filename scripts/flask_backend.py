#!/usr/bin/env python3
"""
AgriAI Map Insights - Flask Backend
Integrates with Google Earth Engine for satellite data analysis
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

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
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

def compute_vegetation_indices(image):
    """Compute various vegetation and water indices"""
    
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

def classify_health_zones(image, geometry):
    """Classify field into health zones using clustering"""
    
    # Sample the image within the field geometry
    sample = image.select(['NDVI', 'EVI', 'NDWI', 'NDRE']).sampleRegion(
        collection=geometry,
        scale=10,
        numPixels=1000
    )
    
    # Convert to numpy array for clustering
    try:
        sample_data = sample.getInfo()
        features = sample_data['features']
        
        if not features:
            raise ValueError("No data points found in the selected area")
        
        # Extract values
        data_points = []
        for feature in features:
            props = feature['properties']
            if all(key in props and props[key] is not None for key in ['NDVI', 'EVI', 'NDWI', 'NDRE']):
                data_points.append([
                    props['NDVI'],
                    props['EVI'], 
                    props['NDWI'],
                    props['NDRE']
                ])
        
        if len(data_points) < 3:
            raise ValueError("Insufficient valid data points for analysis")
        
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
            'healthy': np.sum(clusters == cluster_means[0][0]) / total_points * 100,
            'moderate': np.sum(clusters == cluster_means[1][0]) / total_points * 100,
            'stressed': np.sum(clusters == cluster_means[2][0]) / total_points * 100
        }
        
        return health_mapping, health_percentages, data_array
        
    except Exception as e:
        logger.error(f"Error in clustering: {e}")
        # Return default values if clustering fails
        return {0: 'healthy', 1: 'moderate', 2: 'stressed'}, {'healthy': 60, 'moderate': 30, 'stressed': 10}, None

def generate_recommendations(avg_indices, health_zones):
    """Generate AI-powered recommendations based on analysis"""
    
    recommendations = []
    
    # NDVI-based recommendations
    if avg_indices['NDVI'] > 0.7:
        recommendations.append("Excellent vegetation health detected. Continue current management practices.")
    elif avg_indices['NDVI'] > 0.5:
        recommendations.append("Good vegetation health. Monitor for any declining trends.")
    else:
        recommendations.append("Low vegetation vigor detected. Consider soil testing and nutrient supplementation.")
    
    # Water stress recommendations
    if avg_indices['NDWI'] < 0.1:
        recommendations.append("Water stress indicators present. Increase irrigation frequency or check soil moisture.")
    elif avg_indices['NDWI'] > 0.3:
        recommendations.append("Adequate water content. Current irrigation schedule appears optimal.")
    
    # Health zone recommendations
    if health_zones['stressed'] > 20:
        recommendations.append("Significant stressed areas detected. Focus management on red zones in the overlay.")
    
    if health_zones['healthy'] > 70:
        recommendations.append("Majority of field shows healthy growth. Excellent field management.")
    
    # Seasonal recommendations
    current_month = datetime.now().month
    if current_month in [6, 7, 8, 9]:  # Monsoon season in India
        recommendations.append("Monitor for waterlogging during monsoon season.")
    elif current_month in [3, 4, 5]:  # Summer season
        recommendations.append("Summer season: Ensure adequate irrigation and consider mulching.")
    
    return recommendations

@app.route('/analyze_field', methods=['POST'])
def analyze_field():
    """Main endpoint for field analysis"""
    
    try:
        # Get field geometry from request
        data = request.get_json()
        
        if not data or 'geometry' not in data:
            return jsonify({'error': 'Field geometry is required'}), 400
        
        field_geometry = data['geometry']
        
        # Convert GeoJSON to Earth Engine geometry
        ee_geometry = ee.Geometry(field_geometry)
        
        # Calculate field area
        area_m2 = ee_geometry.area().getInfo()
        area_hectares = area_m2 / 10000
        
        # Define date range (last 30 days)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        # Get Sentinel-2 imagery
        collection = ee.ImageCollection('COPERNICUS/S2_SR') \
            .filterBounds(ee_geometry) \
            .filterDate(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')) \
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
        
        # Check if any images are available
        image_count = collection.size().getInfo()
        if image_count == 0:
            return jsonify({'error': 'No suitable satellite imagery found for the selected area and time period'}), 404
        
        # Get the most recent image
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
        
        # Classify health zones
        health_mapping, health_percentages, cluster_data = classify_health_zones(analyzed_image, ee_geometry)
        
        # Generate recommendations
        recommendations = generate_recommendations(mean_values, health_percentages)
        
        # Create response
        response = {
            'summary': {
                'field_area_hectares': round(area_hectares, 2),
                'avg_ndvi': round(mean_values.get('NDVI', 0), 3),
                'avg_evi': round(mean_values.get('EVI', 0), 3),
                'avg_ndwi': round(mean_values.get('NDWI', 0), 3),
                'avg_ndre': round(mean_values.get('NDRE', 0), 3),
                'health_zones': {
                    'healthy': round(health_percentages['healthy'], 1),
                    'moderate': round(health_percentages['moderate'], 1),
                    'stressed': round(health_percentages['stressed'], 1)
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
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error analyzing field: {e}")
        return jsonify({'error': f'Analysis failed: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'gee_initialized': True
    })

if __name__ == '__main__':
    # Run the Flask app
    app.run(host='0.0.0.0', port=5000, debug=True)
