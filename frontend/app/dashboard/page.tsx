'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'

export default function DashboardPage() {
    const router = useRouter()
    const supabase = createClientComponentClient()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<any>(null)
    const [knowledgeBase, setKnowledgeBase] = useState<any[]>([])
    const [researchBriefs, setResearchBriefs] = useState<any[]>([])

    useEffect(() => {
        const loadData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)

            if (user) {
                // Get auth token
                const { data: { session } } = await supabase.auth.getSession()
                const token = session?.access_token

                if (token) {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

                    // Fetch sales profile
                    try {
                        const profileRes = await fetch(`${apiUrl}/api/v1/profile/sales`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        })
                        if (profileRes.ok) {
                            const profileData = await profileRes.json()
                            setProfile(profileData)
                        }
                    } catch (error) {
                        console.error('Failed to load profile:', error)
                    }

                    // Fetch knowledge base
                    try {
                        const kbRes = await fetch(`${apiUrl}/api/v1/knowledge-base/files`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        })
                        if (kbRes.ok) {
                            const kbData = await kbRes.json()
                            setKnowledgeBase(kbData.files || [])
                        }
                    } catch (error) {
                        console.error('Failed to load knowledge base:', error)
                    }

                    // Fetch research briefs
                    try {
                        const researchRes = await fetch(`${apiUrl}/api/v1/research/briefs`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        })
                        if (researchRes.ok) {
                            const researchData = await researchRes.json()
                            setResearchBriefs(researchData.briefs || [])
                        }
                    } catch (error) {
                        console.error('Failed to load research briefs:', error)
                    }
                }
            }

            setLoading(false)
        }
        loadData()
    }, [supabase])

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Icons.spinner className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col">
            {/* Header */}
            <header className="border-b">
                <div className="container flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold">SalesPrep AI</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                            {user?.email}
                        </span>
                        <Button variant="outline" onClick={handleSignOut}>
                            Sign Out
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1">
                <div className="container py-8 px-4">
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold tracking-tight">
                            Welcome to SalesPrep AI
                        </h2>
                        <p className="text-muted-foreground mt-2">
                            Your AI-powered sales enablement platform
                        </p>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid gap-4 md:grid-cols-3 mb-8">
                        <div className="rounded-lg border bg-card p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Research Reports
                                    </p>
                                    <p className="text-2xl font-bold">{researchBriefs.length}</p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Icons.fileText className="h-6 w-6 text-primary" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-card p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Knowledge Base
                                    </p>
                                    <p className="text-2xl font-bold">{knowledgeBase.length}</p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Icons.book className="h-6 w-6 text-primary" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-card p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Sales Profile
                                    </p>
                                    <p className="text-2xl font-bold">{profile ? '✓' : '–'}</p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Icons.user className="h-6 w-6 text-primary" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sales Profile Card */}
                    {profile && (
                        <div className="mb-8 rounded-lg border bg-card p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Your Sales Profile</h3>
                                <Button variant="outline" size="sm" onClick={() => router.push('/onboarding')}>
                                    Update Profile
                                </Button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Name</p>
                                    <p className="text-base">{profile.full_name || 'Not set'}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Role</p>
                                    <p className="text-base">{profile.role || 'Not set'}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Experience</p>
                                    <p className="text-base">{profile.experience_years ? `${profile.experience_years} years` : 'Not set'}</p>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Methodology</p>
                                    <p className="text-base">{profile.sales_methodology || 'Not set'}</p>
                                </div>
                                {profile.target_industries && profile.target_industries.length > 0 && (
                                    <div className="md:col-span-2">
                                        <p className="text-sm font-medium text-muted-foreground mb-1">Target Industries</p>
                                        <div className="flex flex-wrap gap-2">
                                            {profile.target_industries.map((industry: string, i: number) => (
                                                <span key={i} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                                                    {industry}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Knowledge Base & Research */}
                    <div className="grid gap-4 md:grid-cols-2 mb-8">
                        {/* Knowledge Base */}
                        <div className="rounded-lg border bg-card p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Knowledge Base</h3>
                                <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/knowledge-base')}>
                                    View All
                                </Button>
                            </div>
                            {knowledgeBase.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {knowledgeBase.slice(0, 3).map((doc: any) => (
                                        <div key={doc.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50">
                                            <Icons.fileText className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm truncate">{doc.title || doc.filename}</span>
                                        </div>
                                    ))}
                                    {knowledgeBase.length > 3 && (
                                        <p className="text-xs text-muted-foreground mt-2">
                                            +{knowledgeBase.length - 3} more documents
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Research Briefs */}
                        <div className="rounded-lg border bg-card p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Research Briefs</h3>
                                <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/research')}>
                                    View All
                                </Button>
                            </div>
                            {researchBriefs.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No research briefs yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {researchBriefs.slice(0, 3).map((brief: any) => (
                                        <div
                                            key={brief.id}
                                            className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                                            onClick={() => router.push(`/research/${brief.id}`)}
                                        >
                                            <Icons.search className="h-4 w-4 text-muted-foreground" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm truncate">{brief.company_name}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(brief.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {researchBriefs.length > 3 && (
                                        <p className="text-xs text-muted-foreground mt-2">
                                            +{researchBriefs.length - 3} more briefs
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                        Welcome! Your account is set up and ready to go. Here's what you can do next:
                    </p>
                    <ul className="space-y-2 text-sm">
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>Upload your company knowledge base (PDFs, docs)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>Connect your CRM (HubSpot, Salesforce)</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-primary">✓</span>
                            <span>Start researching your first prospect</span>
                        </li>
                    </ul>
                </div>
        </div>
            </main >

        {/* Footer */ }
        < footer className = "border-t py-6" >
            <div className="container px-4 text-center text-sm text-muted-foreground">
                <p>SalesPrep AI - AI-powered sales enablement platform</p>
            </div>
            </footer >
        </div >
    )
}
