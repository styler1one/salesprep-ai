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

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            setLoading(false)
        }
        getUser()
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
                                    <p className="text-2xl font-bold">0</p>
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
                                        Meeting Preps
                                    </p>
                                    <p className="text-2xl font-bold">0</p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Icons.calendar className="h-6 w-6 text-primary" />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border bg-card p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">
                                        Follow-ups
                                    </p>
                                    <p className="text-2xl font-bold">0</p>
                                </div>
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Icons.checkCircle className="h-6 w-6 text-primary" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="rounded-lg border bg-card p-6">
                        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                        <div className="grid gap-4 md:grid-cols-3">
                            <Button className="h-auto flex-col items-start p-4" variant="outline">
                                <Icons.search className="h-5 w-5 mb-2" />
                                <span className="font-semibold">Research Prospect</span>
                                <span className="text-xs text-muted-foreground mt-1">
                                    Generate AI-powered research brief
                                </span>
                            </Button>

                            <Button className="h-auto flex-col items-start p-4" variant="outline">
                                <Icons.calendar className="h-5 w-5 mb-2" />
                                <span className="font-semibold">Prepare Meeting</span>
                                <span className="text-xs text-muted-foreground mt-1">
                                    Create meeting preparation guide
                                </span>
                            </Button>

                            <Button className="h-auto flex-col items-start p-4" variant="outline">
                                <Icons.mic className="h-5 w-5 mb-2" />
                                <span className="font-semibold">Upload Call</span>
                                <span className="text-xs text-muted-foreground mt-1">
                                    Transcribe and summarize call
                                </span>
                            </Button>
                        </div>
                    </div>

                    {/* Getting Started */}
                    <div className="mt-8 rounded-lg border bg-muted/50 p-6">
                        <h3 className="text-lg font-semibold mb-2">🎉 Getting Started</h3>
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
            </main>

            {/* Footer */}
            <footer className="border-t py-6">
                <div className="container px-4 text-center text-sm text-muted-foreground">
                    <p>SalesPrep AI - AI-powered sales enablement platform</p>
                </div>
            </footer>
        </div>
    )
}
