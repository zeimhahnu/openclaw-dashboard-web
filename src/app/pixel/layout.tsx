import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "OpenClaw — Pixel Agent World",
  description: "Pixel art multi-agent dashboard",
}

export default function PixelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-pixel">{children}</body>
    </html>
  )
}