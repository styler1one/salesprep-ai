'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { FileUploadZone } from '@/components/knowledge-base/file-upload-zone'
import { FileList } from '@/components/knowledge-base/file-list'

interface KnowledgeBaseFile {
  id: string
  filename: string
  file_size: number
  file_type: string
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  chunk_count: number
  error_message?: string
  created_at: string
  processed_at?: string
}

export default function KnowledgeBasePage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const [user, setUser] = useState<any>(null)
  const [files, setFiles] = useState<KnowledgeBaseFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        fetchFiles()
      }
      setLoading(false)
    }
    getUser()
  }, [supabase])

  const fetchFiles = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/knowledge-base/files`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
      }
    } catch (error) {
      console.error('Failed to fetch files:', error)
    }
  }, [supabase])

  const handleFileUpload = async (file: File) => {
    setUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const formData = new FormData()
      formData.append('file', file)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      console.log('Uploading to:', `${apiUrl}/api/v1/knowledge-base/upload`)
      
      const response = await fetch(
        `${apiUrl}/api/v1/knowledge-base/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          },
          body: formData
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Upload failed')
      }

      // Refresh file list
      await fetchFiles()
      
      // Start polling for status updates
      setTimeout(() => fetchFiles(), 2000)
    } catch (error: any) {
      console.error('Upload failed:', error)
      const errorMessage = error.message || 'Failed to fetch'
      alert(`Upload failed: ${errorMessage}\n\nCheck browser console (F12) for details.`)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/knowledge-base/files/${fileId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      )

      if (response.ok) {
        await fetchFiles()
      }
    } catch (error) {
      console.error('Delete failed:', error)
      alert('Failed to delete file')
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Auto-refresh for processing files
  useEffect(() => {
    const hasProcessingFiles = files.some(f => 
      f.status === 'uploading' || f.status === 'processing'
    )

    if (hasProcessingFiles) {
      const interval = setInterval(() => {
        fetchFiles()
      }, 3000) // Poll every 3 seconds

      return () => clearInterval(interval)
    }
  }, [files, fetchFiles])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const completedFiles = files.filter(f => f.status === 'completed').length
  const processingFiles = files.filter(f => f.status === 'processing' || f.status === 'uploading').length
  const failedFiles = files.filter(f => f.status === 'failed').length

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
              Knowledge Base
            </h2>
            <p className="text-muted-foreground mt-2">
              Upload company documents to power AI research
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Completed Files
                  </p>
                  <p className="text-2xl font-bold">{completedFiles}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Icons.checkCircle className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Processing
                  </p>
                  <p className="text-2xl font-bold">{processingFiles}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Icons.spinner className="h-6 w-6 text-blue-600 animate-spin" />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Failed
                  </p>
                  <p className="text-2xl font-bold">{failedFiles}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                  <Icons.alertCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Upload Zone */}
          <FileUploadZone 
            onUpload={handleFileUpload}
            uploading={uploading}
          />

          {/* File List */}
          <div className="mt-8">
            <FileList 
              files={files}
              onDelete={handleDeleteFile}
              onRefresh={fetchFiles}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container px-4 text-center text-sm text-muted-foreground">
          <p>SalesPrep AI - Knowledge Base</p>
        </div>
      </footer>
    </div>
  )
}
