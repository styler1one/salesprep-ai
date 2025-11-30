'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import ReactMarkdown from 'react-markdown'
import { useTranslations } from 'next-intl'

interface MeetingPrep {
  id: string
  prospect_id?: string
  prospect_company_name: string
  meeting_type: string
  status: string
  custom_notes?: string
  brief_content?: string
  talking_points?: any[]
  questions?: string[]
  strategy?: string
  pdf_url?: string
  created_at: string
  completed_at?: string
  error_message?: string
  contact_ids?: string[]
}

interface ProfileStatus {
  hasSalesProfile: boolean
  hasCompanyProfile: boolean
}

interface ResearchBrief {
  id: string
  company_name: string
  completed_at: string
}

interface ProspectContact {
  id: string
  name: string
  role?: string
  linkedin_url?: string
  communication_style?: string
  decision_authority?: string
}

export default function PreparationDetailPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const t = useTranslations('preparation')
  const tCommon = useTranslations('common')
  
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [prep, setPrep] = useState<MeetingPrep | null>(null)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>({ hasSalesProfile: false, hasCompanyProfile: false })
  const [researchBrief, setResearchBrief] = useState<ResearchBrief | null>(null)
  const [linkedContacts, setLinkedContacts] = useState<ProspectContact[]>([])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        fetchPrep()
        fetchProfileStatus()
      } else {
        router.push('/login')
      }
    }
    getUser()
  }, [supabase, params.id])

  const fetchProfileStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      
      const [salesRes, companyRes] = await Promise.all([
        fetch(`${apiUrl}/api/v1/profile/sales`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }),
        fetch(`${apiUrl}/api/v1/profile/company`, {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
      ])

      setProfileStatus({
        hasSalesProfile: salesRes.ok && (await salesRes.json())?.full_name,
        hasCompanyProfile: companyRes.ok && (await companyRes.json())?.company_name
      })
    } catch (error) {
      console.error('Failed to fetch profile status:', error)
    }
  }

  const fetchPrep = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/prep/${params.id}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setPrep(data)
        
        // Try to find the research brief for this company
        if (data.prospect_company_name) {
          fetchResearchBrief(data.prospect_company_name, session.access_token)
        }
        
        // Fetch linked contacts
        if (data.contact_ids && data.contact_ids.length > 0) {
          fetchLinkedContacts(data.contact_ids, session.access_token)
        }
      } else {
        toast({
          variant: "destructive",
          title: "Kon voorbereiding niet laden",
          description: "Er is een fout opgetreden",
        })
        router.push('/dashboard/preparation')
      }
    } catch (error) {
      console.error('Failed to fetch prep:', error)
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Er is een fout opgetreden",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchResearchBrief = async (companyName: string, token: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/research/briefs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        const brief = data.briefs?.find((b: any) => 
          b.company_name.toLowerCase() === companyName.toLowerCase() && b.status === 'completed'
        )
        if (brief) {
          setResearchBrief(brief)
        }
      }
    } catch (error) {
      console.error('Failed to fetch research brief:', error)
    }
  }

  const fetchLinkedContacts = async (contactIds: string[], token: string) => {
    if (!contactIds || contactIds.length === 0) return
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/contacts?ids=${contactIds.join(',')}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        // API returns { contacts: [], count: number }
        setLinkedContacts(data.contacts || [])
      }
    } catch (error) {
      console.error('Failed to fetch linked contacts:', error)
    }
  }

  const handleStartFollowup = () => {
    if (prep) {
      sessionStorage.setItem('followupForCompany', prep.prospect_company_name)
    }
    router.push('/dashboard/followup')
  }

  const getMeetingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      discovery: '🔍 Discovery Call',
      demo: '🖥️ Product Demo',
      closing: '🤝 Closing Call',
      follow_up: '📞 Follow-up Meeting',
      other: '📋 Anders'
    }
    return labels[type] || type
  }

  const getMeetingTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      discovery: '🔍',
      demo: '🖥️',
      closing: '🤝',
      follow_up: '📞',
      other: '📋'
    }
    return icons[type] || '📋'
  }

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <Icons.spinner className="h-8 w-8 animate-spin text-green-600 mx-auto" />
            <p className="text-slate-500 dark:text-slate-400">{t('loading')}</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!prep) {
    return null
  }

  return (
    <DashboardLayout user={user}>
      <>
        <div className="p-4 lg:p-6">
          {/* Page Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard/preparation')}
            >
              <Icons.arrowLeft className="h-4 w-4 mr-2" />
              Terug
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{prep.prospect_company_name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {getMeetingTypeLabel(prep.meeting_type)} • {new Date(prep.completed_at || prep.created_at).toLocaleDateString('nl-NL')}
              </p>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="flex gap-6">
            {/* Left Column - Brief Content (scrollable) */}
            <div className="flex-1 min-w-0">
              {prep.status === 'completed' && prep.brief_content ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 lg:p-8 shadow-sm">
                  <div className="flex justify-end mb-4">
                    <Button variant="outline" size="sm" onClick={() => {
                      navigator.clipboard.writeText(prep.brief_content || '')
                      toast({
                        title: "Gekopieerd!",
                        description: "Voorbereiding is naar het klembord gekopieerd",
                      })
                    }}>
                      <Icons.copy className="h-4 w-4 mr-2" />
                      Kopieer Brief
                    </Button>
                  </div>
                  
                  <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-20">
                    <ReactMarkdown
                      components={{
                        h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-8 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-6 mb-3 text-slate-900 dark:text-white" {...props} />,
                        p: ({ node, ...props }) => <p className="mb-4 leading-relaxed text-slate-700 dark:text-slate-300" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 space-y-2" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 space-y-2" {...props} />,
                        li: ({ node, ...props }) => <li className="ml-4 text-slate-700 dark:text-slate-300" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-semibold text-slate-900 dark:text-white" {...props} />,
                        table: ({ node, ...props }) => (
                          <div className="overflow-x-auto my-4">
                            <table className="min-w-full border-collapse border border-slate-200 dark:border-slate-700" {...props} />
                          </div>
                        ),
                        th: ({ node, ...props }) => <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-800 text-left font-semibold text-slate-900 dark:text-white" {...props} />,
                        td: ({ node, ...props }) => <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-700 dark:text-slate-300" {...props} />,
                      }}
                    >
                      {prep.brief_content}
                    </ReactMarkdown>
                  </div>

                  {prep.questions && prep.questions.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
                      <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
                        <Icons.message className="h-5 w-5 text-green-600 dark:text-green-400" />
                        Discovery Vragen
                      </h3>
                      <div className="space-y-3">
                        {prep.questions.map((q, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                            <span className="font-bold text-green-600 dark:text-green-400 min-w-[24px]">{i + 1}.</span>
                            <span className="text-slate-700 dark:text-slate-300">{q}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : prep.status === 'failed' ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm text-center">
                  <Icons.alertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                  <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">{t('toast.failed')}</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">{prep.error_message || 'Er is een fout opgetreden'}</p>
                  <Button onClick={() => router.push('/dashboard/preparation')}>
                    Probeer Opnieuw
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm text-center">
                  <Icons.spinner className="h-16 w-16 text-green-600 mx-auto mb-4 animate-spin" />
                  <h3 className="font-bold text-lg mb-2 text-slate-900 dark:text-white">{t('form.generating')}</h3>
                  <p className="text-slate-500 dark:text-slate-400">{t('toast.startedDesc')}</p>
                </div>
              )}
            </div>

            {/* Right Column - Sticky Sidebar */}
            <div className="w-80 flex-shrink-0 hidden lg:block">
              <div className="sticky top-4 space-y-4">
                
                {/* Meeting Type Badge */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{getMeetingTypeIcon(prep.meeting_type)}</span>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{getMeetingTypeLabel(prep.meeting_type).replace(/^[^\s]+\s/, '')}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(prep.completed_at || prep.created_at).toLocaleDateString('nl-NL', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Context Panel */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-4 shadow-sm">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Icons.sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
                    {t('context.title')}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                    {t('context.description')}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      {profileStatus.hasSalesProfile ? (
                        <Icons.check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Icons.circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                      )}
                      <span className={profileStatus.hasSalesProfile ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}>
                        {t('context.salesProfile')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {profileStatus.hasCompanyProfile ? (
                        <Icons.check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Icons.circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                      )}
                      <span className={profileStatus.hasCompanyProfile ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}>
                        {t('context.companyProfile')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {researchBrief ? (
                        <Icons.check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Icons.circle className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                      )}
                      <span className={researchBrief ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}>
                        {t('detail.researchBrief')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Icons.check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-slate-700 dark:text-slate-200">{t('detail.meetingContext')}</span>
                    </div>
                  </div>
                </div>

                {/* Research Link */}
                {researchBrief && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <Icons.search className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      {t('detail.linkedResearch')}
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

                {/* Linked Contacts */}
                {linkedContacts.length > 0 && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <Icons.user className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      {t('detail.linkedContact')}
                    </h3>
                    <div className="space-y-2">
                      {linkedContacts.map((contact) => (
                        <button
                          key={contact.id}
                          onClick={() => researchBrief && router.push(`/dashboard/research/${researchBrief.id}#contacts`)}
                          className="w-full p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors text-left group"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm text-purple-900 dark:text-purple-100">{contact.name}</p>
                              {contact.role && (
                                <p className="text-xs text-purple-600 dark:text-purple-400">{contact.role}</p>
                              )}
                              {contact.communication_style && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  💬 {contact.communication_style}
                                </p>
                              )}
                              {contact.decision_authority && (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  🎯 {contact.decision_authority}
                                </p>
                              )}
                            </div>
                            <Icons.chevronRight className="h-4 w-4 text-purple-600 dark:text-purple-400 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Notes */}
                {prep.custom_notes && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <Icons.fileText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      {t('detail.yourNotes')}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      {prep.custom_notes}
                    </p>
                  </div>
                )}

                {/* CTA Panel - Follow-up */}
                <div className="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950 p-4 shadow-sm">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <Icons.arrowRight className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    {t('nextStep.title')}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                    {t('nextStep.description')}
                  </p>
                  <Button 
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    onClick={handleStartFollowup}
                  >
                    <Icons.mic className="h-4 w-4 mr-2" />
                    {t('nextStep.button')}
                  </Button>
                </div>

                {/* Quick Actions */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3 text-sm">{t('detail.quickActions')}</h3>
                  <div className="space-y-2">
                    {prep.pdf_url && (
                      <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                        <a href={prep.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Icons.download className="h-4 w-4 mr-2" />
                          {tCommon('download')}
                        </a>
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full justify-start"
                      onClick={() => {
                        navigator.clipboard.writeText(prep.brief_content || '')
                        toast({ title: tCommon('copied') })
                      }}
                    >
                      <Icons.copy className="h-4 w-4 mr-2" />
                      {t('brief.copyAll')}
                    </Button>
                    {researchBrief && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full justify-start"
                        onClick={() => router.push(`/dashboard/research/${researchBrief.id}`)}
                      >
                        <Icons.search className="h-4 w-4 mr-2" />
                        {t('brief.viewResearch')}
                      </Button>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Mobile: Floating Action Button */}
          <div className="lg:hidden fixed bottom-6 right-6">
            <Button 
              className="rounded-full h-14 w-14 shadow-lg bg-orange-600 hover:bg-orange-700"
              onClick={handleStartFollowup}
            >
              <Icons.mic className="h-6 w-6" />
            </Button>
          </div>

        </div>
      
        <Toaster />
      </>
    </DashboardLayout>
  )
}
