'use client'

/**
 * AI Sales Coach "Luna" - Main Widget Component
 * TASK-029 / SPEC-028
 * 
 * Floating widget that provides suggestions and guidance.
 */

import React from 'react'
import { useCoachOptional } from './CoachProvider'
import { CoachMinimized } from './CoachMinimized'
import { CoachCompact } from './CoachCompact'
import { CoachExpanded } from './CoachExpanded'

export function CoachWidget() {
  const coach = useCoachOptional()
  
  // Don't render if coach context isn't available or is disabled
  if (!coach || !coach.isEnabled || coach.widgetState === 'hidden') {
    return null
  }
  
  // Don't render while loading initial data
  if (coach.isLoading) {
    return null
  }
  
  return (
    <div className="fixed bottom-6 right-6 z-50">
      {coach.widgetState === 'minimized' && <CoachMinimized />}
      {coach.widgetState === 'compact' && <CoachCompact />}
      {coach.widgetState === 'expanded' && <CoachExpanded />}
    </div>
  )
}

