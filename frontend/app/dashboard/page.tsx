'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { DashboardLayout } from '@/components/layout'

// Helper function for relative time
function getRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'Zojuist'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min geleden`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} uur geleden`
    if (diffInSeconds < 172800) return 'Gisteren'
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} dagen geleden`
    return date.toLocaleDateString('nl-NL')
}

// Helper function for time-based greeting
function getGreeting(): { greeting: string; emoji: string } {
    const hour = new Date().getHours()
    if (hour < 12) return { greeting: 'Goedemorgen', emoji: '☀️' }
    if (hour < 17) return { greeting: 'Goedemiddag', emoji: '👋' }
    if (hour < 21) return { greeting: 'Goedenavond', emoji: '🌆' }
    return { greeting: 'Goedenacht', emoji: '🌙' }
}

// Helper to count items from last 7 days
function countRecentItems(items: any[], dateField: string = 'created_at'): number {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return items.filter(item => new Date(item[dateField]) > weekAgo).length
}

interface ProspectWithStatus {
    id: string
    company_name: string
    hasResearch: boolean
    researchId?: string
    researchStatus?: string
    hasPrep: boolean
    prepId?: string
    prepStatus?: string
    hasFollowup: boolean
    followupId?: string
    followupStatus?: string
    lastActivity: string
    nextAction: 'research' | 'prep' | 'followup' | 'complete'
}

export default function DashboardPage() {
    const router = useRouter()
    const supabase = createClientComponentClient()
    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [profile, setProfile] = useState<any>(null)
    const [companyProfile, setCompanyProfile] = useState<any>(null)
    const [knowledgeBase, setKnowledgeBase] = useState<any[]>([])
    const [researchBriefs, setResearchBriefs] = useState<any[]>([])
    const [meetingPreps, setMeetingPreps] = useState<any[]>([])
    const [followups, setFollowups] = useState<any[]>([])

    useEffect(() => {
        const loadData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)

            if (user) {
                const { data: { session } } = await supabase.auth.getSession()
                const token = session?.access_token

                if (token) {
                    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

                    const fetchPromises = [
                        fetch(`${apiUrl}/api/v1/profile/sales`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${apiUrl}/api/v1/profile/company`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${apiUrl}/api/v1/knowledge-base/files`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${apiUrl}/api/v1/research/briefs`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${apiUrl}/api/v1/prep/briefs`, { headers: { 'Authorization': `Bearer ${token}` } }),
                        fetch(`${apiUrl}/api/v1/followup/list`, { headers: { 'Authorization': `Bearer ${token}` } }),
                    ]

                    try {
                        const [profileRes, companyRes, kbRes, researchRes, prepsRes, followupsRes] = await Promise.all(fetchPromises)

                        if (profileRes.ok) setProfile(await profileRes.json())
                        if (companyRes.ok) setCompanyProfile(await companyRes.json())
                        if (kbRes.ok) {
                            const kbData = await kbRes.json()
                            setKnowledgeBase(kbData.files || [])
                        }
                        if (researchRes.ok) {
                            const researchData = await researchRes.json()
                            setResearchBriefs(researchData.briefs || [])
                        }
                        if (prepsRes.ok) {
                            const prepsData = await prepsRes.json()
                            setMeetingPreps(prepsData.preps || [])
                        }
                        if (followupsRes.ok) {
                            const followupsData = await followupsRes.json()
                            setFollowups(followupsData || [])
                        }
                    } catch (error) {
                        console.error('Failed to load data:', error)
                    }
                }
            }

            setLoading(false)
        }
        loadData()
    }, [supabase])

    // Calculate trends (items from last 7 days)
    const recentResearch = useMemo(() => countRecentItems(researchBriefs), [researchBriefs])
    const recentPreps = useMemo(() => countRecentItems(meetingPreps), [meetingPreps])
    const recentFollowups = useMemo(() => countRecentItems(followups), [followups])

    // Build prospect-centric view
    const prospects = useMemo(() => {
        const prospectMap = new Map<string, ProspectWithStatus>()

        // Add from research briefs
        researchBriefs.forEach(brief => {
            const name = brief.company_name.toLowerCase()
            if (!prospectMap.has(name)) {
                prospectMap.set(name, {
                    id: brief.id,
                    company_name: brief.company_name,
                    hasResearch: true,
                    researchId: brief.id,
                    researchStatus: brief.status,
                    hasPrep: false,
                    hasFollowup: false,
                    lastActivity: brief.created_at,
                    nextAction: brief.status === 'completed' ? 'prep' : 'research'
                })
            } else {
                const existing = prospectMap.get(name)!
                existing.hasResearch = true
                existing.researchId = brief.id
                existing.researchStatus = brief.status
                if (new Date(brief.created_at) > new Date(existing.lastActivity)) {
                    existing.lastActivity = brief.created_at
                }
            }
        })

        // Add from meeting preps
        meetingPreps.forEach(prep => {
            const name = prep.prospect_company_name.toLowerCase()
            if (!prospectMap.has(name)) {
                prospectMap.set(name, {
                    id: prep.id,
                    company_name: prep.prospect_company_name,
                    hasResearch: false,
                    hasPrep: true,
                    prepId: prep.id,
                    prepStatus: prep.status,
                    hasFollowup: false,
                    lastActivity: prep.created_at,
                    nextAction: prep.status === 'completed' ? 'followup' : 'prep'
                })
            } else {
                const existing = prospectMap.get(name)!
                existing.hasPrep = true
                existing.prepId = prep.id
                existing.prepStatus = prep.status
                if (prep.status === 'completed') {
                    existing.nextAction = 'followup'
                }
                if (new Date(prep.created_at) > new Date(existing.lastActivity)) {
                    existing.lastActivity = prep.created_at
                }
            }
        })

        // Add from followups
        followups.forEach(followup => {
            const name = (followup.prospect_company_name || followup.meeting_subject || '').toLowerCase()
            if (!name) return
            
            if (!prospectMap.has(name)) {
                prospectMap.set(name, {
                    id: followup.id,
                    company_name: followup.prospect_company_name || followup.meeting_subject,
                    hasResearch: false,
                    hasPrep: false,
                    hasFollowup: true,
                    followupId: followup.id,
                    followupStatus: followup.status,
                    lastActivity: followup.created_at,
                    nextAction: 'complete'
                })
            } else {
                const existing = prospectMap.get(name)!
                existing.hasFollowup = true
                existing.followupId = followup.id
                existing.followupStatus = followup.status
                if (followup.status === 'completed') {
                    existing.nextAction = 'complete'
                }
                if (new Date(followup.created_at) > new Date(existing.lastActivity)) {
                    existing.lastActivity = followup.created_at
                }
            }
        })

        // Sort by last activity (most recent first)
        return Array.from(prospectMap.values())
            .sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime())
    }, [researchBriefs, meetingPreps, followups])

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Icons.spinner className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-sm text-slate-500">Dashboard laden...</p>
                </div>
            </div>
        )
    }

    // Smart suggestion based on activity
    const getSuggestion = () => {
        if (!profile?.full_name) return { 
            text: 'Start met het aanmaken van je sales profiel voor gepersonaliseerde AI outputs', 
            action: '/onboarding', 
            actionText: 'Profiel Maken',
            icon: Icons.user,
            color: 'violet'
        }
        if (!companyProfile?.company_name) return { 
            text: 'Voeg je bedrijfsprofiel toe zodat de AI je producten en diensten kent', 
            action: '/onboarding/company', 
            actionText: 'Bedrijf Toevoegen',
            icon: Icons.building,
            color: 'indigo'
        }
        if (researchBriefs.length === 0) return { 
            text: 'Research je eerste prospect om te beginnen met je sales voorbereiding', 
            action: '/dashboard/research', 
            actionText: 'Start Research',
            icon: Icons.search,
            color: 'blue'
        }
        if (meetingPreps.length === 0 && researchBriefs.some(b => b.status === 'completed')) return { 
            text: 'Je hebt research klaar staan - maak nu een gepersonaliseerde gespreksvoorbereiding', 
            action: '/dashboard/preparation', 
            actionText: 'Maak Voorbereiding',
            icon: Icons.fileText,
            color: 'green'
        }
        if (followups.length === 0 && meetingPreps.some(p => p.status === 'completed')) return { 
            text: 'Na je meeting: upload de opname voor transcriptie en follow-up acties', 
            action: '/dashboard/followup', 
            actionText: 'Upload Meeting',
            icon: Icons.mic,
            color: 'orange'
        }
        
        // Check for prospects that need attention
        const needsPrep = prospects.find(p => p.hasResearch && p.researchStatus === 'completed' && !p.hasPrep)
        if (needsPrep) return {
            text: `Je research voor ${needsPrep.company_name} is klaar - maak nu een voorbereiding`,
            action: '/dashboard/preparation',
            actionText: 'Voorbereiden',
            icon: Icons.fileText,
            color: 'green'
        }
        
        const needsFollowup = prospects.find(p => p.hasPrep && p.prepStatus === 'completed' && !p.hasFollowup)
        if (needsFollowup) return {
            text: `Meeting met ${needsFollowup.company_name} gehad? Upload de opname voor follow-up`,
            action: '/dashboard/followup',
            actionText: 'Follow-up',
            icon: Icons.mic,
            color: 'orange'
        }

        return { 
            text: 'Goed bezig! Je sales voorbereiding loopt op schema 🎉', 
            action: '/dashboard/research', 
            actionText: 'Nieuwe Prospect',
            icon: Icons.sparkles,
            color: 'emerald'
        }
    }
    
    const suggestion = getSuggestion()
    const { greeting, emoji } = getGreeting()

    const colorClasses: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', gradient: 'from-blue-500 to-blue-600' },
        green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', gradient: 'from-green-500 to-green-600' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', gradient: 'from-orange-500 to-orange-600' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', gradient: 'from-purple-500 to-purple-600' },
        violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', gradient: 'from-violet-500 to-violet-600' },
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200', gradient: 'from-indigo-500 to-indigo-600' },
        emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', gradient: 'from-emerald-500 to-emerald-600' },
    }

    const suggestionColors = colorClasses[suggestion.color] || colorClasses.blue
    const SuggestionIcon = suggestion.icon

    const getNextActionButton = (prospect: ProspectWithStatus) => {
        switch (prospect.nextAction) {
            case 'research':
                return (
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                        <Icons.spinner className="h-3 w-3 animate-spin" />
                        Research bezig...
                    </span>
                )
            case 'prep':
                return (
                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={(e) => {
                        e.stopPropagation()
                        sessionStorage.setItem('prepareForCompany', prospect.company_name)
                        router.push('/dashboard/preparation')
                    }}>
                        <Icons.fileText className="h-3 w-3 mr-1" />
                        Voorbereiden
                    </Button>
                )
            case 'followup':
                return (
                    <Button size="sm" className="h-7 text-xs bg-orange-600 hover:bg-orange-700" onClick={(e) => {
                        e.stopPropagation()
                        sessionStorage.setItem('followupForCompany', prospect.company_name)
                        router.push('/dashboard/followup')
                    }}>
                        <Icons.mic className="h-3 w-3 mr-1" />
                        Follow-up
                    </Button>
                )
            case 'complete':
                return (
                    <span className="text-xs text-emerald-600 flex items-center gap-1">
                        <Icons.check className="h-3 w-3" />
                        Compleet
                    </span>
                )
        }
    }

    const getProspectLink = (prospect: ProspectWithStatus) => {
        if (prospect.followupId && prospect.followupStatus === 'completed') {
            return `/dashboard/followup/${prospect.followupId}`
        }
        if (prospect.prepId && prospect.prepStatus === 'completed') {
            return `/dashboard/preparation/${prospect.prepId}`
        }
        if (prospect.researchId && prospect.researchStatus === 'completed') {
            return `/dashboard/research/${prospect.researchId}`
        }
        return null
    }

    return (
        <DashboardLayout user={user}>
            <div className="p-4 lg:p-6">
                {/* Welcome + Suggestion */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 mb-1">
                        {greeting}{typeof profile?.full_name === 'string' && profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! {emoji}
                    </h1>
                    <p className="text-slate-500 text-sm mb-4">
                        Hier is je sales voorbereiding overzicht.
                    </p>
                    
                    {/* Smart Suggestion - Prominent */}
                    <div className={`flex items-center gap-4 p-4 rounded-xl border-2 ${suggestionColors.border} ${suggestionColors.bg}`}>
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${suggestionColors.gradient} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                            <SuggestionIcon className="h-6 w-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900">{suggestion.text}</p>
                        </div>
                        {suggestion.action && (
                            <Button 
                                onClick={() => router.push(suggestion.action!)} 
                                className={`flex-shrink-0 bg-gradient-to-r ${suggestionColors.gradient} hover:opacity-90`}
                            >
                                {suggestion.actionText}
                                <Icons.arrowRight className="h-4 w-4 ml-2" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Two Column Layout */}
                <div className="flex gap-6">
                    {/* Left: Prospects */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                <Icons.users className="h-5 w-5 text-slate-400" />
                                Mijn Prospects
                                <span className="text-sm font-normal text-slate-400">({prospects.length})</span>
                            </h2>
                            <Button size="sm" onClick={() => router.push('/dashboard/research')}>
                                <Icons.plus className="h-4 w-4 mr-1" />
                                Nieuwe Prospect
                            </Button>
                        </div>

                        {prospects.length === 0 ? (
                            <div className="bg-white rounded-xl border p-12 text-center">
                                <Icons.users className="h-16 w-16 text-slate-200 mx-auto mb-4" />
                                <h3 className="font-semibold text-slate-700 mb-2">Nog geen prospects</h3>
                                <p className="text-slate-500 text-sm mb-4">
                                    Start met je eerste prospect research
                                </p>
                                <Button onClick={() => router.push('/dashboard/research')}>
                                    <Icons.search className="h-4 w-4 mr-2" />
                                    Start Research
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {prospects.slice(0, 8).map((prospect) => {
                                    const link = getProspectLink(prospect)
                                    return (
                                        <div
                                            key={prospect.id}
                                            className={`bg-white rounded-xl border p-4 hover:shadow-md transition-all ${link ? 'cursor-pointer' : ''}`}
                                            onClick={() => link && router.push(link)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4 min-w-0 flex-1">
                                                    {/* Company Initial */}
                                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                                                        <span className="font-bold text-slate-600">
                                                            {prospect.company_name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    
                                                    {/* Company Info */}
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="font-semibold text-slate-900 truncate">{prospect.company_name}</h3>
                                                        <p className="text-xs text-slate-500">{getRelativeTime(prospect.lastActivity)}</p>
                                                    </div>

                                                    {/* Status Indicators */}
                                                    <div className="flex items-center gap-2">
                                                        {/* Research */}
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                            prospect.hasResearch && prospect.researchStatus === 'completed' 
                                                                ? 'bg-blue-100' 
                                                                : prospect.hasResearch 
                                                                    ? 'bg-blue-50' 
                                                                    : 'bg-slate-100'
                                                        }`} title="Research">
                                                            {prospect.hasResearch && prospect.researchStatus === 'completed' ? (
                                                                <Icons.check className="h-4 w-4 text-blue-600" />
                                                            ) : prospect.hasResearch ? (
                                                                <Icons.spinner className="h-4 w-4 text-blue-400 animate-spin" />
                                                            ) : (
                                                                <Icons.search className="h-4 w-4 text-slate-300" />
                                                            )}
                                                        </div>
                                                        
                                                        {/* Prep */}
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                            prospect.hasPrep && prospect.prepStatus === 'completed' 
                                                                ? 'bg-green-100' 
                                                                : prospect.hasPrep 
                                                                    ? 'bg-green-50' 
                                                                    : 'bg-slate-100'
                                                        }`} title="Voorbereiding">
                                                            {prospect.hasPrep && prospect.prepStatus === 'completed' ? (
                                                                <Icons.check className="h-4 w-4 text-green-600" />
                                                            ) : prospect.hasPrep ? (
                                                                <Icons.spinner className="h-4 w-4 text-green-400 animate-spin" />
                                                            ) : (
                                                                <Icons.fileText className="h-4 w-4 text-slate-300" />
                                                            )}
                                                        </div>
                                                        
                                                        {/* Follow-up */}
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                            prospect.hasFollowup && prospect.followupStatus === 'completed' 
                                                                ? 'bg-orange-100' 
                                                                : prospect.hasFollowup 
                                                                    ? 'bg-orange-50' 
                                                                    : 'bg-slate-100'
                                                        }`} title="Follow-up">
                                                            {prospect.hasFollowup && prospect.followupStatus === 'completed' ? (
                                                                <Icons.check className="h-4 w-4 text-orange-600" />
                                                            ) : prospect.hasFollowup ? (
                                                                <Icons.spinner className="h-4 w-4 text-orange-400 animate-spin" />
                                                            ) : (
                                                                <Icons.mail className="h-4 w-4 text-slate-300" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Next Action */}
                                                <div className="ml-4 flex-shrink-0">
                                                    {getNextActionButton(prospect)}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                
                                {prospects.length > 8 && (
                                    <button 
                                        className="w-full py-3 text-sm text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2"
                                        onClick={() => router.push('/dashboard/research')}
                                    >
                                        Bekijk alle {prospects.length} prospects
                                        <Icons.arrowRight className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Sidebar */}
                    <div className="w-80 flex-shrink-0 hidden lg:block">
                        <div className="sticky top-4 space-y-4">
                            
                            {/* Stats */}
                            <div className="rounded-xl border bg-white p-4 shadow-sm">
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <Icons.barChart className="h-4 w-4 text-slate-400" />
                                    Deze Week
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                                <Icons.search className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <span className="text-sm text-slate-600">Research</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900">{researchBriefs.length}</span>
                                            {recentResearch > 0 && (
                                                <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                                                    +{recentResearch}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
                                                <Icons.fileText className="h-4 w-4 text-green-600" />
                                            </div>
                                            <span className="text-sm text-slate-600">Voorbereidingen</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900">{meetingPreps.length}</span>
                                            {recentPreps > 0 && (
                                                <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                                                    +{recentPreps}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
                                                <Icons.mail className="h-4 w-4 text-orange-600" />
                                            </div>
                                            <span className="text-sm text-slate-600">Follow-ups</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900">{followups.length}</span>
                                            {recentFollowups > 0 && (
                                                <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">
                                                    +{recentFollowups}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="rounded-xl border bg-white p-4 shadow-sm">
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <Icons.zap className="h-4 w-4 text-amber-500" />
                                    Snelle Acties
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => router.push('/dashboard/research')}
                                        className="p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors text-center"
                                    >
                                        <Icons.search className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                                        <span className="text-xs font-medium text-blue-700">Research</span>
                                    </button>
                                    <button
                                        onClick={() => router.push('/dashboard/preparation')}
                                        className="p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors text-center"
                                    >
                                        <Icons.fileText className="h-5 w-5 text-green-600 mx-auto mb-1" />
                                        <span className="text-xs font-medium text-green-700">Prep</span>
                                    </button>
                                    <button
                                        onClick={() => router.push('/dashboard/followup')}
                                        className="p-3 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors text-center"
                                    >
                                        <Icons.mic className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                                        <span className="text-xs font-medium text-orange-700">Follow-up</span>
                                    </button>
                                    <button
                                        onClick={() => router.push('/dashboard/knowledge-base')}
                                        className="p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors text-center"
                                    >
                                        <Icons.book className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                                        <span className="text-xs font-medium text-purple-700">Docs</span>
                                    </button>
                                </div>
                            </div>

                            {/* Profiles Status */}
                            <div className="rounded-xl border bg-white p-4 shadow-sm">
                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                    <Icons.user className="h-4 w-4 text-slate-400" />
                                    Profielen
                                </h3>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => router.push(profile?.full_name ? '/dashboard/profile' : '/onboarding')}
                                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                profile?.full_name ? 'bg-violet-100' : 'bg-slate-100'
                                            }`}>
                                                <Icons.user className={`h-4 w-4 ${profile?.full_name ? 'text-violet-600' : 'text-slate-400'}`} />
                                            </div>
                                            <span className="text-sm text-slate-700">Sales Profiel</span>
                                        </div>
                                        {profile?.full_name ? (
                                            <span className="text-xs text-green-600 flex items-center gap-1">
                                                <Icons.check className="h-3 w-3" />
                                                {profile.profile_completeness || 0}%
                                            </span>
                                        ) : (
                                            <span className="text-xs text-amber-600">Invullen →</span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => router.push(companyProfile?.company_name ? '/dashboard/company-profile' : '/onboarding/company')}
                                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                                companyProfile?.company_name ? 'bg-indigo-100' : 'bg-slate-100'
                                            }`}>
                                                <Icons.building className={`h-4 w-4 ${companyProfile?.company_name ? 'text-indigo-600' : 'text-slate-400'}`} />
                                            </div>
                                            <span className="text-sm text-slate-700">Bedrijfsprofiel</span>
                                        </div>
                                        {companyProfile?.company_name ? (
                                            <span className="text-xs text-green-600 flex items-center gap-1">
                                                <Icons.check className="h-3 w-3" />
                                                {companyProfile.profile_completeness || 0}%
                                            </span>
                                        ) : (
                                            <span className="text-xs text-amber-600">Invullen →</span>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Knowledge Base */}
                            <div className="rounded-xl border bg-gradient-to-br from-purple-50 to-indigo-50 p-4 shadow-sm">
                                <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                                    <Icons.book className="h-4 w-4 text-purple-600" />
                                    Knowledge Base
                                </h3>
                                <p className="text-xs text-slate-600 mb-3">
                                    {knowledgeBase.length} document{knowledgeBase.length !== 1 ? 'en' : ''} geüpload
                                </p>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full"
                                    onClick={() => router.push('/dashboard/knowledge-base')}
                                >
                                    <Icons.upload className="h-4 w-4 mr-2" />
                                    Upload Documenten
                                </Button>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
