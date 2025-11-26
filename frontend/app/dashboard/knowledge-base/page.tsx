'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import { FileUploadZone } from '@/components/knowledge-base/file-upload-zone'
import { FileList } from '@/components/knowledge-base/file-list'
import { useToast } from '@/components/ui/use-toast'
import { Toaster } from '@/components/ui/toaster'

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
  const { toast } = useToast()
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
      
      toast({
        title: "Upload successful",
        description: `${file.name} is being processed`,
      })
      
      // Start polling for status updates
      setTimeout(() => fetchFiles(), 2000)
    } catch (error: any) {
      console.error('Upload failed:', error)
      const errorMessage = error.message || 'Failed to fetch'
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: errorMessage,
      })
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteFile = async (fileId: string) => {
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
        toast({
          title: "File deleted",
          description: "The file has been removed from your knowledge base",
        })
      } else {
        throw new Error('Delete failed')
      }
    } catch (error) {
      console.error('Delete failed:', error)
      toast({
        variant: "destructive",
        title: "Delete failed",
        description: "Could not delete the file. Please try again.",
      })
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
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icons.fileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold">SalesPrep AI</h1>
              <p className="text-xs text-muted-foreground">Knowledge Base</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-sm text-muted-foreground">
              {user?.email}
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="container py-8 px-4 max-w-7xl">
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Knowledge Base
            </h2>
            <p className="text-muted-foreground mt-2 text-lg">
              Upload and manage your company documents
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3 mb-8">
            <div className="group rounded-xl border bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 p-6 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Completed Files
                  </p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-400">{completedFiles}</p>
                </div>
                <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icons.checkCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            <div className="group rounded-xl border bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 p-6 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Processing
                  </p>
                  <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{processingFiles}</p>
                </div>
                <div className="h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <Icons.spinner className="h-7 w-7 text-blue-600 dark:text-blue-400 animate-spin" />
                </div>
              </div>
            </div>

            <div className="group rounded-xl border bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 p-6 transition-all hover:shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Failed
                  </p>
                  <p className="text-3xl font-bold text-red-700 dark:text-red-400">{failedFiles}</p>
                </div>
                <div className="h-14 w-14 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icons.alertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
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
      <footer className="border-t bg-muted/30 py-6 mt-auto">
        <div className="container px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Built with <span className="text-red-500">♥</span> by SalesPrep AI
          </p>
        </div>
      </footer>
      
      <Toaster />
    </div>
  )
}
