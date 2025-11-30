/**
 * Centralized API client for making authenticated requests.
 * 
 * This module provides a consistent way to make API calls with:
 * - Automatic authentication header injection
 * - Consistent error handling
 * - Type-safe responses
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { ApiError } from '@/types'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

interface ApiResponse<T> {
  data: T | null
  error: ApiError | null
  status: number
}

/**
 * Custom error class for API errors.
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

/**
 * Get the current access token from Supabase.
 */
async function getAccessToken(): Promise<string | null> {
  const supabase = createClientComponentClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

/**
 * Make an authenticated API request.
 * 
 * @example
 * ```ts
 * // GET request
 * const { data, error } = await apiClient<ResearchBrief[]>('/api/v1/research')
 * 
 * // POST request
 * const { data, error } = await apiClient<ResearchBrief>('/api/v1/research/start', {
 *   method: 'POST',
 *   body: { company_name: 'Acme Inc' }
 * })
 * ```
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { body, headers: customHeaders, ...restOptions } = options
  
  try {
    const token = await getAccessToken()
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(customHeaders as Record<string, string>),
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
    
    const response = await fetch(url, {
      ...restOptions,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    
    // Handle no content response
    if (response.status === 204) {
      return { data: null, error: null, status: response.status }
    }
    
    const responseData = await response.json()
    
    if (!response.ok) {
      const error: ApiError = {
        message: responseData.detail || responseData.message || 'An error occurred',
        code: responseData.code,
        details: responseData,
      }
      return { data: null, error, status: response.status }
    }
    
    return { data: responseData as T, error: null, status: response.status }
  } catch (err) {
    const error: ApiError = {
      message: err instanceof Error ? err.message : 'Network error',
      code: 'NETWORK_ERROR',
    }
    return { data: null, error, status: 0 }
  }
}

/**
 * Convenience methods for common HTTP verbs.
 */
export const api = {
  get: <T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiClient<T>(endpoint, { ...options, method: 'GET' }),
  
  post: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...options, method: 'POST', body }),
  
  put: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...options, method: 'PUT', body }),
  
  patch: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...options, method: 'PATCH', body }),
  
  delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
}

/**
 * Upload a file with authentication.
 * 
 * @example
 * ```ts
 * const { data, error } = await uploadFile('/api/v1/followup/upload', file, {
 *   company_name: 'Acme Inc',
 *   language: 'en'
 * })
 * ```
 */
export async function uploadFile<T>(
  endpoint: string,
  file: File,
  additionalFields?: Record<string, string>
): Promise<ApiResponse<T>> {
  try {
    const token = await getAccessToken()
    
    const formData = new FormData()
    formData.append('file', file)
    
    if (additionalFields) {
      Object.entries(additionalFields).forEach(([key, value]) => {
        formData.append(key, value)
      })
    }
    
    const headers: Record<string, string> = {}
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
    
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    })
    
    const responseData = await response.json()
    
    if (!response.ok) {
      const error: ApiError = {
        message: responseData.detail || responseData.message || 'Upload failed',
        code: responseData.code,
        details: responseData,
      }
      return { data: null, error, status: response.status }
    }
    
    return { data: responseData as T, error: null, status: response.status }
  } catch (err) {
    const error: ApiError = {
      message: err instanceof Error ? err.message : 'Upload error',
      code: 'UPLOAD_ERROR',
    }
    return { data: null, error, status: 0 }
  }
}

