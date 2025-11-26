'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Icons } from '@/components/icons'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { ThemeToggle } from '@/components/theme-toggle'

interface ResearchBrief {
  id: string
  company_name: string
  country?: string
  city?: string
  status: 'pending' | 'researching' | 'completed' | 'failed'
  brief_content?: string
  error_message?: string
  created_at: string
  completed_at?: string
}

export default function ResearchPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [researching, setResearching] = useState(false)
  const [briefs, setBriefs] = useState<ResearchBrief[]>([])
  
  // Form state
  const [companyName, setCompanyName] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        fetchBriefs()
      }
      setLoading(false)
    }
    getUser()
  }, [supabase])

  const fetchBriefs = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/research/briefs`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setBriefs(data.briefs || [])
      }
    } catch (error) {
      console.error('Failed to fetch briefs:', error)
    }
  }, [supabase])

  const handleStartResearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!companyName.trim()) {
      toast({
        variant: "destructive",
        title: "Company name required",
        description: "Please enter a company name",
      })
      return
    }

    setResearching(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const response = await fetch(
        `${apiUrl}/api/v1/research/start`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            company_name: companyName,
            company_linkedin_url: linkedinUrl || null,
            country: country || null,
            city: city || null
          })
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Research failed')
      }

      // Clear form
      setCompanyName('')
      setLinkedinUrl('')
      setCountry('')
      setCity('')
      
      // Refresh list
      await fetchBriefs()
      
      toast({
        title: "Research started",
        description: "Your research is being generated. This may take 2-3 minutes.",
      })
      
      // Start polling for updates
      setTimeout(() => fetchBriefs(), 3000)
    } catch (error: any) {
      console.error('Research failed:', error)
      toast({
        variant: "destructive",
        title: "Research failed",
        description: error.message || 'Failed to start research',
      })
    } finally {
      setResearching(false)
    }
  }

  const handleDeleteBrief = async (briefId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/research/${briefId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (response.ok) {
        await fetchBriefs()
        toast({
          title: "Research deleted",
          description: "The research brief has been removed",
        })
      } else {
        throw new Error('Delete failed')
      }
    } catch (error) {
      console.error('Delete failed:', error)
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Could not delete the research. Please try again.",
      })
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Auto-refresh for processing briefs
  useEffect(() => {
    const hasProcessingBriefs = briefs.some(b => 
      b.status === 'pending' || b.status === 'researching'
    )

    if (hasProcessingBriefs) {
      const interval = setInterval(() => {
        fetchBriefs()
      }, 5000) // Poll every 5 seconds

      return () => clearInterval(interval)
    }
  }, [briefs, fetchBriefs])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    router.push('/login')
    return null
  }

  const completedBriefs = briefs.filter(b => b.status === 'completed').length
  const processingBriefs = briefs.filter(b => b.status === 'researching' || b.status === 'pending').length
  const failedBriefs = briefs.filter(b => b.status === 'failed').length

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icons.search className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">SalesPrep AI</h1>
              <p className="text-xs text-muted-foreground">Research Agent</p>
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
        <div className="container py-8 px-4 max-w-7xl">
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Research Agent
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg">
              Automated prospect research powered by AI
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <div className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Completed
                  </p>
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">{completedBriefs}</p>
                </div>
                <div className="h-14 w-14 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icons.checkCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            <div className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Researching
                  </p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{processingBriefs}</p>
                </div>
                <div className="h-14 w-14 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                  <Icons.spinner className="h-7 w-7 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              </div>
            </div>

            <div className="group rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-lg transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Failed
                  </p>
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">{failedBriefs}</p>
                </div>
                <div className="h-14 w-14 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icons.alertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </div>
          </div>

          {/* Research Form */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm mb-8">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Icons.search className="h-5 w-5" />
              Research a Company
            </h3>
            <form onSubmit={handleStartResearch} className="space-y-4">
              <div>
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g., Acme Corp"
                  required
                />
              </div>

              <div>
                <Label htmlFor="linkedinUrl">LinkedIn URL (optional)</Label>
                <Input
                  id="linkedinUrl"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/company/..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="country">Country (optional)</Label>
                  <Input
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g., Netherlands"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Improves search accuracy
                  </p>
                </div>

                <div>
                  <Label htmlFor="city">City (optional)</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g., Amsterdam"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Helps find the right company
                  </p>
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={researching}
                className="w-full md:w-auto"
              >
                {researching ? (
                  <>
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                    Starting Research...
                  </>
                ) : (
                  <>
                    <Icons.search className="mr-2 h-4 w-4" />
                    Start Research
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Research History */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Research History ({briefs.length})</h3>
              <Button variant="outline" size="sm" onClick={fetchBriefs}>
                <Icons.refresh className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            {briefs.length === 0 ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
                <Icons.search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 dark:text-slate-400">
                  No research yet. Start by researching a company above.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {briefs.map((brief) => (
                  <div
                    key={brief.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold">{brief.company_name}</h4>
                          {brief.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
                              <Icons.checkCircle className="h-3 w-3" />
                              Completed
                            </span>
                          )}
                          {brief.status === 'researching' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
                              <Icons.spinner className="h-3 w-3 animate-spin" />
                              Researching
                            </span>
                          )}
                          {brief.status === 'pending' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400">
                              <Icons.clock className="h-3 w-3" />
                              Pending
                            </span>
                          )}
                          {brief.status === 'failed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400">
                              <Icons.alertCircle className="h-3 w-3" />
                              Failed
                            </span>
                          )}
                        </div>
                        
                        {(brief.city || brief.country) && (
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            📍 {[brief.city, brief.country].filter(Boolean).join(', ')}
                          </p>
                        )}
                        
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Created {new Date(brief.created_at).toLocaleString()}
                        </p>
                        
                        {brief.error_message && (
                          <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                            Error: {brief.error_message}
                          </p>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {brief.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/dashboard/research/${brief.id}`)}
                          >
                            <Icons.fileText className="h-4 w-4 mr-2" />
                            View Brief
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteBrief(brief.id)}
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
