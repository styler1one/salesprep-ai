'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DashboardLayout } from '@/components/layout'
import { 
  ArrowLeft, 
  Globe,
  MessageSquare,
  Mail,
  Loader2,
  Settings,
  Save,
  CreditCard,
  Link,
  Bell
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/ui/use-toast'
import { useSettings } from '@/lib/settings-context'
import { LanguageSelect } from '@/components/language-select'
import { Badge } from '@/components/ui/badge'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const { toast } = useToast()
  
  const { settings, updateSettings, loading: settingsLoading } = useSettings()
  
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Local state for form
  const [appLanguage, setAppLanguage] = useState('nl')
  const [outputLanguage, setOutputLanguage] = useState('nl')
  const [emailLanguage, setEmailLanguage] = useState('nl')

  // Sync local state with settings when loaded
  useEffect(() => {
    if (!settingsLoading && settings) {
      setAppLanguage(settings.app_language)
      setOutputLanguage(settings.output_language)
      setEmailLanguage(settings.email_language)
    }
  }, [settings, settingsLoading])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      setLoading(false)
    }
    getUser()
  }, [supabase, router])

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings({
        app_language: appLanguage,
        output_language: outputLanguage,
        email_language: emailLanguage,
      })

      toast({
        title: t('saved'),
        description: t('savedDesc'),
      })

      // If app language changed, update cookie and reload
      if (appLanguage !== settings.app_language) {
        document.cookie = `NEXT_LOCALE=${appLanguage}; path=/; max-age=31536000`
        // Small delay before reload to show toast
        setTimeout(() => {
          window.location.reload()
        }, 500)
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast({
        title: t('error'),
        description: t('errorDesc'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Check if there are unsaved changes
  const hasChanges = 
    appLanguage !== settings.app_language ||
    outputLanguage !== settings.output_language ||
    emailLanguage !== settings.email_language

  if (loading || settingsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <DashboardLayout user={user}>
      <div className="p-6 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {tCommon('back')}
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
              <Settings className="h-6 w-6 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('title')}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('description')}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Language Settings Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-500" />
                <CardTitle>{t('language.title')}</CardTitle>
              </div>
              <CardDescription>
                {t('language.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* App Language */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                  <Globe className="h-4 w-4 text-slate-400" />
                  {t('language.appLanguage')}
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('language.appLanguageDesc')}
                </p>
                <LanguageSelect
                  value={appLanguage}
                  onChange={setAppLanguage}
                />
              </div>

              {/* Output Language */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-slate-400" />
                  {t('language.outputLanguage')}
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('language.outputLanguageDesc')}
                </p>
                <LanguageSelect
                  value={outputLanguage}
                  onChange={setOutputLanguage}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                  💡 {t('language.outputLanguageHint')}
                </p>
              </div>

              {/* Email Language */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  {t('language.emailLanguage')}
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('language.emailLanguageDesc')}
                </p>
                <LanguageSelect
                  value={emailLanguage}
                  onChange={setEmailLanguage}
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                  💡 {t('language.emailLanguageHint')}
                </p>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t">
                <Button 
                  onClick={handleSave} 
                  disabled={saving || !hasChanges}
                  className="gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('saving')}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {t('save')}
                    </>
                  )}
                </Button>
                {hasChanges && (
                  <span className="ml-3 text-sm text-amber-600 dark:text-amber-400">
                    {t('unsavedChanges')}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon: Subscription */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-emerald-500" />
                <CardTitle className="flex items-center gap-2">
                  {t('sections.subscription')}
                  <Badge variant="secondary" className="text-xs">
                    {t('comingSoon')}
                  </Badge>
                </CardTitle>
              </div>
              <CardDescription>
                {t('subscription.description')}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Coming Soon: Integrations */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Link className="h-5 w-5 text-purple-500" />
                <CardTitle className="flex items-center gap-2">
                  {t('sections.integrations')}
                  <Badge variant="secondary" className="text-xs">
                    {t('comingSoon')}
                  </Badge>
                </CardTitle>
              </div>
              <CardDescription>
                {t('integrations.description')}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Coming Soon: Notifications */}
          <Card className="opacity-60">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-500" />
                <CardTitle className="flex items-center gap-2">
                  {t('sections.notifications')}
                  <Badge variant="secondary" className="text-xs">
                    {t('comingSoon')}
                  </Badge>
                </CardTitle>
              </div>
              <CardDescription>
                {t('notifications.description')}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}

