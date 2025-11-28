'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, FileText, Download, Trash2, RefreshCw, ArrowLeft, Copy, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import ReactMarkdown from 'react-markdown'
import { DashboardLayout } from '@/components/layout'
import { ProspectAutocomplete } from '@/components/prospect-autocomplete'

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

interface ResearchBrief {
    id: string
    company_name: string
    status: string
    created_at: string
}

export default function PreparationPage() {
    const router = useRouter()
    const supabase = createClientComponentClient()
    const { toast } = useToast()

    const [user, setUser] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [preps, setPreps] = useState<MeetingPrep[]>([])
    const [selectedPrep, setSelectedPrep] = useState<MeetingPrep | null>(null)
    const [researchBriefs, setResearchBriefs] = useState<ResearchBrief[]>([])
    const [copiedSection, setCopiedSection] = useState<string | null>(null)

    // Form state
    const [companyName, setCompanyName] = useState('')
    const [meetingType, setMeetingType] = useState('discovery')
    const [customNotes, setCustomNotes] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)

    // Company suggestions based on research briefs
    const companySuggestions = useMemo(() => {
        if (!companyName) return []
        const searchTerm = companyName.toLowerCase()
        return researchBriefs
            .filter(b => b.company_name.toLowerCase().includes(searchTerm))
            .slice(0, 5)
    }, [companyName, researchBriefs])

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
        }
        getUser()
        loadPreps()
        loadResearchBriefs()

        // Poll for status updates every 5 seconds
        const interval = setInterval(() => {
            if (preps.some(p => p.status === 'pending' || p.status === 'generating')) {
                loadPreps()
            }
        }, 5000)

        return () => clearInterval(interval)
    }, [supabase])

    const loadResearchBriefs = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(`${apiUrl}/api/v1/research/briefs`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })

            if (response.ok) {
                const data = await response.json()
                setResearchBriefs(data.briefs || [])
            }
        } catch (error) {
            console.error('Failed to load research briefs:', error)
        }
    }

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
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                toast({ title: 'Error', description: 'Not authenticated', variant: 'destructive' })
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
                    custom_notes: customNotes || null
                })
            })

            if (response.ok) {
                toast({ title: 'Success', description: 'Meeting prep started! Generation in progress...' })
                setCompanyName('')
                setCustomNotes('')
                loadPreps()
            } else {
                const error = await response.json()
                toast({ title: 'Error', description: error.detail || 'Failed to start prep', variant: 'destructive' })
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to start prep', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    const viewPrep = async (prepId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(`${apiUrl}/api/v1/prep/${prepId}`, {
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })

            if (response.ok) {
                const data = await response.json()
                setSelectedPrep(data)
            }
        } catch (error) {
            console.error('Failed to load prep:', error)
        }
    }

    const deletePrep = async (prepId: string) => {
        if (!confirm('Are you sure you want to delete this prep?')) return

        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) return

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            const response = await fetch(`${apiUrl}/api/v1/prep/${prepId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session.access_token}` }
            })

            if (response.ok) {
                toast({ title: 'Success', description: 'Prep deleted' })
                setSelectedPrep(null)
                loadPreps()
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete prep', variant: 'destructive' })
        }
    }

    const copyToClipboard = async (text: string, section: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopiedSection(section)
            toast({ title: 'Copied!', description: `${section} copied to clipboard` })
            setTimeout(() => setCopiedSection(null), 2000)
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' })
        }
    }

    const getStatusBadge = (status: string) => {
        const configs = {
            pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
            generating: { color: 'bg-blue-100 text-blue-800', icon: Loader2, label: 'Generating' },
            completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Ready' },
            failed: { color: 'bg-red-100 text-red-800', icon: AlertCircle, label: 'Failed' }
        }
        const config = configs[status as keyof typeof configs] || configs.pending
        const Icon = config.icon

        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${config.color}`}>
                <Icon className={`h-3 w-3 ${status === 'generating' ? 'animate-spin' : ''}`} />
                {config.label}
            </span>
        )
    }

    const getMeetingTypeLabel = (type: string) => {
        const labels: Record<string, string> = {
            discovery: 'Discovery Call',
            demo: 'Product Demo',
            closing: 'Closing Call',
            follow_up: 'Follow-up Meeting',
            other: 'Other'
        }
        return labels[type] || type
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMs / 3600000)
        const diffDays = Math.floor(diffMs / 86400000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        if (diffDays < 7) return `${diffDays}d ago`
        return date.toLocaleDateString()
    }

    return (
        <DashboardLayout user={user}>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">Meeting Preparation</h1>
                    <p className="text-slate-500">
                        AI-powered meeting briefs using your knowledge base, research, and profile context
                    </p>
                </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Left Column - Form & History */}
                <div className="space-y-6">
                    {/* Create New Prep */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Prepare for a Meeting
                            </CardTitle>
                            <CardDescription>Generate an AI-powered meeting brief personalized to your style</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* Company Name with Autocomplete */}
                                <div>
                                    <Label htmlFor="company">Prospect Company *</Label>
                                    <ProspectAutocomplete
                                        value={companyName}
                                        onChange={setCompanyName}
                                        placeholder="Zoek of voer bedrijfsnaam in..."
                                    />
                                </div>

                                {/* Meeting Type */}
                                <div>
                                    <Label htmlFor="type">Meeting Type *</Label>
                                    <Select value={meetingType} onValueChange={setMeetingType}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="discovery">🔍 Discovery Call</SelectItem>
                                            <SelectItem value="demo">🖥️ Product Demo</SelectItem>
                                            <SelectItem value="closing">🤝 Closing Call</SelectItem>
                                            <SelectItem value="follow_up">📞 Follow-up Meeting</SelectItem>
                                            <SelectItem value="other">📋 Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Custom Notes */}
                                <div>
                                    <Label htmlFor="notes">Custom Notes (optional)</Label>
                                    <Textarea
                                        id="notes"
                                        value={customNotes}
                                        onChange={(e) => setCustomNotes(e.target.value)}
                                        placeholder="Any specific context, focus areas, or things to avoid..."
                                        rows={3}
                                    />
                                </div>

                                <Button type="submit" disabled={loading || !companyName} className="w-full">
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating Brief...
                                        </>
                                    ) : (
                                        <>
                                            <FileText className="mr-2 h-4 w-4" />
                                            Generate Meeting Brief
                                        </>
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Recent Preps */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Recent Preparations</CardTitle>
                                <Button variant="ghost" size="sm" onClick={loadPreps}>
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {preps.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                                        <p>No preparations yet</p>
                                        <p className="text-sm">Generate your first meeting brief above</p>
                                    </div>
                                ) : (
                                    preps.map((prep) => (
                                        <div
                                            key={prep.id}
                                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedPrep?.id === prep.id
                                                ? 'bg-primary/5 border-primary'
                                                : 'hover:bg-muted/50'
                                                }`}
                                            onClick={() => viewPrep(prep.id)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate">{prep.prospect_company_name}</div>
                                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <span>{getMeetingTypeLabel(prep.meeting_type)}</span>
                                                    <span>•</span>
                                                    <span>{formatDate(prep.created_at)}</span>
                                                </div>
                                            </div>
                                            <div className="ml-2">
                                                {getStatusBadge(prep.status)}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Brief Display */}
                <div>
                    {selectedPrep ? (
                        <Card className="sticky top-6">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Building2 className="h-5 w-5" />
                                            {selectedPrep.prospect_company_name}
                                        </CardTitle>
                                        <CardDescription className="flex items-center gap-2 mt-1">
                                            {getMeetingTypeLabel(selectedPrep.meeting_type)}
                                            <span>•</span>
                                            {getStatusBadge(selectedPrep.status)}
                                        </CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        {selectedPrep.brief_content && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => copyToClipboard(selectedPrep.brief_content!, 'Brief')}
                                            >
                                                {copiedSection === 'Brief' ? (
                                                    <CheckCircle className="h-4 w-4" />
                                                ) : (
                                                    <Copy className="h-4 w-4" />
                                                )}
                                            </Button>
                                        )}
                                        {selectedPrep.pdf_url && (
                                            <Button variant="outline" size="sm" asChild>
                                                <a href={selectedPrep.pdf_url} target="_blank" rel="noopener noreferrer">
                                                    <Download className="h-4 w-4 mr-2" />
                                                    PDF
                                                </a>
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => deletePrep(selectedPrep.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {selectedPrep.status === 'completed' ? (
                                    <div className="space-y-6">
                                        {/* Brief Content with Markdown */}
                                        {selectedPrep.brief_content && (
                                            <div className="prose prose-sm max-w-none dark:prose-invert">
                                                <ReactMarkdown
                                                    components={{
                                                        h1: ({ children }) => <h1 className="text-xl font-bold mt-6 mb-3 text-foreground">{children}</h1>,
                                                        h2: ({ children }) => <h2 className="text-lg font-semibold mt-5 mb-2 text-foreground">{children}</h2>,
                                                        h3: ({ children }) => <h3 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h3>,
                                                        p: ({ children }) => <p className="mb-2 text-muted-foreground">{children}</p>,
                                                        ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                                                        ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                                                        li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
                                                        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                                                        hr: () => <hr className="my-4 border-border" />,
                                                    }}
                                                >
                                                    {selectedPrep.brief_content}
                                                </ReactMarkdown>
                                            </div>
                                        )}

                                        {/* Questions Section */}
                                        {selectedPrep.questions && selectedPrep.questions.length > 0 && (
                                            <div className="border-t pt-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="font-semibold">Key Questions</h3>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => copyToClipboard(selectedPrep.questions!.join('\n'), 'Questions')}
                                                    >
                                                        {copiedSection === 'Questions' ? (
                                                            <CheckCircle className="h-4 w-4" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                                <ul className="space-y-2">
                                                    {selectedPrep.questions.map((q, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-sm">
                                                            <span className="font-medium text-primary min-w-[20px]">{i + 1}.</span>
                                                            <span className="text-muted-foreground">{q}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ) : selectedPrep.status === 'failed' ? (
                                    <div className="text-center py-12">
                                        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                                        <p className="text-red-600 font-medium mb-2">Generation Failed</p>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            {selectedPrep.error_message || 'An error occurred while generating the brief.'}
                                        </p>
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setCompanyName(selectedPrep.prospect_company_name)
                                                setMeetingType(selectedPrep.meeting_type)
                                                setCustomNotes(selectedPrep.custom_notes || '')
                                            }}
                                        >
                                            Try Again
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="text-center py-12">
                                        <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
                                        <p className="font-medium mb-1">Generating your meeting brief...</p>
                                        <p className="text-sm text-muted-foreground">
                                            This usually takes 30-60 seconds
                                        </p>
                                        <div className="mt-6 max-w-xs mx-auto">
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="sticky top-6">
                            <CardContent className="flex flex-col items-center justify-center h-96">
                                <FileText className="h-16 w-16 mb-4 text-muted-foreground/30" />
                                <p className="text-lg font-medium text-muted-foreground">No prep selected</p>
                                <p className="text-sm text-muted-foreground">
                                    Select a preparation from the list or create a new one
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
        </DashboardLayout>
    )
}
