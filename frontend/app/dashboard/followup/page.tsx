'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { DashboardLayout } from '@/components/layout'
import { 
  ArrowLeft, 
  Upload, 
  FileAudio, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Trash2,
  RefreshCw,
  Mic
} from 'lucide-react'

interface Followup {
  id: string
  prospect_company_name: string | null
  meeting_subject: string | null
  meeting_date: string | null
  status: string
  executive_summary: string | null
  audio_duration_seconds: number | null
  created_at: string
  completed_at: string | null
}

export default function FollowupPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  
  const [user, setUser] = useState<any>(null)
  const [followups, setFollowups] = useState<Followup[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadType, setUploadType] = useState<'audio' | 'transcript'>('audio')
  
  // Form state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [prospectCompany, setProspectCompany] = useState('')
  const [meetingSubject, setMeetingSubject] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  
  const fetchFollowups = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/followup/list`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setFollowups(data)
      }
    } catch (error) {
      console.error('Error fetching followups:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  // Use a ref to track followups for polling without causing re-renders
  const followupsRef = useRef<Followup[]>([])
  followupsRef.current = followups

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
    fetchFollowups()
  }, [fetchFollowups, supabase])

  // Separate effect for polling to avoid dependency loop
  useEffect(() => {
    // Poll for updates every 5 seconds if there are processing items
    const interval = setInterval(() => {
      const hasProcessing = followupsRef.current.some(f => 
        ['uploading', 'transcribing', 'summarizing'].includes(f.status)
      )
      if (hasProcessing) {
        fetchFollowups()
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [fetchFollowups])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const ext = file.name.toLowerCase().split('.').pop() || ''
      
      if (uploadType === 'audio') {
        // Validate audio file type
        const allowedTypes = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/x-m4a']
        if (!allowedTypes.includes(file.type)) {
          toast({
            title: 'Ongeldig bestandstype',
            description: 'Upload een mp3, m4a, wav of webm bestand',
            variant: 'destructive'
          })
          return
        }
        
        // Validate file size (50MB for audio)
        if (file.size > 50 * 1024 * 1024) {
          toast({
            title: 'Bestand te groot',
            description: 'Maximum bestandsgrootte is 50MB',
            variant: 'destructive'
          })
          return
        }
      } else {
        // Validate transcript file type
        const allowedExts = ['txt', 'md', 'docx', 'srt']
        if (!allowedExts.includes(ext)) {
          toast({
            title: 'Ongeldig bestandstype',
            description: 'Upload een txt, md, docx of srt bestand',
            variant: 'destructive'
          })
          return
        }
        
        // Validate file size (10MB for transcripts)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: 'Bestand te groot',
            description: 'Maximum bestandsgrootte is 10MB',
            variant: 'destructive'
          })
          return
        }
      }
      
      setSelectedFile(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'Geen bestand geselecteerd',
        description: 'Selecteer eerst een audio bestand',
        variant: 'destructive'
      })
      return
    }

    setUploading(true)
    setUploadProgress(10)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const formData = new FormData()
      formData.append('file', selectedFile)
      if (prospectCompany) formData.append('prospect_company_name', prospectCompany)
      if (meetingSubject) formData.append('meeting_subject', meetingSubject)
      if (meetingDate) formData.append('meeting_date', meetingDate)

      setUploadProgress(30)

      // Use different endpoint based on upload type
      const endpoint = uploadType === 'audio' 
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1/followup/upload`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/v1/followup/upload-transcript`

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData
      })

      setUploadProgress(80)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Upload failed')
      }

      const result = await response.json()
      setUploadProgress(100)

      toast({
        title: 'Upload gestart',
        description: 'Audio wordt getranscribeerd en verwerkt...'
      })

      // Reset form
      setSelectedFile(null)
      setProspectCompany('')
      setMeetingSubject('')
      setMeetingDate('')
      
      // Refresh list
      fetchFollowups()

    } catch (error: any) {
      toast({
        title: 'Upload mislukt',
        description: error.message,
        variant: 'destructive'
      })
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze follow-up wilt verwijderen?')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/followup/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (response.ok) {
        toast({ title: 'Follow-up verwijderd' })
        fetchFollowups()
      }
    } catch (error) {
      toast({
        title: 'Verwijderen mislukt',
        variant: 'destructive'
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { icon: any, label: string, className: string }> = {
      pending: { icon: Clock, label: 'Wachten', className: 'bg-gray-100 text-gray-700' },
      uploading: { icon: Upload, label: 'Uploaden', className: 'bg-blue-100 text-blue-700' },
      transcribing: { icon: Loader2, label: 'Transcriberen', className: 'bg-yellow-100 text-yellow-700' },
      summarizing: { icon: Loader2, label: 'Samenvatten', className: 'bg-purple-100 text-purple-700' },
      completed: { icon: CheckCircle2, label: 'Voltooid', className: 'bg-green-100 text-green-700' },
      failed: { icon: XCircle, label: 'Mislukt', className: 'bg-red-100 text-red-700' }
    }
    
    const badge = badges[status] || badges.pending
    const Icon = badge.icon
    const isAnimated = ['uploading', 'transcribing', 'summarizing'].includes(status)
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        <Icon className={`h-3 w-3 ${isAnimated ? 'animate-spin' : ''}`} />
        {badge.label}
      </span>
    )
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <DashboardLayout user={user}>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">Meeting Follow-up</h1>
          <p className="text-slate-500">
            Upload meeting recordings voor transcriptie, samenvatting en follow-up emails
          </p>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Nieuwe Follow-up
            </CardTitle>
            <CardDescription>
              Upload een meeting opname
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload Type Selector */}
            <div className="flex gap-2">
              <Button
                variant={uploadType === 'audio' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setUploadType('audio'); setSelectedFile(null); }}
                disabled={uploading}
                className="flex-1"
              >
                <Mic className="h-4 w-4 mr-1" />
                Audio
              </Button>
              <Button
                variant={uploadType === 'transcript' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setUploadType('transcript'); setSelectedFile(null); }}
                disabled={uploading}
                className="flex-1"
              >
                <FileAudio className="h-4 w-4 mr-1" />
                Transcript
              </Button>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label>{uploadType === 'audio' ? 'Audio Bestand' : 'Transcript Bestand'} *</Label>
              <div 
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                  ${selectedFile ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-gray-400'}
                  ${uploading ? 'pointer-events-none opacity-50' : ''}`}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <input
                  id="file-input"
                  type="file"
                  accept={uploadType === 'audio' 
                    ? "audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/x-m4a"
                    : ".txt,.md,.docx,.srt"}
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileAudio className="h-8 w-8 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium text-sm">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">
                      Klik of sleep een {uploadType === 'audio' ? 'audio' : 'transcript'} bestand
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {uploadType === 'audio' 
                        ? 'MP3, M4A, WAV, WebM (max 50MB)'
                        : 'TXT, MD, DOCX, SRT (max 10MB)'}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {uploading && (
              <div className="space-y-1">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  {uploadProgress < 30 ? 'Uploading...' : 
                   uploadProgress < 80 ? 'Processing...' : 'Almost done...'}
                </p>
              </div>
            )}

            {/* Optional fields */}
            <div className="space-y-2">
              <Label htmlFor="prospect">Prospect Bedrijf</Label>
              <Input
                id="prospect"
                placeholder="Bijv. Ordina"
                value={prospectCompany}
                onChange={(e) => setProspectCompany(e.target.value)}
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Meeting Onderwerp</Label>
              <Input
                id="subject"
                placeholder="Bijv. Demo gesprek"
                value={meetingSubject}
                onChange={(e) => setMeetingSubject(e.target.value)}
                disabled={uploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Meeting Datum</Label>
              <Input
                id="date"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                disabled={uploading}
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verwerken...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload & Verwerk
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Follow-ups List */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recente Follow-ups</CardTitle>
              <CardDescription>
                {followups.length} follow-up{followups.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchFollowups}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : followups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileAudio className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nog geen follow-ups</p>
                <p className="text-sm">Upload een meeting opname om te beginnen</p>
              </div>
            ) : (
              <div className="space-y-3">
                {followups.map((followup) => (
                  <div
                    key={followup.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/followup/${followup.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">
                          {followup.prospect_company_name || followup.meeting_subject || 'Untitled Meeting'}
                        </h3>
                        {getStatusBadge(followup.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {followup.meeting_date && (
                          <span>{new Date(followup.meeting_date).toLocaleDateString('nl-NL')}</span>
                        )}
                        {followup.audio_duration_seconds && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDuration(followup.audio_duration_seconds)}
                          </span>
                        )}
                        <span>
                          {new Date(followup.created_at).toLocaleDateString('nl-NL', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {followup.executive_summary && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {followup.executive_summary}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(followup.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
    </DashboardLayout>
  )
}

