'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { 
  ArrowLeft, 
  Copy, 
  CheckCircle2, 
  Clock, 
  Users,
  Loader2,
  Mail,
  ListTodo,
  FileText,
  AlertCircle,
  Lightbulb,
  RefreshCw,
  Play,
  ChevronDown,
  ChevronUp
} from 'lucide-react'

interface Followup {
  id: string
  organization_id: string
  user_id: string
  meeting_prep_id: string | null
  audio_url: string | null
  audio_filename: string | null
  audio_duration_seconds: number | null
  transcription_text: string | null
  transcription_segments: Array<{ speaker: string; start: number; end: number; text: string }>
  speaker_count: number
  executive_summary: string | null
  key_points: string[]
  concerns: string[]
  decisions: string[]
  next_steps: string[]
  action_items: Array<{ task: string; assignee: string; due_date: string | null; priority: string }>
  email_draft: string | null
  email_tone: string
  meeting_date: string | null
  prospect_company_name: string | null
  meeting_subject: string | null
  status: string
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export default function FollowupDetailPage() {
  const router = useRouter()
  const params = useParams()
  const followupId = params.id as string
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  
  const [followup, setFollowup] = useState<Followup | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailDraft, setEmailDraft] = useState('')
  const [regeneratingEmail, setRegeneratingEmail] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    transcription: false,
    actionItems: true,
    email: true
  })

  const fetchFollowup = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/followup/${followupId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setFollowup(data)
        setEmailDraft(data.email_draft || '')
      } else {
        toast({
          title: 'Follow-up niet gevonden',
          variant: 'destructive'
        })
        router.push('/dashboard/followup')
      }
    } catch (error) {
      console.error('Error fetching followup:', error)
    } finally {
      setLoading(false)
    }
  }, [followupId, supabase, router, toast])

  useEffect(() => {
    fetchFollowup()
    
    // Poll while processing
    const interval = setInterval(() => {
      if (followup && ['uploading', 'transcribing', 'summarizing'].includes(followup.status)) {
        fetchFollowup()
      }
    }, 5000)
    
    return () => clearInterval(interval)
  }, [fetchFollowup, followup?.status])

  const handleCopy = async (text: string, type: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    toast({ title: 'Gekopieerd!' })
    setTimeout(() => setCopied(null), 2000)
  }

  const handleRegenerateEmail = async (tone: string) => {
    setRegeneratingEmail(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/followup/${followupId}/regenerate-email`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ tone })
        }
      )

      if (response.ok) {
        const data = await response.json()
        setEmailDraft(data.email_draft)
        toast({ title: 'Email opnieuw gegenereerd' })
      }
    } catch (error) {
      toast({
        title: 'Regenereren mislukt',
        variant: 'destructive'
      })
    } finally {
      setRegeneratingEmail(false)
    }
  }

  const handleSaveEmail = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/followup/${followupId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email_draft: emailDraft })
        }
      )

      if (response.ok) {
        toast({ title: 'Email opgeslagen' })
      }
    } catch (error) {
      toast({
        title: 'Opslaan mislukt',
        variant: 'destructive'
      })
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!followup) {
    return null
  }

  const isProcessing = ['uploading', 'transcribing', 'summarizing'].includes(followup.status)

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.push('/dashboard/followup')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug naar Follow-ups
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {followup.prospect_company_name || followup.meeting_subject || 'Meeting Follow-up'}
            </h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              {followup.meeting_date && (
                <span>{new Date(followup.meeting_date).toLocaleDateString('nl-NL')}</span>
              )}
              {followup.audio_duration_seconds && (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDuration(followup.audio_duration_seconds)}
                </span>
              )}
              {followup.speaker_count > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {followup.speaker_count} sprekers
                </span>
              )}
            </div>
          </div>
          {isProcessing && (
            <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm font-medium">
                {followup.status === 'transcribing' ? 'Transcriberen...' : 
                 followup.status === 'summarizing' ? 'Samenvatten...' : 'Verwerken...'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error State */}
      {followup.status === 'failed' && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Verwerking mislukt</span>
            </div>
            <p className="text-sm text-red-600 mt-1">{followup.error_message}</p>
          </CardContent>
        </Card>
      )}

      {followup.status === 'completed' && (
        <div className="space-y-6">
          {/* Executive Summary */}
          <Card>
            <CardHeader 
              className="cursor-pointer" 
              onClick={() => toggleSection('summary')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Samenvatting
                </CardTitle>
                {expandedSections.summary ? <ChevronUp /> : <ChevronDown />}
              </div>
            </CardHeader>
            {expandedSections.summary && (
              <CardContent className="space-y-4">
                {/* Executive Summary */}
                {followup.executive_summary && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm">{followup.executive_summary}</p>
                  </div>
                )}

                {/* Key Points */}
                {followup.key_points?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      Belangrijkste Punten
                    </h4>
                    <ul className="space-y-1">
                      {followup.key_points.map((point, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-blue-500">•</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Concerns */}
                {followup.concerns?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      Bezwaren & Zorgen
                    </h4>
                    <ul className="space-y-1">
                      {followup.concerns.map((concern, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-orange-500">•</span>
                          {concern}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Decisions */}
                {followup.decisions?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Beslissingen
                    </h4>
                    <ul className="space-y-1">
                      {followup.decisions.map((decision, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-green-500">•</span>
                          {decision}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Next Steps */}
                {followup.next_steps?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <ArrowLeft className="h-4 w-4 rotate-180 text-purple-500" />
                      Vervolgstappen
                    </h4>
                    <ul className="space-y-1">
                      {followup.next_steps.map((step, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-purple-500">•</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(
                    `Samenvatting: ${followup.executive_summary}\n\nBelangrijkste punten:\n${followup.key_points?.join('\n')}\n\nVervolgstappen:\n${followup.next_steps?.join('\n')}`,
                    'summary'
                  )}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  {copied === 'summary' ? 'Gekopieerd!' : 'Kopieer Samenvatting'}
                </Button>
              </CardContent>
            )}
          </Card>

          {/* Action Items */}
          {followup.action_items?.length > 0 && (
            <Card>
              <CardHeader 
                className="cursor-pointer" 
                onClick={() => toggleSection('actionItems')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ListTodo className="h-5 w-5" />
                    Actie Items ({followup.action_items.length})
                  </CardTitle>
                  {expandedSections.actionItems ? <ChevronUp /> : <ChevronDown />}
                </div>
              </CardHeader>
              {expandedSections.actionItems && (
                <CardContent>
                  <div className="space-y-3">
                    {followup.action_items.map((item, i) => (
                      <div 
                        key={i} 
                        className="flex items-start gap-3 p-3 border rounded-lg"
                      >
                        <div className={`w-2 h-2 rounded-full mt-2 ${
                          item.priority === 'high' ? 'bg-red-500' :
                          item.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.task}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>👤 {item.assignee || 'TBD'}</span>
                            {item.due_date && <span>📅 {item.due_date}</span>}
                            <span className={`px-2 py-0.5 rounded ${
                              item.priority === 'high' ? 'bg-red-100 text-red-700' :
                              item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 
                              'bg-green-100 text-green-700'
                            }`}>
                              {item.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          {/* Email Draft */}
          <Card>
            <CardHeader 
              className="cursor-pointer" 
              onClick={() => toggleSection('email')}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Follow-up Email
                </CardTitle>
                {expandedSections.email ? <ChevronUp /> : <ChevronDown />}
              </div>
            </CardHeader>
            {expandedSections.email && (
              <CardContent className="space-y-4">
                <Textarea
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerateEmail('professional')}
                      disabled={regeneratingEmail}
                    >
                      {regeneratingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                      Professioneel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerateEmail('casual')}
                      disabled={regeneratingEmail}
                    >
                      Informeel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerateEmail('formal')}
                      disabled={regeneratingEmail}
                    >
                      Formeel
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleSaveEmail}>
                      Opslaan
                    </Button>
                    <Button onClick={() => handleCopy(emailDraft, 'email')}>
                      <Copy className="h-4 w-4 mr-2" />
                      {copied === 'email' ? 'Gekopieerd!' : 'Kopieer'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Transcription */}
          {followup.transcription_text && (
            <Card>
              <CardHeader 
                className="cursor-pointer" 
                onClick={() => toggleSection('transcription')}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Transcriptie
                  </CardTitle>
                  {expandedSections.transcription ? <ChevronUp /> : <ChevronDown />}
                </div>
                <CardDescription>
                  Volledige meeting transcriptie
                </CardDescription>
              </CardHeader>
              {expandedSections.transcription && (
                <CardContent>
                  {followup.transcription_segments?.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {followup.transcription_segments.map((segment, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="flex-shrink-0 w-24">
                            <span className="text-xs font-medium text-blue-600">
                              {segment.speaker}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {formatTimestamp(segment.start)}
                            </span>
                          </div>
                          <p className="text-sm flex-1">{segment.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm max-h-96 overflow-y-auto">
                      {followup.transcription_text}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => handleCopy(followup.transcription_text || '', 'transcription')}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {copied === 'transcription' ? 'Gekopieerd!' : 'Kopieer Transcriptie'}
                  </Button>
                </CardContent>
              )}
            </Card>
          )}

          {/* Audio Player */}
          {followup.audio_url && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Audio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <audio controls className="w-full">
                  <source src={followup.audio_url} />
                  Je browser ondersteunt geen audio playback.
                </audio>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Processing State */}
      {isProcessing && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
              <h3 className="font-medium text-lg mb-2">
                {followup.status === 'transcribing' ? 'Audio wordt getranscribeerd...' :
                 followup.status === 'summarizing' ? 'Samenvatting wordt gegenereerd...' :
                 'Bestand wordt verwerkt...'}
              </h3>
              <p className="text-muted-foreground text-sm">
                Dit kan enkele minuten duren afhankelijk van de lengte van de opname.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

