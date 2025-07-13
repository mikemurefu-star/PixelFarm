"use client"

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Navigation, Loader2, AlertTriangle, Trash2, RotateCcw } from "lucide-react"

interface MapComponentProps {
  onFieldSelected: (field: any) => void
  analysisOverlay?: any
}

const MapComponent = forwardRef<any, MapComponentProps>(({ onFieldSelected, analysisOverlay }, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const drawnItems = useRef<any>(null)
  const drawControl = useRef<any>(null)
  const overlayLayer = useRef<any>(null)
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

  // Clear all drawn items
  const clearSelection = () => {
    if (typeof window !== 'undefined' && drawnItems.current && window.L) {
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

    // Remove existing map
    if (map.current) {
      map.current.remove()
      map.current = null
    }

    // Clear refs
    drawnItems.current = null
    drawControl.current = null
    overlayLayer.current = null

    // Reset state
    setHasDrawnItems(false)
    onFieldSelected(null)

    // Reload scripts with a small delay
    setTimeout(() => {
      loadLeafletScripts()
    }, 500)
  }

  // Helper function to load a CSS file with fallback
  const loadCSS = async (urls: string[], description: string) => {
    for (let i = 0; i < urls.length; i++) {
      try {
        await new Promise((resolve, reject) => {
          const link = document.createElement("link")
          link.rel = "stylesheet"
          link.href = urls[i]
          link.crossOrigin = "anonymous"

          const timeout = setTimeout(() => {
            reject(new Error(`Timeout loading ${description}`))
          }, 10000)

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

          const timeout = setTimeout(() => {
            reject(new Error(`Timeout loading ${description}`))
          }, 15000)

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
      // Check if already loaded
      if (window.L && window.L.Control && window.L.Control.Draw) {
        setScriptsLoaded(true)
        return
      }

      // Remove existing scripts and styles to prevent conflicts
      document.querySelectorAll('link[href*="leaflet"], script[src*="leaflet"]').forEach((el) => el.remove())

      // Clear any existing Leaflet instance
      if (window.L) {
        delete window.L
      }

      // Load Leaflet CSS with fallbacks
      const leafletCSSUrls = [
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
        "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
      ]
      await loadCSS(leafletCSSUrls, "Leaflet CSS")

      // Load Leaflet Draw CSS with fallbacks
      const leafletDrawCSSUrls = [
        "https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css",
        "https://cdn.jsdelivr.net/npm/leaflet-draw@1.0.4/dist/leaflet.draw.css",
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css",
      ]
      await loadCSS(leafletDrawCSSUrls, "Leaflet Draw CSS")

      // Load Leaflet JS with fallbacks
      const leafletJSUrls = [
        "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
        "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
      ]
      await loadJS(leafletJSUrls, "Leaflet JS", () => !!window.L)

      // Verify Leaflet loaded correctly
      if (!window.L) {
        throw new Error("Leaflet failed to initialize")
      }

      // Load Leaflet Draw JS with fallbacks
      const leafletDrawJSUrls = [
        "https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js",
        "https://cdn.jsdelivr.net/npm/leaflet-draw@1.0.4/dist/leaflet.draw.js",
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js",
      ]
      await loadJS(
        leafletDrawJSUrls,
        "Leaflet Draw JS",
        () => !!(window.L && window.L.Control && window.L.Control.Draw),
      )

      // Final verification
      if (!window.L || !window.L.Control || !window.L.Control.Draw) {
      }
    }
  }
}

// Helper function to load a JS file with fallback
const loadJS = async (urls: string[], description: string, validator?: () => boolean) => {
  for (let i = 0; i <urls.length; i++) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script")
        script.src = urls[i]
        script.crossOrigin = "anonymous"

        const timeout = setTimeout(() => {
          reject(new Error(`Timeout loading ${description}`))
        }, 15000)

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
    // Check if already loaded
    if ((window as any).L && (window as any).L.Control && (window as any).L.Control.Draw) {
      setScriptsLoaded(true)
      return
    }

    // Remove existing scripts and styles to prevent conflicts
    document.querySelectorAll('link[href*="leaflet"], script[src*="leaflet"]').forEach((el) => el.remove())

    // Clear any existing Leaflet instance
    if ((window as any).L) {
      delete (window as any).L
    }

    // Load Leaflet CSS with fallbacks
    const leafletCSSUrls = [
      "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
      "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css",
    ]
    await loadCSS(leafletCSSUrls, "Leaflet CSS")

    // Load Leaflet Draw CSS with fallbacks
    const leafletDrawCSSUrls = [
      "https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.css",
      "https://cdn.jsdelivr.net/npm/leaflet-draw@1.0.4/dist/leaflet.draw.css",
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.css",
    ]
    await loadCSS(leafletDrawCSSUrls, "Leaflet Draw CSS")

    // Load Leaflet JS with fallbacks
    const leafletJSUrls = [
      "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
      "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js",
    ]
    await loadJS(leafletJSUrls, "Leaflet JS", () => !!(window as any).L)

    // Verify Leaflet loaded correctly
    if (!(window as any).L) {
      throw new Error("Leaflet failed to initialize")
    }

    // Load Leaflet Draw JS with fallbacks
    const leafletDrawJSUrls = [
      "https://unpkg.com/leaflet-draw@1.0.4/dist/leaflet.draw.js",
      "https://cdn.jsdelivr.net/npm/leaflet-draw@1.0.4/dist/leaflet.draw.js",
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet.draw/1.0.4/leaflet.draw.js",
    ]
    await loadJS(
      leafletDrawJSUrls,
      "Leaflet Draw JS",
      () => !!((window as any).L && (window as any).L.Control && (window as any).L.Control.Draw),
    )

    // Final verification
    if (!(window as any).L || !(window as any).L.Control || !(window as any).L.Control.Draw) {
      throw new Error("Leaflet or Leaflet Draw not properly initialized")
    }

    setScriptsLoaded(true)
    console.log("All Leaflet scripts loaded successfully")
  } catch (error: any) {
    console.error("Failed to load Leaflet scripts:", error)
    setMapError(
      `Failed to load mapping libraries: ${error.message}. Please check your internet connection and try refreshing.`,
    )
    setIsLoading(false)
  }
}

// Get user's location
useEffect(() => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation([position.coords.latitude, position.coords.longitude])
      },
      (error) => {
        console.log("Geolocation error:", error)
        // Default to agricultural region (Central Valley, California)
        setUserLocation([36.7783, -119.4179])
      },
      { timeout: 10000, enableHighAccuracy: false },
    )
  } else {
    // Default location if geolocation not supported
    setUserLocation([36.7783, -119.4179])
  }
}, [])

// Initialize map when scripts are loaded and location is available
useEffect(() => {
  if (typeof window === 'undefined' || !mapContainer.current || !userLocation || !scriptsLoaded || !(window as any).L) return

  try {
    // Fix for default markers in Leaflet
    if (typeof window !== 'undefined' && (window as any).L && (window as any).L.Icon && (window as any).L.Icon.Default) {
      delete (window as any).L.Icon.Default.prototype._getIconUrl
    }
    if (typeof window !== 'undefined' && (window as any).L && (window as any).L.Icon && (window as any).L.Icon.Default) {
      (window as any).L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      })

      // Initialize map
      if (typeof window !== 'undefined' && (window as any).L) {
        map.current = (window as any).L.map(mapContainer.current, {
          center: userLocation,
          zoom: 13,
          zoomControl: false,
          attributionControl: true,
        })

        // Add zoom control to top-right
        if (typeof window !== 'undefined' && (window as any).L && map.current) {
          (window as any).L.control.zoom({ position: "topright" }).addTo(map.current)
        }

        // Single satellite tile layer (Esri World Imagery)
        let satelliteLayer;
        if (typeof window !== 'undefined' && (window as any).L) {
          satelliteLayer = (window as any).L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
              attribution: " Esri, Maxar, Earthstar Geographics",
              maxZoom: 19,
              errorTileUrl:
                "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNHB4IiBmaWxsPSIjOTk5Ij5Mb2FkaW5nLi4uPC90ZXh0Pjwvc3ZnPg==",
            },
          )

          satelliteLayer.addTo(map.current)

          // Handle tile loading errors with retry
          satelliteLayer.on("tileerror", (e: any) => {
            console.warn("Tile loading error:", e)
            // Retry after a short delay
            setTimeout(() => {
              if (map.current) {
                map.current.invalidateSize()
              }
            }, 2000)
          })

          // Initialize drawing layer
          if (typeof window !== 'undefined' && (window as any).L) {
            drawnItems.current = new (window as any).L.FeatureGroup()
          }
          map.current.addLayer(drawnItems.current)

          // Drawing control options
          const drawOptions = {
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
              remove: true,
              edit: true,
            },
          }

          if (typeof window !== 'undefined' && (window as any).L && (window as any).L.Control && (window as any).L.Control.Draw) {
            drawControl.current = new (window as any).L.Control.Draw(drawOptions)
          }
          if (map.current && drawControl.current) {
            map.current.addControl(drawControl.current)
          }

          // Drawing event handlers
          if (typeof window !== 'undefined' && map.current && (window as any).L && (window as any).L.Draw) {
            map.current.on((window as any).L.Draw.Event.CREATED, (e: any) => {
              const layer = e.layer
              drawnItems.current?.addLayer(layer)
              setHasDrawnItems(true)

              // Convert to GeoJSON and calculate area
              const geoJson = layer.toGeoJSON()
              const area = calculatePolygonArea(geoJson.geometry.coordinates[0])
              geoJson.properties = { ...geoJson.properties, area }

              onFieldSelected(geoJson)
            })

            if (typeof window !== 'undefined' && map.current && (window as any).L && (window as any).L.Draw) {
              map.current.on((window as any).L.Draw.Event.EDITED, (e: any) => {
                const layers = e.layers
                layers.eachLayer((layer: any) => {
                  const geoJson = layer.toGeoJSON()
                  const area = calculatePolygonArea(geoJson.geometry.coordinates[0])
                  geoJson.properties = { ...geoJson.properties, area }
                  onFieldSelected(geoJson)
                })
              })

              if (typeof window !== 'undefined' && map.current && (window as any).L && (window as any).L.Draw) {
                map.current.on((window as any).L.Draw.Event.DELETED, () => {
                  if (drawnItems.current.getLayers().length === 0) {
                    setHasDrawnItems(false)
                    onFieldSelected(null)
                  }
                })

                // Map ready
                if (map.current && map.current.whenReady) {
                  map.current.whenReady(() => {
                    setIsLoading(false)
                    setMapError(null)
                  })
                }
              }
            }
          }
        }
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
    },
    [userLocation, scriptsLoaded, onFieldSelected],
  )

  // Handle analysis overlay
  useEffect(() => {
    if (typeof window === 'undefined' || !map.current || !analysisOverlay || !(window as any).L) return

    // Remove existing overlay
    if (overlayLayer.current) {
      map.current.removeLayer(overlayLayer.current)
    }

    // Add new overlay with health zone colors
    if (typeof window !== 'undefined' && (window as any).L && map.current) {
      overlayLayer.current = (window as any).L.geoJSON(analysisOverlay, {
        style: (feature: any) => {
          const zone = feature?.properties?.zone || "unknown"
          let color = "#22c55e" // default green

          if (zone === "healthy")
            color = "#22c55e" // green
          else if (zone === "moderate")
            color = "#f59e0b" // yellow
          else if (zone === "stressed") color = "#ef4444" // red

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
      })

      if (overlayLayer.current && map.current) {
        overlayLayer.current.addTo(map.current)
      }
    }
  }, [analysisOverlay])

  // Calculate polygon area in hectares
  const calculatePolygonArea = (coordinates: number[][]) => {
    if (!coordinates || coordinates.length < 3) return 0

    // Simple polygon area calculation using shoelace formula
    let area = 0
    const n = coordinates.length - 1

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      area += coordinates[i][0] * coordinates[j][1]
      area -= coordinates[j][0] * coordinates[i][1]
    }

    area = Math.abs(area) / 2
    // Convert to hectares (approximate for small areas)
    const hectares = (area * 111320 * 111320) / 10000
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

      {/* Map Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-[1000]">
        {/* Clear Selection Button */}
        {hasDrawnItems && (
          <Button
            onClick={clearSelection}
            size="sm"
            variant="destructive"
            className="bg-red-600 hover:bg-red-700 shadow-lg"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        )}

        {/* User Location Button */}
        {userLocation && !isLoading && (
          <Button
            onClick={centerOnUserLocation}
            size="sm"
            variant="secondary"
            className="bg-white hover:bg-gray-50 shadow-lg"
          >
            <Navigation className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">My Location</span>
          </Button>
        )}

        {/* Refresh Button */}
        <Button onClick={refreshMap} size="sm" variant="outline" className="bg-white hover:bg-gray-50 shadow-lg">
          <RotateCcw className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
    </div>
  )
})

MapComponent.displayName = "MapComponent"

// Extend Window interface for TypeScript
declare global {
  interface Window {
    L: any
  }
}

export default MapComponent
