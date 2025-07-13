"use client"

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-draw/dist/leaflet.draw.css"
import "leaflet-draw"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Navigation, Loader2, AlertTriangle } from 'lucide-react'

// Fix for default markers in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
})

interface MapComponentProps {
  onFieldSelected: (field: any) => void
  analysisOverlay?: any
}

const MapComponent = forwardRef<any, MapComponentProps>(({ onFieldSelected, analysisOverlay }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const drawnItems = useRef<L.FeatureGroup | null>(null)
  const drawControl = useRef<L.Control.Draw | null>(null)
  const overlayLayer = useRef<L.GeoJSON | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)

  useImperativeHandle(ref, () => ({
    clearDrawing: () => {
      if (drawnItems.current) {
        drawnItems.current.clearLayers()
        onFieldSelected(null)
      }
      if (overlayLayer.current && map.current) {
        map.current.removeLayer(overlayLayer.current)
        overlayLayer.current = null
      }
    },
  }))

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude])
        },
        (error) => {
          console.log("Geolocation error:", error)
          // Default to India (Bangalore) if geolocation fails
          setUserLocation([12.9716, 77.5946])
        },
        { timeout: 10000, enableHighAccuracy: false }
      )
    } else {
      // Default to India if geolocation not supported
      setUserLocation([12.9716, 77.5946])
    }
  }, [])

  useEffect(() => {
    if (!mapContainer.current || !userLocation) return

    try {
      // Initialize map
      map.current = L.map(mapContainer.current, {
        center: userLocation,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      })

      // Add zoom control to top-right
      L.control.zoom({ position: "topright" }).addTo(map.current)

      // Add attribution
      L.control.attribution({
        position: "bottomright",
        prefix: false,
      }).addTo(map.current)

      // Add multiple tile layer options with fallbacks
      const tileLayers = {
        satellite: L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution: "© Esri, Maxar, Earthstar Geographics",
            maxZoom: 19,
            errorTileUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNHB4IiBmaWxsPSIjOTk5Ij5UaWxlIEVycm9yPC90ZXh0Pjwvc3ZnPg=="
          }
        ),
        osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        }),
        hybrid: L.tileLayer(
          "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
          {
            attribution: "© Google",
            maxZoom: 20,
          }
        ),
      }

      // Try satellite first, fallback to OSM if it fails
      let currentLayer = tileLayers.satellite
      currentLayer.addTo(map.current)

      // Handle tile loading errors
      currentLayer.on("tileerror", () => {
        if (currentLayer === tileLayers.satellite) {
          console.log("Satellite tiles failed, switching to OSM")
          map.current?.removeLayer(currentLayer)
          currentLayer = tileLayers.osm
          currentLayer.addTo(map.current!)
        }
      })

      // Layer control
      L.control.layers(
        {
          "Satellite": tileLayers.satellite,
          "OpenStreetMap": tileLayers.osm,
          "Hybrid": tileLayers.hybrid,
        },
        {},
        { position: "topright" }
      ).addTo(map.current)

      // Initialize drawing
      drawnItems.current = new L.FeatureGroup()
      map.current.addLayer(drawnItems.current)

      // Drawing options
      const drawOptions = {
        position: "topleft" as L.ControlPosition,
        draw: {
          polygon: {
            allowIntersection: false,
            drawError: {
              color: "#e1e100",
              message: "<strong>Error:</strong> Shape edges cannot cross!",
            },
            shapeOptions: {
              color: "#3b82f6",
              weight: 2,
              fillOpacity: 0.1,
            },
          },
          rectangle: {
            shapeOptions: {
              color: "#3b82f6",
              weight: 2,
              fillOpacity: 0.1,
            },
          },
          circle: false,
          circlemarker: false,
          marker: false,
          polyline: false,
        },
        edit: {
          featureGroup: drawnItems.current,
          remove: true,
        },
      }

      drawControl.current = new L.Control.Draw(drawOptions)
      map.current.addControl(drawControl.current)

      // Drawing event handlers
      map.current.on(L.Draw.Event.CREATED, (e: any) => {
        const layer = e.layer
        drawnItems.current?.addLayer(layer)

        // Convert to GeoJSON and calculate area
        const geoJson = layer.toGeoJSON()
        const area = calculatePolygonArea(geoJson.geometry.coordinates[0])
        geoJson.properties = { ...geoJson.properties, area }

        onFieldSelected(geoJson)
      })

      map.current.on(L.Draw.Event.EDITED, (e: any) => {
        const layers = e.layers
        layers.eachLayer((layer: any) => {
          const geoJson = layer.toGeoJSON()
          const area = calculatePolygonArea(geoJson.geometry.coordinates[0])
          geoJson.properties = { ...geoJson.properties, area }
          onFieldSelected(geoJson)
        })
      })

      map.current.on(L.Draw.Event.DELETED, () => {
        onFieldSelected(null)
      })

      // Map ready
      map.current.whenReady(() => {
        setIsLoading(false)
        setMapError(null)
      })

      // Handle map errors
      map.current.on("error", (e) => {
        console.error("Map error:", e)
        setMapError("Failed to load map tiles. Please check your internet connection.")
        setIsLoading(false)
      })

    } catch (error) {
      console.error("Failed to initialize map:", error)
      setMapError("Failed to initialize map. Please refresh the page.")
      setIsLoading(false)
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [userLocation, onFieldSelected])

  // Handle analysis overlay
  useEffect(() => {
    if (!map.current || !analysisOverlay) return

    // Remove existing overlay
    if (overlayLayer.current) {
      map.current.removeLayer(overlayLayer.current)
    }

    // Add new overlay
    overlayLayer.current = L.geoJSON(analysisOverlay, {
      style: (feature) => ({
        fillColor: feature?.properties?.color || "#22c55e",
        weight: 2,
        opacity: 0.8,
        color: feature?.properties?.color || "#22c55e",
        fillOpacity: 0.6,
      }),
      onEachFeature: (feature, layer) => {
        if (feature.properties) {
          layer.bindPopup(`
            <div class="p-2">
              <h3 class="font-semibold text-sm mb-1">Zone: ${feature.properties.zone || "Unknown"}</h3>
              <p class="text-xs text-gray-600">NDVI: ${feature.properties.ndvi || "N/A"}</p>
            </div>
          `)
        }
      },
    })

    overlayLayer.current.addTo(map.current)
  }, [analysisOverlay])

  // Calculate polygon area in hectares
  const calculatePolygonArea = (coordinates: number[][]) => {
    if (!coordinates || coordinates.length < 3) return 0

    // Use Leaflet's built-in area calculation
    const latLngs = coordinates.map(coord => L.latLng(coord[1], coord[0]))
    const polygon = L.polygon(latLngs)
    const areaInSquareMeters = L.GeometryUtil ? 
      L.GeometryUtil.geodesicArea(latLngs) : 
      // Fallback calculation
      Math.abs(coordinates.reduce((area, coord, i) => {
        const j = (i + 1) % coordinates.length
        return area + (coord[0] * coordinates[j][1] - coordinates[j][0] * coord[1])
      }, 0)) / 2 * 111320 * 111320

    return areaInSquareMeters / 10000 // Convert to hectares
  }

  const centerOnUserLocation = () => {
    if (map.current && userLocation) {
      map.current.flyTo(userLocation, 15, { duration: 2 })
    }
  }

  if (mapError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{mapError}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {isLoading && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-[1000]">
          <div className="text-center text-white">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm">Loading map tiles...</p>
          </div>
        </div>
      )}

      {/* User location button */}
      {userLocation && !isLoading && (
        <Button
          onClick={centerOnUserLocation}
          size="sm"
          variant="secondary"
          className="absolute bottom-4 right-4 bg-white hover:bg-gray-50 shadow-lg z-[1000]"
        >
          <Navigation className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">My Location</span>
        </Button>
      )}
    </div>
  )
})

MapComponent.displayName = "MapComponent"

export default MapComponent
