'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { adminApi } from '@/lib/admin-api'
import { HealthScoreCard } from '@/components/admin/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Icons } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { AdminUserDetail, ActivityItem, AdminNoteInfo } from '@/types/admin'

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const userId = params.id as string

  const [user, setUser] = useState<AdminUserDetail | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  
  // Action dialogs
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [showAddFlowsDialog, setShowAddFlowsDialog] = useState(false)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [actionReason, setActionReason] = useState('')
  const [flowsToAdd, setFlowsToAdd] = useState(5)
  const [noteContent, setNoteContent] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [userData, activityData] = await Promise.all([
          adminApi.getUser(userId),
          adminApi.getUserActivity(userId, 20),
        ])
        setUser(userData)
        setActivities(activityData.activities)
      } catch (err) {
        console.error('Failed to fetch user:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId])

  const handleResetFlows = async () => {
    if (!actionReason.trim()) return
    setActionLoading(true)
    try {
      await adminApi.resetFlows(userId, { reason: actionReason })
      // Refresh user data
      const userData = await adminApi.getUser(userId)
      setUser(userData)
      setShowResetDialog(false)
      setActionReason('')
    } catch (err) {
      console.error('Failed to reset flows:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddFlows = async () => {
    if (!actionReason.trim() || flowsToAdd < 1) return
    setActionLoading(true)
    try {
      await adminApi.addFlows(userId, { flows: flowsToAdd, reason: actionReason })
      const userData = await adminApi.getUser(userId)
      setUser(userData)
      setShowAddFlowsDialog(false)
      setActionReason('')
      setFlowsToAdd(5)
    } catch (err) {
      console.error('Failed to add flows:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddNote = async () => {
    if (!noteContent.trim()) return
    setActionLoading(true)
    try {
      await adminApi.createNote({
        targetType: 'user',
        targetId: userId,
        content: noteContent,
      })
      const userData = await adminApi.getUser(userId)
      setUser(userData)
      setShowNoteDialog(false)
      setNoteContent('')
    } catch (err) {
      console.error('Failed to add note:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const data = await adminApi.exportUser(userId)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `user-${userId}-export.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icons.loader className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Icons.userX className="h-12 w-12 text-slate-400 mb-4" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          User Not Found
        </h2>
        <Button onClick={() => router.push('/admin/users')}>
          Back to Users
        </Button>
      </div>
    )
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Icons.user },
    { key: 'activity', label: 'Activity', icon: Icons.activity },
    { key: 'flow_packs', label: 'Flow Packs', icon: Icons.package },
    { key: 'notes', label: 'Notes', icon: Icons.fileText },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button 
            variant="ghost" 
            className="mb-2"
            onClick={() => router.push('/admin/users')}
          >
            <Icons.arrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {user.fullName || user.email}
          </h1>
          <p className="text-slate-500">{user.email}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Icons.download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">Plan</div>
            <div className="text-lg font-semibold capitalize">{user.plan.replace('_', ' ')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">Flows Used</div>
            <div className="text-lg font-semibold">
              {user.flowUsage.used}
              {user.flowUsage.limit !== -1 ? `/${user.flowUsage.limit}` : ' (∞)'}
              {user.flowUsage.packBalance > 0 && (
                <span className="text-sm text-purple-500 ml-1">+{user.flowUsage.packBalance}</span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-slate-500">Researches</div>
            <div className="text-lg font-semibold">{user.totalResearches}</div>
          </CardContent>
        </Card>
        <HealthScoreCard 
          score={user.healthScore} 
          status={user.healthStatus}
          className="md:row-span-1"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab.key
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {activeTab === 'overview' && (
            <Card>
              <CardHeader>
                <CardTitle>User Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-500">Email</div>
                    <div className="font-medium">{user.email}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Organization</div>
                    <div className="font-medium">{user.organizationName || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Subscription Status</div>
                    <div className="font-medium capitalize">{user.subscriptionStatus || 'None'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Profile Completeness</div>
                    <div className="font-medium">{user.profileCompleteness}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Member Since</div>
                    <div className="font-medium">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Last Active</div>
                    <div className="font-medium">
                      {user.lastActive 
                        ? new Date(user.lastActive).toLocaleDateString()
                        : 'Never'
                      }
                    </div>
                  </div>
                </div>

                {/* Usage Stats */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="font-medium mb-3">Usage Statistics</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-2xl font-bold text-blue-500">{user.totalResearches}</div>
                      <div className="text-xs text-slate-500">Researches</div>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-2xl font-bold text-green-500">{user.totalPreps}</div>
                      <div className="text-xs text-slate-500">Preparations</div>
                    </div>
                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-2xl font-bold text-orange-500">{user.totalFollowups}</div>
                      <div className="text-xs text-slate-500">Follow-ups</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'activity' && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {activities.length > 0 ? (
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className={cn(
                          'p-2 rounded-full',
                          activity.type === 'research' ? 'bg-blue-100 text-blue-500' :
                          activity.type === 'preparation' ? 'bg-green-100 text-green-500' :
                          'bg-orange-100 text-orange-500'
                        )}>
                          {activity.type === 'research' ? <Icons.search className="h-4 w-4" /> :
                           activity.type === 'preparation' ? <Icons.fileText className="h-4 w-4" /> :
                           <Icons.mail className="h-4 w-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{activity.description}</div>
                          <div className="text-xs text-slate-500">
                            {new Date(activity.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    No recent activity
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'flow_packs' && (
            <Card>
              <CardHeader>
                <CardTitle>Flow Packs</CardTitle>
              </CardHeader>
              <CardContent>
                {user.flowPacks.length > 0 ? (
                  <div className="space-y-3">
                    {user.flowPacks.map((pack) => (
                      <div key={pack.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div>
                          <div className="font-medium">
                            {pack.flowsRemaining} / {pack.flowsPurchased} flows remaining
                          </div>
                          <div className="text-xs text-slate-500">
                            Purchased {new Date(pack.purchasedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <span className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium',
                          pack.status === 'active' ? 'bg-green-100 text-green-700' :
                          pack.status === 'depleted' ? 'bg-slate-100 text-slate-600' :
                          'bg-red-100 text-red-700'
                        )}>
                          {pack.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    No flow packs
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'notes' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Admin Notes</CardTitle>
                <Button size="sm" onClick={() => setShowNoteDialog(true)}>
                  <Icons.plus className="h-4 w-4 mr-1" />
                  Add Note
                </Button>
              </CardHeader>
              <CardContent>
                {user.adminNotes.length > 0 ? (
                  <div className="space-y-3">
                    {user.adminNotes.map((note) => (
                      <div key={note.id} className={cn(
                        'p-3 rounded-lg border',
                        note.isPinned ? 'border-teal-200 bg-teal-50 dark:bg-teal-900/20 dark:border-teal-800' : 
                        'border-slate-100 bg-slate-50 dark:bg-slate-800 dark:border-slate-700'
                      )}>
                        {note.isPinned && (
                          <div className="flex items-center gap-1 text-xs text-teal-600 dark:text-teal-400 mb-2">
                            <Icons.pin className="h-3 w-3" />
                            Pinned
                          </div>
                        )}
                        <div className="text-sm">{note.content}</div>
                        <div className="text-xs text-slate-500 mt-2">
                          By {note.adminName} • {new Date(note.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    No notes yet
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setShowResetDialog(true)}
              >
                <Icons.refresh className="h-4 w-4 mr-2" />
                Reset Monthly Flows
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setShowAddFlowsDialog(true)}
              >
                <Icons.plus className="h-4 w-4 mr-2" />
                Add Bonus Flows
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setShowNoteDialog(true)}
              >
                <Icons.fileText className="h-4 w-4 mr-2" />
                Add Note
              </Button>
              {user.stripeCustomerId && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => window.open(`https://dashboard.stripe.com/customers/${user.stripeCustomerId}`, '_blank')}
                >
                  <Icons.externalLink className="h-4 w-4 mr-2" />
                  View in Stripe
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reset Flows Dialog */}
      {showResetDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Reset Monthly Flows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">
                This will reset the user&apos;s monthly flow count to 0. Please provide a reason.
              </p>
              <Textarea
                placeholder="Reason for reset..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowResetDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleResetFlows}
                  disabled={!actionReason.trim() || actionLoading}
                >
                  {actionLoading ? <Icons.loader className="h-4 w-4 animate-spin mr-2" /> : null}
                  Reset Flows
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Flows Dialog */}
      {showAddFlowsDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Bonus Flows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-500">
                This will create a new flow pack with the specified number of bonus flows.
              </p>
              <div>
                <label className="text-sm font-medium">Number of Flows</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={flowsToAdd}
                  onChange={(e) => setFlowsToAdd(parseInt(e.target.value) || 5)}
                />
              </div>
              <Textarea
                placeholder="Reason for bonus flows..."
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAddFlowsDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddFlows}
                  disabled={!actionReason.trim() || flowsToAdd < 1 || actionLoading}
                >
                  {actionLoading ? <Icons.loader className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add {flowsToAdd} Flows
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Note Dialog */}
      {showNoteDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Admin Note</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Enter your note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                rows={4}
              />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowNoteDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddNote}
                  disabled={!noteContent.trim() || actionLoading}
                >
                  {actionLoading ? <Icons.loader className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add Note
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

