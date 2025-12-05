'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { adminApi } from '@/lib/admin-api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icons } from '@/components/icons'
import { cn } from '@/lib/utils'
import type { AdminUserListItem, UserListResponse } from '@/types/admin'

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<AdminUserListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState<string>('')
  const [healthFilter, setHealthFilter] = useState<string>('')
  const [offset, setOffset] = useState(0)
  const limit = 25

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await adminApi.listUsers({
        search: search || undefined,
        plan: planFilter || undefined,
        healthStatus: healthFilter || undefined,
        offset,
        limit,
      })
      setUsers(data.users)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to fetch users:', err)
    } finally {
      setLoading(false)
    }
  }, [search, planFilter, healthFilter, offset])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    fetchUsers()
  }

  const getHealthBadge = (status: string, score: number) => {
    const colors = {
      healthy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      at_risk: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    }
    return (
      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', colors[status as keyof typeof colors])}>
        {score}
      </span>
    )
  }

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = {
      free: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
      pro_solo: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      unlimited_solo: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      enterprise: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    }
    const labels: Record<string, string> = {
      free: 'Free',
      pro_solo: 'Pro Solo',
      unlimited_solo: 'Unlimited',
      enterprise: 'Enterprise',
    }
    return (
      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', colors[plan] || colors.free)}>
        {labels[plan] || plan}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Users</h1>
        <span className="text-sm text-slate-500">{total} total users</span>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Icons.search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by email, name, or organization..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <select
              value={planFilter}
              onChange={(e) => { setPlanFilter(e.target.value); setOffset(0) }}
              className="h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            >
              <option value="">All Plans</option>
              <option value="free">Free</option>
              <option value="pro_solo">Pro Solo</option>
              <option value="unlimited_solo">Unlimited Solo</option>
              <option value="enterprise">Enterprise</option>
            </select>
            <select
              value={healthFilter}
              onChange={(e) => { setHealthFilter(e.target.value); setOffset(0) }}
              className="h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            >
              <option value="">All Health</option>
              <option value="healthy">Healthy</option>
              <option value="at_risk">At Risk</option>
              <option value="critical">Critical</option>
            </select>
            <Button type="submit">
              <Icons.search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Icons.loader className="h-6 w-6 animate-spin text-teal-500" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <Icons.users className="h-12 w-12 mb-4 opacity-50" />
              <span>No users found</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Flows
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Health
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Last Active
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map((user) => (
                    <tr 
                      key={user.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                      onClick={() => router.push(`/admin/users/${user.id}`)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-slate-900 dark:text-white">
                            {user.fullName || 'No name'}
                          </div>
                          <div className="text-sm text-slate-500">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {user.organizationName || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {getPlanBadge(user.plan)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={cn(
                          user.flowUsage.limit === -1 ? 'text-slate-500' :
                          user.flowUsage.used >= user.flowUsage.limit ? 'text-red-500 font-medium' :
                          'text-slate-500'
                        )}>
                          {user.flowUsage.used}
                          {user.flowUsage.limit !== -1 && `/${user.flowUsage.limit}`}
                          {user.flowUsage.limit === -1 && ' (∞)'}
                        </span>
                        {user.flowUsage.packBalance > 0 && (
                          <span className="ml-1 text-xs text-purple-500">
                            +{user.flowUsage.packBalance}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {getHealthBadge(user.healthStatus, user.healthScore)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {user.lastActive 
                          ? new Date(user.lastActive).toLocaleDateString()
                          : 'Never'
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/admin/users/${user.id}`)
                          }}
                        >
                          <Icons.eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-500">
                Showing {offset + 1} to {Math.min(offset + limit, total)} of {total}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + limit >= total}
                  onClick={() => setOffset(offset + limit)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

