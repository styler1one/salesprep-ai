'use client'

import { ReactNode } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { SettingsProvider } from '@/lib/settings-context'
import { BillingProvider } from '@/lib/billing-context'
import { ErrorBoundary } from '@/components/error-boundary'
import { Toaster } from '@/components/ui/toaster'

interface ProvidersProps {
  children: ReactNode
}

/**
 * Client-side providers wrapper
 * 
 * Combines all client-side providers and context in a single component
 * to keep the layout file clean and simplify provider management.
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <ErrorBoundary>
        <SettingsProvider>
          <BillingProvider>
            {children}
            <Toaster />
          </BillingProvider>
        </SettingsProvider>
      </ErrorBoundary>
    </ThemeProvider>
  )
}

