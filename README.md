# AgriAI Map Insights

A full-stack web application for AI-powered agricultural field analysis using satellite imagery.

## Features

### Frontend (React + Next.js)
- 🗺️ Interactive global satellite map with Mapbox
- ✏️ Field boundary drawing tools (polygon/rectangle)
- 📊 Real-time analysis visualization with color-coded overlays
- 📱 Responsive design with detailed insights sidebar
- 🎯 Click-to-analyze functionality with loading states

### Backend (Python Flask + Google Earth Engine)
- 🛰️ Sentinel-2 satellite imagery processing
- 🌱 Vegetation indices computation (NDVI, EVI, NDWI, NDRE)
- 🤖 Machine learning-based health zone classification
- 📈 AI-powered recommendations and insights
- 🔄 RESTful API with robust error handling

## Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Python 3.9+
- Google Earth Engine account
- Mapbox access token (for production)

### Frontend Setup
\`\`\`bash
# Install dependencies
npm install

# Set environment variables
echo "NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token" > .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:5000" >> .env.local

# Run development server
npm run dev
\`\`\`

### Backend Setup
\`\`\`bash
# Install Python dependencies
pip install -r requirements.txt

# Authenticate with Google Earth Engine
earthengine authenticate

# Set up service account (production)
export GOOGLE_APPLICATION_CREDENTIALS="path/to/service-account-key.json"

# Run Flask server
python scripts/flask_backend.py
\`\`\`

### Docker Deployment
\`\`\`bash
# Build and run with Docker Compose
docker-compose up --build

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:5000
\`\`\`

## API Endpoints

### POST /analyze_field
Analyzes an agricultural field using satellite imagery.

**Request Body:**
\`\`\`json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng, lat], [lng, lat], ...]]
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "summary": {
    "field_area_hectares": 12.5,
    "avg_ndvi": 0.72,
    "avg_evi": 0.68,
    "avg_ndwi": 0.15,
    "avg_ndre": 0.45,
    "health_zones": {
      "healthy": 65,
      "moderate": 25,
      "stressed": 10
    },
    "recommendations": ["..."],
    "analysis_date": "2024-01-15",
    "image_count": 5
  },
  "geojson_overlay": {
    "type": "FeatureCollection",
    "features": [...]
  }
}
\`\`\`

## Deployment

### Frontend (Vercel)
\`\`\`bash
# Deploy to Vercel
vercel --prod

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_MAPBOX_TOKEN
# NEXT_PUBLIC_API_URL
\`\`\`

### Backend (Render/Fly.io)
\`\`\`bash
# Deploy to Render
# 1. Connect GitHub repository
# 2. Set build command: pip install -r requirements.txt
# 3. Set start command: gunicorn --bind 0.0.0.0:$PORT app:app
# 4. Add environment variables

# Deploy to Fly.io
fly launch
fly deploy
\`\`\`

## Environment Variables

### Frontend
- `NEXT_PUBLIC_MAPBOX_TOKEN`: Mapbox access token
- `NEXT_PUBLIC_API_URL`: Backend API URL

### Backend
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to GEE service account key
- `FLASK_ENV`: Environment (development/production)
- `PORT`: Server port (default: 5000)

## Technology Stack

- **Frontend**: React, Next.js, TypeScript, Tailwind CSS
- **Mapping**: Mapbox GL JS, Turf.js for geospatial operations
- **Backend**: Python Flask, Google Earth Engine API
- **ML/Analysis**: NumPy, Pandas, Scikit-learn
- **Deployment**: Vercel (frontend), Render/Fly.io (backend)
- **Containerization**: Docker, Docker Compose

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
