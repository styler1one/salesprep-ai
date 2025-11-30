'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { User } from '@supabase/supabase-js'
import { 
  Building2, 
  Search, 
  Plus,
  ChevronRight,
  MapPin,
  Users,
  Target,
  Loader2,
  Filter
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'
import { Prospect } from '@/types'

export default function ProspectsPage() {
  const router = useRouter()
  const t = useTranslations('prospects')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  
  // Fetch user and prospects
  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
        
        if (user) {
          // Get organization ID
          const { data: orgMember } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .single()
          
          if (orgMember) {
            // Fetch prospects using Supabase directly for now
            let query = supabase
              .from('prospects')
              .select('*')
              .eq('organization_id', orgMember.organization_id)
              .order('last_activity_at', { ascending: false })
            
            if (searchQuery) {
              query = query.ilike('company_name', `%${searchQuery}%`)
            }
            
            if (statusFilter) {
              query = query.eq('status', statusFilter)
            }
            
            const { data, error } = await query.limit(50)
            
            if (error) {
              toast({ variant: "destructive", title: t('errors.loadFailed') })
              console.error('Failed to load prospects:', error)
            } else {
              setProspects(data || [])
            }
          }
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast({ variant: "destructive", title: t('errors.loadFailed') })
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [supabase, searchQuery, statusFilter, t])
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
      case 'researching': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'qualified': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      case 'meeting_scheduled': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      case 'proposal_sent': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
      case 'won': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      case 'lost': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
    }
  }
  
  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-7 h-7 text-blue-500" />
              {t('title')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {t('subtitle')}
            </p>
          </div>
          <Button onClick={() => router.push('/dashboard/research')}>
            <Plus className="w-4 h-4 mr-2" />
            {t('actions.newProspect')}
          </Button>
        </div>
        
        {/* Search and Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Prospects Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : prospects.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <h3 className="text-lg font-medium mb-2">{t('empty.title')}</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-4">
                  {t('empty.description')}
                </p>
                <Button onClick={() => router.push('/dashboard/research')}>
                  <Search className="w-4 h-4 mr-2" />
                  {t('actions.startResearch')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prospects.map(prospect => (
              <Card 
                key={prospect.id}
                className="cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition group"
                onClick={() => router.push(`/dashboard/prospects/${prospect.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                          {prospect.company_name}
                        </h3>
                        {prospect.industry && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {prospect.industry}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition" />
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
                    {prospect.headquarters_location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {prospect.headquarters_location}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusColor(prospect.status)}>
                      {t(`status.${prospect.status}`)}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {prospect.last_activity_at && (
                        new Date(prospect.last_activity_at).toLocaleDateString()
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

