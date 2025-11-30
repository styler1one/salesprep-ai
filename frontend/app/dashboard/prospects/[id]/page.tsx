'use client'

import { useState, useEffect } from 'react'
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
  Plus,
  ExternalLink,
  Globe,
  Linkedin,
  MapPin,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { 
  ProspectHub, 
  DealWithStats, 
  Activity, 
  ProspectContact,
  ResearchBrief 
} from '@/types'

export default function ProspectHubPage() {
  const params = useParams()
  const router = useRouter()
  const prospectId = params.id as string
  const t = useTranslations('prospectHub')
  const tCommon = useTranslations('common')
  
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [hubData, setHubData] = useState<ProspectHub | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  
  // Fetch user and hub data
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        if (user) {
          // Get organization ID
          const { data: orgMember } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()
          
          if (orgMember) {
            // Fetch hub data
            const { data, error } = await api.get<ProspectHub>(
              `/api/v1/prospects/${prospectId}/hub?organization_id=${orgMember.organization_id}`
            )
            
            if (error) {
              toast.error(t('errors.loadFailed'))
              console.error('Failed to load prospect hub:', error)
            } else {
              setHubData(data)
            }
          }
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast.error(t('errors.loadFailed'))
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [prospectId, supabase, t])
  
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    )
  }
  
  if (!hubData) {
    return (
      <DashboardLayout>
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
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {prospect.company_name}
              </h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                {prospect.industry && (
                  <span>{prospect.industry}</span>
                )}
                {prospect.headquarters_location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {prospect.headquarters_location}
                  </span>
                )}
                {prospect.employee_count && (
                  <span>{prospect.employee_count} employees</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
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
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
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
                            {research.completed_at && new Date(research.completed_at).toLocaleDateString()}
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
                      <p className="text-sm text-slate-500 text-center py-4">
                        {t('empty.noContacts')}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {contacts.slice(0, 3).map(contact => (
                          <ContactCard key={contact.id} contact={contact} />
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
              research={research} 
              prospectId={prospectId}
              companyName={prospect.company_name}
            />
          </TabsContent>
          
          {/* Contacts Tab */}
          <TabsContent value="contacts" className="mt-6">
            <ContactsTabContent 
              contacts={contacts} 
              prospectId={prospectId}
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
      className={`${onClick ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition' : ''}`}
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
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'research': return '🔍'
      case 'prep': return '📋'
      case 'followup': return '📝'
      case 'meeting': return '📅'
      case 'deal_created': return '🎯'
      case 'contact_added': return '👤'
      default: return activity.icon || '📌'
    }
  }
  
  return (
    <div className="flex items-start gap-3">
      <span className="text-lg">{getActivityIcon(activity.activity_type)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-900 dark:text-white">{activity.title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {new Date(activity.created_at).toLocaleDateString()}
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
  companyName 
}: { 
  research: ResearchBrief | null
  prospectId: string
  companyName: string
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
            <Button onClick={() => router.push(`/dashboard/research?company=${encodeURIComponent(companyName)}`)}>
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
  prospectId 
}: { 
  contacts: ProspectContact[]
  prospectId: string
}) {
  const router = useRouter()
  const t = useTranslations('prospectHub')
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('sections.allContacts')}</CardTitle>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" />
          {t('actions.addContact')}
        </Button>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <h3 className="text-lg font-medium mb-2">{t('empty.noContactsTitle')}</h3>
            <p className="text-slate-500 dark:text-slate-400">
              {t('empty.noContactsDesc')}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {contacts.map(contact => (
              <div key={contact.id} className="p-4 border rounded-lg">
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
          <Button size="sm" onClick={() => router.push(`/dashboard/prospects/${prospectId}/deals/new`)}>
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
    const date = new Date(activity.created_at).toLocaleDateString()
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
                      <div className="absolute left-0 top-1 w-2 h-2 -translate-x-[5px] rounded-full bg-slate-400 dark:bg-slate-500" />
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
                          {new Date(activity.created_at).toLocaleTimeString()}
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

