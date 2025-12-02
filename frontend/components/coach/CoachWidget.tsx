'use client'

/**
 * AI Sales Coach "Luna" - Main Widget Component
 * TASK-029 / SPEC-028
 * 
 * Floating widget that provides suggestions and guidance.
 * Phase 4: Added animations, transitions, and accessibility.
 */

import React, { useEffect, useState } from 'react'
import { useCoachOptional } from './CoachProvider'
import { CoachMinimized } from './CoachMinimized'
import { CoachCompact } from './CoachCompact'
import { CoachExpanded } from './CoachExpanded'

export function CoachWidget() {
  const coach = useCoachOptional()
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  
  // Animate in on mount
  useEffect(() => {
    if (coach && coach.isEnabled && !coach.isLoading && coach.widgetState !== 'hidden') {
      setShouldRender(true)
      // Small delay for animation
      const timer = setTimeout(() => setIsVisible(true), 50)
      return () => clearTimeout(timer)
    } else {
      setIsVisible(false)
      // Delay unmount for exit animation
      const timer = setTimeout(() => setShouldRender(false), 300)
      return () => clearTimeout(timer)
    }
  }, [coach?.isEnabled, coach?.isLoading, coach?.widgetState])
  
  // Don't render if coach context isn't available
  if (!coach || !shouldRender) {
    return null
  }
  
  return (
    <div 
      className={`
        fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50
        transition-all duration-300 ease-out
        ${isVisible 
          ? 'opacity-100 translate-y-0 scale-100' 
          : 'opacity-0 translate-y-4 scale-95 pointer-events-none'}
      `}
      role="complementary"
      aria-label="AI Sales Coach"
    >
      {coach.widgetState === 'minimized' && <CoachMinimized />}
      {coach.widgetState === 'compact' && <CoachCompact />}
      {coach.widgetState === 'expanded' && <CoachExpanded />}
    </div>
  )
}

