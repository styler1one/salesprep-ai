import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'

const inter = Inter({ 
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: "SalesPrep AI",
  description: "AI-powered sales enablement platform",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get locale and messages for i18n
  const locale = await getLocale()
  const messages = await getMessages()
  
  // Determine text direction (RTL for Arabic)
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning className={inter.variable}>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
