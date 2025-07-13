# Mapbox Setup Instructions

## 1. Get Mapbox Access Token

1. Go to [Mapbox](https://www.mapbox.com/) and create a free account
2. Navigate to your [Account page](https://account.mapbox.com/)
3. Copy your **Default public token**

## 2. Configure Environment Variables

Create a `.env.local` file in your project root:

\`\`\`bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbGV4YW1wbGUifQ.your-actual-token-here
\`\`\`

## 3. Update Map Component

In `components/map-component.tsx`, replace the placeholder token:

\`\`\`tsx
// Replace this line:
const MAPBOX_TOKEN = "pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbGV4YW1wbGUifQ.example"

// With this:
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ""
\`\`\`

## 4. Mapbox Pricing

- **Free tier**: 50,000 map loads per month
- **Satellite imagery**: Included in free tier
- **Drawing tools**: Free with Mapbox GL JS

## 5. Production Deployment

For Vercel deployment, add the environment variable in your Vercel dashboard:
- Go to your project settings
- Add `NEXT_PUBLIC_MAPBOX_TOKEN` with your token value

## 6. Features Enabled

✅ **Global satellite basemap** - High-resolution imagery worldwide  
✅ **Smooth panning & zooming** - Seamless navigation experience  
✅ **User location detection** - Auto-center on user's position  
✅ **Interactive drawing tools** - Polygon and rectangle selection  
✅ **Clear selection functionality** - Remove drawn areas completely  
✅ **Analysis overlays** - Color-coded health zone visualization  
✅ **Click interactions** - Detailed zone information on click  

## 7. Drawing Tools Usage

- **Polygon tool**: Click points to create custom field shapes
- **Rectangle tool**: Click and drag for rectangular fields  
- **Trash tool**: Delete selected drawings
- **Clear Selection button**: Remove all drawings and analysis

## 8. Troubleshooting

**Map not loading?**
- Check your Mapbox token is valid
- Ensure token has proper permissions
- Check browser console for errors

**Drawing not working?**
- Make sure Mapbox GL Draw CSS is loaded
- Check that drawing controls are visible in top-left corner

**Location not detected?**
- Allow location permissions in browser
- Falls back to India (Bangalore) if geolocation fails
