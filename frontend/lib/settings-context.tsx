'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// ==========================================
// Types
// ==========================================

export interface UserSettings {
  app_language: string
  output_language: string
  email_language: string
}

interface SettingsContextType {
  settings: UserSettings
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>
  loading: boolean
  loaded: boolean
}

// ==========================================
// Defaults
// ==========================================

const defaultSettings: UserSettings = {
  app_language: 'en',
  output_language: 'en',
  email_language: 'en',
}

// ==========================================
// Context
// ==========================================

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  updateSettings: async () => {},
  loading: true,
  loaded: false,
})

// ==========================================
// Provider
// ==========================================

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const supabase = createClientComponentClient()

  // Load settings from API
  const loadSettings = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setLoading(false)
        setLoaded(true)
        return
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/settings`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSettings({
          app_language: data.app_language || defaultSettings.app_language,
          output_language: data.output_language || defaultSettings.output_language,
          email_language: data.email_language || defaultSettings.email_language,
        })
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [supabase])

  // Update settings via API
  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/settings`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newSettings),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to update settings')
      }

      const data = await response.json()
      setSettings(prev => ({
        ...prev,
        ...data,
      }))
    } catch (error) {
      console.error('Failed to update settings:', error)
      throw error
    }
  }, [supabase])

  // Load settings on mount and auth state change
  useEffect(() => {
    loadSettings()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        loadSettings()
      } else if (event === 'SIGNED_OUT') {
        setSettings(defaultSettings)
        setLoaded(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [loadSettings, supabase.auth])

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading, loaded }}>
      {children}
    </SettingsContext.Provider>
  )
}

// ==========================================
// Hook
// ==========================================

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

