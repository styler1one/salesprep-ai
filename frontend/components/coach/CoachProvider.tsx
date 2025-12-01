'use client'

/**
 * AI Sales Coach "Luna" - Context Provider
 * TASK-029 / SPEC-028
 * 
 * Provides coach state and actions to the entire application.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { api } from '@/lib/api'
import type {
  CoachContextValue,
  CoachSettings,
  CoachSettingsUpdate,
  Suggestion,
  SuggestionsResponse,
  CoachStatsResponse,
  WidgetState,
  EventType,
  BehaviorEventCreate,
} from '@/types/coach'

// =============================================================================
// CONTEXT
// =============================================================================

const CoachContext = createContext<CoachContextValue | null>(null)

export function useCoach(): CoachContextValue {
  const context = useContext(CoachContext)
  if (!context) {
    throw new Error('useCoach must be used within a CoachProvider')
  }
  return context
}

// Optional hook that doesn't throw (for components that might render outside provider)
export function useCoachOptional(): CoachContextValue | null {
  return useContext(CoachContext)
}


// =============================================================================
// PROVIDER
// =============================================================================

interface CoachProviderProps {
  children: ReactNode
}

export function CoachProvider({ children }: CoachProviderProps) {
  const pathname = usePathname()
  
  // State
  const [isLoading, setIsLoading] = useState(true)
  const [settings, setSettings] = useState<CoachSettings | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [stats, setStats] = useState<CoachStatsResponse | null>(null)
  const [widgetState, setWidgetStateInternal] = useState<WidgetState>('minimized')
  
  // Derived state
  const isEnabled = settings?.is_enabled ?? true
  
  // ==========================================================================
  // API CALLS
  // ==========================================================================
  
  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await api.get<CoachSettings>('/api/v1/coach/settings')
      if (!error && data) {
        setSettings(data)
        setWidgetStateInternal(data.widget_state || 'minimized')
      }
    } catch (err) {
      console.error('Failed to fetch coach settings:', err)
    }
  }, [])
  
  const fetchSuggestions = useCallback(async () => {
    if (!isEnabled) return
    
    try {
      const { data, error } = await api.get<SuggestionsResponse>('/api/v1/coach/suggestions?limit=10')
      if (!error && data) {
        setSuggestions(data.suggestions)
      }
    } catch (err) {
      console.error('Failed to fetch suggestions:', err)
    }
  }, [isEnabled])
  
  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await api.get<CoachStatsResponse>('/api/v1/coach/stats')
      if (!error && data) {
        setStats(data)
      }
    } catch (err) {
      console.error('Failed to fetch coach stats:', err)
    }
  }, [])
  
  // ==========================================================================
  // ACTIONS
  // ==========================================================================
  
  const refreshSuggestions = useCallback(async () => {
    await fetchSuggestions()
  }, [fetchSuggestions])
  
  const dismissSuggestion = useCallback(async (id: string) => {
    try {
      await api.post(`/api/v1/coach/suggestions/${id}/action`, { action: 'dismissed' })
      setSuggestions(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to dismiss suggestion:', err)
    }
  }, [])
  
  const snoozeSuggestion = useCallback(async (id: string, until: Date) => {
    try {
      await api.post(`/api/v1/coach/suggestions/${id}/action`, {
        action: 'snoozed',
        snooze_until: until.toISOString(),
      })
      setSuggestions(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to snooze suggestion:', err)
    }
  }, [])
  
  const clickSuggestion = useCallback(async (id: string) => {
    try {
      await api.post(`/api/v1/coach/suggestions/${id}/action`, { action: 'clicked' })
      // Don't remove from list - user might want to see it again
    } catch (err) {
      console.error('Failed to record suggestion click:', err)
    }
  }, [])
  
  const trackEvent = useCallback(async (type: EventType, data?: Record<string, unknown>) => {
    try {
      const event: BehaviorEventCreate = {
        event_type: type,
        event_data: data || {},
        page_context: pathname,
      }
      await api.post('/api/v1/coach/events', event)
    } catch (err) {
      // Silently fail - tracking shouldn't break the app
      console.debug('Failed to track event:', err)
    }
  }, [pathname])
  
  const updateSettings = useCallback(async (updates: CoachSettingsUpdate) => {
    try {
      const { data, error } = await api.patch<CoachSettings>('/api/v1/coach/settings', updates)
      if (!error && data) {
        setSettings(data)
        if (updates.widget_state) {
          setWidgetStateInternal(updates.widget_state)
        }
      }
    } catch (err) {
      console.error('Failed to update coach settings:', err)
    }
  }, [])
  
  const setWidgetState = useCallback((state: WidgetState) => {
    setWidgetStateInternal(state)
    // Persist to server
    updateSettings({ widget_state: state })
    // Track event
    if (state === 'expanded') {
      trackEvent('widget_expanded')
    } else if (state === 'minimized') {
      trackEvent('widget_collapsed')
    }
  }, [updateSettings, trackEvent])
  
  // ==========================================================================
  // EFFECTS
  // ==========================================================================
  
  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      await fetchSettings()
      await Promise.all([fetchSuggestions(), fetchStats()])
      setIsLoading(false)
    }
    init()
  }, [fetchSettings, fetchSuggestions, fetchStats])
  
  // Track page views
  useEffect(() => {
    if (pathname && isEnabled) {
      trackEvent('page_view', { page: pathname })
    }
  }, [pathname, isEnabled, trackEvent])
  
  // Refresh suggestions periodically (every 5 minutes)
  useEffect(() => {
    if (!isEnabled) return
    
    const interval = setInterval(() => {
      fetchSuggestions()
    }, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [isEnabled, fetchSuggestions])
  
  // ==========================================================================
  // CONTEXT VALUE
  // ==========================================================================
  
  const value: CoachContextValue = {
    isEnabled,
    isLoading,
    widgetState,
    suggestions,
    stats,
    settings,
    setWidgetState,
    refreshSuggestions,
    dismissSuggestion,
    snoozeSuggestion,
    clickSuggestion,
    trackEvent,
    updateSettings,
  }
  
  return (
    <CoachContext.Provider value={value}>
      {children}
    </CoachContext.Provider>
  )
}

