'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Icons } from '@/components/icons'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { DashboardLayout } from '@/components/layout'
import { ProspectAutocomplete } from '@/components/prospect-autocomplete'
import { useTranslations } from 'next-intl'

interface MeetingPrep {
  id: string
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
}

interface Contact {
  id: string
  name: string
  role?: string
  decision_authority?: string
  communication_style?: string
  analyzed_at?: string
}

export default function PreparationPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const t = useTranslations('preparation')

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [preps, setPreps] = useState<MeetingPrep[]>([])
  const [initialLoading, setInitialLoading] = useState(true)

  // Form state
  const [companyName, setCompanyName] = useState('')
  const [meetingType, setMeetingType] = useState('discovery')
  const [customNotes, setCustomNotes] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  // Contact persons state
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()
    loadPreps()

    // Check for pre-selected company from Research page
    const prepareFor = sessionStorage.getItem('prepareForCompany')
    if (prepareFor) {
      setCompanyName(prepareFor)
      sessionStorage.removeItem('prepareForCompany')
    }

    // Poll for status updates
    const interval = setInterval(() => {
      if (preps.some(p => p.status === 'pending' || p.status === 'generating')) {
        loadPreps()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [supabase])

  const loadPreps = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/prep/briefs`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setPreps(data.preps || [])
      }
    } catch (error) {
      console.error('Failed to load preps:', error)
    } finally {
      setInitialLoading(false)
    }
  }

  // Load contacts when company name changes
  const loadContactsForProspect = async (prospectName: string) => {
    if (!prospectName || prospectName.length < 2) {
      setAvailableContacts([])
      setSelectedContactIds([])
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setContactsLoading(true)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      
      const prospectResponse = await fetch(
        `${apiUrl}/api/v1/prospects/search?q=${encodeURIComponent(prospectName)}`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      )

      if (prospectResponse.ok) {
        const prospects = await prospectResponse.json()
        const exactMatch = prospects.find(
          (p: any) => p.company_name.toLowerCase() === prospectName.toLowerCase()
        )

        if (exactMatch) {
          const contactsResponse = await fetch(
            `${apiUrl}/api/v1/prospects/${exactMatch.id}/contacts`,
            { headers: { 'Authorization': `Bearer ${session.access_token}` } }
          )

          if (contactsResponse.ok) {
            const data = await contactsResponse.json()
            setAvailableContacts(data.contacts || [])
          }
        } else {
          setAvailableContacts([])
        }
      }
    } catch (error) {
      console.error('Failed to load contacts:', error)
      setAvailableContacts([])
    } finally {
      setContactsLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadContactsForProspect(companyName)
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [companyName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast({ title: 'Fout', description: 'Niet ingelogd', variant: 'destructive' })
        return
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/prep/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prospect_company_name: companyName,
          meeting_type: meetingType,
          custom_notes: customNotes || null,
          contact_ids: selectedContactIds.length > 0 ? selectedContactIds : null
        })
      })

      if (response.ok) {
        toast({ title: 'Gestart', description: 'Voorbereiding wordt gegenereerd...' })
        setCompanyName('')
        setCustomNotes('')
        setSelectedContactIds([])
        setAvailableContacts([])
        setShowAdvanced(false)
        loadPreps()
      } else {
        const error = await response.json()
        toast({ title: 'Fout', description: error.detail || 'Kon niet starten', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Fout', description: 'Kon niet starten', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const viewPrep = (prepId: string) => {
    router.push(`/dashboard/preparation/${prepId}`)
  }

  const deletePrep = async (prepId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Weet je zeker dat je deze voorbereiding wilt verwijderen?')) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(`${apiUrl}/api/v1/prep/${prepId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })

      if (response.ok) {
        toast({ title: 'Verwijderd' })
        loadPreps()
      }
    } catch (error) {
      toast({ title: 'Fout', description: 'Kon niet verwijderen', variant: 'destructive' })
    }
  }

  const getMeetingTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      discovery: '🔍 Discovery Call',
      demo: '🖥️ Product Demo',
      closing: '🤝 Closing Call',
      follow_up: '📞 Follow-up',
      other: '📋 Anders'
    }
    return labels[type] || type
  }

  const completedPreps = preps.filter(p => p.status === 'completed').length
  const processingPreps = preps.filter(p => p.status === 'pending' || p.status === 'generating').length

  return (
    <DashboardLayout user={user}>
      <div className="p-4 lg:p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
            Preparation Agent
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            AI-gegenereerde meeting briefs met context van je profiel en research
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="flex gap-6">
          
          {/* Left Column - Preparations History */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Icons.fileText className="h-5 w-5 text-slate-400" />
                Mijn Voorbereidingen
                <span className="text-sm font-normal text-slate-400">({preps.length})</span>
              </h2>
              <Button variant="ghost" size="sm" onClick={loadPreps}>
                <Icons.refresh className="h-4 w-4" />
              </Button>
            </div>

            {preps.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                <Icons.fileText className="h-16 w-16 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-2">Nog geen voorbereidingen</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                  Genereer je eerste meeting brief via het formulier rechts →
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {preps.map((prep) => (
                  <div
                    key={prep.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:shadow-md dark:hover:shadow-slate-800/50 transition-all cursor-pointer group hover:border-green-300 dark:hover:border-green-700"
                    onClick={() => prep.status === 'completed' && viewPrep(prep.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900 dark:text-white truncate">{prep.prospect_company_name}</h4>
                          
                          {prep.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/50 text-green-700 dark:text-green-400 flex-shrink-0">
                              <Icons.check className="h-3 w-3" />
                              Klaar
                            </span>
                          )}
                          {(prep.status === 'generating' || prep.status === 'pending') && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 flex-shrink-0">
                              <Icons.spinner className="h-3 w-3 animate-spin" />
                              Bezig...
                            </span>
                          )}
                          {prep.status === 'failed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-400 flex-shrink-0">
                              <Icons.alertCircle className="h-3 w-3" />
                              Mislukt
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span>{getMeetingTypeLabel(prep.meeting_type)}</span>
                          <span>•</span>
                          <span>{new Date(prep.created_at).toLocaleDateString('nl-NL')}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 ml-4">
                        {prep.status === 'completed' && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 text-xs bg-green-600 hover:bg-green-700 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                viewPrep(prep.id)
                              }}
                            >
                              <Icons.eye className="h-3 w-3 mr-1" />
                              Bekijk
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                sessionStorage.setItem('followupForCompany', prep.prospect_company_name)
                                router.push('/dashboard/followup')
                              }}
                            >
                              <Icons.mic className="h-3 w-3 mr-1" />
                              Follow-up
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => deletePrep(prep.id, e)}
                        >
                          <Icons.trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column - Sticky Sidebar */}
          <div className="w-80 flex-shrink-0 hidden lg:block">
            <div className="sticky top-4 space-y-4">
              
              {/* Stats Panel */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Icons.barChart className="h-4 w-4 text-slate-400" />
                  Overzicht
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedPreps}</p>
                    <p className="text-xs text-green-700 dark:text-green-300">Voltooid</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{processingPreps}</p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">Bezig</p>
                  </div>
                </div>
              </div>

              {/* New Preparation Form */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Icons.fileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Nieuwe Voorbereiding
                </h3>
                
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <Label htmlFor="company" className="text-xs text-slate-700 dark:text-slate-300">Prospect *</Label>
                    <ProspectAutocomplete
                      value={companyName}
                      onChange={setCompanyName}
                      placeholder="Zoek bedrijf..."
                    />
                  </div>

                  <div>
                    <Label className="text-xs text-slate-700 dark:text-slate-300">Meeting Type *</Label>
                    <Select value={meetingType} onValueChange={setMeetingType}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="discovery">🔍 Discovery</SelectItem>
                        <SelectItem value="demo">🖥️ Demo</SelectItem>
                        <SelectItem value="closing">🤝 Closing</SelectItem>
                        <SelectItem value="follow_up">📞 Follow-up</SelectItem>
                        <SelectItem value="other">📋 Anders</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Contact Persons */}
                  {availableContacts.length > 0 && (
                    <div>
                      <Label className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        👥 Contactpersonen
                        <span className="text-slate-400 dark:text-slate-500 font-normal">(optioneel)</span>
                      </Label>
                      <div className="mt-1 space-y-1 max-h-32 overflow-y-auto p-2 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800">
                        {availableContacts.map((contact) => {
                          const isSelected = selectedContactIds.includes(contact.id)
                          return (
                            <label
                              key={contact.id}
                              className={`flex items-center gap-2 p-1.5 rounded cursor-pointer text-xs ${
                                isSelected ? 'bg-green-100 dark:bg-green-900/50' : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedContactIds(prev => [...prev, contact.id])
                                  } else {
                                    setSelectedContactIds(prev => prev.filter(id => id !== contact.id))
                                  }
                                }}
                                className="rounded border-gray-300 dark:border-gray-600"
                              />
                              <span className="truncate text-slate-900 dark:text-white">{contact.name}</span>
                              {contact.decision_authority === 'decision_maker' && (
                                <span className="text-xs bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300 px-1 rounded">DM</span>
                              )}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {contactsLoading && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Icons.spinner className="h-3 w-3 animate-spin" />
                      Contacten laden...
                    </div>
                  )}

                  {/* Advanced toggle */}
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1"
                  >
                    {showAdvanced ? <Icons.chevronDown className="h-3 w-3" /> : <Icons.chevronRight className="h-3 w-3" />}
                    Extra context
                  </button>

                  {showAdvanced && (
                    <div>
                      <Label htmlFor="notes" className="text-xs text-slate-700 dark:text-slate-300">Notities</Label>
                      <Textarea
                        id="notes"
                        value={customNotes}
                        onChange={(e) => setCustomNotes(e.target.value)}
                        placeholder="Specifieke aandachtspunten..."
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    disabled={loading || !companyName}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {loading ? (
                      <>
                        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                        Genereren...
                      </>
                    ) : (
                      <>
                        <Icons.zap className="mr-2 h-4 w-4" />
                        Genereer Brief
                      </>
                    )}
                  </Button>
                </form>
              </div>

              {/* How it works Panel */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-4 shadow-sm">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Icons.sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Wat krijg je?
                </h3>
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-start gap-2">
                    <Icons.check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Gepersonaliseerde gespreksopeners</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icons.check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Relevante discovery vragen</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icons.check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Bezwaren & responses</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icons.check className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                    <span>Klantgerichte value props</span>
                  </li>
                </ul>
              </div>

            </div>
          </div>
        </div>

        <Toaster />
      </div>
    </DashboardLayout>
  )
}
