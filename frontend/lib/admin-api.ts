/**
 * Admin API Client
 * ================
 * 
 * API client and React Query hooks for the admin panel.
 */

import { api } from './api'
import type {
  AdminCheckResponse,
  DashboardMetrics,
  DashboardTrends,
  UserListResponse,
  AdminUserDetail,
  UserActivityResponse,
  AlertListResponse,
  AdminAlert,
  HealthOverview,
  JobHealthResponse,
  BillingOverview,
  TransactionListResponse,
  FailedPaymentsResponse,
  AuditLogResponse,
  NoteListResponse,
  NoteResponse,
  NoteCreate,
  NoteUpdate,
  ResetFlowsRequest,
  AddFlowsRequest,
  ExtendTrialRequest,
  ResolveAlertRequest,
} from '@/types/admin'

const BASE = '/api/v1/admin'

// ============================================================
// Dashboard API
// ============================================================

export const adminApi = {
  // Check admin access
  checkAccess: async (): Promise<AdminCheckResponse> => {
    const response = await api.get(`${BASE}/dashboard/check`)
    return response.data
  },

  // Get dashboard metrics
  getMetrics: async (): Promise<DashboardMetrics> => {
    const response = await api.get(`${BASE}/dashboard/metrics`)
    return response.data
  },

  // Get usage trends
  getTrends: async (days = 7): Promise<DashboardTrends> => {
    const response = await api.get(`${BASE}/dashboard/trends?days=${days}`)
    return response.data
  },

  // ============================================================
  // Users API
  // ============================================================

  // List users
  listUsers: async (params: {
    search?: string
    plan?: string
    healthStatus?: string
    sortBy?: string
    sortOrder?: string
    offset?: number
    limit?: number
  }): Promise<UserListResponse> => {
    const query = new URLSearchParams()
    if (params.search) query.set('search', params.search)
    if (params.plan) query.set('plan', params.plan)
    if (params.healthStatus) query.set('health_status', params.healthStatus)
    if (params.sortBy) query.set('sort_by', params.sortBy)
    if (params.sortOrder) query.set('sort_order', params.sortOrder)
    if (params.offset) query.set('offset', params.offset.toString())
    if (params.limit) query.set('limit', params.limit.toString())
    
    const response = await api.get(`${BASE}/users?${query.toString()}`)
    return response.data
  },

  // Get user detail
  getUser: async (userId: string): Promise<AdminUserDetail> => {
    const response = await api.get(`${BASE}/users/${userId}`)
    return response.data
  },

  // Get user activity
  getUserActivity: async (userId: string, limit = 50): Promise<UserActivityResponse> => {
    const response = await api.get(`${BASE}/users/${userId}/activity?limit=${limit}`)
    return response.data
  },

  // Reset user flows
  resetFlows: async (userId: string, data: ResetFlowsRequest): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`${BASE}/users/${userId}/reset-flows`, data)
    return response.data
  },

  // Add bonus flows
  addFlows: async (userId: string, data: AddFlowsRequest): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`${BASE}/users/${userId}/add-flows`, data)
    return response.data
  },

  // Extend trial
  extendTrial: async (userId: string, data: ExtendTrialRequest): Promise<{ success: boolean; message: string; newEnd: string }> => {
    const response = await api.post(`${BASE}/users/${userId}/extend-trial`, data)
    return response.data
  },

  // Export user data
  exportUser: async (userId: string): Promise<Record<string, unknown>> => {
    const response = await api.get(`${BASE}/users/${userId}/export`)
    return response.data
  },

  // ============================================================
  // Notes API
  // ============================================================

  // List notes
  listNotes: async (params: {
    targetType?: string
    targetId?: string
  }): Promise<NoteListResponse> => {
    const query = new URLSearchParams()
    if (params.targetType) query.set('target_type', params.targetType)
    if (params.targetId) query.set('target_id', params.targetId)
    
    const response = await api.get(`${BASE}/notes?${query.toString()}`)
    return response.data
  },

  // Create note
  createNote: async (data: NoteCreate): Promise<NoteResponse> => {
    const response = await api.post(`${BASE}/notes`, {
      target_type: data.targetType,
      target_id: data.targetId,
      content: data.content,
      is_pinned: data.isPinned ?? false,
    })
    return response.data
  },

  // Update note
  updateNote: async (noteId: string, data: NoteUpdate): Promise<NoteResponse> => {
    const response = await api.patch(`${BASE}/notes/${noteId}`, {
      content: data.content,
      is_pinned: data.isPinned,
    })
    return response.data
  },

  // Delete note
  deleteNote: async (noteId: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`${BASE}/notes/${noteId}`)
    return response.data
  },

  // ============================================================
  // Alerts API
  // ============================================================

  // List alerts
  listAlerts: async (params: {
    status?: string
    severity?: string
    alertType?: string
    limit?: number
    offset?: number
  }): Promise<AlertListResponse> => {
    const query = new URLSearchParams()
    if (params.status) query.set('status', params.status)
    if (params.severity) query.set('severity', params.severity)
    if (params.alertType) query.set('alert_type', params.alertType)
    if (params.limit) query.set('limit', params.limit.toString())
    if (params.offset) query.set('offset', params.offset.toString())
    
    const response = await api.get(`${BASE}/alerts?${query.toString()}`)
    return response.data
  },

  // Get single alert
  getAlert: async (alertId: string): Promise<AdminAlert> => {
    const response = await api.get(`${BASE}/alerts/${alertId}`)
    return response.data
  },

  // Acknowledge alert
  acknowledgeAlert: async (alertId: string): Promise<{ success: boolean }> => {
    const response = await api.post(`${BASE}/alerts/${alertId}/acknowledge`)
    return response.data
  },

  // Resolve alert
  resolveAlert: async (alertId: string, data: ResolveAlertRequest): Promise<{ success: boolean }> => {
    const response = await api.post(`${BASE}/alerts/${alertId}/resolve`, data)
    return response.data
  },

  // Bulk acknowledge
  bulkAcknowledgeAlerts: async (alertIds: string[]): Promise<{ success: boolean; acknowledgedCount: number }> => {
    const response = await api.post(`${BASE}/alerts/bulk-acknowledge`, alertIds)
    return response.data
  },

  // ============================================================
  // Health API
  // ============================================================

  // Get health overview
  getHealthOverview: async (): Promise<HealthOverview> => {
    const response = await api.get(`${BASE}/health/overview`)
    return response.data
  },

  // Get job health
  getJobHealth: async (): Promise<JobHealthResponse> => {
    const response = await api.get(`${BASE}/health/jobs`)
    return response.data
  },

  // ============================================================
  // Billing API
  // ============================================================

  // Get billing overview
  getBillingOverview: async (): Promise<BillingOverview> => {
    const response = await api.get(`${BASE}/billing/overview`)
    return response.data
  },

  // Get transactions
  getTransactions: async (params: {
    type?: string
    limit?: number
    offset?: number
  }): Promise<TransactionListResponse> => {
    const query = new URLSearchParams()
    if (params.type) query.set('type', params.type)
    if (params.limit) query.set('limit', params.limit.toString())
    if (params.offset) query.set('offset', params.offset.toString())
    
    const response = await api.get(`${BASE}/billing/transactions?${query.toString()}`)
    return response.data
  },

  // Get failed payments
  getFailedPayments: async (): Promise<FailedPaymentsResponse> => {
    const response = await api.get(`${BASE}/billing/failed-payments`)
    return response.data
  },

  // ============================================================
  // Audit API
  // ============================================================

  // Get audit log
  getAuditLog: async (params: {
    action?: string
    targetType?: string
    adminId?: string
    dateFrom?: string
    dateTo?: string
    search?: string
    limit?: number
    cursor?: string
  }): Promise<AuditLogResponse> => {
    const query = new URLSearchParams()
    if (params.action) query.set('action', params.action)
    if (params.targetType) query.set('target_type', params.targetType)
    if (params.adminId) query.set('admin_id', params.adminId)
    if (params.dateFrom) query.set('date_from', params.dateFrom)
    if (params.dateTo) query.set('date_to', params.dateTo)
    if (params.search) query.set('search', params.search)
    if (params.limit) query.set('limit', params.limit.toString())
    if (params.cursor) query.set('cursor', params.cursor)
    
    const response = await api.get(`${BASE}/audit?${query.toString()}`)
    return response.data
  },

  // Get action types
  getActionTypes: async (): Promise<{ actions: string[] }> => {
    const response = await api.get(`${BASE}/audit/actions`)
    return response.data
  },

  // Export audit log
  exportAuditLog: async (params: {
    action?: string
    targetType?: string
    dateFrom?: string
    dateTo?: string
    limit?: number
  }): Promise<Blob> => {
    const query = new URLSearchParams()
    if (params.action) query.set('action', params.action)
    if (params.targetType) query.set('target_type', params.targetType)
    if (params.dateFrom) query.set('date_from', params.dateFrom)
    if (params.dateTo) query.set('date_to', params.dateTo)
    if (params.limit) query.set('limit', params.limit.toString())
    
    const response = await api.get(`${BASE}/audit/export?${query.toString()}`, {
      responseType: 'blob',
    })
    return response.data
  },
}

