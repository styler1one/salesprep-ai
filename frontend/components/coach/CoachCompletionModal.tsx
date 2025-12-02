'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCoach } from './CoachProvider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PartyPopper, ArrowRight, X, Sparkles } from 'lucide-react'

/**
 * Types of completions that can trigger a modal
 */
export type CompletionType = 
  | 'research_completed'
  | 'contacts_added'
  | 'prep_completed'
  | 'followup_completed'
  | 'action_generated'

/**
 * Configuration for each completion type
 */
interface CompletionConfig {
  icon: string
  title: string
  description: string
  nextSteps: Array<{
    label: string
    description: string
    route: string
    primary?: boolean
  }>
}

/**
 * Get completion configuration based on type and context
 */
function getCompletionConfig(
  type: CompletionType, 
  context?: Record<string, unknown>
): CompletionConfig {
  const companyName = (context?.companyName as string) || 'the company'
  
  switch (type) {
    case 'research_completed':
      return {
        icon: '🎉',
        title: 'Research Complete!',
        description: `Great work! Your research on ${companyName} is ready. What would you like to do next?`,
        nextSteps: [
          {
            label: 'Add Contacts',
            description: 'Add key people to talk to',
            route: context?.researchId 
              ? `/dashboard/research/${context.researchId}` 
              : '/dashboard/research',
            primary: true,
          },
          {
            label: 'Create Preparation',
            description: 'Start meeting prep now',
            route: '/dashboard/preparation/new',
          },
        ],
      }
    
    case 'contacts_added':
      return {
        icon: '👤',
        title: 'Contacts Added!',
        description: `You've added ${context?.contactCount || 'contacts'} to ${companyName}. Luna can now generate personalized conversation starters.`,
        nextSteps: [
          {
            label: 'Create Preparation',
            description: 'Get personalized talking points',
            route: '/dashboard/preparation/new',
            primary: true,
          },
          {
            label: 'Add More Contacts',
            description: 'Find more people to connect with',
            route: context?.prospectId 
              ? `/dashboard/prospects/${context.prospectId}` 
              : '/dashboard/prospects',
          },
        ],
      }
    
    case 'prep_completed':
      return {
        icon: '📋',
        title: 'Prep Ready!',
        description: `Your meeting preparation for ${companyName} is complete. You're all set for your meeting!`,
        nextSteps: [
          {
            label: 'View Prep',
            description: 'Review your preparation',
            route: context?.prepId 
              ? `/dashboard/preparation/${context.prepId}` 
              : '/dashboard/preparation',
            primary: true,
          },
          {
            label: 'After Meeting',
            description: 'Create follow-up later',
            route: '/dashboard/followup/new',
          },
        ],
      }
    
    case 'followup_completed':
      return {
        icon: '🎙️',
        title: 'Follow-up Created!',
        description: `Your meeting notes for ${companyName} have been processed. Generate follow-up actions to make the most of it.`,
        nextSteps: [
          {
            label: 'Generate Customer Report',
            description: 'Create a shareable summary',
            route: context?.followupId 
              ? `/dashboard/followup/${context.followupId}` 
              : '/dashboard/followup',
            primary: true,
          },
          {
            label: 'View All Actions',
            description: 'See all follow-up options',
            route: context?.followupId 
              ? `/dashboard/followup/${context.followupId}` 
              : '/dashboard/followup',
          },
        ],
      }
    
    case 'action_generated':
      return {
        icon: '✨',
        title: 'Action Generated!',
        description: `Your ${context?.actionType || 'follow-up action'} is ready. You can export it as PDF, Word, or Markdown.`,
        nextSteps: [
          {
            label: 'View & Export',
            description: 'Download or share the action',
            route: context?.followupId 
              ? `/dashboard/followup/${context.followupId}` 
              : '/dashboard/followup',
            primary: true,
          },
          {
            label: 'Generate More',
            description: 'Create additional actions',
            route: context?.followupId 
              ? `/dashboard/followup/${context.followupId}` 
              : '/dashboard/followup',
          },
        ],
      }
    
    default:
      return {
        icon: '🎉',
        title: 'Great Work!',
        description: 'You completed a task successfully.',
        nextSteps: [
          {
            label: 'Continue',
            description: 'Keep going',
            route: '/dashboard',
            primary: true,
          },
        ],
      }
  }
}

interface CoachCompletionModalProps {
  type: CompletionType
  open: boolean
  onOpenChange: (open: boolean) => void
  context?: Record<string, unknown>
}

/**
 * Modal shown after completing key tasks to suggest next steps.
 * 
 * @example
 * ```tsx
 * const [showModal, setShowModal] = useState(false)
 * 
 * // After research completes:
 * setShowModal(true)
 * 
 * <CoachCompletionModal
 *   type="research_completed"
 *   open={showModal}
 *   onOpenChange={setShowModal}
 *   context={{ companyName: 'Acme Inc', researchId: '123' }}
 * />
 * ```
 */
export function CoachCompletionModal({
  type,
  open,
  onOpenChange,
  context,
}: CoachCompletionModalProps) {
  const router = useRouter()
  const { settings, trackEvent } = useCoach()
  
  // Don't show if completion modals are disabled
  if (!settings?.show_completion_modals) {
    return null
  }
  
  const config = getCompletionConfig(type, context)
  
  const handleNextStep = (route: string) => {
    trackEvent('action_completed', { type, action: 'next_step', route })
    onOpenChange(false)
    router.push(route)
  }
  
  const handleDismiss = () => {
    trackEvent('action_completed', { type, action: 'dismissed' })
    onOpenChange(false)
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center pb-2">
          {/* Celebration icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-4xl mb-4">
            {config.icon}
          </div>
          
          <DialogTitle className="text-xl">
            {config.title}
          </DialogTitle>
          <DialogDescription className="text-base">
            {config.description}
          </DialogDescription>
        </DialogHeader>
        
        {/* Next Steps */}
        <div className="space-y-3 py-4">
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Suggested next steps
          </p>
          
          {config.nextSteps.map((step, index) => (
            <button
              key={index}
              onClick={() => handleNextStep(step.route)}
              className={`
                w-full flex items-center justify-between p-4 rounded-lg border transition-all
                ${step.primary 
                  ? 'bg-primary/5 border-primary/20 hover:bg-primary/10' 
                  : 'hover:bg-muted'
                }
              `}
            >
              <div className="text-left">
                <p className={`font-medium ${step.primary ? 'text-primary' : ''}`}>
                  {step.label}
                </p>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
              <ArrowRight className={`h-5 w-5 ${step.primary ? 'text-primary' : 'text-muted-foreground'}`} />
            </button>
          ))}
        </div>
        
        <DialogFooter className="sm:justify-center">
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="text-muted-foreground"
          >
            Maybe later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Hook to manage completion modal state
 */
export function useCompletionModal() {
  const [modalState, setModalState] = useState<{
    open: boolean
    type: CompletionType
    context?: Record<string, unknown>
  }>({
    open: false,
    type: 'research_completed',
  })
  
  const showCompletionModal = (
    type: CompletionType, 
    context?: Record<string, unknown>
  ) => {
    setModalState({ open: true, type, context })
  }
  
  const closeCompletionModal = () => {
    setModalState(prev => ({ ...prev, open: false }))
  }
  
  return {
    modalState,
    showCompletionModal,
    closeCompletionModal,
    CompletionModalProps: {
      type: modalState.type,
      open: modalState.open,
      onOpenChange: (open: boolean) => {
        if (!open) closeCompletionModal()
      },
      context: modalState.context,
    },
  }
}

