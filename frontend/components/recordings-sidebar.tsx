'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Mic, 
  RefreshCw, 
  Loader2, 
  Clock, 
  Users, 
  ChevronRight,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Flame
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'

interface ExternalRecording {
  id: string
  provider: string
  external_id: string
  title: string | null
  recording_date: string
  duration_seconds: number | null
  participants: string[]
  transcript_available: boolean
  audio_url: string | null
  matched_meeting_id: string | null
  matched_prospect_id: string | null
  import_status: string
}

interface RecordingsResponse {
  recordings: ExternalRecording[]
  total: number
}

interface IntegrationsStatus {
  fireflies: {
    connected: boolean
    pending_recordings: number
  }
  zoom: {
    connected: boolean
    pending_recordings: number
  }
  teams: {
    connected: boolean
    pending_recordings: number
  }
}

export function RecordingsSidebar() {
  const router = useRouter()
  const { toast } = useToast()
  
  const [recordings, setRecordings] = useState<ExternalRecording[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [importing, setImporting] = useState<string | null>(null)
  const [hasIntegration, setHasIntegration] = useState(false)

  // Load recordings
  const loadRecordings = async () => {
    setLoading(true)
    try {
      // First check if user has any integrations
      const { data: statusData } = await api.get<IntegrationsStatus>('/api/v1/integrations/status')
      
      const hasFireflies = statusData?.fireflies?.connected || false
      const hasZoom = statusData?.zoom?.connected || false
      const hasTeams = statusData?.teams?.connected || false
      
      setHasIntegration(hasFireflies || hasZoom || hasTeams)
      
      if (!hasFireflies && !hasZoom && !hasTeams) {
        setRecordings([])
        setLoading(false)
        return
      }

      // Load pending recordings from Fireflies (for now, only Fireflies supported)
      if (hasFireflies) {
        const { data, error } = await api.get<RecordingsResponse>(
          '/api/v1/integrations/fireflies/recordings?import_status=pending&limit=10'
        )
        
        if (!error && data) {
          setRecordings(data.recordings)
        }
      }
    } catch (err) {
      console.error('Failed to load recordings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRecordings()
  }, [])

  // Sync recordings
  const handleSync = async () => {
    setSyncing(true)
    try {
      const { data, error } = await api.post<{
        success: boolean
        new_recordings: number
      }>('/api/v1/integrations/fireflies/sync', { days_back: 30 })
      
      if (error) {
        throw new Error(error.message || 'Sync failed')
      }
      
      toast({
        title: 'Sync complete',
        description: `${data?.new_recordings || 0} new recordings found`,
      })
      
      loadRecordings()
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

  // Import recording
  const handleImport = async (recordingId: string) => {
    setImporting(recordingId)
    try {
      const { data, error } = await api.post<{
        success: boolean
        followup_id: string
        message: string
      }>(`/api/v1/integrations/fireflies/import/${recordingId}`, {})
      
      if (error) {
        throw new Error(error.message || 'Import failed')
      }
      
      toast({
        title: 'Recording imported',
        description: data?.message || 'AI analysis in progress',
      })
      
      // Navigate to the followup if we got an ID
      if (data?.followup_id) {
        router.push(`/dashboard/followups/${data.followup_id}`)
      } else {
        // Remove from list
        setRecordings(prev => prev.filter(r => r.id !== recordingId))
      }
    } catch (err) {
      console.error('Import failed:', err)
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setImporting(null)
    }
  }

  // Format duration
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--'
    const mins = Math.floor(seconds / 60)
    if (mins < 60) return `${mins}m`
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours}h ${remainingMins}m`
  }

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Get provider icon
  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'fireflies':
        return <Flame className="h-4 w-4 text-orange-500" />
      default:
        return <Mic className="h-4 w-4 text-pink-500" />
    }
  }

  // Don't render if no integration
  if (!loading && !hasIntegration) {
    return null
  }

  return (
    <Card className="w-full lg:w-80 shrink-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mic className="h-4 w-4 text-pink-500" />
            New Recordings
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={handleSync}
            disabled={syncing || loading}
          >
            {syncing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-slate-500">All caught up!</p>
            <p className="text-xs text-slate-400 mt-1">
              No pending recordings to import
            </p>
          </div>
        ) : (
          <>
            {recordings.slice(0, 5).map((recording) => (
              <div
                key={recording.id}
                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Provider icon */}
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm shrink-0">
                    {getProviderIcon(recording.provider)}
                  </div>
                  
                  {/* Recording info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {recording.title || 'Untitled Recording'}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      <span>{formatDuration(recording.duration_seconds)}</span>
                      <span>•</span>
                      <span>{formatDate(recording.recording_date)}</span>
                    </div>
                    {recording.participants.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                        <Users className="h-3 w-3" />
                        <span>{recording.participants.slice(0, 2).join(', ')}</span>
                        {recording.participants.length > 2 && (
                          <span>+{recording.participants.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Import button */}
                <Button
                  size="sm"
                  className="w-full mt-3 gap-1"
                  onClick={() => handleImport(recording.id)}
                  disabled={importing === recording.id}
                >
                  {importing === recording.id ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      Analyze
                      <ArrowRight className="h-3 w-3" />
                    </>
                  )}
                </Button>
              </div>
            ))}
            
            {recordings.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-slate-500 gap-1"
                onClick={() => router.push('/dashboard/recordings')}
              >
                View all {recordings.length} recordings
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </>
        )}
        
        {/* Connect integration prompt */}
        {!loading && !hasIntegration && (
          <div className="text-center py-4">
            <AlertCircle className="h-6 w-6 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Connect Fireflies to import recordings
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push('/dashboard/settings')}
            >
              Connect
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

