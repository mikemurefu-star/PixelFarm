"use client"

import { useState, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useToast } from "@/hooks/use-toast"
import { Loader2, MapPin, Satellite, TrendingUp, Droplets, Leaf, Menu, X, WifiOff, RotateCcw } from "lucide-react"
import axios from "axios"

// Dynamically import the map component to avoid SSR issues
const MapComponent = dynamic(() => import("@/components/map-component"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
      <div className="text-center">
        <Satellite className="h-16 w-16 text-green-600 mx-auto mb-4 animate-pulse" />
        <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
        <p className="text-gray-700 text-lg font-medium">Loading Satellite Map...</p>
        <p className="text-gray-500 text-sm mt-2">Powered by Esri & Leaflet</p>
      </div>
    </div>
  ),
})

interface AnalysisResult {
  summary: {
    field_area_hectares: number
    avg_ndvi: number
    avg_evi: number
    avg_ndwi: number
    avg_ndre: number
    health_zones: {
      healthy: number
      moderate: number
      stressed: number
    }
    recommendations: string[]
    analysis_date: string
    image_count: number
  }
  geojson_overlay: any
  overlay_url?: string
}

interface ApiResponse {
  success: boolean
  message: string
  data?: AnalysisResult
}

export default function AgriAIMapInsights() {
  const [selectedField, setSelectedField] = useState<any>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const mapRef = useRef<any>(null)
  const { toast } = useToast()

  // Check network status
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const validateField = (field: any): string | null => {
    if (!field || !field.geometry) {
      return "Invalid field geometry"
    }

    if (field.geometry.type !== "Polygon") {
      return "Field must be a polygon"
    }

    const coordinates = field.geometry.coordinates[0]
    if (!coordinates || coordinates.length < 4) {
      return "Polygon must have at least 3 points"
    }

    // Check if area is reasonable (between 0.1 and 10000 hectares)
    const area = field.properties?.area || 0
    if (area < 0.1 || area > 10000) {
      return `Field area (${area.toFixed(1)} ha) is outside valid range (0.1 - 10,000 ha)`
    }

    return null
  }

  const analyzeField = async () => {
    if (!selectedField) return

    const validationError = validateField(selectedField)
    if (validationError) {
      toast({
        title: "Invalid Field",
        description: validationError,
        variant: "destructive",
      })
      return
    }

    if (!isOnline) {
      toast({
        title: "No Internet Connection",
        description: "Please check your network connection and try again.",
        variant: "destructive",
      })
      return
    }

    setIsAnalyzing(true)

    try {
      const response = await axios.post<ApiResponse>(`/api/analyze_field`, {
        geometry: selectedField.geometry,
        properties: selectedField.properties,
      }, {
        timeout: 45000, // 45 second timeout
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.data.success && response.data.data) {
        setAnalysisResult(response.data.data)
        setSidebarOpen(true) // Auto-open sidebar on mobile after analysis
        toast({
          title: "Analysis Complete",
          description: "Field analysis completed successfully!",
        })
      } else {
        throw new Error(response.data.message || "Analysis failed")
      }
    } catch (err: any) {
      console.error("Analysis error:", err)

      let errorMessage = "Analysis failed. Please try again."

      if (err.code === "ECONNABORTED") {
        errorMessage = "Analysis timeout. The field may be too large or server is busy."
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message
      } else if (err.request) {
        errorMessage = "Cannot reach analysis server. Please check your connection."
      }

      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
        action: (
          <Button onClick={analyzeField} size="sm" variant="outline">
            <RotateCcw className="h-4 w-4 mr-1" />
            Retry
          </Button>
        ),
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const clearAnalysis = () => {
    setAnalysisResult(null)
    setSelectedField(null)
    setSidebarOpen(false)
    if (mapRef.current) {
      mapRef.current.clearDrawing()
    }
  }

  const SidebarContent = () => (
    <div className="h-full overflow-y-auto">
      {analysisResult ? (
        <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg lg:text-xl font-semibold text-gray-900">Analysis Results</h2>
            <Button variant="outline" size="sm" onClick={clearAnalysis} className="ml-2">Clear</Button>

            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)} className="lg:hidden">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Field Overview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Field Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Area</span>
                <span className="text-sm font-medium">{analysisResult.summary.field_area_hectares} hectares</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 font-medium flex items-center">NDVI (Vegetation)
                  <span className="ml-1 cursor-pointer group relative">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#888" strokeWidth="2" fill="#fff"/><text x="12" y="17" textAnchor="middle" fontSize="13" fill="#888">i</text></svg>
                    <span className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-6 z-50 min-w-[180px] bg-white border border-gray-200 shadow-lg rounded-md p-2 text-xs text-gray-700 font-normal">
                      NDVI shows how healthy and green the plants are. Higher values mean more vegetation.
                    </span>
                  </span>
                </span>
                <span className="text-sm font-medium">{analysisResult.summary.analysis_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500 font-medium flex items-center">NDRE (Red Edge)
                  <span className="ml-1 cursor-pointer group relative">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#888" strokeWidth="2" fill="#fff"/><text x="12" y="17" textAnchor="middle" fontSize="13" fill="#888">i</text></svg>
                    <span className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-6 z-50 min-w-[180px] bg-white border border-gray-200 shadow-lg rounded-md p-2 text-xs text-gray-700 font-normal">
                      NDRE helps detect plant stress and nutrient levels. Higher values often mean healthier crops.
                    </span>
                  </span>
                </span>
                <span className="text-sm font-medium">{analysisResult.summary.image_count} images</span>
              </div>
            </CardContent>
          </Card>

          {/* Vegetation Indices */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
                Vegetation Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "NDVI (Vegetation)", value: analysisResult.summary.avg_ndvi, color: "bg-green-600", info: "NDVI shows how healthy and green the plants are. Higher values mean more vegetation." },
                { label: "EVI (Enhanced)", value: analysisResult.summary.avg_evi, color: "bg-green-500", info: "EVI is an enhanced version of NDVI, providing more accurate vegetation health data." },
                { label: "NDWI (Water)", value: analysisResult.summary.avg_ndwi, color: "bg-blue-500", info: "NDWI helps detect water stress in plants. Lower values often mean more water stress." },
                { label: "NDRE (Red Edge)", value: analysisResult.summary.avg_ndre, color: "bg-purple-500", info: "NDRE helps detect plant stress and nutrient levels. Higher values often mean healthier crops." },
              ].map((index) => (
                <div key={index.label} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center">
                      {index.label}
                      <span className="ml-1 cursor-pointer group relative">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="#888" strokeWidth="2" fill="#fff"/><text x="12" y="17" textAnchor="middle" fontSize="13" fill="#888">i</text></svg>
                        <span className="hidden group-hover:block absolute left-1/2 -translate-x-1/2 top-6 z-50 min-w-[180px] bg-white border border-gray-200 shadow-lg rounded-md p-2 text-xs text-gray-700 font-normal">
                          {index.info}
                        </span>
                      </span>
                    </span>
                    <span className="text-sm font-medium">{typeof index.value === 'number' && !isNaN(index.value) ? index.value.toFixed(3) : 'N/A'}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`${index.color} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${Math.max(0, Math.min(100, (typeof index.value === 'number' ? index.value : 0) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Health Zones */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <TrendingUp className="h-4 w-4 mr-2 text-blue-600" />
                Health Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Healthy", value: analysisResult.summary.health_zones?.healthy ?? 0, color: "bg-green-500" },
                { label: "Moderate", value: analysisResult.summary.health_zones?.moderate ?? 0, color: "bg-yellow-500" },
                { label: "Stressed", value: analysisResult.summary.health_zones?.stressed ?? 0, color: "bg-red-500" },
              ].map((zone) => (
                <div key={zone.label} className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className={`w-3 h-3 ${zone.color} rounded-full mr-2`} />
                    <span className="text-sm text-gray-600">{zone.label}</span>
                  </div>
                  <span className="text-sm font-medium">{zone.value}%</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center">
                <Droplets className="h-4 w-4 mr-2 text-blue-600" />
                AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(analysisResult.summary.recommendations ?? []).map((rec, index) => (
                  <li key={index} className="text-sm text-gray-700 flex items-start">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="p-4 lg:p-6">
          <div className="text-center py-8 lg:py-12">
            {selectedField ? (
              <>
                <TrendingUp className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Field Selected</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Ready to analyze{" "}
                  {selectedField.properties?.area
                    ? `${selectedField.properties.area.toFixed(1)} hectare field`
                    : "your selected field"}
                </p>
                <Button
                  onClick={analyzeField}
                  className="bg-green-600 hover:bg-green-700 w-full lg:w-auto"
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Satellite className="h-4 w-4 mr-2" />
                      Start Analysis
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Field Selected</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Draw a field boundary on the satellite map to get AI-powered agricultural insights
                </p>
                <div className="space-y-4 text-left">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">How to get started:</h4>
                    <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                      <li>Navigate to your agricultural field</li>
                      <li>Use drawing tools to outline field boundaries</li>
                      <li>Complete the polygon shape</li>
                      <li>Click "Analyze Field" for AI insights</li>
                    </ol>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Analysis includes:</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Vegetation health indices (NDVI, EVI)</li>
                      <li>• Water stress detection (NDWI)</li>
                      <li>• Nutrient analysis (NDRE)</li>
                      <li>• Zone-based recommendations</li>
                    </ul>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-green-600 p-2 rounded-lg">
              <Satellite className="h-5 w-5 lg:h-6 lg:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold text-gray-900">PixelFarm</h1>
              <p className="text-xs lg:text-sm text-gray-600">AI-Powered Agricultural Field Analysis</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!isOnline && (
              <Badge variant="destructive" className="hidden lg:flex">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
            <Badge variant="secondary" className="bg-green-100 text-green-800 hidden lg:flex">
              <Satellite className="h-3 w-3 mr-1" />
              Satellite
            </Badge>
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="lg:hidden bg-transparent">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:w-96 p-0">
                <SidebarContent />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Map Container */}
        <div className="flex-1 relative">
          <MapComponent
            ref={mapRef}
            onFieldSelected={setSelectedField}
            analysisOverlay={analysisResult?.geojson_overlay}
            ndviOverlayUrl={analysisResult?.overlay_url}
          />

          {/* Map Controls */}
          <div className="absolute top-4 left-4 space-y-2 z-10">
            <Button
              onClick={analyzeField}
              disabled={!selectedField || isAnalyzing || !isOnline}
              className="bg-green-600 hover:bg-green-700 min-w-[140px] shadow-lg"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Analyze Field
                </>
              )}
            </Button>

            {(selectedField || analysisResult) && (
              <Button
                onClick={clearAnalysis}
                variant="outline"
                className="bg-white hover:bg-gray-50 min-w-[140px] shadow-lg"
                disabled={isAnalyzing}
              >
                <X className="h-4 w-4 mr-2" />
                Clear Selection
              </Button>
            )}
          </div>

          {/* Offline Alert */}
          {!isOnline && (
            <div className="absolute bottom-4 left-4 right-4 lg:right-auto lg:max-w-md z-10">
              <Alert variant="destructive" className="bg-white/95 backdrop-blur-sm">
                <WifiOff className="h-4 w-4" />
                <AlertDescription>
                  No internet connection. Please check your network to analyze fields.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        {/* Desktop Sidebar */}
        <div className="hidden lg:block w-96 bg-white border-l border-gray-200">
          <SidebarContent />
        </div>
      </div>
    </div>
  )
}
