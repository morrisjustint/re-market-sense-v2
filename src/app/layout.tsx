import type { Metadata } from "next"
import { Source_Sans_3, Source_Serif_4 } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"

import "./globals.css"

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
})

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "RE Market Sense",
    template: "%s · RE Market Sense",
  },
  description:
    "Market research and list intelligence for real estate professionals.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${sourceSans.variable} ${sourceSerif.variable} font-sans antialiased`}
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
