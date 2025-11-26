'use client'

import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { ThemeToggle } from '@/components/theme-toggle'
import ReactMarkdown from 'react-markdown'

interface ResearchBrief {
  id: string
  company_name: string
  brief_content: string
  pdf_url?: string
  created_at: string
  completed_at: string
}

export default function ResearchBriefPage() {
  const router = useRouter()
  const params = useParams()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [brief, setBrief] = useState<ResearchBrief | null>(null)

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
