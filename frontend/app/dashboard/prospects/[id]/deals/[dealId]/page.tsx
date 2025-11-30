'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { User } from '@supabase/supabase-js'
import { 
  Target, 
  ArrowLeft,
  Plus,
  Calendar,
  FileText,
  Mail,
  Users,
  MoreHorizontal,
  Archive,
  Trash2,
  Edit2,
  CheckCircle,
  Clock,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { Deal, Meeting, MeetingWithLinks } from '@/types'

export default function DealDetailPage() {
  const params = useParams()
  const router = useRouter()
  const prospectId = params.id as string
  const dealId = params.dealId as string
  const t = useTranslations('deals')
  const tCommon = useTranslations('common')
  
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [deal, setDeal] = useState<Deal | null>(null)
  const [meetings, setMeetings] = useState<MeetingWithLinks[]>([])
  
  // Fetch deal and meetings
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        if (user) {
          // Fetch deal
          const { data: dealData, error: dealError } = await supabase
            .from('deals')
            .select('*')
            .eq('id', dealId)
            .single()
          
          if (dealError) {
            console.error('Error fetching deal:', dealError)
            toast.error(t('errors.loadFailed'))
            return
          }
          
          setDeal(dealData)
          
          // Fetch meetings for this deal
          const { data: meetingsData } = await supabase
            .from('meetings')
            .select('*')
            .eq('deal_id', dealId)
            .order('scheduled_date', { ascending: false })
          
          if (meetingsData) {
            // Enrich meetings with prep/followup info
            const enrichedMeetings = await Promise.all(
              meetingsData.map(async (meeting) => {
                // Check for linked prep
                const { data: prepData } = await supabase
                  .from('meeting_preps')
                  .select('id')
                  .eq('meeting_id', meeting.id)
                  .limit(1)
                
                // Check for linked followup
                const { data: followupData } = await supabase
                  .from('followups')
                  .select('id')
                  .eq('meeting_id', meeting.id)
                  .limit(1)
                
                // Get contact names
                let contactNames: string[] = []
                if (meeting.contact_ids?.length) {
                  const { data: contacts } = await supabase
                    .from('prospect_contacts')
                    .select('name')
                    .in('id', meeting.contact_ids)
                  contactNames = contacts?.map(c => c.name) || []
                }
                
                return {
                  ...meeting,
                  has_prep: prepData && prepData.length > 0,
                  prep_id: prepData?.[0]?.id,
                  has_followup: followupData && followupData.length > 0,
                  followup_id: followupData?.[0]?.id,
                  contact_names: contactNames
                } as MeetingWithLinks
              })
            )
            setMeetings(enrichedMeetings)
          }
        }
      } catch (error) {
        console.error('Error loading deal:', error)
        toast.error(t('errors.loadFailed'))
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [dealId, supabase, t])
  
  const handleArchive = async () => {
    if (!deal) return
    
    try {
      const { error } = await supabase
        .from('deals')
        .update({ is_active: !deal.is_active })
        .eq('id', dealId)
      
      if (error) throw error
      
      setDeal({ ...deal, is_active: !deal.is_active })
      toast.success(deal.is_active ? t('success.archived') : t('success.activated'))
    } catch (error) {
      console.error('Error updating deal:', error)
      toast.error(t('errors.updateFailed'))
    }
  }
  
  const handleDelete = async () => {
    if (!confirm(t('confirm.delete'))) return
    
    try {
      const { error } = await supabase
        .from('deals')
        .delete()
        .eq('id', dealId)
      
      if (error) throw error
      
      toast.success(t('success.deleted'))
      router.push(`/dashboard/prospects/${prospectId}`)
    } catch (error) {
      console.error('Error deleting deal:', error)
      toast.error(t('errors.deleteFailed'))
    }
  }
  
  const getMeetingStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>
      case 'scheduled':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"><Clock className="w-3 h-3 mr-1" />Scheduled</Badge>
      case 'cancelled':
        return <Badge variant="secondary">Cancelled</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }
  
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    )
  }
  
  if (!deal) {
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
  
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => router.push(`/dashboard/prospects/${prospectId}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('backToProspect')}
        </Button>
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <Target className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {deal.name}
                </h1>
                <Badge variant={deal.is_active ? 'default' : 'secondary'}>
                  {deal.is_active ? t('status.active') : t('status.archived')}
                </Badge>
              </div>
              {deal.description && (
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                  {deal.description}
                </p>
              )}
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleArchive}>
                  <Archive className="w-4 h-4 mr-2" />
                  {deal.is_active ? t('actions.archive') : t('actions.activate')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('actions.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{meetings.length}</p>
                  <p className="text-sm text-slate-500">{t('stats.meetings')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{meetings.filter(m => m.has_prep).length}</p>
                  <p className="text-sm text-slate-500">{t('stats.preps')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{meetings.filter(m => m.has_followup).length}</p>
                  <p className="text-sm text-slate-500">{t('stats.followups')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Meetings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                {t('sections.meetings')}
              </CardTitle>
              <CardDescription>{t('sections.meetingsDesc')}</CardDescription>
            </div>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              {t('actions.addMeeting')}
            </Button>
          </CardHeader>
          <CardContent>
            {meetings.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <h3 className="text-lg font-medium mb-2">{t('empty.noMeetings')}</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  {t('empty.noMeetingsDesc')}
                </p>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('actions.scheduleFirst')}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {meetings.map(meeting => (
                  <div 
                    key={meeting.id}
                    className="p-4 border rounded-lg hover:border-blue-300 dark:hover:border-blue-700 transition"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-medium text-slate-900 dark:text-white">
                          {meeting.title}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                          {meeting.scheduled_date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(meeting.scheduled_date).toLocaleDateString()}
                            </span>
                          )}
                          {meeting.meeting_type && (
                            <Badge variant="outline">{meeting.meeting_type}</Badge>
                          )}
                        </div>
                      </div>
                      {getMeetingStatusBadge(meeting.status)}
                    </div>
                    
                    {/* Contacts */}
                    {meeting.contact_names.length > 0 && (
                      <div className="flex items-center gap-2 mb-3 text-sm text-slate-500">
                        <Users className="w-4 h-4" />
                        {meeting.contact_names.join(', ')}
                      </div>
                    )}
                    
                    {/* Linked Items */}
                    <div className="flex items-center gap-2">
                      {meeting.has_prep ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => router.push(`/dashboard/preparation/${meeting.prep_id}`)}
                        >
                          <FileText className="w-3 h-3 mr-1 text-green-500" />
                          {t('links.viewPrep')}
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => router.push(`/dashboard/preparation?meeting_id=${meeting.id}`)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          {t('links.createPrep')}
                        </Button>
                      )}
                      
                      {meeting.has_followup ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => router.push(`/dashboard/followup/${meeting.followup_id}`)}
                        >
                          <Mail className="w-3 h-3 mr-1 text-orange-500" />
                          {t('links.viewFollowup')}
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => router.push(`/dashboard/followup?meeting_id=${meeting.id}`)}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          {t('links.createFollowup')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

