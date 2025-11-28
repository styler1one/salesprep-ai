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
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    if (diffInSeconds < 172800) return 'Yesterday'
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`
    return date.toLocaleDateString()
}

// Helper function for time-based greeting
function getGreeting(): { greeting: string; emoji: string } {
    const hour = new Date().getHours()
    if (hour < 12) return { greeting: 'Good morning', emoji: '☀️' }
    if (hour < 17) return { greeting: 'Good afternoon', emoji: '👋' }
    if (hour < 21) return { greeting: 'Good evening', emoji: '🌆' }
    return { greeting: 'Good night', emoji: '🌙' }
}

// Helper to count items from last 7 days
function countRecentItems(items: any[], dateField: string = 'created_at'): number {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return items.filter(item => new Date(item[dateField]) > weekAgo).length
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

                    // Fetch all data in parallel
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

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="text-center">
                    <Icons.spinner className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-sm text-slate-500">Loading your dashboard...</p>
                </div>
            </div>
        )
    }

    // Calculate trends (items from last 7 days)
    const recentResearch = useMemo(() => countRecentItems(researchBriefs), [researchBriefs])
    const recentPreps = useMemo(() => countRecentItems(meetingPreps), [meetingPreps])
    const recentFollowups = useMemo(() => countRecentItems(followups), [followups])
    const recentDocs = useMemo(() => countRecentItems(knowledgeBase), [knowledgeBase])

    const stats = [
        { 
            name: 'Research', 
            value: researchBriefs.length, 
            recentCount: recentResearch,
            icon: Icons.search, 
            color: 'blue',
            href: '/dashboard/research',
            description: 'Prospects researched'
        },
        { 
            name: 'Preparations', 
            value: meetingPreps.length, 
            recentCount: recentPreps,
            icon: Icons.fileText, 
            color: 'green',
            href: '/dashboard/preparation',
            description: 'Meeting briefs'
        },
        { 
            name: 'Follow-ups', 
            value: followups.length, 
            recentCount: recentFollowups,
            icon: Icons.mail, 
            color: 'orange',
            href: '/dashboard/followup',
            description: 'Calls summarized'
        },
        { 
            name: 'Knowledge', 
            value: knowledgeBase.length, 
            recentCount: recentDocs,
            icon: Icons.book, 
            color: 'purple',
            href: '/dashboard/knowledge-base',
            description: 'Documents uploaded'
        },
    ]

    // Get smart suggestion based on activity
    const getSuggestion = () => {
        if (!profile) return { text: 'Start by creating your sales profile', action: '/onboarding', actionText: 'Create Profile' }
        if (!companyProfile) return { text: 'Add your company profile for better AI context', action: '/onboarding/company', actionText: 'Add Company' }
        if (researchBriefs.length === 0) return { text: 'Research your first prospect to get started', action: '/dashboard/research', actionText: 'Start Research' }
        if (meetingPreps.length === 0) return { text: 'Generate your first meeting brief', action: '/dashboard/preparation', actionText: 'Prepare Meeting' }
        if (meetingPreps.length > researchBriefs.length) return { text: 'Research more prospects to expand your pipeline', action: '/dashboard/research', actionText: 'Research' }
        return { text: 'Keep up the great work! Your sales prep is on track', action: null, actionText: null }
    }
    
    const suggestion = getSuggestion()
    const { greeting, emoji } = getGreeting()

    const quickActions = [
        {
            name: 'Research Prospect',
            description: 'AI-powered company research',
            icon: Icons.search,
            color: 'blue',
            href: '/dashboard/research',
        },
        {
            name: 'Prepare Meeting',
            description: 'Generate personalized brief',
            icon: Icons.fileText,
            color: 'green',
            href: '/dashboard/preparation',
        },
        {
            name: 'Meeting Follow-up',
            description: 'Transcribe & summarize calls',
            icon: Icons.mail,
            color: 'orange',
            href: '/dashboard/followup',
        },
        {
            name: 'Upload Documents',
            description: 'Add to knowledge base',
            icon: Icons.upload,
            color: 'purple',
            href: '/dashboard/knowledge-base',
        },
    ]

    const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200 hover:border-blue-300' },
        green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200 hover:border-green-300' },
        orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200 hover:border-orange-300' },
        purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200 hover:border-purple-300' },
        violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200 hover:border-violet-300' },
        indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200 hover:border-indigo-300' },
    }

    return (
        <DashboardLayout user={user}>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
                {/* Welcome Section */}
                <div className="mb-8">
                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">
                        {greeting}{typeof profile?.full_name === 'string' && profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! {emoji}
                    </h1>
                    <p className="text-slate-500 mb-4">
                        Here's what's happening with your sales activities.
                    </p>
                    
                    {/* Smart Suggestion */}
                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Icons.sparkles className="h-4 w-4 text-blue-600" />
                        </div>
                        <p className="text-sm text-slate-700 flex-1">{suggestion.text}</p>
                        {suggestion.action && (
                            <Button size="sm" variant="outline" onClick={() => router.push(suggestion.action!)} className="flex-shrink-0">
                                {suggestion.actionText}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {stats.map((stat) => {
                        const Icon = stat.icon
                        const colors = colorClasses[stat.color]
                        return (
                            <button
                                key={stat.name}
                                onClick={() => router.push(stat.href)}
                                className="bg-white rounded-xl border p-5 text-left hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                        <Icon className={`h-5 w-5 ${colors.text}`} />
                                    </div>
                                    <Icons.chevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                                    {stat.recentCount > 0 && (
                                        <span className="text-xs font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                            <Icons.trendingUp className="h-3 w-3" />
                                            +{stat.recentCount} this week
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500">{stat.description}</p>
                            </button>
                        )
                    })}
                </div>

                {/* Quick Actions */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {quickActions.map((action) => {
                            const Icon = action.icon
                            const colors = colorClasses[action.color]
                            return (
                                <button
                                    key={action.name}
                                    onClick={() => router.push(action.href)}
                                    className={`bg-white rounded-xl border ${colors.border} p-5 text-left hover:shadow-md transition-all duration-200 group`}
                                >
                                    <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                        <Icon className={`h-5 w-5 ${colors.text}`} />
                                    </div>
                                    <p className="font-medium text-slate-900">{action.name}</p>
                                    <p className="text-sm text-slate-500">{action.description}</p>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Profile Cards */}
                <div className="grid lg:grid-cols-2 gap-6 mb-8">
                    {/* Sales Profile */}
                    <div className="bg-white rounded-xl border overflow-hidden">
                        {profile ? (
                            <>
                                {/* Header with gradient */}
                                <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white text-xl font-bold">
                                                {typeof profile.full_name === 'string' && profile.full_name 
                                                    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() 
                                                    : 'SP'}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-white text-lg">{profile.full_name || 'Sales Professional'}</h3>
                                                <p className="text-violet-100 text-sm">{profile.job_title || 'Sales Rep'}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/profile')} className="bg-white/20 hover:bg-white/30 text-white border-0">
                                                <Icons.eye className="h-4 w-4 mr-1" />
                                                View
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Content */}
                                <div className="p-6 space-y-4">
                                    {/* Quick Stats */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <p className="text-xs text-slate-500 mb-1">Experience</p>
                                            <p className="font-semibold text-slate-900">
                                                {profile.years_experience ? `${profile.years_experience} years` : 'Not set'}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <p className="text-xs text-slate-500 mb-1">Sales Style</p>
                                            <p className="font-semibold text-slate-900 truncate">
                                                {profile.sales_methodology || 'Consultative'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Top Strengths */}
                                    {Array.isArray(profile.key_strengths) && profile.key_strengths.length > 0 && (
                                        <div>
                                            <p className="text-xs text-slate-500 mb-2">Key Strengths</p>
                                            <div className="flex flex-wrap gap-2">
                                                {profile.key_strengths.slice(0, 4).map((strength: string, i: number) => (
                                                    <span key={i} className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                                                        {strength}
                                                    </span>
                                                ))}
                                                {profile.key_strengths.length > 4 && (
                                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs">
                                                        +{profile.key_strengths.length - 4} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* AI Summary */}
                                    {profile.sales_narrative && (
                                        <div className="pt-3 border-t">
                                            <p className="text-xs text-slate-500 mb-2">AI-Generated Summary</p>
                                            <p className="text-sm text-slate-600 line-clamp-2">
                                                {profile.sales_narrative}
                                            </p>
                                            <button 
                                                className="text-xs text-violet-600 hover:text-violet-700 font-medium mt-2 flex items-center gap-1"
                                                onClick={() => router.push('/dashboard/profile')}
                                            >
                                                Read full story <Icons.arrowRight className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                    
                                    {/* Completeness */}
                                    <div className="flex items-center justify-between pt-3 border-t">
                                        <div className="flex items-center gap-2">
                                            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                                                    style={{ width: `${profile.profile_completeness || 0}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-slate-500">{profile.profile_completeness || 0}% complete</span>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => router.push('/onboarding')} className="text-xs h-7">
                                            <Icons.edit className="h-3 w-3 mr-1" />
                                            Update
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                                        <Icons.user className="h-5 w-5 text-violet-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900">Sales Profile</h3>
                                        <p className="text-sm text-slate-500">Your AI personalization</p>
                                    </div>
                                </div>
                                <div className="text-center py-8 bg-slate-50 rounded-lg">
                                    <Icons.user className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-600 font-medium mb-1">Create your sales profile</p>
                                    <p className="text-slate-500 text-sm mb-4">
                                        Get personalized AI outputs tailored to your style
                                    </p>
                                    <Button size="sm" onClick={() => router.push('/onboarding')}>
                                        <Icons.plus className="h-4 w-4 mr-1" />
                                        Create Profile
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Company Profile */}
                    <div className="bg-white rounded-xl border overflow-hidden">
                        {companyProfile ? (
                            <>
                                {/* Header with gradient */}
                                <div className="bg-gradient-to-r from-indigo-500 to-blue-600 px-6 py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                                                <Icons.building className="h-7 w-7 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-white text-lg">{companyProfile.company_name || 'Your Company'}</h3>
                                                <p className="text-indigo-100 text-sm">{companyProfile.industry || 'Industry not set'}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button variant="secondary" size="sm" onClick={() => router.push('/dashboard/company-profile')} className="bg-white/20 hover:bg-white/30 text-white border-0">
                                                <Icons.eye className="h-4 w-4 mr-1" />
                                                View
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Content */}
                                <div className="p-6 space-y-4">
                                    {/* Quick Stats */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <p className="text-xs text-slate-500 mb-1">Company Size</p>
                                            <p className="font-semibold text-slate-900">
                                                {companyProfile.company_size || 'Not set'}
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 rounded-lg p-3">
                                            <p className="text-xs text-slate-500 mb-1">Target Market</p>
                                            <p className="font-semibold text-slate-900 truncate">
                                                {companyProfile.target_market || (typeof companyProfile.ideal_customer_profile === 'string' ? companyProfile.ideal_customer_profile.split(',')[0] : 'B2B')}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {/* Value Propositions */}
                                    {Array.isArray(companyProfile.value_propositions) && companyProfile.value_propositions.length > 0 && (
                                        <div>
                                            <p className="text-xs text-slate-500 mb-2">Value Propositions</p>
                                            <div className="flex flex-wrap gap-2">
                                                {companyProfile.value_propositions.slice(0, 3).map((vp: string, i: number) => (
                                                    <span key={i} className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium truncate max-w-[150px]">
                                                        {vp}
                                                    </span>
                                                ))}
                                                {companyProfile.value_propositions.length > 3 && (
                                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs">
                                                        +{companyProfile.value_propositions.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Products/Services */}
                                    {Array.isArray(companyProfile.products_services) && companyProfile.products_services.length > 0 && (
                                        <div>
                                            <p className="text-xs text-slate-500 mb-2">Products & Services</p>
                                            <div className="flex flex-wrap gap-2">
                                                {companyProfile.products_services.slice(0, 3).map((ps: string, i: number) => (
                                                    <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium truncate max-w-[150px]">
                                                        {ps}
                                                    </span>
                                                ))}
                                                {companyProfile.products_services.length > 3 && (
                                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs">
                                                        +{companyProfile.products_services.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* AI Summary */}
                                    {companyProfile.company_narrative && (
                                        <div className="pt-3 border-t">
                                            <p className="text-xs text-slate-500 mb-2">AI-Generated Summary</p>
                                            <p className="text-sm text-slate-600 line-clamp-2">
                                                {companyProfile.company_narrative}
                                            </p>
                                            <button 
                                                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium mt-2 flex items-center gap-1"
                                                onClick={() => router.push('/dashboard/company-profile')}
                                            >
                                                Read full story <Icons.arrowRight className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                    
                                    {/* Completeness */}
                                    <div className="flex items-center justify-between pt-3 border-t">
                                        <div className="flex items-center gap-2">
                                            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all"
                                                    style={{ width: `${companyProfile.profile_completeness || 0}%` }}
                                                />
                                            </div>
                                            <span className="text-xs text-slate-500">{companyProfile.profile_completeness || 0}% complete</span>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => router.push('/onboarding/company')} className="text-xs h-7">
                                            <Icons.edit className="h-3 w-3 mr-1" />
                                            Update
                                        </Button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="p-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                                        <Icons.building className="h-5 w-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900">Company Profile</h3>
                                        <p className="text-sm text-slate-500">Your company context</p>
                                    </div>
                                </div>
                                <div className="text-center py-8 bg-slate-50 rounded-lg">
                                    <Icons.building className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-slate-600 font-medium mb-1">Add your company profile</p>
                                    <p className="text-slate-500 text-sm mb-4">
                                        Help AI understand your products and value props
                                    </p>
                                    <Button size="sm" onClick={() => router.push('/onboarding/company')}>
                                        <Icons.plus className="h-4 w-4 mr-1" />
                                        Create Profile
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Recent Research */}
                    <div className="bg-white rounded-xl border p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-900">Recent Research</h3>
                            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/research')}>
                                View All
                            </Button>
                        </div>
                        {researchBriefs.length === 0 ? (
                            <div className="text-center py-6">
                                <Icons.search className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                                <p className="text-sm text-slate-500 mb-3">No research yet</p>
                                <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/research')}>
                                    Start Research
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {researchBriefs.slice(0, 4).map((brief: any) => (
                                    <button
                                        key={brief.id}
                                        onClick={() => router.push(`/dashboard/research/${brief.id}`)}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                            <Icons.search className="h-4 w-4 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">{brief.company_name}</p>
                                            <p className="text-xs text-slate-500">{getRelativeTime(brief.created_at)}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recent Preps */}
                    <div className="bg-white rounded-xl border p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-900">Recent Preps</h3>
                            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/preparation')}>
                                View All
                            </Button>
                        </div>
                        {meetingPreps.length === 0 ? (
                            <div className="text-center py-6">
                                <Icons.fileText className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                                <p className="text-sm text-slate-500 mb-3">No preps yet</p>
                                <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/preparation')}>
                                    Create Brief
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {meetingPreps.slice(0, 4).map((prep: any) => (
                                    <button
                                        key={prep.id}
                                        onClick={() => router.push('/dashboard/preparation')}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                            <Icons.fileText className="h-4 w-4 text-green-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">{prep.prospect_company_name}</p>
                                            <p className="text-xs text-slate-500">{getRelativeTime(prep.created_at)}</p>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            prep.status === 'completed' ? 'bg-green-100 text-green-700' :
                                            prep.status === 'generating' ? 'bg-blue-100 text-blue-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {prep.status}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Recent Follow-ups */}
                    <div className="bg-white rounded-xl border p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-900">Recent Follow-ups</h3>
                            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/followup')}>
                                View All
                            </Button>
                        </div>
                        {followups.length === 0 ? (
                            <div className="text-center py-6">
                                <Icons.mail className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                                <p className="text-sm text-slate-500 mb-3">No follow-ups yet</p>
                                <Button size="sm" variant="outline" onClick={() => router.push('/dashboard/followup')}>
                                    Upload Recording
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {followups.slice(0, 4).map((followup: any) => (
                                    <button
                                        key={followup.id}
                                        onClick={() => router.push(`/dashboard/followup/${followup.id}`)}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                                            <Icons.mail className="h-4 w-4 text-orange-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">
                                                {followup.prospect_company_name || followup.meeting_subject || 'Meeting'}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {followup.created_at ? getRelativeTime(followup.created_at) : 'No date'}
                                            </p>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full ${
                                            followup.status === 'completed' ? 'bg-green-100 text-green-700' :
                                            followup.status === 'failed' ? 'bg-red-100 text-red-700' :
                                            'bg-blue-100 text-blue-700'
                                        }`}>
                                            {followup.status}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    )
}
