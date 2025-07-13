"use client"

import { useEffect } from "react"

// Mapbox CSS - load once globally
export function MapboxSetup() {
  useEffect(() => {
    // Load Mapbox CSS
    const link = document.createElement("link")
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css"
    link.rel = "stylesheet"
    document.head.appendChild(link)

    // Load Mapbox Draw CSS
    const drawLink = document.createElement("link")
    drawLink.href = "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.css"
    drawLink.rel = "stylesheet"
    document.head.appendChild(drawLink)

    return () => {
      document.head.removeChild(link)
      document.head.removeChild(drawLink)
    }
  }, [])

  return null
}
