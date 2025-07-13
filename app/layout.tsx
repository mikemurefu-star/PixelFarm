import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "AgriAI Map Insights - AI-Powered Agricultural Field Analysis",
  description: "Analyze agricultural fields using satellite imagery and AI. Get vegetation health indices, water stress detection, and personalized farming recommendations.",
  keywords: "agriculture, AI, satellite imagery, NDVI, crop health, precision farming, field analysis",
  authors: [{ name: "AgriAI Team" }],
  creator: "AgriAI Map Insights",
  publisher: "AgriAI",
  robots: "index, follow",
  openGraph: {
    title: "AgriAI Map Insights - AI-Powered Agricultural Analysis",
    description: "Transform your farming with AI-powered satellite analysis. Get instant insights on crop health, water stress, and field conditions.",
    type: "website",
    locale: "en_US",
    siteName: "AgriAI Map Insights",
  },
  twitter: {
    card: "summary_large_image",
    title: "AgriAI Map Insights",
    description: "AI-powered agricultural field analysis using satellite imagery",
  },
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  themeColor: "#16a34a",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="application-name" content="AgriAI Map Insights" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AgriAI" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#16a34a" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
