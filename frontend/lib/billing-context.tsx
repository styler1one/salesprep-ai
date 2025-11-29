'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface UsageMetric {
  used: number
  limit: number
  unlimited: boolean
  remaining?: number
  percentage?: number
}

interface TranscriptionUsage extends UsageMetric {
  used_hours?: number
  limit_hours?: number
}

interface Usage {
  period_start: string
  period_end?: string
  research: UsageMetric
  preparation: UsageMetric
  followup: UsageMetric
  transcription_seconds: TranscriptionUsage
  kb_documents: UsageMetric
}

interface Subscription {
  id: string | null
  organization_id: string
  plan_id: string
  plan_name: string
  status: string
  features: Record<string, any>
  price_cents: number | null
  billing_interval: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  trial_start: string | null
  trial_end: string | null
  is_trialing: boolean
  is_active: boolean
  is_paid: boolean
}

interface BillingContextType {
  subscription: Subscription | null
  usage: Usage | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  checkLimit: (metric: string) => Promise<{ allowed: boolean; current: number; limit: number; upgrade_required: boolean }>
  createCheckoutSession: (planId: string) => Promise<string>
  openBillingPortal: () => Promise<string>
  getUsagePercentage: (metric: keyof Usage) => number
  isFeatureAvailable: (feature: string) => boolean
}

const BillingContext = createContext<BillingContextType | undefined>(undefined)

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBillingData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClientComponentClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        setLoading(false)
        return
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

      // Fetch subscription and usage in parallel
      const [subResponse, usageResponse] = await Promise.all([
        fetch(`${apiUrl}/api/v1/billing/subscription`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${apiUrl}/api/v1/billing/usage`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }),
      ])

      if (subResponse.ok) {
        const subData = await subResponse.json()
        setSubscription(subData)
      }

      if (usageResponse.ok) {
        const usageData = await usageResponse.json()
        setUsage(usageData)
      }

    } catch (err) {
      console.error('Error fetching billing data:', err)
      setError('Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBillingData()
  }, [fetchBillingData])

  const checkLimit = async (metric: string) => {
    try {
      const supabase = createClientComponentClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        return { allowed: false, current: 0, limit: 0, upgrade_required: true }
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/billing/check-limit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metric }),
      })

      if (response.ok) {
        return await response.json()
      }

      return { allowed: false, current: 0, limit: 0, upgrade_required: true }
    } catch (err) {
      console.error('Error checking limit:', err)
      return { allowed: false, current: 0, limit: 0, upgrade_required: true }
    }
  }

  const createCheckoutSession = async (planId: string): Promise<string> => {
    try {
      const supabase = createClientComponentClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/billing/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          plan_id: planId,
          success_url: `${window.location.origin}/billing/success`,
          cancel_url: `${window.location.origin}/pricing`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Checkout API error:', response.status, errorData)
        throw new Error(errorData.detail || `Checkout failed: ${response.status}`)
      }

      const data = await response.json()
      if (!data.checkout_url) {
        console.error('No checkout_url in response:', data)
        throw new Error('No checkout URL returned from server')
      }
      return data.checkout_url
    } catch (err) {
      console.error('Error creating checkout:', err)
      throw err
    }
  }

  const openBillingPortal = async (): Promise<string> => {
    try {
      const supabase = createClientComponentClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/billing/portal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          return_url: `${window.location.origin}/dashboard/settings`,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create portal session')
      }

      const data = await response.json()
      return data.portal_url
    } catch (err) {
      console.error('Error opening portal:', err)
      throw err
    }
  }

  const getUsagePercentage = (metric: keyof Usage): number => {
    if (!usage || !usage[metric]) return 0
    
    const data = usage[metric] as UsageMetric
    if (data.unlimited) return 0
    if (data.limit === 0) return data.used > 0 ? 100 : 0
    
    return Math.min(100, Math.round((data.used / data.limit) * 100))
  }

  const isFeatureAvailable = (feature: string): boolean => {
    if (!subscription?.features) return false
    return !!subscription.features[feature]
  }

  return (
    <BillingContext.Provider
      value={{
        subscription,
        usage,
        loading,
        error,
        refetch: fetchBillingData,
        checkLimit,
        createCheckoutSession,
        openBillingPortal,
        getUsagePercentage,
        isFeatureAvailable,
      }}
    >
      {children}
    </BillingContext.Provider>
  )
}

export function useBilling() {
  const context = useContext(BillingContext)
  if (context === undefined) {
    throw new Error('useBilling must be used within a BillingProvider')
  }
  return context
}

