'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useCoach } from './CoachProvider'
import { X, Lightbulb, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Types of inline tips that can be shown
 */
export type InlineTipType = 
  | 'research_form'
  | 'contacts_empty'
  | 'contacts_few'
  | 'prep_form'
  | 'prep_no_contacts'
  | 'followup_form'
  | 'deal_form'
  | 'export_available'

/**
 * Configuration for inline tips
 */
interface InlineTipConfig {
  id: string
  type: InlineTipType
  icon?: string
  title: string
  description: string
  actionLabel?: string
  actionRoute?: string
  dismissable?: boolean
  showOnce?: boolean
}

/**
 * Pre-configured inline tips
 */
const INLINE_TIPS: Record<InlineTipType, Omit<InlineTipConfig, 'id' | 'type'>> = {
  research_form: {
    icon: '🔍',
    title: 'Pro tip: Be specific',
    description: 'Include the company website or LinkedIn URL for better research results.',
    dismissable: true,
  },
  contacts_empty: {
    icon: '👤',
    title: 'Add contacts first',
    description: 'Adding contact persons before creating a preparation improves your meeting outcomes by 40%.',
    actionLabel: 'Add contacts',
    dismissable: true,
  },
  contacts_few: {
    icon: '👥',
    title: 'Add more contacts',
    description: 'Having 2-3 contacts gives Luna more context for personalized conversation starters.',
    dismissable: true,
  },
  prep_form: {
    icon: '📋',
    title: 'Best timing',
    description: 'Create your preparation 1-2 days before the meeting for optimal results.',
    dismissable: true,
  },
  prep_no_contacts: {
    icon: '⚠️',
    title: 'Missing contacts',
    description: 'Your preparation will be more generic without contact persons. Add contacts first for personalized talking points.',
    actionLabel: 'Add contacts first',
    dismissable: true,
  },
  followup_form: {
    icon: '🎙️',
    title: 'Upload your recording',
    description: 'Upload your meeting recording or transcript to generate comprehensive follow-up actions.',
    dismissable: true,
  },
  deal_form: {
    icon: '💼',
    title: 'Track your deal',
    description: 'Linking deals to prospects helps Luna provide better pipeline insights.',
    dismissable: true,
  },
  export_available: {
    icon: '📤',
    title: 'Export available',
    description: 'You can export this brief as PDF, Word, or Markdown using the dropdown menu.',
    dismissable: true,
    showOnce: true,
  },
}

interface CoachInlineTipProps {
  type: InlineTipType
  className?: string
  onAction?: () => void
  /** Override the default config */
  config?: Partial<InlineTipConfig>
  /** Custom ID for dismissal tracking */
  tipId?: string
}

/**
 * Inline tip component that shows contextual coaching hints.
 * 
 * @example
 * ```tsx
 * <CoachInlineTip 
 *   type="contacts_empty" 
 *   onAction={() => router.push('/contacts/new')} 
 * />
 * ```
 */
export function CoachInlineTip({
  type,
  className,
  onAction,
  config: overrideConfig,
  tipId,
}: CoachInlineTipProps) {
  const { settings, dismissTipId, isDismissed } = useCoach()
  const [visible, setVisible] = useState(true)
  
  const baseConfig = INLINE_TIPS[type]
  const config: InlineTipConfig = {
    ...baseConfig,
    ...overrideConfig,
    id: tipId || `inline-${type}`,
    type,
  }
  
  // Check if this tip should be shown
  const shouldShow = settings?.show_inline_tips !== false && visible
  
  // Check if already dismissed
  useEffect(() => {
    if (isDismissed(config.id)) {
      setVisible(false)
    }
  }, [config.id, isDismissed])
  
  if (!shouldShow) {
    return null
  }
  
  const handleDismiss = () => {
    setVisible(false)
    if (config.showOnce || config.dismissable) {
      dismissTipId(config.id)
    }
  }
  
  const handleAction = () => {
    onAction?.()
  }
  
  return (
    <div 
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg',
        'bg-gradient-to-r from-primary/5 to-primary/10',
        'border border-primary/20',
        'animate-in fade-in slide-in-from-top-2 duration-300',
        className
      )}
    >
      {/* Icon */}
      <div className="text-2xl flex-shrink-0 mt-0.5">
        {config.icon || <Lightbulb className="h-5 w-5 text-primary" />}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-medium text-foreground">
              {config.title}
            </h4>
            <p className="text-sm text-muted-foreground mt-0.5">
              {config.description}
            </p>
          </div>
          
          {/* Dismiss button */}
          {config.dismissable && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 flex-shrink-0 hover:bg-primary/10"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss tip</span>
            </Button>
          )}
        </div>
        
        {/* Action button */}
        {config.actionLabel && (
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 mt-2 text-primary"
            onClick={handleAction}
          >
            {config.actionLabel}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Compact version of the inline tip for smaller spaces
 */
export function CoachInlineTipCompact({
  type,
  className,
  tipId,
}: Pick<CoachInlineTipProps, 'type' | 'className' | 'tipId'>) {
  const { settings, isDismissed } = useCoach()
  const [visible, setVisible] = useState(true)
  
  const config = INLINE_TIPS[type]
  const id = tipId || `inline-${type}`
  
  useEffect(() => {
    if (isDismissed(id)) {
      setVisible(false)
    }
  }, [id, isDismissed])
  
  if (!settings?.show_inline_tips || !visible) {
    return null
  }
  
  return (
    <div 
      className={cn(
        'flex items-center gap-2 py-1.5 px-3 rounded-md',
        'bg-primary/5 text-sm text-muted-foreground',
        'animate-in fade-in duration-200',
        className
      )}
    >
      <span>{config.icon}</span>
      <span>{config.title}</span>
    </div>
  )
}

