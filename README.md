# AgriAI Map Insights

**Production-ready, fully open-source agricultural field analysis tool**

A bulletproof satellite-based field analysis application with zero paid dependencies. Built with Leaflet + Esri satellite imagery for global coverage and Google Earth Engine for AI-powered crop analysis.

## 🎯 **Key Features**

### **🗺️ Satellite Mapping (100% Free)**
- **Esri World Imagery**: High-resolution global satellite coverage
- **Leaflet.js**: Lightweight, reliable mapping library via CDN
- **Drawing Tools**: Polygon & rectangle field selection with area calculation
- **Responsive Design**: Works seamlessly on desktop and mobile

### **🤖 AI-Powered Analysis**
- **Vegetation Indices**: NDVI, EVI, NDWI, NDRE computation
- **Health Zones**: ML-based field classification (healthy/moderate/stressed)
- **Smart Recommendations**: Context-aware agricultural insights
- **Satellite Data**: Sentinel-2 imagery via Google Earth Engine

### **🛡️ Production-Ready**
- **Robust Error Handling**: Graceful fallbacks and user-friendly messages
- **Input Validation**: Comprehensive geometry and data validation
- **Toast Notifications**: Real-time feedback for all operations
- **Refresh Functionality**: Easy recovery from network issues
- **Clean UI**: Minimal, uncluttered interface focused on analysis

## 🚀 **Quick Start**

### **Frontend (Zero Configuration)**
\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
\`\`\`

**That's it!** No API keys, tokens, or paid services required for the frontend.

### **Backend Setup**
\`\`\`bash
# Install Python dependencies
pip install -r requirements.txt

# Authenticate with Google Earth Engine
earthengine authenticate

# Run Flask server
python scripts/flask_backend.py
\`\`\`

### **Environment Variables**
\`\`\`bash
# Frontend (.env.local) - Optional
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000

# Backend - For production only
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json
PORT=5000
\`\`\`

## 📦 **Deployment**

### **Frontend → Vercel (Recommended)**
\`\`\`bash
# Deploy instantly
vercel --prod

# Or connect GitHub repository for auto-deployment
\`\`\`

**Environment Variables in Vercel:**
- `NEXT_PUBLIC_BACKEND_URL`: Your backend URL

### **Backend → Render/Railway/Fly.io**
\`\`\`bash
# Example for Render
# 1. Connect GitHub repository
# 2. Build command: pip install -r requirements.txt
# 3. Start command: python scripts/flask_backend.py
# 4. Add Google Earth Engine service account credentials
\`\`\`

### **Vercel Configuration**
\`\`\`json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": ".next"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/$1"
    }
  ]
}
\`\`\`

## 🏗️ **Architecture**

### **Frontend Stack**
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Leaflet.js**: Mapping library (CDN)
- **Esri Tiles**: Satellite imagery (free tier)
- **Radix UI**: Accessible components

### **Backend Stack**
- **Flask**: Lightweight Python web framework
- **Google Earth Engine**: Satellite data processing
- **Scikit-learn**: Machine learning for health classification
- **NumPy/Pandas**: Data processing
- **CORS**: Cross-origin resource sharing

### **Key Design Decisions**
- ✅ **CDN-only mapping**: No npm dependencies for mapping
- ✅ **Single satellite layer**: Simplified, focused interface
- ✅ **Standardized API**: Consistent JSON responses
- ✅ **Comprehensive validation**: Input sanitization and error handling
- ✅ **Toast notifications**: Better UX than inline alerts
- ✅ **Refresh functionality**: Easy error recovery

## 🔧 **API Reference**

### **POST /analyze_field**
Analyze agricultural field using satellite imagery.

**Request:**
\`\`\`json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng, lat], [lng, lat], ...]]
  },
  "properties": {
    "area": 12.5
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Field analysis completed successfully",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
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
      "features": []
    }
  }
}
\`\`\`

### **GET /health**
Service health check.

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Service is healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "gee_initialized": true,
    "version": "1.0.0"
  }
}
\`\`\`

## 🛡️ **Error Handling**

### **Frontend**
- **Network errors**: Toast notifications with retry options
- **Validation errors**: Inline feedback with clear messages
- **Map loading**: Graceful fallbacks with refresh button
- **Offline detection**: Status indicators and user guidance

### **Backend**
- **Input validation**: Comprehensive geometry and data checks
- **Earth Engine errors**: Graceful handling of API failures
- **Standardized responses**: Consistent error format across endpoints
- **Logging**: Detailed error tracking for debugging

## 🔒 **Security & Best Practices**

- ✅ **Input validation**: All user inputs sanitized and validated
- ✅ **CORS configuration**: Proper cross-origin handling
- ✅ **Error sanitization**: No sensitive data in error messages
- ✅ **Rate limiting**: Implement in production deployment
- ✅ **HTTPS only**: Enforce secure connections in production

## 📊 **Performance**

- **Frontend**: Static generation with Next.js for fast loading
- **CDN assets**: Leaflet and tiles served from global CDNs
- **Caching**: Aggressive caching of static assets
- **Lazy loading**: Map component loaded only when needed
- **Optimized builds**: Tree-shaking and code splitting

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 **Development Guidelines**

- **Code Style**: Follow TypeScript/Python best practices
- **Testing**: Add tests for new features
- **Documentation**: Update README for significant changes
- **Error Handling**: Maintain robust error handling patterns

## 🐛 **Troubleshooting**

### **Common Issues**

**Map not loading:**
- Check internet connection
- Click the "Refresh" button
- Verify CDN accessibility

**Analysis failing:**
- Ensure field is between 0.1-10,000 hectares
- Check backend URL configuration
- Verify Google Earth Engine authentication

**Build errors:**
- Run `npm install` to update dependencies
- Check Node.js version (18+ required)
- Clear `.next` cache: `rm -rf .next`

### **Debug Mode**
\`\`\`bash
# Frontend debug
npm run dev

# Backend debug
FLASK_ENV=development python scripts/flask_backend.py
\`\`\`

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 **Acknowledgments**

- **Esri**: Free satellite imagery tiles
- **Leaflet**: Open-source mapping library
- **Google Earth Engine**: Satellite data processing
- **OpenStreetMap**: Community-driven mapping data

---

**Ready to deploy?** This application is production-ready with zero paid dependencies. Deploy the frontend to Vercel and backend to any cloud provider for a complete agricultural analysis solution.
