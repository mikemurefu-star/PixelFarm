"use client"

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Navigation, Loader2, AlertTriangle, Trash2, RotateCcw } from "lucide-react"

interface MapComponentProps {
  onFieldSelected: (field: any) => void
  analysisOverlay?: any
  ndviOverlayUrl?: string
}

const MapComponent = forwardRef<any, MapComponentProps>(({ onFieldSelected, analysisOverlay, ndviOverlayUrl }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const drawnItems = useRef<L.FeatureGroup | null>(null)
  const drawControl = useRef<L.Control.Draw | null>(null)
  const overlayLayer = useRef<L.GeoJSON | null>(null)
  const ndviImageOverlay = useRef<any>(null)
  const [showNdviOverlay, setShowNdviOverlay] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [mapError, setMapError] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [scriptsLoaded, setScriptsLoaded] = useState(false)
  const [hasDrawnItems, setHasDrawnItems] = useState(false)

  useImperativeHandle(ref, () => ({
    clearDrawing: () => {
      clearSelection()
    },
  }))

  // Helper function to load a CSS file with fallback
  const loadCSS = async (urls: string[], description: string) => {
    for (let i = 0; i < urls.length; i++) {
      try {
        await new Promise((resolve, reject) => {
          const link = document.createElement("link")
          link.rel = "stylesheet"
          link.href = urls[i]
          link.crossOrigin = "anonymous"

          const timeout = setTimeout(() => reject(new Error(`Timeout loading ${description}`)), 10000)

          link.onload = () => {
            clearTimeout(timeout)
            resolve(void 0)
          }

          link.onerror = () => {
            clearTimeout(timeout)
            reject(new Error(`Failed to load ${description} from ${urls[i]}`))
          }

          document.head.appendChild(link)
        })
        console.log(`Successfully loaded ${description} from ${urls[i]}`)
        return // Success, exit the loop
      } catch (error: any) {
        console.warn(`Failed to load ${description} from ${urls[i]}:`, error)
        if (i === urls.length - 1) {
          throw new Error(`Failed to load ${description} from all sources`)
        }
      }
    }
  }

  // Helper function to load a JS file with fallback
  const loadJS = async (urls: string[], description: string, validator?: () => boolean) => {
    for (let i = 0; i < urls.length; i++) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script")
          script.src = urls[i]
          script.crossOrigin = "anonymous"

          const timeout = setTimeout(() => reject(new Error(`Timeout loading ${description}`)), 15000)

          script.onload = () => {
            clearTimeout(timeout)
            // Wait a bit for the script to initialize
            setTimeout(() => {
              if (validator && !validator()) {
                reject(new Error(`${description} failed to initialize properly`))
              } else {
                resolve(void 0)
              }
            }, 300)
          }

          script.onerror = () => {
            clearTimeout(timeout)
            reject(new Error(`Failed to load ${description} from ${urls[i]}`))
          }

          document.head.appendChild(script)
        })
        console.log(`Successfully loaded ${description} from ${urls[i]}`)
        return // Success, exit the loop
      } catch (error: any) {
        console.warn(`Failed to load ${description} from ${urls[i]}:`, error)
        if (i === urls.length - 1) {
          throw new Error(`Failed to load ${description} from all sources`)
        }
      }
    }
  }

  // Load Leaflet and Leaflet Draw from CDN with fallbacks
  const loadLeafletScripts = async () => {
    try {
      if (window.L?.Control?.Draw) {
        setScriptsLoaded(true)
        return
      }

      document.querySelectorAll('link[href*="leaflet"], script[src*="leaflet"]').forEach((el) => el.remove())
      if (window.L) {
        delete (window as any).L
      }

      await loadCSS(["https://unpkg.com/leaflet@1.9.4/dist/leaflet.css", "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"], "Leaflet CSS")
      await loadCSS(["https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css", "https://cdn.jsdelivr.net/npm/leaflet-draw@1.0.4/dist/leaflet.draw.css", "https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css"], "Leaflet Draw CSS")
      await loadJS(["https://unpkg.com/leaflet@1.9.4/dist/leaflet.js", "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"], "Leaflet JS", () => !!window.L)
      await loadJS(["https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js", "https://cdn.jsdelivr.net/npm/leaflet-draw@1.0.4/dist/leaflet.draw.js", "https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js"], "Leaflet Draw JS", () => !!window.L?.Control?.Draw)

      if (!window.L?.Control?.Draw) {
        throw new Error("Leaflet or Leaflet Draw failed to initialize")
      }

      setScriptsLoaded(true)
      console.log("All Leaflet scripts loaded successfully")
    } catch (error: any) {
      console.error("Failed to load Leaflet scripts:", error)
      setMapError(`Failed to load mapping libraries: ${error.message}. Please check your internet connection and try refreshing.`)
      setIsLoading(false)
    }
  }

  // Clear all drawn items
  const clearSelection = () => {
    if (drawnItems.current && window.L) {
      drawnItems.current.clearLayers()
      setHasDrawnItems(false)
      onFieldSelected(null)
    }
    if (overlayLayer.current && map.current) {
      map.current.removeLayer(overlayLayer.current)
      overlayLayer.current = null
    }
  }

  // Refresh/retry map initialization
  const refreshMap = () => {
    setMapError(null)
    setIsLoading(true)
    setScriptsLoaded(false)

    if (map.current) {
      map.current.remove()
      map.current = null
    }

    drawnItems.current = null
    drawControl.current = null
    overlayLayer.current = null
    setHasDrawnItems(false)
    onFieldSelected(null)

    setTimeout(() => {
      loadLeafletScripts()
    }, 500)
  }

  // Load scripts on initial mount
  useEffect(() => {
    loadLeafletScripts().catch((error) => {
      console.error("Initial map script load failed:", error)
    })
  }, [])

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude])
        },
        () => {
          // Default to an agricultural region if geolocation fails or is denied
          setUserLocation([36.7783, -119.4179]) // Central Valley, California
        },
        { timeout: 10000, enableHighAccuracy: false },
      )
    } else {
      setUserLocation([36.7783, -119.4179])
    }
  }, [])

  // Initialize map when scripts are loaded and location is available
  useEffect(() => {
    if (!scriptsLoaded || !userLocation || !mapContainer.current || !window.L || map.current) {
      return
    }

    try {
      // Fix for default markers in Leaflet
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      })

      map.current = L.map(mapContainer.current, {
        center: userLocation,
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      })

      L.control.zoom({ position: "topright" }).addTo(map.current)

      const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Esri, Maxar, Earthstar Geographics",
        maxZoom: 19,
        errorTileUrl: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNHB4IiBmaWxsPSIjOTk5Ij5Mb2FkaW5nLi4uPC90ZXh0Pjwvc3ZnPg==",
      }).addTo(map.current)

      satelliteLayer.on("tileerror", (e: any) => {
        console.warn("Tile loading error:", e)
        setTimeout(() => map.current?.invalidateSize(), 2000)
      })

      drawnItems.current = new L.FeatureGroup()
      map.current.addLayer(drawnItems.current)

      drawControl.current = new L.Control.Draw({
        position: "topleft",
        draw: {
          polygon: {
            allowIntersection: false,
            drawError: {
              color: "#ef4444",
              message: "<strong>Error:</strong> Field boundaries cannot cross!",
            },
            shapeOptions: {
              color: "#16a34a",
              weight: 3,
              fillOpacity: 0.2,
              fillColor: "#16a34a",
            },
            showArea: true,
            metric: true,
          },
          rectangle: {
            shapeOptions: {
              color: "#16a34a",
              weight: 3,
              fillOpacity: 0.2,
              fillColor: "#16a34a",
            },
            showArea: true,
            metric: true,
          },
          circle: false,
          circlemarker: false,
          marker: false,
          polyline: false,
        },
        edit: {
          featureGroup: drawnItems.current,
          remove: false, // Hide delete button from toolbar
          edit: false,   // Hide edit button from toolbar
        },
      });
      map.current.addControl(drawControl.current);

      map.current.on(L.Draw.Event.CREATED, (e: any) => {
        const layer = e.layer;
        drawnItems.current?.addLayer(layer);
        setHasDrawnItems(true);
        const geoJson = layer.toGeoJSON();
        const area = calculatePolygonArea(geoJson.geometry.coordinates[0]);
        geoJson.properties = { ...geoJson.properties, area };
        onFieldSelected(geoJson);
      });

      map.current.on(L.Draw.Event.EDITED, (e: any) => {
        e.layers.eachLayer((layer: any) => {
          const geoJson = layer.toGeoJSON()
          const area = calculatePolygonArea(geoJson.geometry.coordinates[0])
          geoJson.properties = { ...geoJson.properties, area }
          onFieldSelected(geoJson)
        })
      })

      map.current.on(L.Draw.Event.DELETED, () => {
        if (drawnItems.current?.getLayers().length === 0) {
          setHasDrawnItems(false)
          onFieldSelected(null)
        }
      })

      map.current.whenReady(() => {
        setIsLoading(false)
        setMapError(null)
      })
    } catch (error: any) {
      console.error("Failed to initialize map:", error)
      setMapError("Failed to initialize map. Please try refreshing.")
      setIsLoading(false)
    }

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [userLocation, scriptsLoaded, onFieldSelected])

  // Handle analysis overlay
  useEffect(() => {
    if (!map.current || !analysisOverlay || !window.L) return

    if (overlayLayer.current) {
      map.current.removeLayer(overlayLayer.current)
    }

    overlayLayer.current = L.geoJSON(analysisOverlay, {
      style: (feature: any) => {
        const zone = feature?.properties?.zone || "unknown"
        let color = "#22c55e" // default green
        if (zone === "healthy") color = "#22c55e"
        else if (zone === "moderate") color = "#f59e0b"
        else if (zone === "stressed") color = "#ef4444"

        return {
          fillColor: color,
          weight: 2,
          opacity: 0.8,
          color: color,
          fillOpacity: 0.6,
        }
      },
      onEachFeature: (feature: any, layer: any) => {
        if (feature.properties) {
          const zone = feature.properties.zone || "Unknown"
          const ndvi = feature.properties.ndvi || "N/A"
          layer.bindPopup(`
            <div class="p-3 min-w-[200px]">
              <h3 class="font-semibold text-sm mb-2 text-gray-800">Health Zone</h3>
              <div class="space-y-1">
                <p class="text-xs"><strong>Status:</strong> <span class="capitalize">${zone}</span></p>
                <p class="text-xs"><strong>NDVI:</strong> ${ndvi}</p>
              </div>
            </div>
          `)
        }
      },
    }).addTo(map.current)
  }, [analysisOverlay])

  // Handle NDVI PNG overlay image
  useEffect(() => {
    if (!map.current || !ndviOverlayUrl || !showNdviOverlay || !window.L) {
      if (ndviImageOverlay.current && map.current) {
        map.current.removeLayer(ndviImageOverlay.current)
        ndviImageOverlay.current = null
      }
      return
    }
    // Remove previous overlay if exists
    if (ndviImageOverlay.current) {
      map.current.removeLayer(ndviImageOverlay.current)
      ndviImageOverlay.current = null
    }
    // Get bounds from the drawn polygon (if available)
    let bounds = null
    if (drawnItems.current && drawnItems.current.getLayers().length > 0) {
      const layer = drawnItems.current.getLayers()[0]
      bounds = layer.getBounds()
    }
    // Fallback: use whole map bounds
    if (!bounds) {
      bounds = map.current.getBounds()
    }
    ndviImageOverlay.current = window.L.imageOverlay(ndviOverlayUrl, bounds, {
      opacity: 0.6,
      interactive: false,
      zIndex: 500
    })
    ndviImageOverlay.current.addTo(map.current)
    return () => {
      if (ndviImageOverlay.current && map.current) {
        map.current.removeLayer(ndviImageOverlay.current)
        ndviImageOverlay.current = null
      }
    }
  }, [ndviOverlayUrl, showNdviOverlay, drawnItems.current])

  // Calculate polygon area in hectares accurately
  const calculatePolygonArea = (coordinates: number[][]) => {
    if (!coordinates || coordinates.length < 4) {
      return 0
    }

    let area = 0
    // Shoelace formula for area in square degrees
    for (let i = 0; i < coordinates.length - 1; i++) {
      area += coordinates[i][0] * coordinates[i + 1][1] - coordinates[i + 1][0] * coordinates[i][1]
    }
    area = Math.abs(area) / 2

    // Get average latitude for a more accurate conversion factor
    const lats = coordinates.map((p) => p[1])
    const avgLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length
    const latRad = avgLat * (Math.PI / 180)

    // Convert area from square degrees to square meters, then to hectares
    const metersPerDegree = 111320 // Approx. meters per degree at the equator
    const areaInMeters = area * Math.pow(metersPerDegree, 2) * Math.cos(latRad)
    const hectares = areaInMeters / 10000

    return hectares
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
          <AlertDescription>
            <div className="space-y-3">
              <p className="font-medium">{mapError}</p>
              <Button onClick={refreshMap} size="sm" className="w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                Refresh Map
              </Button>
            </div>
          </AlertDescription>
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
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
            <p className="text-lg font-medium">Loading Satellite Map</p>
            <p className="text-sm text-gray-300 mt-1">Powered by Esri & Leaflet</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-[1000]">
        {ndviOverlayUrl && (
          <Button
            onClick={() => setShowNdviOverlay((v) => !v)}
            size="sm"
            variant={showNdviOverlay ? "secondary" : "outline"}
            className="bg-white hover:bg-gray-50 shadow-lg"
          >
            {showNdviOverlay ? "Hide NDVI Overlay" : "Show NDVI Overlay"}
          </Button>
        )}
        {hasDrawnItems && (
          <Button onClick={clearSelection} size="sm" variant="destructive" className="bg-red-600 hover:bg-red-700 shadow-lg">
            <Trash2 className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        )}
        {userLocation && !isLoading && (
          <Button onClick={centerOnUserLocation} size="sm" variant="secondary" className="bg-white hover:bg-gray-50 shadow-lg">
            <Navigation className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">My Location</span>
          </Button>
        )}
        <Button onClick={refreshMap} size="sm" variant="outline" className="bg-white hover:bg-gray-50 shadow-lg">
          <RotateCcw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
      {/* NDVI Legend */}
      {ndviOverlayUrl && showNdviOverlay && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white bg-opacity-90 rounded shadow-lg p-3 flex flex-col gap-2 border border-gray-200">
          <div className="font-semibold text-xs text-gray-700 mb-1">NDVI Health Zones</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-[#FF0000] border border-gray-300" /> <span className="text-xs text-gray-700">Stressed</span></div>
            <div className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-[#FFFF00] border border-gray-300" /> <span className="text-xs text-gray-700">Moderate</span></div>
            <div className="flex items-center gap-1"><span className="inline-block w-4 h-4 rounded bg-[#00FF00] border border-gray-300" /> <span className="text-xs text-gray-700">Healthy</span></div>
          </div>
        </div>
      )}
    </div>
  )
})

MapComponent.displayName = "MapComponent"

// Extend Window interface for Leaflet and Leaflet Draw
declare global {
  interface Window {
    L: typeof import("leaflet") & {
      Draw: any
      drawLocal: any
    }
  }
}

export default MapComponent