'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'

export default function Home() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/dashboard')
      }
      setLoading(false)
    }
    checkUser()
  }, [supabase, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <Icons.zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl">SalesPrep AI</span>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => router.push('/login')}>
                Log in
              </Button>
              <Button onClick={() => router.push('/signup')} className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-6">
              <Icons.sparkles className="h-4 w-4" />
              AI-Powered Sales Enablement
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6">
              Prepare for meetings{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">
                in seconds
              </span>
            </h1>
            <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
              Research prospects, generate personalized briefs, and follow up with AI-powered summaries. 
              Everything you need to close more deals, faster.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button 
                size="lg" 
                onClick={() => router.push('/signup')}
                className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-lg px-8 h-14"
              >
                Start Free Trial
                <Icons.arrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => router.push('/login')}
                className="text-lg px-8 h-14"
              >
                <Icons.play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </div>
          </div>

          {/* Hero Image/Preview */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 pointer-events-none" />
            <div className="rounded-2xl border shadow-2xl overflow-hidden bg-white">
              <div className="h-8 bg-slate-100 border-b flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-[400px] flex items-center justify-center">
                <div className="grid grid-cols-3 gap-4 w-full max-w-4xl">
                  {/* Preview Cards */}
                  <div className="col-span-1 space-y-4">
                    <div className="rounded-lg bg-white p-4 shadow-sm border">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Icons.search className="h-4 w-4 text-blue-600" />
                        </div>
                        <span className="font-medium text-sm">Research</span>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 bg-slate-100 rounded w-full" />
                        <div className="h-2 bg-slate-100 rounded w-3/4" />
                      </div>
                    </div>
                    <div className="rounded-lg bg-white p-4 shadow-sm border">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <Icons.fileText className="h-4 w-4 text-green-600" />
                        </div>
                        <span className="font-medium text-sm">Brief</span>
                      </div>
                      <div className="space-y-2">
                        <div className="h-2 bg-slate-100 rounded w-full" />
                        <div className="h-2 bg-slate-100 rounded w-2/3" />
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 rounded-lg bg-white p-6 shadow-sm border">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                        <Icons.sparkles className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium">AI Meeting Brief</p>
                        <p className="text-xs text-slate-500">Generated in 30 seconds</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="h-3 bg-slate-100 rounded w-full" />
                      <div className="h-3 bg-slate-100 rounded w-5/6" />
                      <div className="h-3 bg-slate-100 rounded w-4/5" />
                      <div className="h-3 bg-slate-100 rounded w-full" />
                      <div className="h-3 bg-slate-100 rounded w-3/4" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
              Everything you need to win more deals
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              From research to follow-up, SalesPrep AI helps you at every step of your sales process.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="group p-6 rounded-2xl border bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Icons.search className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Prospect Research</h3>
              <p className="text-slate-600 text-sm">
                AI-powered research on any company. Get insights on their business, challenges, and opportunities.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group p-6 rounded-2xl border bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Icons.fileText className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Meeting Preparation</h3>
              <p className="text-slate-600 text-sm">
                Generate personalized meeting briefs with talking points, questions, and strategy recommendations.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group p-6 rounded-2xl border bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Icons.mail className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Meeting Follow-up</h3>
              <p className="text-slate-600 text-sm">
                Upload recordings, get AI summaries, action items, and draft follow-up emails automatically.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group p-6 rounded-2xl border bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Icons.book className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Knowledge Base</h3>
              <p className="text-slate-600 text-sm">
                Upload your company docs. The AI uses your context to generate relevant, on-brand content.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 px-4 bg-slate-50">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm font-medium text-slate-500 mb-8">TRUSTED BY SALES TEAMS AT</p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-50">
            {['Microsoft', 'Salesforce', 'HubSpot', 'Oracle', 'SAP'].map((company) => (
              <span key={company} className="text-2xl font-bold text-slate-400">
                {company}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-violet-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Ready to transform your sales process?
          </h2>
          <p className="text-xl text-blue-100 mb-10">
            Join thousands of sales professionals who close more deals with SalesPrep AI.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => router.push('/signup')}
            className="text-lg px-8 h-14 bg-white text-blue-600 hover:bg-blue-50"
          >
            Get Started Free
            <Icons.arrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <Icons.zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-white">SalesPrep AI</span>
            </div>
            <p className="text-sm">
              © {new Date().getFullYear()} SalesPrep AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
