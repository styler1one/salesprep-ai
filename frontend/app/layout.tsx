import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "SalesPrep AI",
  description: "AI-powered sales enablement platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
