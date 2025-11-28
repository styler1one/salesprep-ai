'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { ThemeToggle } from '@/components/theme-toggle'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import ReactMarkdown from 'react-markdown'

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

export default function ResearchBriefPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [brief, setBrief] = useState<ResearchBrief | null>(null)
  
  // Contact states
  const [contacts, setContacts] = useState<Contact[]>([])
  const [showAddContact, setShowAddContact] = useState(false)
  const [addingContact, setAddingContact] = useState(false)
  const [newContact, setNewContact] = useState({ name: '', role: '', linkedin_url: '' })
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [contactsLoading, setContactsLoading] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        fetchBrief()
      } else {
        router.push('/login')
      }
    }
    getUser()
  }, [supabase, params.id])

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
          title: "Failed to load brief",
          description: "Could not load the research brief",
        })
        router.push('/dashboard/research')
      }
    } catch (error) {
      console.error('Failed to fetch brief:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "An error occurred while loading the brief",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
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

  // Add a new contact
  const handleAddContact = async () => {
    if (!newContact.name.trim()) {
      toast({
        variant: "destructive",
        title: "Naam verplicht",
        description: "Vul de naam van de contactpersoon in",
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
        setNewContact({ name: '', role: '', linkedin_url: '' })
        setShowAddContact(false)
        toast({
          title: "Contactpersoon toegevoegd",
          description: "Analyse wordt op de achtergrond uitgevoerd...",
        })
        
        // Poll for updates
        setTimeout(() => fetchContacts(), 5000)
        setTimeout(() => fetchContacts(), 15000)
        setTimeout(() => fetchContacts(), 30000)
      } else {
        const error = await response.json()
        toast({
          variant: "destructive",
          title: "Fout",
          description: error.detail || "Kon contact niet toevoegen",
        })
      }
    } catch (error) {
      console.error('Failed to add contact:', error)
      toast({
        variant: "destructive",
        title: "Fout",
        description: "Er is een fout opgetreden",
      })
    } finally {
      setAddingContact(false)
    }
  }

  // Delete a contact
  const handleDeleteContact = async (contactId: string) => {
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
          title: "Verwijderd",
          description: "Contactpersoon is verwijderd",
        })
      }
    } catch (error) {
      console.error('Failed to delete contact:', error)
    }
  }

  // Get badge color for decision authority
  const getAuthorityBadge = (authority?: string) => {
    switch (authority) {
      case 'decision_maker':
        return <Badge className="bg-green-500 hover:bg-green-600">Decision Maker</Badge>
      case 'influencer':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Influencer</Badge>
      case 'gatekeeper':
        return <Badge className="bg-orange-500 hover:bg-orange-600">Gatekeeper</Badge>
      case 'user':
        return <Badge className="bg-gray-500 hover:bg-gray-600">Gebruiker</Badge>
      default:
        return null
    }
  }

  // Get badge for communication style
  const getStyleBadge = (style?: string) => {
    switch (style) {
      case 'formal':
        return <Badge variant="outline">Formeel</Badge>
      case 'informal':
        return <Badge variant="outline">Informeel</Badge>
      case 'technical':
        return <Badge variant="outline">Technisch</Badge>
      case 'strategic':
        return <Badge variant="outline">Strategisch</Badge>
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading research brief...</p>
        </div>
      </div>
    )
  }

  if (!brief) {
    return null
  }

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/research')}
            >
              <Icons.arrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
            <div>
              <h1 className="text-lg font-bold">{brief.company_name}</h1>
              <p className="text-xs text-muted-foreground">Research Brief</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden sm:block text-sm text-slate-600 dark:text-slate-400">
              {user?.email}
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-slate-50 dark:bg-slate-900">
        <div className="container py-8 px-4 max-w-4xl">
          {/* Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Generated {new Date(brief.completed_at).toLocaleString()}
            </div>
            <div className="flex gap-2">
              {brief.pdf_url && (
                <Button variant="outline" size="sm">
                  <Icons.download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => {
                navigator.clipboard.writeText(brief.brief_content)
                toast({
                  title: "Copied!",
                  description: "Research brief copied to clipboard",
                })
              }}>
                <Icons.copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
          </div>

          {/* Brief Content */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm">
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 className="text-3xl font-bold mb-4" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-2xl font-bold mt-8 mb-4" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-xl font-semibold mt-6 mb-3" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-4 leading-relaxed" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 space-y-2" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 space-y-2" {...props} />,
                  li: ({ node, ...props }) => <li className="ml-4" {...props} />,
                  strong: ({ node, ...props }) => <strong className="font-semibold text-slate-900 dark:text-white" {...props} />,
                  code: ({ node, ...props }) => <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-sm" {...props} />,
                }}
              >
                {brief.brief_content}
              </ReactMarkdown>
            </div>
          </div>

          {/* Contacts Section */}
          <div className="mt-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Icons.user className="h-5 w-5" />
                Contactpersonen
              </h2>
              <Button 
                size="sm" 
                onClick={() => setShowAddContact(true)}
                disabled={showAddContact}
              >
                <Icons.plus className="h-4 w-4 mr-2" />
                Toevoegen
              </Button>
            </div>

            {/* Add Contact Form */}
            {showAddContact && (
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <h3 className="font-semibold mb-3">Nieuwe contactpersoon</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="contact-name">Naam *</Label>
                    <Input
                      id="contact-name"
                      placeholder="Jan de Vries"
                      value={newContact.name}
                      onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact-role">Functie</Label>
                    <Input
                      id="contact-role"
                      placeholder="IT Director"
                      value={newContact.role}
                      onChange={(e) => setNewContact(prev => ({ ...prev, role: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact-linkedin">LinkedIn URL</Label>
                    <Input
                      id="contact-linkedin"
                      placeholder="https://linkedin.com/in/..."
                      value={newContact.linkedin_url}
                      onChange={(e) => setNewContact(prev => ({ ...prev, linkedin_url: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleAddContact} disabled={addingContact}>
                    {addingContact ? (
                      <>
                        <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
                        Analyseren...
                      </>
                    ) : (
                      <>
                        <Icons.search className="h-4 w-4 mr-2" />
                        Analyseer & Voeg Toe
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setShowAddContact(false)
                    setNewContact({ name: '', role: '', linkedin_url: '' })
                  }}>
                    Annuleren
                  </Button>
                </div>
              </div>
            )}

            {/* Contacts List */}
            {contactsLoading ? (
              <div className="text-center py-8 text-slate-500">
                <Icons.spinner className="h-6 w-6 animate-spin mx-auto mb-2" />
                Contacten laden...
              </div>
            ) : contacts.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Icons.user className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nog geen contactpersonen toegevoegd</p>
                <p className="text-sm mt-1">Voeg een contactpersoon toe voor gepersonaliseerde gespreksadvies</p>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div 
                    key={contact.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedContact?.id === contact.id 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                    onClick={() => setSelectedContact(selectedContact?.id === contact.id ? null : contact)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                          <Icons.user className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            {contact.name}
                            {contact.is_primary && (
                              <Badge variant="secondary" className="text-xs">Primary</Badge>
                            )}
                          </div>
                          {contact.role && (
                            <div className="text-sm text-slate-500">{contact.role}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getAuthorityBadge(contact.decision_authority)}
                        {getStyleBadge(contact.communication_style)}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteContact(contact.id)
                          }}
                        >
                          <Icons.trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Contact Analysis */}
                    {selectedContact?.id === contact.id && contact.profile_brief && (
                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                        {contact.analyzed_at ? (
                          <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                            <ReactMarkdown
                              components={{
                                h1: ({ node, ...props }) => <h1 className="text-xl font-bold mb-3" {...props} />,
                                h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-4 mb-2" {...props} />,
                                h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-3 mb-2" {...props} />,
                                p: ({ node, ...props }) => <p className="mb-2 text-sm" {...props} />,
                                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2 space-y-1 text-sm" {...props} />,
                                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-sm" {...props} />,
                                li: ({ node, ...props }) => <li className="ml-2" {...props} />,
                              }}
                            >
                              {contact.profile_brief}
                            </ReactMarkdown>
                            
                            {/* Quick Actions */}
                            {(contact.opening_suggestions?.length || contact.questions_to_ask?.length) && (
                              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                {contact.opening_suggestions && contact.opening_suggestions.length > 0 && (
                                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <h4 className="font-semibold text-green-700 dark:text-green-400 mb-2 text-sm">
                                      💬 Openingszinnen
                                    </h4>
                                    <ul className="space-y-1">
                                      {contact.opening_suggestions.slice(0, 3).map((s, i) => (
                                        <li key={i} className="text-xs text-green-800 dark:text-green-300">
                                          "{s}"
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {contact.questions_to_ask && contact.questions_to_ask.length > 0 && (
                                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <h4 className="font-semibold text-blue-700 dark:text-blue-400 mb-2 text-sm">
                                      ❓ Discovery Vragen
                                    </h4>
                                    <ul className="space-y-1">
                                      {contact.questions_to_ask.slice(0, 3).map((q, i) => (
                                        <li key={i} className="text-xs text-blue-800 dark:text-blue-300">
                                          {q}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-center py-4 text-slate-500">
                            <Icons.spinner className="h-5 w-5 animate-spin mx-auto mb-2" />
                            Analyse wordt uitgevoerd...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-6 mt-auto">
        <div className="container px-4 text-center">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Built with <span className="text-red-500">♥</span> by SalesPrep AI
          </p>
        </div>
      </footer>
      
      <Toaster />
    </div>
  )
}
