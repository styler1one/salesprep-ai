'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icons } from '@/components/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MarkdownEditor } from '@/components/markdown-editor'
import ReactMarkdown from 'react-markdown'
import { exportAsMarkdown, exportAsPdf, exportAsDocx } from '@/lib/export-utils'
import { useToast } from '@/components/ui/use-toast'
import type { FollowupAction } from '@/types/followup-actions'
import { getActionTypeInfo, isActionGenerating, isActionError } from '@/types/followup-actions'
import { cn } from '@/lib/utils'

interface ActionPanelProps {
  action: FollowupAction
  companyName: string
  onUpdate: (actionId: string, content: string) => Promise<void>
  onDelete: (actionId: string) => Promise<void>
  onRegenerate: (actionId: string) => void
  onClose: () => void
}

export function ActionPanel({
  action,
  companyName,
  onUpdate,
  onDelete,
  onRegenerate,
  onClose,
}: ActionPanelProps) {
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(action.content || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const actionInfo = getActionTypeInfo(action.action_type)
  const isGenerating = isActionGenerating(action)
  const hasError = isActionError(action)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onUpdate(action.id, editedContent)
      setIsEditing(false)
      toast({ title: 'Changes saved' })
    } catch (error) {
      toast({ title: 'Failed to save', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditedContent(action.content || '')
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this action?')) return
    
    setIsDeleting(true)
    try {
      await onDelete(action.id)
      onClose()
      toast({ title: 'Action deleted' })
    } catch (error) {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleExportPdf = async () => {
    if (!action.content) return
    setIsExporting(true)
    try {
      await exportAsPdf(action.content, companyName, `${companyName} - ${actionInfo.label}`)
      toast({ title: 'PDF downloaded' })
    } catch (error) {
      toast({ title: 'Export failed', variant: 'destructive' })
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportDocx = async () => {
    if (!action.content) return
    setIsExporting(true)
    try {
      await exportAsDocx(action.content, companyName, `${companyName} - ${actionInfo.label}`)
      toast({ title: 'Word document downloaded' })
    } catch (error) {
      toast({ title: 'Export failed', variant: 'destructive' })
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportMd = () => {
    if (!action.content) return
    exportAsMarkdown(action.content, `${companyName}_${action.action_type}`)
    toast({ title: 'Markdown downloaded' })
  }

  const handleCopy = () => {
    if (!action.content) return
    navigator.clipboard.writeText(action.content)
    toast({ title: 'Copied to clipboard' })
  }

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} min ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{actionInfo.icon}</span>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {actionInfo.label}
            </h3>
            {action.metadata?.status === 'completed' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {action.word_count} words • Generated {formatRelativeTime(action.created_at)}
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <Icons.x className="h-4 w-4" />
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-700">
        {isEditing ? (
          <>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Icons.check className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} disabled={isGenerating}>
              <Icons.edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!action.content}>
              <Icons.copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!action.content || isExporting}>
                  {isExporting ? (
                    <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Icons.download className="h-4 w-4 mr-2" />
                  )}
                  Export
                  <Icons.chevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handleExportPdf}>
                  <Icons.fileText className="h-4 w-4 mr-2" />
                  Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportDocx}>
                  <Icons.fileText className="h-4 w-4 mr-2" />
                  Download Word
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportMd}>
                  <Icons.fileText className="h-4 w-4 mr-2" />
                  Download Markdown
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="flex-1" />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onRegenerate(action.id)}
              disabled={isGenerating}
            >
              <Icons.refresh className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              {isDeleting ? (
                <Icons.spinner className="h-4 w-4 animate-spin" />
              ) : (
                <Icons.trash className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {isGenerating && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icons.spinner className="h-8 w-8 text-amber-600 animate-spin mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Generating content...</p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
              This may take 10-30 seconds
            </p>
          </div>
        )}

        {hasError && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icons.alertCircle className="h-8 w-8 text-red-500 mb-4" />
            <p className="text-red-600 dark:text-red-400">Generation failed</p>
            <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
              {action.metadata?.error || 'An error occurred. Please try regenerating.'}
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onRegenerate(action.id)}
              className="mt-4"
            >
              <Icons.refresh className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {!isGenerating && !hasError && isEditing && (
          <MarkdownEditor
            value={editedContent}
            onChange={setEditedContent}
            placeholder="Edit content..."
            disabled={isSaving}
          />
        )}

        {!isGenerating && !hasError && !isEditing && action.content && (
          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-20">
            <ReactMarkdown
              components={{
                h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-6 mb-3 pb-2 border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-5 mb-2 text-slate-900 dark:text-white" {...props} />,
                p: ({ node, ...props }) => <p className="mb-4 leading-relaxed text-slate-700 dark:text-slate-300" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-4 space-y-1" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-4 space-y-1" {...props} />,
                li: ({ node, ...props }) => <li className="ml-4 text-slate-700 dark:text-slate-300" {...props} />,
                strong: ({ node, ...props }) => <strong className="font-semibold text-slate-900 dark:text-white" {...props} />,
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full border-collapse border border-slate-200 dark:border-slate-700" {...props} />
                  </div>
                ),
                th: ({ node, ...props }) => <th className="border border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-800 text-left font-semibold text-slate-900 dark:text-white" {...props} />,
                td: ({ node, ...props }) => <td className="border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-700 dark:text-slate-300" {...props} />,
              }}
            >
              {action.content}
            </ReactMarkdown>
          </div>
        )}

        {!isGenerating && !hasError && !action.content && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-slate-500 dark:text-slate-400">No content yet</p>
          </div>
        )}
      </div>

      {/* Metadata footer */}
      {action.metadata?.generated_with_context && action.metadata.generated_with_context.length > 0 && (
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium">Context used:</span>{' '}
            {action.metadata.generated_with_context.join(', ')}
          </p>
        </div>
      )}
    </div>
  )
}

