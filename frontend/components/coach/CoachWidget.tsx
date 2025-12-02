'use client'

/**
 * AI Sales Coach "Luna" - Main Widget Component
 * TASK-029 / SPEC-028
 * 
 * Floating widget that provides suggestions and guidance.
 * Phase 4: Added animations, transitions, and accessibility.
 */

import React from 'react'
import { useCoachOptional } from './CoachProvider'
import { CoachMinimized } from './CoachMinimized'
import { CoachCompact } from './CoachCompact'
import { CoachExpanded } from './CoachExpanded'

export function CoachWidget() {
  const coach = useCoachOptional()
  
  // Debug logging
  console.log('[CoachWidget] coach:', coach ? {
    isEnabled: coach.isEnabled,
    isLoading: coach.isLoading,
    widgetState: coach.widgetState,
    suggestionsCount: coach.suggestions?.length
  } : 'null')
  
  // Don't render if coach context isn't available
  if (!coach) {
    console.log('[CoachWidget] Not rendering: coach is null')
    return null
  }
  
  // Don't render if disabled or hidden
  if (!coach.isEnabled || coach.widgetState === 'hidden') {
    console.log('[CoachWidget] Not rendering: isEnabled=', coach.isEnabled, 'widgetState=', coach.widgetState)
    return null
  }
  
  // Don't render while loading initial data
  if (coach.isLoading) {
    console.log('[CoachWidget] Not rendering: still loading')
    return null
  }
  
  console.log('[CoachWidget] Rendering widget!')
  return (
    <div 
      className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 animate-in slide-in-from-bottom-4 duration-300"
      role="complementary"
      aria-label="AI Sales Coach"
    >
      {coach.widgetState === 'minimized' && <CoachMinimized />}
      {coach.widgetState === 'compact' && <CoachCompact />}
      {coach.widgetState === 'expanded' && <CoachExpanded />}
    </div>
  )
}

