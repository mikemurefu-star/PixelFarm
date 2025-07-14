# PixelFarm: AI-Powered Agricultural Field Analysis

**Production-ready, fully open-source agricultural field analysis tool**

A bulletproof satellite-based field analysis application with zero paid dependencies. Built with Next.js, Leaflet, and Google Earth Engine for AI-powered crop analysis.

## 🎯 **Key Features**

### **🗺️ Satellite Mapping (100% Free)**
- **Esri World Imagery**: High-resolution global satellite coverage.
- **Leaflet.js**: Lightweight, reliable mapping library.
- **Drawing Tools**: Polygon field selection with area calculation.
- **Responsive Design**: Works seamlessly on desktop and mobile.

### **🤖 AI-Powered Analysis (via Google Earth Engine)**
- **Vegetation Indices**: NDVI, EVI, NDWI, and NDRE computation.
- **Health Zones**: Dynamic classification of field health (healthy, moderate, stressed).
- **Smart Recommendations**: Context-aware agricultural insights based on index values.
- **Satellite Data**: Near real-time Sentinel-2 imagery.

### **🛡️ Production-Ready & Modern Stack**
- **Next.js 14+**: Full-stack React application with App Router.
- **TypeScript**: Type-safe code from frontend to backend.
- **Robust Error Handling**: Graceful fallbacks and user-friendly toast notifications.
- **Input Validation**: Comprehensive geometry and data validation on the backend.
- **Clean UI**: Minimal, uncluttered interface built with **Tailwind CSS** and **Radix UI**.

## 🚀 **Quick Start**

This is a full-stack Next.js application. The frontend and backend API are in the same project.

### **1. Install Dependencies**
```bash
npm install
```

### **2. Set Up Environment Variables**

Create a file named `.env.local` in the root of the project and add your Google Earth Engine (GEE) service account credentials. You can get these from the Google Cloud Console.

```bash
# .env.local

# Google Earth Engine Credentials
GEE_PROJECT_ID="your-gcp-project-id"
GEE_CLIENT_EMAIL="your-service-account-email@your-project.iam.gserviceaccount.com"
GEE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...your-private-key...\n-----END PRIVATE KEY-----\n"
```

**Important**: When pasting your private key, you must replace all newline characters with `\n` for it to be parsed correctly from the environment variable.

### **3. Run the Development Server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## 📦 **Deployment**

This Next.js application can be deployed to any hosting provider that supports Node.js (e.g., a VPS, Heroku, Render, Railway, etc.).

### **1. Build the Application**

First, build the production-optimized application:
```bash
npm run build
```
This will create an optimized build in the `.next` directory.

### **2. Run the Production Server**

After the build is complete, start the production server:
```bash
npm start
```
The application will run on the port specified in your environment (defaulting to 3000).

### **3. Configure Environment Variables**

On your hosting provider, you must set the following environment variables for the application to run correctly:
- `GEE_PROJECT_ID`
- `GEE_CLIENT_EMAIL`
- `GEE_PRIVATE_KEY`
- `NODE_ENV=production`

Make sure to configure your server environment (e.g., using `systemd` or a process manager like `pm2`) to keep the `npm start` process running.

## 🏗️ **Architecture**

### **Unified Stack (Next.js)**
- **Framework**: **Next.js 14+** (App Router)
- **Language**: **TypeScript**
- **Frontend**: React, Tailwind CSS, Radix UI
- **Backend**: **Next.js API Routes** (running on Node.js)
- **Mapping**: Leaflet.js with Esri World Imagery tiles.
- **AI/Data Processing**: **Google Earth Engine Node.js SDK**

### **Key Design Decisions**
- ✅ **Unified Full-Stack**: Simplified development and deployment with Next.js.
- ✅ **Server-Side GEE**: All Google Earth Engine processing is done securely on the backend.
- ✅ **Standardized API**: The frontend communicates with the backend via a clear `/api/analyze_field` endpoint.
- ✅ **Type Safety**: End-to-end type safety with TypeScript.
- ✅ **Minimal Dependencies**: Avoids unnecessary npm packages for core mapping functionality.

## 🔧 **API Reference**

### `POST /api/analyze_field`

Analyzes a given agricultural field geometry.

**Request Body:**
```json
{
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng, lat], [lng, lat], ...]]
  }
}
```

**Successful Response (200):**
```json
{
    "summary": {
        "field_area_hectares": 15.7,
        "avg_ndvi": 0.65,
        "avg_evi": 0.58,
        "avg_ndwi": 0.21,
        "avg_ndre": 0.41,
        "health_zones": {
            "healthy": 70,
            "moderate": 20,
            "stressed": 10
        },
        "recommendations": [
            "Field shows predominantly healthy vegetation..."
        ]
    },
    "overlay_url": null
}
```
*Note: `overlay_url` is reserved for future NDVI map overlay functionality and is currently `null`.*

## 🐛 **Troubleshooting**

- **GEE Authentication Errors**: Ensure your `.env.local` file is correctly formatted, especially the `GEE_PRIVATE_KEY` with `\n` for newlines. Also, ensure your service account has the "Earth Engine Resource User" role in your Google Cloud project.
- **Analysis Failing**: Make sure the drawn polygon is a reasonable size (e.g., > 0.1 hectares).
- **Build Errors**: Run `npm install` again and ensure you are using Node.js version 18 or higher.

## 📄 **License**

MIT License. See the [LICENSE](LICENSE) file for details.
