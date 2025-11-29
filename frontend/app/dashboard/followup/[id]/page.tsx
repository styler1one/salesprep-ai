'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Icons } from '@/components/icons'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { DashboardLayout } from '@/components/layout/dashboard-layout'

interface Followup {
  id: string
  organization_id: string
  user_id: string
  meeting_prep_id: string | null
  prospect_id: string | null
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
  include_coaching: boolean
  commercial_signals: {
    koopsignalen: string[]
    cross_sell: string[]
    risks: string[]
  } | null
  observations: {
    doubts: string[]
    unspoken_needs: string[]
    opportunities: string[]
    red_flags: string[]
  } | null
  coaching_feedback: {
    strengths: string[]
    improvements: string[]
    tips: string[]
  } | null
  full_summary_content: string | null
}

interface ResearchBrief {
  id: string
  company_name: string
  completed_at: string
}

interface MeetingPrep {
  id: string
  prospect_company_name: string
  meeting_type: string
  completed_at: string
}

export default function FollowupDetailPage() {
  const router = useRouter()
  const params = useParams()
  const followupId = params.id as string
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  
  const [user, setUser] = useState<any>(null)
  const [followup, setFollowup] = useState<Followup | null>(null)
  const [loading, setLoading] = useState(true)
  const [emailDraft, setEmailDraft] = useState('')
  const [regeneratingEmail, setRegeneratingEmail] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [researchBrief, setResearchBrief] = useState<ResearchBrief | null>(null)
  const [meetingPrep, setMeetingPrep] = useState<MeetingPrep | null>(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
  }, [supabase])

  const fetchFollowup = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/followup/${followupId}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      )

      if (response.ok) {
        const data = await response.json()
        setFollowup(data)
        setEmailDraft(data.email_draft || '')
        
        // Fetch related research and prep
        if (data.prospect_company_name) {
          fetchRelatedData(data.prospect_company_name, session.access_token)
        }
      } else {
        toast({ title: 'Follow-up niet gevonden', variant: 'destructive' })
        router.push('/dashboard/followup')
      }
    } catch (error) {
      console.error('Error fetching followup:', error)
    } finally {
      setLoading(false)
    }
  }, [followupId, supabase, router, toast])

  const fetchRelatedData = async (companyName: string, token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      
      // Fetch research briefs
      const researchRes = await fetch(`${apiUrl}/api/v1/research/briefs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (researchRes.ok) {
        const data = await researchRes.json()
        const brief = data.briefs?.find((b: any) => 
          b.company_name.toLowerCase() === companyName.toLowerCase() && b.status === 'completed'
        )
        if (brief) setResearchBrief(brief)
      }

      // Fetch meeting preps
      const prepRes = await fetch(`${apiUrl}/api/v1/prep/briefs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (prepRes.ok) {
        const data = await prepRes.json()
        const prep = data.preps?.find((p: any) => 
          p.prospect_company_name.toLowerCase() === companyName.toLowerCase() && p.status === 'completed'
        )
        if (prep) setMeetingPrep(prep)
      }
    } catch (error) {
      console.error('Error fetching related data:', error)
    }
  }

  useEffect(() => {
    fetchFollowup()
    
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
      toast({ title: 'Regenereren mislukt', variant: 'destructive' })
    } finally {
      setRegeneratingEmail(false)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <Icons.spinner className="h-8 w-8 animate-spin text-orange-600 mx-auto" />
            <p className="text-slate-500 dark:text-slate-400">Follow-up laden...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!followup) return null

  const isProcessing = ['uploading', 'transcribing', 'summarizing'].includes(followup.status)
  const hasCommercialSignals = followup.commercial_signals && (
    followup.commercial_signals.koopsignalen?.length > 0 ||
    followup.commercial_signals.cross_sell?.length > 0 ||
    followup.commercial_signals.risks?.length > 0
  )
  const hasObservations = followup.observations && (
    followup.observations.doubts?.length > 0 ||
    followup.observations.unspoken_needs?.length > 0 ||
    followup.observations.opportunities?.length > 0 ||
    followup.observations.red_flags?.length > 0
  )
  const hasCoaching = followup.include_coaching && followup.coaching_feedback && (
    followup.coaching_feedback.strengths?.length > 0 ||
    followup.coaching_feedback.improvements?.length > 0 ||
    followup.coaching_feedback.tips?.length > 0
  )

  return (
    <DashboardLayout user={user}>
      <>
        <div className="p-4 lg:p-6">
          {/* Page Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard/followup')}
            >
              <Icons.arrowLeft className="h-4 w-4 mr-2" />
              Terug
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {followup.prospect_company_name || followup.meeting_subject || 'Meeting Follow-up'}
              </h1>
              <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                {followup.meeting_date && (
                  <span>{new Date(followup.meeting_date).toLocaleDateString('nl-NL')}</span>
                )}
                {followup.audio_duration_seconds && (
                  <span className="flex items-center gap-1">
                    <Icons.clock className="h-3 w-3" />
                    {formatDuration(followup.audio_duration_seconds)}
                  </span>
                )}
                {followup.speaker_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Icons.users className="h-3 w-3" />
                    {followup.speaker_count} sprekers
                  </span>
                )}
              </div>
            </div>
            {isProcessing && (
              <div className="ml-auto flex items-center gap-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-2 rounded-lg">
                <Icons.spinner className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">
                  {followup.status === 'transcribing' ? 'Transcriberen...' : 
                   followup.status === 'summarizing' ? 'Samenvatten...' : 'Verwerken...'}
                </span>
              </div>
            )}
          </div>

          {/* Error State */}
          {followup.status === 'failed' && (
            <div className="mb-6 p-4 rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <Icons.alertCircle className="h-5 w-5" />
                <span className="font-medium">Verwerking mislukt</span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{followup.error_message}</p>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-sm">
              <Icons.spinner className="h-16 w-16 text-orange-600 mx-auto mb-4 animate-spin" />
              <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">
                {followup.status === 'transcribing' ? 'Audio wordt getranscribeerd...' :
                 followup.status === 'summarizing' ? 'Samenvatting wordt gegenereerd...' :
                 'Bestand wordt verwerkt...'}
              </h3>
              <p className="text-slate-500 dark:text-slate-400">Dit kan enkele minuten duren</p>
            </div>
          )}

          {/* Main Content - Two Column Layout */}
          {followup.status === 'completed' && (
            <div className="flex gap-6">
              {/* Left Column - Main Content */}
              <div className="flex-1 min-w-0 space-y-6">
                
                {/* Executive Summary */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
                      <Icons.fileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      Samenvatting
                    </h2>
                    <Button variant="outline" size="sm" onClick={() => handleCopy(
                      `${followup.executive_summary}\n\nBelangrijkste punten:\n${followup.key_points?.map(p => `• ${p}`).join('\n')}\n\nVervolgstappen:\n${followup.next_steps?.map(s => `• ${s}`).join('\n')}`,
                      'summary'
                    )}>
                      <Icons.copy className="h-4 w-4 mr-1" />
                      {copied === 'summary' ? 'Gekopieerd!' : 'Kopieer'}
                    </Button>
                  </div>
                  
                  {followup.executive_summary && (
                    <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-lg mb-4">
                      <p className="text-sm text-slate-700 dark:text-slate-300">{followup.executive_summary}</p>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Key Points */}
                    {followup.key_points?.length > 0 && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-1">
                          💡 Belangrijkste Punten
                        </h4>
                        <ul className="space-y-1">
                          {followup.key_points.map((point, i) => (
                            <li key={i} className="text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
                              <span>•</span>{point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Concerns */}
                    {followup.concerns?.length > 0 && (
                      <div className="p-4 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                        <h4 className="font-semibold text-sm text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-1">
                          ⚠️ Bezwaren & Zorgen
                        </h4>
                        <ul className="space-y-1">
                          {followup.concerns.map((concern, i) => (
                            <li key={i} className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                              <span>•</span>{concern}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Decisions */}
                    {followup.decisions?.length > 0 && (
                      <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg">
                        <h4 className="font-semibold text-sm text-green-800 dark:text-green-200 mb-2 flex items-center gap-1">
                          ✅ Beslissingen
                        </h4>
                        <ul className="space-y-1">
                          {followup.decisions.map((decision, i) => (
                            <li key={i} className="text-sm text-green-700 dark:text-green-300 flex items-start gap-2">
                              <span>•</span>{decision}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Next Steps */}
                    {followup.next_steps?.length > 0 && (
                      <div className="p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                        <h4 className="font-semibold text-sm text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-1">
                          ➡️ Vervolgstappen
                        </h4>
                        <ul className="space-y-1">
                          {followup.next_steps.map((step, i) => (
                            <li key={i} className="text-sm text-purple-700 dark:text-purple-300 flex items-start gap-2">
                              <span>•</span>{step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Commercial Signals */}
                {hasCommercialSignals && (
                  <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 p-6 shadow-sm">
                    <h2 className="font-bold text-lg flex items-center gap-2 mb-4 text-slate-900 dark:text-white">
                      <Icons.trendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      💰 Commerciële Signalen
                    </h2>
                    <div className="grid gap-4 md:grid-cols-3">
                      {followup.commercial_signals?.koopsignalen && followup.commercial_signals.koopsignalen.length > 0 && (
                        <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg">
                          <h4 className="font-semibold text-sm text-green-700 dark:text-green-400 mb-2">✓ Koopsignalen</h4>
                          <ul className="space-y-1">
                            {followup.commercial_signals.koopsignalen.map((s, i) => (
                              <li key={i} className="text-xs text-slate-700 dark:text-slate-300">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {followup.commercial_signals?.cross_sell && followup.commercial_signals.cross_sell.length > 0 && (
                        <div className="bg-white/60 dark:bg-slate-800/60 p-4 rounded-lg">
                          <h4 className="font-semibold text-sm text-blue-700 dark:text-blue-400 mb-2">💡 Cross/Upsell</h4>
                          <ul className="space-y-1">
                            {followup.commercial_signals.cross_sell.map((s, i) => (
                              <li key={i} className="text-xs text-slate-700 dark:text-slate-300">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {followup.commercial_signals?.risks && followup.commercial_signals.risks.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-sm text-red-700 dark:text-red-400 mb-2">⚠️ Risico's</h4>
                          <ul className="space-y-1">
                            {followup.commercial_signals.risks.map((s, i) => (
                              <li key={i} className="text-xs text-red-700 dark:text-red-400">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Observations */}
                {hasObservations && (
                  <div className="rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 p-6 shadow-sm">
                    <h2 className="font-bold text-lg flex items-center gap-2 mb-4 text-slate-900 dark:text-white">
                      <Icons.search className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      🔎 Observaties & Signalen
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      {followup.observations?.doubts && followup.observations.doubts.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-sm text-amber-700 dark:text-amber-400 mb-2">⚠️ Twijfel</h4>
                          <ul className="space-y-1">
                            {followup.observations.doubts.map((d, i) => (
                              <li key={i} className="text-xs text-slate-700 dark:text-slate-300">{d}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {followup.observations?.unspoken_needs && followup.observations.unspoken_needs.length > 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-sm text-yellow-700 dark:text-yellow-400 mb-2">💡 Onuitgesproken</h4>
                          <ul className="space-y-1">
                            {followup.observations.unspoken_needs.map((n, i) => (
                              <li key={i} className="text-xs text-slate-700 dark:text-slate-300">{n}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {followup.observations?.opportunities && followup.observations.opportunities.length > 0 && (
                        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-sm text-green-700 dark:text-green-400 mb-2">🎯 Kansen</h4>
                          <ul className="space-y-1">
                            {followup.observations.opportunities.map((o, i) => (
                              <li key={i} className="text-xs text-slate-700 dark:text-slate-300">{o}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {followup.observations?.red_flags && followup.observations.red_flags.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-sm text-red-700 dark:text-red-400 mb-2">🚩 Rode Vlaggen</h4>
                          <ul className="space-y-1">
                            {followup.observations.red_flags.map((f, i) => (
                              <li key={i} className="text-xs text-red-700 dark:text-red-400">{f}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Coaching Feedback */}
                {hasCoaching && (
                  <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950 p-6 shadow-sm">
                    <h2 className="font-bold text-lg flex items-center gap-2 mb-4 text-slate-900 dark:text-white">
                      <Icons.sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      📈 Coaching Feedback
                    </h2>
                    <div className="grid gap-4 md:grid-cols-3">
                      {followup.coaching_feedback?.strengths && followup.coaching_feedback.strengths.length > 0 && (
                        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-sm text-green-700 dark:text-green-400 mb-2">✅ Goed</h4>
                          <ul className="space-y-1">
                            {followup.coaching_feedback.strengths.map((s, i) => (
                              <li key={i} className="text-xs text-slate-700 dark:text-slate-300">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {followup.coaching_feedback?.improvements && followup.coaching_feedback.improvements.length > 0 && (
                        <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-sm text-orange-700 dark:text-orange-400 mb-2">🔧 Verbeter</h4>
                          <ul className="space-y-1">
                            {followup.coaching_feedback.improvements.map((item, idx) => (
                              <li key={idx} className="text-xs text-slate-700 dark:text-slate-300">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {followup.coaching_feedback?.tips && followup.coaching_feedback.tips.length > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
                          <h4 className="font-semibold text-sm text-blue-700 dark:text-blue-400 mb-2">💡 Tips</h4>
                          <ul className="space-y-1">
                            {followup.coaching_feedback.tips.map((t, i) => (
                              <li key={i} className="text-xs text-slate-700 dark:text-slate-300">{t}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Follow-up Email */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
                      <Icons.mail className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      Follow-up Email
                    </h2>
                    <Button variant="outline" size="sm" onClick={() => handleCopy(emailDraft, 'email')}>
                      <Icons.copy className="h-4 w-4 mr-1" />
                      {copied === 'email' ? 'Gekopieerd!' : 'Kopieer'}
                    </Button>
                  </div>
                  
                  <Textarea
                    value={emailDraft}
                    onChange={(e) => setEmailDraft(e.target.value)}
                    rows={10}
                    className="font-mono text-sm mb-4 dark:bg-slate-800 dark:border-slate-700"
                  />
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Toon:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerateEmail('professional')}
                      disabled={regeneratingEmail}
                      className="h-7 text-xs"
                    >
                      {regeneratingEmail ? <Icons.spinner className="h-3 w-3 animate-spin" /> : 'Professioneel'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerateEmail('casual')}
                      disabled={regeneratingEmail}
                      className="h-7 text-xs"
                    >
                      Informeel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRegenerateEmail('formal')}
                      disabled={regeneratingEmail}
                      className="h-7 text-xs"
                    >
                      Formeel
                    </Button>
                  </div>
                </div>

                {/* Transcription (collapsible) */}
                {followup.transcription_text && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                    <button
                      className="w-full p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={() => setShowTranscript(!showTranscript)}
                    >
                      <h2 className="font-bold text-lg flex items-center gap-2 text-slate-900 dark:text-white">
                        <Icons.fileText className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        Transcriptie
                      </h2>
                      {showTranscript ? <Icons.chevronDown className="h-5 w-5 text-slate-500" /> : <Icons.chevronRight className="h-5 w-5 text-slate-500" />}
                    </button>
                    {showTranscript && (
                      <div className="p-4 pt-0 border-t dark:border-slate-800">
                        <div className="max-h-96 overflow-y-auto bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                          <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans">
                            {followup.transcription_text}
                          </pre>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3"
                          onClick={() => handleCopy(followup.transcription_text || '', 'transcript')}
                        >
                          <Icons.copy className="h-4 w-4 mr-1" />
                          {copied === 'transcript' ? 'Gekopieerd!' : 'Kopieer Transcriptie'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column - Sticky Sidebar */}
              <div className="w-80 flex-shrink-0 hidden lg:block">
                <div className="sticky top-4 space-y-4">
                  
                  {/* Meeting Info */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Icons.calendar className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      Meeting Info
                    </h3>
                    <div className="space-y-2 text-sm">
                      {followup.meeting_date && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Datum</span>
                          <span className="font-medium text-slate-900 dark:text-white">{new Date(followup.meeting_date).toLocaleDateString('nl-NL')}</span>
                        </div>
                      )}
                      {followup.audio_duration_seconds && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Duur</span>
                          <span className="font-medium text-slate-900 dark:text-white">{formatDuration(followup.audio_duration_seconds)}</span>
                        </div>
                      )}
                      {followup.speaker_count > 0 && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400">Sprekers</span>
                          <span className="font-medium text-slate-900 dark:text-white">{followup.speaker_count}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Items */}
                  {followup.action_items?.length > 0 && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                        <Icons.check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Actie Items ({followup.action_items.length})
                      </h3>
                      <div className="space-y-2">
                        {followup.action_items.slice(0, 5).map((item, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                              item.priority === 'high' ? 'bg-red-500' :
                              item.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                            }`} />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-slate-900 dark:text-white">{item.task}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {item.assignee || 'TBD'} {item.due_date && `• ${item.due_date}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Related Research */}
                  {researchBrief && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                        <Icons.search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        Gekoppelde Research
                      </h3>
                      <button
                        onClick={() => router.push(`/dashboard/research/${researchBrief.id}`)}
                        className="w-full p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-left group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm text-blue-900 dark:text-blue-100">{researchBrief.company_name}</p>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              {new Date(researchBrief.completed_at).toLocaleDateString('nl-NL')}
                            </p>
                          </div>
                          <Icons.chevronRight className="h-4 w-4 text-blue-600 dark:text-blue-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Related Preparation */}
                  {meetingPrep && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                        <Icons.fileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                        Gekoppelde Voorbereiding
                      </h3>
                      <button
                        onClick={() => router.push(`/dashboard/preparation/${meetingPrep.id}`)}
                        className="w-full p-3 bg-green-50 dark:bg-green-900/30 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors text-left group"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm text-green-900 dark:text-green-100">{meetingPrep.prospect_company_name}</p>
                            <p className="text-xs text-green-600 dark:text-green-400">
                              {meetingPrep.meeting_type} • {new Date(meetingPrep.completed_at).toLocaleDateString('nl-NL')}
                            </p>
                          </div>
                          <Icons.chevronRight className="h-4 w-4 text-green-600 dark:text-green-400 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Audio Player */}
                  {followup.audio_url && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                        <Icons.mic className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                        Audio
                      </h3>
                      <audio controls className="w-full h-10">
                        <source src={followup.audio_url} />
                      </audio>
                    </div>
                  )}

                  {/* CTA - New Research */}
                  <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <Icons.arrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      Volgende Prospect?
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                      Start een nieuwe research voor je volgende prospect.
                    </p>
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                      onClick={() => router.push('/dashboard/research')}
                    >
                      <Icons.search className="h-4 w-4 mr-2" />
                      Nieuwe Research
                    </Button>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      
        <Toaster />
      </>
    </DashboardLayout>
  )
}
