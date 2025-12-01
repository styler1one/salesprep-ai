'use client'

/**
 * AI Sales Coach "Luna" - Minimized State
 * TASK-029 / SPEC-028
 * 
 * Small floating button with suggestion count badge.
 */

import React from 'react'
import { useCoach } from './CoachProvider'
import { useTranslations } from 'next-intl'

export function CoachMinimized() {
  const { suggestions, setWidgetState } = useCoach()
  const t = useTranslations('coach')
  
  const pendingCount = suggestions.filter(s => !s.action_taken).length
  const hasPriority = suggestions.some(s => s.priority >= 80)
  
  return (
    <button
      onClick={() => setWidgetState('compact')}
      className={`
        relative w-14 h-14 rounded-full shadow-lg
        flex items-center justify-center
        transition-all duration-300 ease-out
        hover:scale-110 hover:shadow-xl
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
        ${hasPriority 
          ? 'bg-gradient-to-br from-orange-500 to-red-500 animate-pulse' 
          : 'bg-gradient-to-br from-indigo-500 to-purple-600'
        }
      `}
      aria-label={t('widget.expand')}
    >
      {/* Brain icon */}
      <span className="text-2xl" role="img" aria-hidden="true">🧠</span>
      
      {/* Badge */}
      {pendingCount > 0 && (
        <span 
          className={`
            absolute -top-1 -right-1 
            min-w-[20px] h-5 px-1.5
            flex items-center justify-center
            text-xs font-bold text-white
            rounded-full
            ${hasPriority ? 'bg-red-600' : 'bg-indigo-700'}
          `}
        >
          {pendingCount > 9 ? '9+' : pendingCount}
        </span>
      )}
    </button>
  )
}

