'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { User } from '@supabase/supabase-js'
import { 
  Building2, 
  Users, 
  Search, 
  FileText, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Plus,
  Globe,
  Linkedin,
  MapPin,
  CheckCircle,
  AlertCircle,
  Loader2,
  Mic,
  Target,
  Trophy,
  TrendingDown,
  Lock,
  Send,
  Pin,
  PinOff,
  Trash2,
  ExternalLink
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { useConfirmDialog } from '@/components/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { api } from '@/lib/api'
import { 
  ProspectHub, 
  ProspectContact,
  ProspectStatus
} from '@/types'
import { smartDate } from '@/lib/date-utils'

// ============================================================
// Types & Constants
// ============================================================

type JourneyPhase = 
  | 'research_only'
  | 'has_contacts'
  | 'has_prep'
  | 'has_followup'
  | 'deal_won'
  | 'deal_lost'

interface ProspectNote {
  id: string
  prospect_id: string
  user_id: string
  content: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

const STATUS_OPTIONS: ProspectStatus[] = ['new', 'researching', 'qualified', 'meeting_scheduled', 'proposal_sent', 'won', 'lost', 'inactive']

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
  researching: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  qualified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  meeting_scheduled: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  proposal_sent: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  won: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  lost: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
  inactive: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
}

// ============================================================
// Journey Detection Logic
// ============================================================

function detectJourneyPhase(hubData: ProspectHub): JourneyPhase {
  const { prospect, contacts, stats } = hubData
  
  // Check for closed deals first
  if (prospect.status === 'won') return 'deal_won'
  if (prospect.status === 'lost') return 'deal_lost'
  
  // Check for follow-ups
  if (stats.followup_count > 0) return 'has_followup'
  
  // Check for preps
  if (stats.prep_count > 0) return 'has_prep'
  
  // Check for contacts
  if (contacts.length > 0) return 'has_contacts'
  
  // Default: only research
  return 'research_only'
}

interface NextStepConfig {
  icon: React.ReactNode
  title: string
  description: string
  tip?: string
  actionLabel: string
  actionPath: string
  secondaryAction?: {
    label: string
    path: string
  }
}

function getNextStepConfig(
  phase: JourneyPhase, 
  prospect: ProspectHub['prospect'],
  stats: ProspectHub['stats'],
  t: ReturnType<typeof useTranslations>
): NextStepConfig {
  switch (phase) {
    case 'research_only':
      return {
        icon: <Users className="w-8 h-8 text-purple-600" />,
        title: t('journey.steps.addContacts.title'),
        description: t('journey.steps.addContacts.description'),
        tip: t('journey.steps.addContacts.tip'),
        actionLabel: t('journey.steps.addContacts.action'),
        actionPath: 'add-contact'
      }
    
    case 'has_contacts':
      return {
        icon: <FileText className="w-8 h-8 text-purple-600" />,
        title: t('journey.steps.createPrep.title'),
        description: t('journey.steps.createPrep.description'),
        actionLabel: t('journey.steps.createPrep.action'),
        actionPath: '/dashboard/preparation'
      }
    
    case 'has_prep':
      return {
        icon: <Mic className="w-8 h-8 text-purple-600" />,
        title: t('journey.steps.processFollowup.title'),
        description: t('journey.steps.processFollowup.description'),
        actionLabel: t('journey.steps.processFollowup.action'),
        actionPath: '/dashboard/followup',
        secondaryAction: {
          label: t('journey.steps.processFollowup.secondaryAction'),
          path: '/dashboard/followup'
        }
      }
    
    case 'has_followup':
      return {
        icon: <Target className="w-8 h-8 text-purple-600" />,
        title: t('journey.steps.executeActions.title'),
        description: t('journey.steps.executeActions.description', { count: stats.followup_count }),
        actionLabel: t('journey.steps.executeActions.action'),
        actionPath: '/dashboard/followup'
      }
    
    case 'deal_won':
      return {
        icon: <Trophy className="w-8 h-8 text-green-600" />,
        title: t('journey.steps.dealWon.title'),
        description: t('journey.steps.dealWon.description'),
        actionLabel: t('journey.steps.dealWon.action'),
        actionPath: '/dashboard/prospects'
      }
    
    case 'deal_lost':
      return {
        icon: <TrendingDown className="w-8 h-8 text-red-500" />,
        title: t('journey.steps.dealLost.title'),
        description: t('journey.steps.dealLost.description'),
        actionLabel: t('journey.steps.dealLost.action'),
        actionPath: '/dashboard/prospects'
      }
  }
}

// ============================================================
// Main Component
// ============================================================

export default function ProspectHubPage() {
  const params = useParams()
  const router = useRouter()
  const prospectId = params.id as string
  const t = useTranslations('prospectHub')
  const tProspects = useTranslations('prospects')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  const { confirm } = useConfirmDialog()
  
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [hubData, setHubData] = useState<ProspectHub | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  
  // Notes state
  const [notes, setNotes] = useState<ProspectNote[]>([])
  const [newNoteContent, setNewNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  
  // Add Contact Modal
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState({
    name: '',
    role: '',
    email: '',
    linkedin_url: '',
    decision_authority: ''
  })
  const [savingContact, setSavingContact] = useState(false)
  
  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false)
  
  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<string[]>(['research'])
  
  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        if (user) {
          const { data: orgMember } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()
          
          if (orgMember) {
            setOrganizationId(orgMember.organization_id)
            
            // Fetch hub data
            const { data, error } = await api.get<ProspectHub>(
              `/api/v1/prospects/${prospectId}/hub?organization_id=${orgMember.organization_id}`
            )
            
            if (!error && data) {
              setHubData(data)
            }
            
            // Fetch notes
            const notesResponse = await api.get<ProspectNote[]>(
              `/api/v1/prospects/${prospectId}/notes`
            )
            if (!notesResponse.error && notesResponse.data) {
              setNotes(notesResponse.data)
            }
          }
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast({ variant: "destructive", title: t('errors.loadFailed') })
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [supabase, prospectId, t, toast])
  
  // Refetch hub data
  const refetchHubData = useCallback(async () => {
    if (!organizationId) return
    
    const { data, error } = await api.get<ProspectHub>(
      `/api/v1/prospects/${prospectId}/hub?organization_id=${organizationId}`
    )
    
    if (!error && data) {
      setHubData(data)
    }
  }, [prospectId, organizationId])
  
  // Status change handler
  const handleStatusChange = async (newStatus: ProspectStatus) => {
    if (!hubData) return
    
    setUpdatingStatus(true)
    try {
      const { error } = await api.patch(`/api/v1/prospects/${prospectId}/status`, {
        status: newStatus
      })
      
      if (!error) {
        setHubData({
          ...hubData,
          prospect: { ...hubData.prospect, status: newStatus }
        })
        toast({ title: t('toast.statusUpdated') })
      }
    } catch (error) {
      toast({ variant: "destructive", title: t('errors.updateFailed') })
    } finally {
      setUpdatingStatus(false)
    }
  }
  
  // Add note handler
  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return
    
    setSavingNote(true)
    try {
      const { data, error } = await api.post<ProspectNote>(
        `/api/v1/prospects/${prospectId}/notes`,
        { content: newNoteContent.trim(), is_pinned: false }
      )
      
      if (!error && data) {
        setNotes([data, ...notes])
        setNewNoteContent('')
        toast({ title: t('toast.noteAdded') })
      }
    } catch (error) {
      toast({ variant: "destructive", title: t('errors.noteSaveFailed') })
    } finally {
      setSavingNote(false)
    }
  }
  
  // Toggle pin handler
  const handleTogglePin = async (note: ProspectNote) => {
    try {
      const { error } = await api.patch(
        `/api/v1/prospects/${prospectId}/notes/${note.id}`,
        { is_pinned: !note.is_pinned }
      )
      
      if (!error) {
        setNotes(notes.map(n => 
          n.id === note.id ? { ...n, is_pinned: !n.is_pinned } : n
        ).sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }))
      }
    } catch (error) {
      console.error('Error toggling pin:', error)
    }
  }
  
  // Delete note handler
  const handleDeleteNote = async (noteId: string) => {
    const confirmed = await confirm({
      title: t('confirm.deleteNoteTitle'),
      description: t('confirm.deleteNoteDescription'),
      confirmLabel: tCommon('delete'),
      cancelLabel: tCommon('cancel'),
      variant: 'danger'
    })
    
    if (!confirmed) return
    
    try {
      const { error } = await api.delete(`/api/v1/prospects/${prospectId}/notes/${noteId}`)
      if (!error) {
        setNotes(notes.filter(n => n.id !== noteId))
        toast({ title: t('toast.noteDeleted') })
      }
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }
  
  // Add contact handler
  const handleAddContact = async () => {
    if (!newContact.name.trim()) return
    
    setSavingContact(true)
    try {
      const { error } = await api.post(
        `/api/v1/prospects/${prospectId}/contacts`,
        {
          name: newContact.name.trim(),
          role: newContact.role || undefined,
          email: newContact.email || undefined,
          linkedin_url: newContact.linkedin_url || undefined,
          decision_authority: newContact.decision_authority || undefined
        }
      )
      
      if (!error) {
        setShowAddContact(false)
        setNewContact({ name: '', role: '', email: '', linkedin_url: '', decision_authority: '' })
        toast({ title: t('toast.contactAdded') })
        refetchHubData()
      } else {
        toast({ variant: "destructive", title: t('errors.contactSaveFailed') })
      }
    } catch (error) {
      toast({ variant: "destructive", title: t('errors.contactSaveFailed') })
    } finally {
      setSavingContact(false)
    }
  }
  
  // Next step action handler
  const handleNextStepAction = (actionPath: string) => {
    if (actionPath === 'add-contact') {
      setShowAddContact(true)
    } else {
      router.push(actionPath)
    }
  }
  
  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }
  
  // Loading state
  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      </DashboardLayout>
    )
  }
  
  // Not found state
  if (!hubData) {
    return (
      <DashboardLayout user={user}>
        <div className="flex flex-col items-center justify-center h-96">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t('errors.notFound')}</h2>
          <Button onClick={() => router.push('/dashboard/prospects')}>{tCommon('back')}</Button>
        </div>
      </DashboardLayout>
    )
  }
  
  const { prospect, research, contacts, stats } = hubData
  const phase = detectJourneyPhase(hubData)
  const nextStepConfig = getNextStepConfig(phase, prospect, stats, t)
  
  // Get research summary bullets
  const getResearchBullets = () => {
    if (!research?.brief_content) return []
    const content = research.brief_content
    // Try to extract key points - this is a simple heuristic
    const lines = content.split('\n').filter(line => 
      line.trim().startsWith('•') || 
      line.trim().startsWith('-') ||
      line.trim().startsWith('*')
    ).slice(0, 3)
    
    if (lines.length > 0) return lines.map(l => l.replace(/^[•\-\*]\s*/, '').trim())
    
    // Fallback: first 3 sentences
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20).slice(0, 3)
    return sentences.map(s => s.trim().substring(0, 100) + '...')
  }
  
  const researchBullets = getResearchBullets()
  
  return (
    <DashboardLayout user={user}>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => router.push('/dashboard/prospects')}
          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 -ml-2"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {t('actions.backToProspects')}
        </Button>
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {prospect.company_name}
                </h1>
                
                {/* Status Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`${STATUS_COLORS[prospect.status]} border-0 h-7`}
                      disabled={updatingStatus}
                    >
                      {updatingStatus && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
                      {tProspects(`status.${prospect.status}`)}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {STATUS_OPTIONS.map(status => (
                      <DropdownMenuItem
                        key={status}
                        onClick={() => handleStatusChange(status)}
                        className={prospect.status === status ? 'bg-slate-100 dark:bg-slate-800' : ''}
                      >
                        <span className={`w-2 h-2 rounded-full mr-2 ${STATUS_COLORS[status].split(' ')[0]}`} />
                        {tProspects(`status.${status}`)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
                {prospect.industry && <span>{prospect.industry}</span>}
                {(prospect.city || prospect.country) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {[prospect.city, prospect.country].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {prospect.website && (
              <Button variant="outline" size="sm" asChild>
                <a href={prospect.website} target="_blank" rel="noopener noreferrer">
                  <Globe className="w-4 h-4 mr-1" />
                  Website
                </a>
              </Button>
            )}
            {prospect.linkedin_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="w-4 h-4 mr-1" />
                  LinkedIn
                </a>
              </Button>
            )}
          </div>
        </div>
        
        {/* Next Step Card */}
        <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/30 dark:to-slate-900">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/50">
                {nextStepConfig.icon}
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide mb-1">
                  {t('journey.nextStep')}
                </p>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {nextStepConfig.title}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  {nextStepConfig.description}
                </p>
                {nextStepConfig.tip && (
                  <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
                    💡 {nextStepConfig.tip}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-4">
                  <Button 
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={() => handleNextStepAction(nextStepConfig.actionPath)}
                  >
                    {nextStepConfig.actionLabel}
                  </Button>
                  {nextStepConfig.secondaryAction && (
                    <Button 
                      variant="outline"
                      onClick={() => router.push(nextStepConfig.secondaryAction!.path)}
                    >
                      {nextStepConfig.secondaryAction.label}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Completed Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                {t('journey.completed')}
              </h3>
              
              {/* Research - Always shown if exists */}
              {research && (
                <Collapsible 
                  open={expandedSections.includes('research')}
                  onOpenChange={() => toggleSection('research')}
                >
                  <Card className="border-green-200 dark:border-green-800/50">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                              <Search className="w-4 h-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{t('journey.items.research')}</CardTitle>
                              <p className="text-xs text-slate-500">{researchBullets.length} key insights</p>
                            </div>
                          </div>
                          <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expandedSections.includes('research') ? 'rotate-180' : ''}`} />
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-4">
                        <ul className="space-y-2 mb-3">
                          {researchBullets.map((bullet, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                              <span className="text-purple-500 mt-1">•</span>
                              {bullet}
                            </li>
                          ))}
                        </ul>
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="p-0 h-auto text-purple-600"
                          onClick={() => router.push(`/dashboard/research/${research.id}`)}
                        >
                          {t('journey.viewFull')} <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}
              
              {/* Contacts - Shown if any */}
              {contacts.length > 0 && (
                <Card className="border-green-200 dark:border-green-800/50">
                  <CardHeader className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                        <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {contacts.length} {t('journey.items.contacts')}
                        </CardTitle>
                        <p className="text-xs text-slate-500">
                          {contacts.slice(0, 2).map(c => c.name).join(', ')}
                          {contacts.length > 2 && ` +${contacts.length - 2}`}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              )}
              
              {/* Prep - Shown if any */}
              {stats.prep_count > 0 && (
                <Card className="border-green-200 dark:border-green-800/50">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                          <FileText className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{t('journey.items.preparation')}</CardTitle>
                          <p className="text-xs text-slate-500">{stats.prep_count} prep(s) created</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => router.push('/dashboard/preparation')}
                      >
                        {t('journey.view')} <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              )}
              
              {/* Follow-up - Shown if any */}
              {stats.followup_count > 0 && (
                <Card className="border-green-200 dark:border-green-800/50">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                          <Mic className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{t('journey.items.followup')}</CardTitle>
                          <p className="text-xs text-slate-500">{stats.followup_count} follow-up(s)</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => router.push('/dashboard/followup')}
                      >
                        {t('journey.view')} <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardHeader>
                </Card>
              )}
            </div>
            
            {/* Upcoming Section */}
            {phase !== 'deal_won' && phase !== 'deal_lost' && (
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  {t('journey.upcoming')}
                </h3>
                
                {/* Show locked items based on phase */}
                {phase === 'research_only' && (
                  <>
                    <LockedItem 
                      icon={<FileText className="w-4 h-4" />}
                      title={t('journey.items.preparation')}
                      reason={t('journey.locked.needsContacts')}
                    />
                    <LockedItem 
                      icon={<Mic className="w-4 h-4" />}
                      title={t('journey.items.followup')}
                      reason={t('journey.locked.needsMeeting')}
                    />
                  </>
                )}
                
                {phase === 'has_contacts' && (
                  <LockedItem 
                    icon={<Mic className="w-4 h-4" />}
                    title={t('journey.items.followup')}
                    reason={t('journey.locked.needsMeeting')}
                  />
                )}
              </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="space-y-4">
            {/* Key Contacts */}
            <Card>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-500" />
                    {t('sidebar.keyContacts')} ({contacts.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {contacts.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-2">
                    {t('empty.noContacts')}
                  </p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {contacts.slice(0, 4).map(contact => (
                      <div key={contact.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-sm font-medium text-purple-700 dark:text-purple-300">
                          {contact.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {contact.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {contact.role || contact.decision_authority || '—'}
                          </p>
                        </div>
                        {contact.linkedin_url && (
                          <a 
                            href={contact.linkedin_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-blue-500"
                          >
                            <Linkedin className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setShowAddContact(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {t('actions.addContact')}
                </Button>
              </CardContent>
            </Card>
            
            {/* Quick Notes */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">{t('sidebar.quickNotes')}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-2 mb-3">
                  <Input
                    value={newNoteContent}
                    onChange={e => setNewNoteContent(e.target.value)}
                    placeholder={t('sidebar.addNotePlaceholder')}
                    className="h-9 text-sm"
                    onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                  />
                  <Button 
                    size="sm" 
                    className="h-9 px-3 bg-purple-600 hover:bg-purple-700"
                    onClick={handleAddNote}
                    disabled={!newNoteContent.trim() || savingNote}
                  >
                    {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
                
                {notes.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-2">
                    {t('empty.noNotes')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {notes.slice(0, 3).map(note => (
                      <div 
                        key={note.id} 
                        className={`p-2 rounded-lg text-sm group ${
                          note.is_pinned 
                            ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' 
                            : 'bg-slate-50 dark:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-slate-700 dark:text-slate-300 line-clamp-2">{note.content}</p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleTogglePin(note)}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                            >
                              {note.is_pinned ? (
                                <PinOff className="w-3 h-3 text-amber-500" />
                              ) : (
                                <Pin className="w-3 h-3 text-slate-400" />
                              )}
                            </button>
                            <button 
                              onClick={() => handleDeleteNote(note.id)}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                            >
                              <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{smartDate(note.created_at)}</p>
                      </div>
                    ))}
                    {notes.length > 3 && (
                      <Button variant="link" size="sm" className="w-full text-purple-600">
                        {t('sidebar.viewAllNotes', { count: notes.length })}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Add Contact Modal */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('modal.addContactTitle')}</DialogTitle>
            <DialogDescription>{t('modal.addContactDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="contact-name">{t('modal.contactName')} *</Label>
              <Input
                id="contact-name"
                value={newContact.name}
                onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                placeholder="John Doe"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact-role">{t('modal.contactRole')}</Label>
              <Input
                id="contact-role"
                value={newContact.role}
                onChange={e => setNewContact({ ...newContact, role: e.target.value })}
                placeholder="Sales Director"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact-email">{t('modal.contactEmail')}</Label>
              <Input
                id="contact-email"
                type="email"
                value={newContact.email}
                onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                placeholder="john@company.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact-linkedin">{t('modal.contactLinkedIn')}</Label>
              <Input
                id="contact-linkedin"
                value={newContact.linkedin_url}
                onChange={e => setNewContact({ ...newContact, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/..."
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="contact-authority">{t('modal.contactAuthority')}</Label>
              <Select 
                value={newContact.decision_authority} 
                onValueChange={val => setNewContact({ ...newContact, decision_authority: val })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t('modal.selectAuthority')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="decision_maker">{t('modal.decisionMaker')}</SelectItem>
                  <SelectItem value="influencer">{t('modal.influencer')}</SelectItem>
                  <SelectItem value="gatekeeper">{t('modal.gatekeeper')}</SelectItem>
                  <SelectItem value="end_user">{t('modal.endUser')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContact(false)}>
              {tCommon('cancel')}
            </Button>
            <Button 
              onClick={handleAddContact} 
              disabled={!newContact.name.trim() || savingContact}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {savingContact ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {t('actions.addContact')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}

// ============================================================
// Sub Components
// ============================================================

function LockedItem({ 
  icon, 
  title, 
  reason 
}: { 
  icon: React.ReactNode
  title: string
  reason: string
}) {
  return (
    <Card className="border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 opacity-60">
      <CardHeader className="py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-400">
            {icon}
          </div>
          <div className="flex-1">
            <CardTitle className="text-base text-slate-500 dark:text-slate-400">{title}</CardTitle>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              {reason}
            </p>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}
