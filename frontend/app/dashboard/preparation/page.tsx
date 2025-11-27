'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, FileText, Download, Trash2, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

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
}

export default function PreparationPage() {
    const router = useRouter()
    const supabase = createClientComponentClient()
    const { toast } = useToast()

    const [loading, setLoading] = useState(false)
    const [preps, setPreps] = useState<MeetingPrep[]>([])
    const [selectedPrep, setSelectedPrep] = useState<MeetingPrep | null>(null)

    // Form state
    const [companyName, setCompanyName] = useState('')
    const [meetingType, setMeetingType] = useState('discovery')
    const [customNotes, setCustomNotes] = useState('')

    useEffect(() => {
        loadPreps()

        // Poll for status updates every 5 seconds
        const interval = setInterval(() => {
            if (preps.some(p => p.status === 'pending' || p.status === 'generating')) {
                loadPreps()
            }
        }, 5000)

        return () => clearInterval(interval)
    }, [])

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

    const getStatusBadge = (status: string) => {
        const colors = {
            pending: 'bg-yellow-100 text-yellow-800',
            generating: 'bg-blue-100 text-blue-800',
            completed: 'bg-green-100 text-green-800',
            failed: 'bg-red-100 text-red-800'
        }
        return (
            <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
                {status}
            </span>
        )
    }

    return (
        <div className="container mx-auto p-6 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Meeting Preparation</h1>
                <p className="text-muted-foreground">AI-powered meeting briefs using your knowledge base and research</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Left Column - Form */}
                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Prepare for a Meeting</CardTitle>
                            <CardDescription>Generate an AI-powered meeting brief</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <Label htmlFor="company">Prospect Company *</Label>
                                    <Input
                                        id="company"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        placeholder="e.g., Ordina"
                                        required
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="type">Meeting Type *</Label>
                                    <Select value={meetingType} onValueChange={setMeetingType}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="discovery">Discovery Call</SelectItem>
                                            <SelectItem value="demo">Product Demo</SelectItem>
                                            <SelectItem value="closing">Closing Call</SelectItem>
                                            <SelectItem value="follow_up">Follow-up Meeting</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="notes">Custom Notes (optional)</Label>
                                    <Textarea
                                        id="notes"
                                        value={customNotes}
                                        onChange={(e) => setCustomNotes(e.target.value)}
                                        placeholder="Any specific context or focus areas..."
                                        rows={3}
                                    />
                                </div>

                                <Button type="submit" disabled={loading || !companyName} className="w-full">
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        'Generate Brief'
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {/* Recent Preps */}
                    <Card className="mt-6">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Recent Preparations ({preps.length})</CardTitle>
                                <Button variant="ghost" size="sm" onClick={loadPreps}>
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {preps.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No preparations yet</p>
                                ) : (
                                    preps.map((prep) => (
                                        <div
                                            key={prep.id}
                                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                                            onClick={() => viewPrep(prep.id)}
                                        >
                                            <div className="flex-1">
                                                <div className="font-medium">{prep.prospect_company_name}</div>
                                                <div className="text-sm text-muted-foreground capitalize">{prep.meeting_type.replace('_', ' ')}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getStatusBadge(prep.status)}
                                                {prep.status === 'generating' && <Loader2 className="h-4 w-4 animate-spin" />}
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
                        <Card>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <CardTitle>{selectedPrep.prospect_company_name}</CardTitle>
                                        <CardDescription className="capitalize">{selectedPrep.meeting_type.replace('_', ' ')}</CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        {selectedPrep.pdf_url && (
                                            <Button variant="outline" size="sm">
                                                <Download className="h-4 w-4 mr-2" />
                                                PDF
                                            </Button>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => deletePrep(selectedPrep.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {selectedPrep.status === 'completed' ? (
                                    <div className="space-y-6">
                                        {/* Brief Content */}
                                        {selectedPrep.brief_content && (
                                            <div className="prose prose-sm max-w-none">
                                                <pre className="whitespace-pre-wrap font-sans text-sm">{selectedPrep.brief_content}</pre>
                                            </div>
                                        )}

                                        {/* Questions */}
                                        {selectedPrep.questions && selectedPrep.questions.length > 0 && (
                                            <div>
                                                <h3 className="font-semibold mb-2">Key Questions</h3>
                                                <ul className="list-disc list-inside space-y-1 text-sm">
                                                    {selectedPrep.questions.map((q, i) => (
                                                        <li key={i}>{q}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ) : selectedPrep.status === 'failed' ? (
                                    <div className="text-center py-8">
                                        <p className="text-red-600">Generation failed. Please try again.</p>
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                                        <p className="text-muted-foreground">Generating brief...</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardContent className="flex items-center justify-center h-64">
                                <div className="text-center">
                                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                    <p className="text-muted-foreground">Select a prep to view details</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
