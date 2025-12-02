'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'

/**
 * Tip of the day structure
 */
export interface TipOfDay {
  id: string
  category: 'research' | 'contacts' | 'preparation' | 'followup' | 'actions' | 'timing' | 'general'
  title: string
  content: string
  icon: string
  is_personalized: boolean
}

/**
 * Pattern analysis structure
 */
export interface PatternAnalysis {
  contacts: {
    total_research: number
    research_with_contacts: number
    contact_rate: number
    avg_contacts_per_research: number
  }
  timing: {
    total_preps: number
    completed_preps: number
    completion_rate: number
  }
  actions: {
    total_followups: number
    followups_with_actions: number
    action_rate: number
    avg_actions_per_followup: number
  }
}

/**
 * Recommendation structure
 */
export interface Recommendation {
  type: 'contacts' | 'actions' | 'timing' | 'general'
  priority: 'high' | 'medium' | 'low'
  message: string
  action: string
}

/**
 * Prediction structure
 */
export interface Prediction {
  type: 'timing' | 'prediction' | 'warning'
  priority: 'high' | 'medium' | 'low'
  title: string
  message: string
  icon: string
  action_route?: string
}

/**
 * Hook for fetching AI insights from the coach
 */
export function useCoachInsights() {
  const [tip, setTip] = useState<TipOfDay | null>(null)
  const [patterns, setPatterns] = useState<PatternAnalysis | null>(null)
  const [score, setScore] = useState<number>(0)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Fetch tip of the day
   */
  const fetchTip = useCallback(async () => {
    try {
      const { data, error: apiError } = await api.get<TipOfDay>('/api/v1/coach/insights/tip')
      if (!apiError && data) {
        setTip(data)
      }
    } catch (err) {
      console.error('Failed to fetch tip:', err)
    }
  }, [])

  /**
   * Fetch success patterns
   */
  const fetchPatterns = useCallback(async () => {
    try {
      const { data, error: apiError } = await api.get<{
        patterns: PatternAnalysis
        score: number
        recommendations: Recommendation[]
      }>('/api/v1/coach/insights/patterns')
      
      if (!apiError && data) {
        setPatterns(data.patterns)
        setScore(data.score)
        setRecommendations(data.recommendations)
      }
    } catch (err) {
      console.error('Failed to fetch patterns:', err)
    }
  }, [])

  /**
   * Fetch predictions
   */
  const fetchPredictions = useCallback(async () => {
    try {
      const { data, error: apiError } = await api.get<{
        predictions: Prediction[]
        count: number
      }>('/api/v1/coach/insights/predictions')
      
      if (!apiError && data) {
        setPredictions(data.predictions)
      }
    } catch (err) {
      console.error('Failed to fetch predictions:', err)
    }
  }, [])

  /**
   * Refresh all insights
   */
  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      await Promise.all([
        fetchTip(),
        fetchPatterns(),
        fetchPredictions(),
      ])
    } catch (err) {
      setError('Failed to load insights')
    } finally {
      setLoading(false)
    }
  }, [fetchTip, fetchPatterns, fetchPredictions])

  // Initial load
  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    tip,
    patterns,
    score,
    recommendations,
    predictions,
    loading,
    error,
    refresh,
    fetchTip,
    fetchPatterns,
    fetchPredictions,
  }
}

/**
 * Get a color class based on score
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600 dark:text-green-400'
  if (score >= 60) return 'text-blue-600 dark:text-blue-400'
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

/**
 * Get a background color class based on score
 */
export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-100 dark:bg-green-900/30'
  if (score >= 60) return 'bg-blue-100 dark:bg-blue-900/30'
  if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-900/30'
  return 'bg-red-100 dark:bg-red-900/30'
}

/**
 * Get label for score
 */
export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Fair'
  return 'Needs Work'
}


