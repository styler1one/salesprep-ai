'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { User } from '@supabase/supabase-js'
import { 
  Building2, 
  Users, 
  Target, 
  Clock, 
  Search, 
  FileText, 
  ChevronRight,
  ChevronLeft,
  Plus,
  ExternalLink,
  Globe,
  Linkedin,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  StickyNote,
  Pin,
  PinOff,
  Trash2,
  Mail,
  Send,
  Mic
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'
import { useConfirmDialog } from '@/components/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { api } from '@/lib/api'
import { 
  ProspectHub, 
  DealWithStats, 
  Activity, 
  ProspectContact,
  ResearchBrief,
  ProspectStatus
} from '@/types'
import { formatDate, smartDate } from '@/lib/date-utils'
import { getActivityIcon } from '@/lib/constants/activity'

// Status configurations
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

interface ProspectNote {
  id: string
  prospect_id: string
  user_id: string
  content: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

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
  const [activeTab, setActiveTab] = useState('overview')
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  
  // Notes state
  const [notes, setNotes] = useState<ProspectNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  
  // Add Contact Modal
  const [showAddContact, setShowAddContact] = useState(false)
  const [newContact, setNewContact] = useState({
    name: '',
    role: '',
    email: '',
    phone: '',
    linkedin_url: '',
    decision_authority: ''
  })
  const [savingContact, setSavingContact] = useState(false)
  
  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false)
  
  // Fetch hub data
  const fetchHubData = useCallback(async () => {
    if (!organizationId) return
    
    try {
      const { data, error } = await api.get<ProspectHub>(
        `/api/v1/prospects/${prospectId}/hub?organization_id=${organizationId}`
      )
      
      if (error) {
        toast({ variant: "destructive", title: t('errors.loadFailed') })
        console.error('Failed to load prospect hub:', error)
      } else {
        setHubData(data)
      }
    } catch (error) {
      console.error('Error loading hub:', error)
    }
  }, [prospectId, organizationId, t, toast])
  
  // Fetch notes
  const fetchNotes = useCallback(async () => {
    setNotesLoading(true)
    try {
      const { data, error } = await api.get<ProspectNote[]>(
        `/api/v1/prospects/${prospectId}/notes`
      )
      
      if (!error && data) {
        setNotes(data)
      }
    } catch (error) {
      console.error('Error fetching notes:', error)
    } finally {
      setNotesLoading(false)
    }
  }, [prospectId])
  
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
  }, [supabase, t, toast])
  
  // Fetch data when org ID is set
  useEffect(() => {
    if (organizationId) {
      fetchHubData()
      fetchNotes()
    }
  }, [organizationId, fetchHubData, fetchNotes])
  
  // Update status
  const handleStatusChange = async (newStatus: ProspectStatus) => {
    if (!hubData) return
    
    setUpdatingStatus(true)
    try {
      const { error } = await api.patch(`/api/v1/prospects/${prospectId}/status`, {
        status: newStatus
      })
      
      if (error) {
        toast({ variant: "destructive", title: t('errors.updateFailed') })
      } else {
        setHubData({
          ...hubData,
          prospect: { ...hubData.prospect, status: newStatus }
        })
        toast({ title: t('toast.statusUpdated') })
      }
    } catch (error) {
      console.error('Error updating status:', error)
      toast({ variant: "destructive", title: t('errors.updateFailed') })
    } finally {
      setUpdatingStatus(false)
    }
  }
  
  // Add note
  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return
    
    setSavingNote(true)
    try {
      const { data, error } = await api.post<ProspectNote>(
        `/api/v1/prospects/${prospectId}/notes`,
        { content: newNoteContent.trim(), is_pinned: false }
      )
      
      if (error) {
        toast({ variant: "destructive", title: t('errors.noteSaveFailed') })
      } else if (data) {
        setNotes([data, ...notes])
        setNewNoteContent('')
        toast({ title: t('toast.noteAdded') })
      }
    } catch (error) {
      console.error('Error adding note:', error)
      toast({ variant: "destructive", title: t('errors.noteSaveFailed') })
    } finally {
      setSavingNote(false)
    }
  }
  
  // Toggle note pin
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
  
  // Delete note
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
  
  // Add contact
  const handleAddContact = async () => {
    if (!newContact.name.trim()) return
    
    setSavingContact(true)
    try {
      const { data, error } = await api.post<ProspectContact>(
        `/api/v1/prospects/${prospectId}/contacts`,
        {
          name: newContact.name.trim(),
          role: newContact.role || undefined,
          email: newContact.email || undefined,
          phone: newContact.phone || undefined,
          linkedin_url: newContact.linkedin_url || undefined,
          decision_authority: newContact.decision_authority || undefined
        }
      )
      
      if (error) {
        toast({ variant: "destructive", title: t('errors.contactSaveFailed'), description: error.message })
      } else {
        setShowAddContact(false)
        setNewContact({ name: '', role: '', email: '', phone: '', linkedin_url: '', decision_authority: '' })
        toast({ title: t('toast.contactAdded') })
        fetchHubData() // Refresh to get updated contacts
      }
    } catch (error) {
      console.error('Error adding contact:', error)
      toast({ variant: "destructive", title: t('errors.contactSaveFailed') })
    } finally {
      setSavingContact(false)
    }
  }
  
  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      </DashboardLayout>
    )
  }
  
  if (!hubData) {
    return (
      <DashboardLayout user={user}>
        <div className="flex flex-col items-center justify-center h-96">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t('errors.notFound')}</h2>
          <Button onClick={() => router.back()}>{tCommon('back')}</Button>
        </div>
      </DashboardLayout>
    )
  }
  
  const { prospect, research, contacts, deals, recent_activities, stats } = hubData
  
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
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-8 h-8 text-white" />
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
                      {updatingStatus ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : null}
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
                {prospect.employee_count && (
                  <span>{prospect.employee_count} employees</span>
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
        
        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2 flex-wrap p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mr-2">
            {t('actions.quickActions')}:
          </span>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => router.push(`/dashboard/research?company=${encodeURIComponent(prospect.company_name)}&country=${encodeURIComponent(prospect.country || '')}`)}
          >
            <Search className="w-4 h-4 mr-1" />
            {t('actions.startResearch')}
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => router.push('/dashboard/preparation')}
          >
            <FileText className="w-4 h-4 mr-1" />
            {t('actions.createPrep')}
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => router.push('/dashboard/followup')}
          >
            <Mic className="w-4 h-4 mr-1" />
            {t('actions.uploadFollowup')}
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setShowAddContact(true)}
          >
            <Users className="w-4 h-4 mr-1" />
            {t('actions.addContact')}
          </Button>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:inline-grid">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t('tabs.overview')}</span>
            </TabsTrigger>
            <TabsTrigger value="research" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">{t('tabs.research')}</span>
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{t('tabs.contacts')}</span>
              {stats.contact_count > 0 && (
                <Badge variant="secondary" className="ml-1">{stats.contact_count}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <StickyNote className="w-4 h-4" />
              <span className="hidden sm:inline">{t('tabs.notes')}</span>
              {notes.length > 0 && (
                <Badge variant="secondary" className="ml-1">{notes.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="deals" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">{t('tabs.deals')}</span>
              {stats.active_deal_count > 0 && (
                <Badge variant="secondary" className="ml-1">{stats.active_deal_count}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">{t('tabs.timeline')}</span>
            </TabsTrigger>
          </TabsList>
          
          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatsCard
                icon={<Search className="w-5 h-5 text-blue-500" />}
                label={t('stats.research')}
                value={stats.research_count}
                onClick={() => setActiveTab('research')}
              />
              <StatsCard
                icon={<Users className="w-5 h-5 text-green-500" />}
                label={t('stats.contacts')}
                value={stats.contact_count}
                onClick={() => setActiveTab('contacts')}
              />
              <StatsCard
                icon={<Target className="w-5 h-5 text-purple-500" />}
                label={t('stats.activeDeals')}
                value={stats.active_deal_count}
                onClick={() => setActiveTab('deals')}
              />
              <StatsCard
                icon={<Calendar className="w-5 h-5 text-orange-500" />}
                label={t('stats.meetings')}
                value={stats.meeting_count}
              />
            </div>
            
            {/* Two Column Layout */}
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Active Deals */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5 text-purple-500" />
                        {t('sections.activeDeals')}
                      </CardTitle>
                      <CardDescription>{t('sections.activeDealsDesc')}</CardDescription>
                    </div>
                    <Button size="sm" onClick={() => router.push(`/dashboard/prospects/${prospectId}/deals/new`)}>
                      <Plus className="w-4 h-4 mr-1" />
                      {t('actions.newDeal')}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {deals.filter(d => d.is_active).length === 0 ? (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>{t('empty.noDeals')}</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-3"
                          onClick={() => router.push(`/dashboard/prospects/${prospectId}/deals/new`)}
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          {t('actions.createFirstDeal')}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {deals.filter(d => d.is_active).map(deal => (
                          <DealCard key={deal.id} deal={deal} prospectId={prospectId} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Recent Research */}
                {research && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Search className="w-5 h-5 text-blue-500" />
                        {t('sections.latestResearch')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div 
                        className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        onClick={() => router.push(`/dashboard/research/${research.id}`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {t('status.completed')}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {research.completed_at && formatDate(research.completed_at)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">
                          {research.brief_content?.substring(0, 200)}...
                        </p>
                        <Button variant="link" size="sm" className="mt-2 p-0">
                          {t('actions.viewResearch')}
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
              
              {/* Sidebar */}
              <div className="space-y-6">
                {/* Key Contacts */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-500" />
                      {t('sections.keyContacts')}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('contacts')}>
                      {t('actions.viewAll')}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {contacts.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-slate-500 mb-2">{t('empty.noContacts')}</p>
                        <Button variant="outline" size="sm" onClick={() => setShowAddContact(true)}>
                          <Plus className="w-3 h-3 mr-1" />
                          {t('actions.addContact')}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {contacts.slice(0, 3).map(contact => (
                          <ContactCard key={contact.id} contact={contact} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Recent Notes */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <StickyNote className="w-4 h-4 text-amber-500" />
                      {t('sections.recentNotes')}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('notes')}>
                      {t('actions.viewAll')}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {notes.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">
                        {t('empty.noNotes')}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {notes.slice(0, 3).map(note => (
                          <div key={note.id} className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded text-sm">
                            <p className="line-clamp-2 text-slate-700 dark:text-slate-300">{note.content}</p>
                            <p className="text-xs text-slate-400 mt-1">{smartDate(note.created_at)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Recent Activity */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-500" />
                      {t('sections.recentActivity')}
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={() => setActiveTab('timeline')}>
                      {t('actions.viewAll')}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {recent_activities.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">
                        {t('empty.noActivity')}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {recent_activities.slice(0, 5).map(activity => (
                          <ActivityItem key={activity.id} activity={activity} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          {/* Research Tab */}
          <TabsContent value="research" className="mt-6">
            <ResearchTabContent 
              research={research || null} 
              prospectId={prospectId}
              companyName={prospect.company_name}
              country={prospect.country}
            />
          </TabsContent>
          
          {/* Contacts Tab */}
          <TabsContent value="contacts" className="mt-6">
            <ContactsTabContent 
              contacts={contacts} 
              prospectId={prospectId}
              onAddContact={() => setShowAddContact(true)}
            />
          </TabsContent>
          
          {/* Notes Tab */}
          <TabsContent value="notes" className="mt-6">
            <NotesTabContent 
              notes={notes}
              loading={notesLoading}
              newNoteContent={newNoteContent}
              setNewNoteContent={setNewNoteContent}
              onAddNote={handleAddNote}
              onTogglePin={handleTogglePin}
              onDeleteNote={handleDeleteNote}
              savingNote={savingNote}
            />
          </TabsContent>
          
          {/* Deals Tab */}
          <TabsContent value="deals" className="mt-6">
            <DealsTabContent 
              deals={deals} 
              prospectId={prospectId}
            />
          </TabsContent>
          
          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-6">
            <TimelineTabContent 
              activities={recent_activities}
              prospectId={prospectId}
            />
          </TabsContent>
        </Tabs>
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

function StatsCard({ 
  icon, 
  label, 
  value, 
  onClick 
}: { 
  icon: React.ReactNode
  label: string
  value: number
  onClick?: () => void
}) {
  return (
    <Card 
      className={`${onClick ? 'cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 transition' : ''}`}
      onClick={onClick}
    >
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function DealCard({ deal, prospectId }: { deal: DealWithStats; prospectId: string }) {
  const router = useRouter()
  const t = useTranslations('prospectHub')
  
  return (
    <div 
      className="p-4 border rounded-lg hover:border-purple-300 dark:hover:border-purple-700 transition cursor-pointer"
      onClick={() => router.push(`/dashboard/prospects/${prospectId}/deals/${deal.id}`)}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-slate-900 dark:text-white">{deal.name}</h4>
        <Badge variant={deal.is_active ? 'default' : 'secondary'}>
          {deal.is_active ? t('status.active') : t('status.archived')}
        </Badge>
      </div>
      {deal.description && (
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
          {deal.description}
        </p>
      )}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span>{deal.meeting_count} {t('stats.meetings').toLowerCase()}</span>
        <span>{deal.prep_count} preps</span>
        <span>{deal.followup_count} follow-ups</span>
      </div>
    </div>
  )
}

function ContactCard({ contact }: { contact: ProspectContact }) {
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <span className="text-sm font-medium text-green-700 dark:text-green-400">
          {contact.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
          {contact.name}
        </p>
        {contact.role && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {contact.role}
          </p>
        )}
      </div>
      {contact.linkedin_url && (
        <a 
          href={contact.linkedin_url} 
          target="_blank" 
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-slate-400 hover:text-blue-500"
        >
          <Linkedin className="w-4 h-4" />
        </a>
      )}
    </div>
  )
}

function ActivityItem({ activity }: { activity: Activity }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-lg">{getActivityIcon(activity.activity_type, activity.icon)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-900 dark:text-white">{activity.title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {smartDate(activity.created_at)}
        </p>
      </div>
    </div>
  )
}

// ============================================================
// Tab Content Components
// ============================================================

function ResearchTabContent({ 
  research, 
  prospectId,
  companyName,
  country
}: { 
  research: ResearchBrief | null
  prospectId: string
  companyName: string
  country?: string
}) {
  const router = useRouter()
  const t = useTranslations('prospectHub')
  
  if (!research) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Search className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-lg font-medium mb-2">{t('empty.noResearchTitle')}</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              {t('empty.noResearchDesc')}
            </p>
            <Button 
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => router.push(`/dashboard/research?company=${encodeURIComponent(companyName)}&country=${encodeURIComponent(country || '')}`)}
            >
              <Search className="w-4 h-4 mr-2" />
              {t('actions.startResearch')}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('sections.researchBrief')}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/research/${research.id}`)}>
            <ExternalLink className="w-4 h-4 mr-1" />
            {t('actions.openFull')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {research.brief_content}
        </div>
      </CardContent>
    </Card>
  )
}

function ContactsTabContent({ 
  contacts, 
  prospectId,
  onAddContact
}: { 
  contacts: ProspectContact[]
  prospectId: string
  onAddContact: () => void
}) {
  const t = useTranslations('prospectHub')
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('sections.allContacts')}</CardTitle>
        <Button size="sm" onClick={onAddContact} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-1" />
          {t('actions.addContact')}
        </Button>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-lg font-medium mb-2">{t('empty.noContactsTitle')}</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              {t('empty.noContactsDesc')}
            </p>
            <Button onClick={onAddContact} className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              {t('actions.addContact')}
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {contacts.map(contact => (
              <div key={contact.id} className="p-4 border rounded-lg hover:border-purple-200 dark:hover:border-purple-800 transition">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <span className="text-lg font-medium text-green-700 dark:text-green-400">
                      {contact.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900 dark:text-white">{contact.name}</h4>
                    {contact.role && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{contact.role}</p>
                    )}
                    {contact.email && (
                      <p className="text-xs text-slate-400 mt-1">{contact.email}</p>
                    )}
                    {contact.decision_authority && (
                      <Badge variant="outline" className="mt-2">
                        {contact.decision_authority}
                      </Badge>
                    )}
                  </div>
                  {contact.linkedin_url && (
                    <a 
                      href={contact.linkedin_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-blue-500"
                    >
                      <Linkedin className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function NotesTabContent({ 
  notes,
  loading,
  newNoteContent,
  setNewNoteContent,
  onAddNote,
  onTogglePin,
  onDeleteNote,
  savingNote
}: { 
  notes: ProspectNote[]
  loading: boolean
  newNoteContent: string
  setNewNoteContent: (val: string) => void
  onAddNote: () => void
  onTogglePin: (note: ProspectNote) => void
  onDeleteNote: (id: string) => void
  savingNote: boolean
}) {
  const t = useTranslations('prospectHub')
  const tCommon = useTranslations('common')
  
  return (
    <div className="space-y-6">
      {/* Add Note Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {t('notes.addNote')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={t('notes.placeholder')}
            value={newNoteContent}
            onChange={e => setNewNoteContent(e.target.value)}
            rows={3}
            className="mb-3"
          />
          <Button 
            onClick={onAddNote} 
            disabled={!newNoteContent.trim() || savingNote}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {savingNote ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {t('notes.save')}
          </Button>
        </CardContent>
      </Card>
      
      {/* Notes List */}
      <Card>
        <CardHeader>
          <CardTitle>{t('notes.allNotes')}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12">
              <StickyNote className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <h3 className="text-lg font-medium mb-2">{t('empty.noNotesTitle')}</h3>
              <p className="text-slate-500 dark:text-slate-400">
                {t('empty.noNotesDesc')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map(note => (
                <div 
                  key={note.id} 
                  className={`p-4 border rounded-lg ${note.is_pinned ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/20' : ''}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {note.is_pinned && (
                        <Badge variant="outline" className="mb-2 text-amber-600 border-amber-300">
                          <Pin className="w-3 h-3 mr-1" />
                          Pinned
                        </Badge>
                      )}
                      <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{note.content}</p>
                      <p className="text-xs text-slate-400 mt-2">{smartDate(note.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onTogglePin(note)}
                        className="h-8 w-8 p-0"
                      >
                        {note.is_pinned ? (
                          <PinOff className="w-4 h-4 text-amber-500" />
                        ) : (
                          <Pin className="w-4 h-4 text-slate-400" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteNote(note.id)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function DealsTabContent({ 
  deals, 
  prospectId 
}: { 
  deals: DealWithStats[]
  prospectId: string
}) {
  const router = useRouter()
  const t = useTranslations('prospectHub')
  
  const activeDeals = deals.filter(d => d.is_active)
  const archivedDeals = deals.filter(d => !d.is_active)
  
  return (
    <div className="space-y-6">
      {/* Active Deals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('sections.activeDeals')}</CardTitle>
          <Button size="sm" onClick={() => router.push(`/dashboard/prospects/${prospectId}/deals/new`)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-1" />
            {t('actions.newDeal')}
          </Button>
        </CardHeader>
        <CardContent>
          {activeDeals.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('empty.noActiveDeals')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeDeals.map(deal => (
                <DealCard key={deal.id} deal={deal} prospectId={prospectId} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Archived Deals */}
      {archivedDeals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-slate-500">{t('sections.archivedDeals')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 opacity-75">
              {archivedDeals.map(deal => (
                <DealCard key={deal.id} deal={deal} prospectId={prospectId} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function TimelineTabContent({ 
  activities,
  prospectId 
}: { 
  activities: Activity[]
  prospectId: string
}) {
  const t = useTranslations('prospectHub')
  
  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = formatDate(activity.created_at)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(activity)
    return groups
  }, {} as Record<string, Activity[]>)
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('sections.activityTimeline')}</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-lg font-medium mb-2">{t('empty.noTimelineTitle')}</h3>
            <p className="text-slate-500 dark:text-slate-400">
              {t('empty.noTimelineDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedActivities).map(([date, dayActivities]) => (
              <div key={date}>
                <h4 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                  {date}
                </h4>
                <div className="space-y-3 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
                  {dayActivities.map(activity => (
                    <div key={activity.id} className="relative pl-4">
                      <div className="absolute left-0 top-1 w-2 h-2 -translate-x-[5px] rounded-full bg-purple-400 dark:bg-purple-500" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span>{activity.icon || '📌'}</span>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {activity.title}
                          </p>
                        </div>
                        {activity.description && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {activity.description}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          {new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(activity.created_at))}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
