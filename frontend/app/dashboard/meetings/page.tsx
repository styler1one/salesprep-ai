'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DashboardLayout } from '@/components/layout'
import { 
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  ChevronRight,
  RefreshCw,
  Loader2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  CalendarPlus
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'
import type { User } from '@supabase/supabase-js'

interface Attendee {
  email: string
  name?: string
  response_status?: string
  is_organizer: boolean
}

interface PrepStatus {
  has_prep: boolean
  prep_id?: string
  prep_created_at?: string
}

interface CalendarMeeting {
  id: string
  title: string
  description?: string
  start_time: string
  end_time: string
  location?: string
  meeting_url?: string
  is_online: boolean
  status: string
  attendees: Attendee[]
  organizer_email?: string
  is_now: boolean
  is_today: boolean
  is_tomorrow: boolean
  prospect_id?: string
  prospect_name?: string
  prep_status?: PrepStatus
  is_recurring: boolean
}

interface MeetingsResponse {
  meetings: CalendarMeeting[]
  total: number
  has_more: boolean
}

type FilterType = 'today' | 'week' | 'month' | 'all'

export default function MeetingsPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const t = useTranslations('meetings')
  const tCommon = useTranslations('common')

  const [user, setUser] = useState<User | null>(null)
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('week')
  const [unpreparedOnly, setUnpreparedOnly] = useState(false)

  // Load user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
    })
  }, [supabase, router])

  // Load meetings
  const loadMeetings = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Calculate date range based on filter
      const now = new Date()
      let fromDate = now.toISOString()
      let toDate: string
      
      switch (filter) {
        case 'today':
          toDate = new Date(now.setHours(23, 59, 59, 999)).toISOString()
          break
        case 'week':
          toDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
          break
        case 'month':
          toDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
          break
        default:
          toDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
      }
      
      const params = new URLSearchParams({
        from_date: fromDate,
        to_date: toDate,
        unprepared_only: unpreparedOnly.toString(),
      })
      
      const { data, error: apiError } = await api.get<MeetingsResponse>(
        `/api/v1/calendar-meetings?${params.toString()}`
      )
      
      if (apiError) {
        throw new Error(apiError.message || 'Failed to load meetings')
      }
      
      setMeetings(data?.meetings || [])
    } catch (err) {
      console.error('Failed to load meetings:', err)
      setError(err instanceof Error ? err.message : 'Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      loadMeetings()
    }
  }, [user, filter, unpreparedOnly])

  // Sync calendar
  const handleSync = async () => {
    setSyncing(true)
    try {
      const { data, error: apiError } = await api.post<{
        synced_meetings: number
        new_meetings: number
        updated_meetings: number
      }>('/api/v1/calendar/sync', {})
      
      if (apiError) {
        throw new Error(apiError.message || 'Sync failed')
      }
      
      toast({
        title: t('sync.syncNow'),
        description: `${data?.new_meetings || 0} new, ${data?.updated_meetings || 0} updated`,
      })
      
      // Reload meetings
      loadMeetings()
    } catch (err) {
      console.error('Sync failed:', err)
      toast({
        title: 'Sync failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSyncing(false)
    }
  }

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  }

  // Format date header
  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (date.toDateString() === today.toDateString()) {
      return t('card.today')
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return t('card.tomorrow')
    }
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // Group meetings by date
  const groupedMeetings = meetings.reduce((groups, meeting) => {
    const date = new Date(meeting.start_time).toDateString()
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(meeting)
    return groups
  }, {} as Record<string, CalendarMeeting[]>)

  if (loading && !meetings.length) {
    return (
      <DashboardLayout user={user}>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="p-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-6 w-6 text-blue-500" />
              {t('title')}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('subtitle')}
            </p>
          </div>
          
          <Button 
            variant="outline" 
            onClick={handleSync}
            disabled={syncing}
            className="gap-2"
          >
            {syncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('sync.syncing')}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                {t('sync.syncNow')}
              </>
            )}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6">
          {(['today', 'week', 'month'] as FilterType[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {t(`filters.${f === 'week' ? 'thisWeek' : f === 'month' ? 'thisMonth' : f}`)}
            </Button>
          ))}
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={unpreparedOnly}
              onChange={(e) => setUnpreparedOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            {t('filters.unpreparedOnly')}
          </label>
        </div>

        {/* Error state */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50 dark:bg-red-900/20">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
              <Button variant="ghost" size="sm" onClick={loadMeetings}>
                {tCommon('refresh')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!loading && meetings.length === 0 && !error && (
          <Card className="text-center py-12">
            <CardContent>
              <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                {t('empty.title')}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {t('empty.description')}
              </p>
              <Button onClick={() => router.push('/dashboard/settings')}>
                <CalendarPlus className="h-4 w-4 mr-2" />
                {t('empty.connectCalendar')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Meetings list grouped by day */}
        <div className="space-y-6">
          {Object.entries(groupedMeetings).map(([date, dayMeetings]) => (
            <div key={date}>
              {/* Date header */}
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                {formatDateHeader(dayMeetings[0].start_time)}
              </h2>
              
              {/* Meetings for this day */}
              <div className="space-y-3">
                {dayMeetings.map((meeting) => (
                  <Card 
                    key={meeting.id} 
                    className={`hover:shadow-md transition-shadow ${
                      meeting.is_now ? 'ring-2 ring-red-500 ring-offset-2' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        {/* Left: Time and info */}
                        <div className="flex gap-4">
                          {/* Time column */}
                          <div className="text-right min-w-[60px]">
                            <p className="text-lg font-semibold text-slate-900 dark:text-white">
                              {formatTime(meeting.start_time)}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatTime(meeting.end_time)}
                            </p>
                            {meeting.is_now && (
                              <Badge className="mt-1 bg-red-500 text-white animate-pulse">
                                {t('card.now')}
                              </Badge>
                            )}
                          </div>
                          
                          {/* Meeting info */}
                          <div>
                            <h3 className="font-medium text-slate-900 dark:text-white">
                              {meeting.title}
                            </h3>
                            
                            {/* Location/Online */}
                            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                              {meeting.is_online ? (
                                <>
                                  <Video className="h-4 w-4" />
                                  <span>{t('card.online')}</span>
                                </>
                              ) : meeting.location ? (
                                <>
                                  <MapPin className="h-4 w-4" />
                                  <span>{meeting.location}</span>
                                </>
                              ) : null}
                            </div>
                            
                            {/* Attendees */}
                            {meeting.attendees.length > 0 && (
                              <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                                <Users className="h-4 w-4" />
                                <span>{t('card.attendees', { count: meeting.attendees.length })}</span>
                              </div>
                            )}
                            
                            {/* Prospect link */}
                            {meeting.prospect_name && (
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 h-auto mt-1 text-blue-600"
                                onClick={() => router.push(`/dashboard/prospects/${meeting.prospect_id}`)}
                              >
                                {meeting.prospect_name}
                                <ChevronRight className="h-3 w-3 ml-1" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Right: Actions */}
                        <div className="flex items-center gap-2">
                          {/* Prep status */}
                          {meeting.prep_status?.has_prep ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {t('card.prepared')}
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => {
                                sessionStorage.setItem('prepareForCompany', meeting.title)
                                router.push('/dashboard/preparation')
                              }}
                            >
                              {t('card.prepare')}
                            </Button>
                          )}
                          
                          {/* Join button for online meetings */}
                          {meeting.is_online && meeting.meeting_url && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(meeting.meeting_url, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              {t('card.join')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}

