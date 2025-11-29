'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import ReactMarkdown from 'react-markdown'
import { useTranslations } from 'next-intl'

interface ResearchBrief {
  id: string
  company_name: string
  brief_content: string
  pdf_url?: string
  created_at: string
  completed_at: string
}

interface Contact {
  id: string
  prospect_id: string
  name: string
  role?: string
  email?: string
  linkedin_url?: string
  communication_style?: string
  decision_authority?: string
  probable_drivers?: string
  profile_brief?: string
  opening_suggestions?: string[]
  questions_to_ask?: string[]
  topics_to_avoid?: string[]
  is_primary: boolean
  analyzed_at?: string
  created_at: string
}

interface ProfileStatus {
  hasSalesProfile: boolean
  hasCompanyProfile: boolean
}

export default function ResearchBriefPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const t = useTranslations('research')
  const tCommon = useTranslations('common')
  
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [brief, setBrief] = useState<ResearchBrief | null>(null)
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>({ hasSalesProfile: false, hasCompanyProfile: false })
  
  // Contact states
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showAddContact, setShowAddContact] = useState(false)
  const [addingContact, setAddingContact] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', role: '', linkedin_url: '' })
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [lookingUpContact, setLookingUpContact] = useState(false)
  const [lookupResult, setLookupResult] = useState<{ found: boolean; confidence?: string } | null>(null)
  const [analyzingContactIds, setAnalyzingContactIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        fetchBrief()
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

  const fetchBrief = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/research/${params.id}/brief`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setBrief(data)
      } else {
        toast({
          variant: "destructive",
          title: t('toast.loadFailed'),
          description: t('toast.loadFailedDesc'),
        })
        router.push('/dashboard/research')
      }
    } catch (error) {
      console.error('Failed to fetch brief:', error)
      toast({
        variant: "destructive",
        title: t('contacts.searchFailed'),
        description: t('contacts.searchFailedDesc'),
      })
    } finally {
      setLoading(false)
    }
  }

  // Fetch contacts for this research
  const fetchContacts = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setContactsLoading(true)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/research/${params.id}/contacts`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setContacts(data.contacts || [])
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    } finally {
      setContactsLoading(false)
    }
  }, [supabase, params.id])

  // Load contacts when brief is loaded
  useEffect(() => {
    if (brief) {
      fetchContacts()
    }
  }, [brief, fetchContacts])

  // Lookup contact online (LinkedIn + role)
  const handleLookupContact = async () => {
    if (!newContact.name.trim() || !brief?.company_name) {
      toast({
        variant: "destructive",
        title: t('contacts.name'),
        description: t('contacts.namePlaceholder'),
      })
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setLookingUpContact(true)
      setLookupResult(null)

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/contacts/lookup`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: newContact.name,
            company_name: brief.company_name
          })
        }
      )

      if (response.ok) {
        const data = await response.json()
        setLookupResult({ found: data.found, confidence: data.confidence })
        
        if (data.found) {
          setNewContact(prev => ({
            ...prev,
            role: data.role || prev.role,
            linkedin_url: data.linkedin_url || prev.linkedin_url
          }))
          
          toast({
            title: t('contacts.found'),
            description: data.role ? t('contacts.foundDesc', { role: data.role }) : t('contacts.foundProfile'),
          })
        } else {
          toast({
            variant: "destructive",
            title: t('contacts.notFound'),
            description: t('contacts.notFoundDesc'),
          })
        }
      } else {
        toast({
          variant: "destructive",
          title: t('contacts.searchFailed'),
          description: t('contacts.searchFailedDesc'),
        })
      }
    } catch (error) {
      console.error('Lookup failed:', error)
      toast({
        variant: "destructive",
        title: t('contacts.searchFailed'),
        description: t('contacts.searchFailedDesc'),
      })
    } finally {
      setLookingUpContact(false)
    }
  }

  // Add a new contact
  const handleAddContact = async () => {
    if (!newContact.name.trim()) {
      toast({
        variant: "destructive",
        title: t('contacts.name'),
        description: t('contacts.namePlaceholder'),
      })
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      setAddingContact(true)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/research/${params.id}/contacts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: newContact.name,
            role: newContact.role || null,
            linkedin_url: newContact.linkedin_url || null
          })
        }
      )

      if (response.ok) {
        const data = await response.json()
        setContacts(prev => [...prev, data])
        setAnalyzingContactIds(prev => new Set([...prev, data.id]))
        setNewContact({ name: '', role: '', linkedin_url: '' })
        setLookupResult(null)
        setShowAddContact(false)
        toast({
          title: t('contacts.added'),
          description: t('contacts.addedDesc'),
        })
        
        // Smart polling for analysis completion
        const pollForAnalysis = async (contactId: string, attempts: number) => {
          if (attempts > 12) {
            setAnalyzingContactIds(prev => {
              const next = new Set(prev)
              next.delete(contactId)
              return next
            })
            return
          }
          
          await fetchContacts()
          
          const contact = contacts.find(c => c.id === contactId)
          if (contact?.analyzed_at) {
            setAnalyzingContactIds(prev => {
              const next = new Set(prev)
              next.delete(contactId)
              return next
            })
            toast({
              title: t('contacts.analysisComplete'),
              description: t('contacts.analysisCompleteDesc', { name: contact.name }),
            })
            return
          }
          
          setTimeout(() => pollForAnalysis(contactId, attempts + 1), 5000)
        }
        
        setTimeout(() => pollForAnalysis(data.id, 0), 3000)
      } else {
        const error = await response.json()
        toast({
          variant: "destructive",
          title: t('contacts.searchFailed'),
          description: error.detail || t('contacts.addFailed'),
        })
      }
    } catch (error) {
      console.error('Failed to add contact:', error)
      toast({
        variant: "destructive",
        title: t('contacts.searchFailed'),
        description: t('contacts.searchFailedDesc'),
      })
    } finally {
      setAddingContact(false)
    }
  }

  // Delete a contact
  const handleDeleteContact = async (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/contacts/${contactId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (response.ok) {
        setContacts(prev => prev.filter(c => c.id !== contactId))
        if (selectedContact?.id === contactId) {
          setSelectedContact(null)
        }
        toast({
          title: t('toast.deleted'),
          description: t('toast.deletedDesc'),
        })
      }
    } catch (error) {
      console.error('Failed to delete contact:', error)
    }
  }

  // Navigate to preparation with this prospect pre-selected
  const handleStartPreparation = () => {
    // Store the company name in sessionStorage for the preparation page to pick up
    if (brief) {
      sessionStorage.setItem('prepareForCompany', brief.company_name)
    }
    router.push('/dashboard/preparation')
  }

  // Get badge for decision authority
  const getAuthorityBadge = (authority?: string) => {
    switch (authority) {
      case 'decision_maker':
        return <Badge className="bg-green-500 hover:bg-green-600 text-xs">DM</Badge>
      case 'influencer':
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-xs">INF</Badge>
      case 'gatekeeper':
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-xs">GK</Badge>
      default:
        return null
    }
  }

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-4">
            <Icons.spinner className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-slate-500 dark:text-slate-400">{t('loading')}</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!brief) {
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
              onClick={() => router.push('/dashboard/research')}
            >
              <Icons.arrowLeft className="h-4 w-4 mr-2" />
              {tCommon('back')}
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{brief.company_name}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Research Brief • {new Date(brief.completed_at).toLocaleDateString('nl-NL')}
              </p>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="flex gap-6">
            {/* Left Column - Brief Content (scrollable) */}
            <div className="flex-1 min-w-0">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 lg:p-8 shadow-sm">
                {/* Copy button - rechtsboven in de brief */}
                <div className="flex justify-end mb-4">
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText(brief.brief_content)
                    toast({
                      title: t('brief.copied'),
                      description: t('brief.copied'),
                    })
                  }}>
                    <Icons.copy className="h-4 w-4 mr-2" />
                    {t('brief.copy')}
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
                      code: ({ node, ...props }) => <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-sm" {...props} />,
                    }}
                  >
                    {brief.brief_content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>

            {/* Right Column - Sticky Sidebar */}
            <div className="w-80 flex-shrink-0 hidden lg:block">
              <div className="sticky top-4 space-y-4">
                
                {/* AI Context Panel */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950 dark:to-blue-950 p-4 shadow-sm">
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <Icons.sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    {t('context.title')}
                  </h3>
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
                      <Icons.check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-slate-700 dark:text-slate-200">{t('context.researchBrief')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {contacts.length > 0 ? (
                        <Icons.check className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Icons.circle className="h-4 w-4 text-amber-400" />
                      )}
                      <span className={contacts.length > 0 ? 'text-slate-700 dark:text-slate-200' : 'text-amber-600 dark:text-amber-400'}>
                        {t('context.contacts')} ({contacts.length})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contacts Panel */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Icons.user className="h-4 w-4" />
                      {t('contacts.title')}
                    </h3>
                    {!showAddContact && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => setShowAddContact(true)}
                      >
                        <Icons.plus className="h-3 w-3 mr-1" />
                        Toevoegen
                      </Button>
                    )}
                  </div>

                  {/* Add Contact Form (Compact) */}
                  {showAddContact && (
                    <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="contact-name" className="text-xs text-slate-700 dark:text-slate-300">Naam *</Label>
                          <div className="flex gap-1 mt-1">
                            <Input
                              id="contact-name"
                              placeholder="Jan de Vries"
                              value={newContact.name}
                              onChange={(e) => {
                                setNewContact(prev => ({ ...prev, name: e.target.value }))
                                setLookupResult(null)
                              }}
                              className="h-8 text-sm"
                            />
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8 px-2"
                              onClick={handleLookupContact}
                              disabled={lookingUpContact || !newContact.name.trim()}
                            >
                              {lookingUpContact ? (
                                <Icons.spinner className="h-3 w-3 animate-spin" />
                              ) : (
                                <Icons.search className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          {lookupResult && (
                            <p className={`text-xs mt-1 ${lookupResult.found ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                              {lookupResult.found ? '✓ Gevonden' : '⚠ Niet gevonden'}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor="contact-role" className="text-xs text-slate-700 dark:text-slate-300">{t('detail.contactsPanel.role')}</Label>
                          <Input
                            id="contact-role"
                            placeholder="CTO"
                            value={newContact.role}
                            onChange={(e) => setNewContact(prev => ({ ...prev, role: e.target.value }))}
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="h-7 text-xs flex-1"
                            onClick={handleAddContact} 
                            disabled={addingContact || !newContact.name.trim()}
                          >
                            {addingContact ? (
                              <Icons.spinner className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Icons.plus className="h-3 w-3 mr-1" />
                            )}
                            Toevoegen
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setShowAddContact(false)
                              setNewContact({ name: '', role: '', linkedin_url: '' })
                              setLookupResult(null)
                            }}
                          >
                            Annuleer
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contacts List (Compact) */}
                  {contactsLoading ? (
                    <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                      <Icons.spinner className="h-5 w-5 animate-spin mx-auto" />
                    </div>
                  ) : contacts.length === 0 ? (
                    <div className="text-center py-4">
                      <Icons.user className="h-8 w-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t('detail.contactsPanel.noContacts')}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Voeg toe voor een gepersonaliseerde voorbereiding
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Hint voor gebruiker */}
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1">
                        <Icons.info className="h-3 w-3" />
                        Klik voor uitgebreide analyse
                      </p>
                      
                      {contacts.map((contact) => {
                        const isAnalyzing = analyzingContactIds.has(contact.id) || (!contact.analyzed_at && contact.profile_brief === "Analyse wordt uitgevoerd...")
                        const hasAnalysis = contact.analyzed_at && contact.profile_brief
                        
                        return (
                          <div 
                            key={contact.id}
                            className={`p-3 rounded-lg border transition-all ${
                              selectedContact?.id === contact.id 
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-md' 
                                : isAnalyzing
                                  ? 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/30'
                                  : hasAnalysis
                                    ? 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 cursor-pointer hover:shadow-sm'
                                    : 'border-slate-200 dark:border-slate-700'
                            }`}
                            onClick={() => hasAnalysis && setSelectedContact(selectedContact?.id === contact.id ? null : contact)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  isAnalyzing ? 'bg-amber-200 dark:bg-amber-800' : hasAnalysis ? 'bg-blue-100 dark:bg-blue-900' : 'bg-slate-200 dark:bg-slate-700'
                                }`}>
                                  {isAnalyzing ? (
                                    <Icons.spinner className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-spin" />
                                  ) : (
                                    <Icons.user className={`h-4 w-4 ${hasAnalysis ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-sm text-slate-900 dark:text-white truncate flex items-center gap-1">
                                    {contact.name}
                                    {getAuthorityBadge(contact.decision_authority)}
                                  </div>
                                  {contact.role && (
                                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{contact.role}</div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                {/* Bekijk profiel indicator */}
                                {hasAnalysis && (
                                  <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 mr-1">
                                    <span className="text-xs font-medium hidden sm:inline">{tCommon('view')}</span>
                                    <Icons.chevronRight className="h-4 w-4" />
                                  </div>
                                )}
                                {isAnalyzing && (
                                  <span className="text-xs text-amber-600 dark:text-amber-400 mr-1">Analyseren...</span>
                                )}
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="h-6 w-6 p-0 text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                                  onClick={(e) => handleDeleteContact(contact.id, e)}
                                >
                                  <Icons.x className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Preview van de analyse */}
                            {hasAnalysis && contact.communication_style && (
                              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">{contact.communication_style}</span>
                                  {contact.probable_drivers && (
                                    <span className="truncate">• {contact.probable_drivers.split(',')[0]}</span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* CTA Panel - Conditional based on contacts */}
                {contacts.length === 0 ? (
                  // No contacts yet - prompt to add contact first
                  <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <Icons.user className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      Voeg Contactpersoon Toe
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                      Voeg minimaal één contactpersoon toe voor een gepersonaliseerde voorbereiding.
                    </p>
                    <Button 
                      className="w-full bg-amber-600 hover:bg-amber-700"
                      onClick={() => setShowAddContact(true)}
                    >
                      <Icons.userPlus className="h-4 w-4 mr-2" />
                      Contactpersoon Toevoegen
                    </Button>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-2 text-center">
                      Daarna kun je de voorbereiding starten
                    </p>
                  </div>
                ) : (
                  // Has contacts - can proceed to preparation
                  <div className="rounded-xl border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                      <Icons.arrowRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                      Volgende Stap
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                      Genereer een gepersonaliseerde gespreksvoorbereiding met alle verzamelde context.
                    </p>
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={handleStartPreparation}
                    >
                      <Icons.fileText className="h-4 w-4 mr-2" />
                      Start Preparation
                    </Button>
                    <p className="text-xs text-green-700 dark:text-green-400 mt-2 text-center">
                      Met {contacts.length} contactperso{contacts.length === 1 ? 'on' : 'nen'}
                    </p>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Mobile: Floating Action Button for Contacts/Preparation */}
          <div className="lg:hidden fixed bottom-6 right-6 flex flex-col gap-2">
            {contacts.length === 0 ? (
              <Button 
                className="rounded-full h-14 w-14 shadow-lg bg-amber-600 hover:bg-amber-700"
                onClick={() => setShowAddContact(true)}
              >
                <Icons.userPlus className="h-6 w-6" />
              </Button>
            ) : (
              <Button 
                className="rounded-full h-14 w-14 shadow-lg bg-green-600 hover:bg-green-700"
                onClick={handleStartPreparation}
              >
                <Icons.arrowRight className="h-6 w-6" />
              </Button>
            )}
          </div>

        </div>

        {/* Contact Detail Modal (when contact is selected) */}
        {selectedContact && selectedContact.analyzed_at && (
          <div 
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedContact(null)}
          >
            <div 
              className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-xl border border-slate-200 dark:border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedContact.name}</h2>
                  {selectedContact.role && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{selectedContact.role}</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedContact(null)}>
                  <Icons.x className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-6">
                {selectedContact.profile_brief && (
                  <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                    <ReactMarkdown
                      components={{
                        h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-3 text-slate-900 dark:text-white" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-4 mb-2 text-slate-900 dark:text-white" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-3 mb-2 text-slate-900 dark:text-white" {...props} />,
                        p: ({ node, ...props }) => <p className="mb-2 text-sm text-slate-700 dark:text-slate-300" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1 text-sm" {...props} />,
                        li: ({ node, ...props }) => <li className="ml-2 text-slate-700 dark:text-slate-300" {...props} />,
                      }}
                    >
                      {selectedContact.profile_brief}
                    </ReactMarkdown>
                  </div>
                )}
                
                {/* Quick Tips */}
                {(selectedContact.opening_suggestions?.length || selectedContact.questions_to_ask?.length) && (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {selectedContact.opening_suggestions && selectedContact.opening_suggestions.length > 0 && (
                      <div className="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
                        <h4 className="font-semibold text-green-700 dark:text-green-300 mb-2 text-sm">
                          💬 Openingszinnen
                        </h4>
                        <ul className="space-y-2">
                          {selectedContact.opening_suggestions.map((s, i) => (
                            <li key={i} className="text-sm text-green-800 dark:text-green-200">"{s}"</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {selectedContact.questions_to_ask && selectedContact.questions_to_ask.length > 0 && (
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-2 text-sm">
                          ❓ Discovery Vragen
                        </h4>
                        <ul className="space-y-2">
                          {selectedContact.questions_to_ask.map((q, i) => (
                            <li key={i} className="text-sm text-blue-800 dark:text-blue-200">{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      
        <Toaster />
      </>
    </DashboardLayout>
  )
}
