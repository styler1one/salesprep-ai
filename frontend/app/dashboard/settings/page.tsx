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
  Bell,
  ExternalLink,
  Sparkles,
  Crown,
  Brain,
  RotateCcw,
  Power
} from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { useToast } from '@/components/ui/use-toast'
import { useSettings } from '@/lib/settings-context'
import { LanguageSelect } from '@/components/language-select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useBilling } from '@/lib/billing-context'
import { UsageMeter } from '@/components/usage-meter'
import { useCoachOptional } from '@/components/coach/CoachProvider'
import { api } from '@/lib/api'
import type { User } from '@supabase/supabase-js'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const tErrors = useTranslations('errors')
  const tBilling = useTranslations('billing')
  const { toast } = useToast()
  const currentLocale = useLocale()
  
  const { settings, updateSettings, loading: settingsLoading, loaded: settingsLoaded } = useSettings()
  const { subscription, usage, loading: billingLoading, createCheckoutSession, openBillingPortal } = useBilling()
  const coach = useCoachOptional()
  
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [billingActionLoading, setBillingActionLoading] = useState(false)
  const [coachResetting, setCoachResetting] = useState(false)
  const [coachToggling, setCoachToggling] = useState(false)
  
  // Local state for form
  const [appLanguage, setAppLanguage] = useState('en')
  const [outputLanguage, setOutputLanguage] = useState('en')
  const [emailLanguage, setEmailLanguage] = useState('en')

  // Sync local state with settings when loaded
  // Also sync cookie with database if they differ
  useEffect(() => {
    if (!settingsLoading && settings && settingsLoaded) {
      setAppLanguage(settings.app_language)
      setOutputLanguage(settings.output_language)
      setEmailLanguage(settings.email_language)
      
      // If database app_language differs from current locale (cookie), update the cookie
      if (settings.app_language && settings.app_language !== currentLocale) {
        document.cookie = `NEXT_LOCALE=${settings.app_language}; path=/; max-age=31536000`
        // Reload to apply the correct language
        window.location.reload()
      }
    }
  }, [settings, settingsLoading, settingsLoaded, currentLocale])

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

  const handleUpgrade = async () => {
    setBillingActionLoading(true)
    try {
      const checkoutUrl = await createCheckoutSession('solo_monthly')
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      } else {
        throw new Error('No checkout URL returned')
      }
    } catch (error: any) {
      console.error('Failed to start checkout:', error)
      toast({
        title: tErrors('generic'),
        description: error?.message || tBilling('checkoutError'),
        variant: 'destructive',
      })
    } finally {
      setBillingActionLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    setBillingActionLoading(true)
    try {
      const portalUrl = await openBillingPortal()
      window.location.href = portalUrl
    } catch (error) {
      console.error('Failed to open portal:', error)
      toast({
        title: tErrors('generic'),
        description: tBilling('portalError'),
        variant: 'destructive',
      })
    } finally {
      setBillingActionLoading(false)
    }
  }

  // Coach handlers
  const handleCoachToggle = async (enabled: boolean) => {
    if (!coach) return
    setCoachToggling(true)
    try {
      await coach.updateSettings({ is_enabled: enabled })
      toast({
        title: enabled ? t('coach.enabled') : t('coach.disabled'),
        description: enabled ? t('coach.enabledDesc') : t('coach.disabledDesc'),
      })
    } catch (error) {
      console.error('Failed to toggle coach:', error)
      toast({
        title: tErrors('generic'),
        variant: 'destructive',
      })
    } finally {
      setCoachToggling(false)
    }
  }

  const handleCoachReset = async () => {
    setCoachResetting(true)
    try {
      const { error } = await api.post('/api/v1/coach/suggestions/reset', {})
      if (!error) {
        // Refresh suggestions
        if (coach) {
          await coach.refreshSuggestions()
        }
        toast({
          title: t('coach.reset'),
          description: t('coach.resetDesc'),
        })
      } else {
        throw new Error(error.message)
      }
    } catch (error) {
      console.error('Failed to reset coach:', error)
      toast({
        title: tErrors('generic'),
        variant: 'destructive',
      })
    } finally {
      setCoachResetting(false)
    }
  }

  const getPlanBadge = () => {
    if (!subscription) return null
    
    if (subscription.plan_id === 'free') {
      return <Badge variant="secondary">Free</Badge>
    }
    if (subscription.is_trialing) {
      return <Badge className="bg-amber-500">Trial</Badge>
    }
    if (subscription.plan_id.startsWith('solo')) {
      return <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500">Solo</Badge>
    }
    if (subscription.plan_id === 'teams') {
      return <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Teams</Badge>
    }
    return null
  }

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

          {/* AI Coach Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-indigo-500" />
                <CardTitle>{t('coach.title')}</CardTitle>
              </div>
              <CardDescription>
                {t('coach.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable Coach */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <Power className="h-4 w-4 text-slate-400" />
                    {t('coach.enableLabel')}
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('coach.enableDesc')}
                  </p>
                </div>
                <Switch
                  checked={coach?.isEnabled ?? true}
                  onCheckedChange={handleCoachToggle}
                  disabled={coachToggling || !coach}
                />
              </div>

              {/* Reset Snoozed Suggestions */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-slate-400" />
                      {t('coach.resetLabel')}
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('coach.resetHint')}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCoachReset}
                    disabled={coachResetting}
                    className="gap-2"
                  >
                    {coachResetting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    {t('coach.resetButton')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription & Billing */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-500" />
                  <CardTitle>{t('sections.subscription')}</CardTitle>
                </div>
                {getPlanBadge()}
              </div>
              <CardDescription>
                {t('subscription.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {billingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <>
                  {/* Current Plan Info */}
                  <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {tBilling('currentPlan')}
                      </span>
                      {subscription?.is_trialing && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          {tBilling('trialEnds')} {subscription.trial_end ? new Date(subscription.trial_end).toLocaleDateString() : tBilling('soon')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {subscription?.plan_id !== 'free' && (
                        <Crown className="h-5 w-5 text-amber-500" />
                      )}
                      <span className="text-lg font-semibold text-slate-900 dark:text-white">
                        {subscription?.plan_name || 'Free'}
                      </span>
                      {subscription?.price_cents && subscription.price_cents > 0 && (
                        <span className="text-sm text-slate-500">
                          €{(subscription.price_cents / 100).toFixed(0)}{subscription.billing_interval === 'year' ? tBilling('perYear') : tBilling('perMonth')}
                        </span>
                      )}
                    </div>
                    {subscription?.cancel_at_period_end && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        ⚠️ {tBilling('cancelWarning', { date: subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '' })}
                      </p>
                    )}
                  </div>

                  {/* Usage Meters */}
                  {usage && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {tBilling('usageThisMonth')}
                      </h4>
                      <UsageMeter
                        label="Research"
                        used={usage.research.used}
                        limit={usage.research.limit}
                        unlimited={usage.research.unlimited}
                        showUpgrade={!subscription || subscription.plan_id === 'free' || !subscription.is_paid}
                        onUpgrade={handleUpgrade}
                      />
                      <UsageMeter
                        label="Preparation"
                        used={usage.preparation.used}
                        limit={usage.preparation.limit}
                        unlimited={usage.preparation.unlimited}
                        showUpgrade={!subscription || subscription.plan_id === 'free' || !subscription.is_paid}
                        onUpgrade={handleUpgrade}
                      />
                      <UsageMeter
                        label="Follow-up"
                        used={usage.followup.used}
                        limit={usage.followup.limit}
                        unlimited={usage.followup.unlimited}
                        showUpgrade={!subscription || subscription.plan_id === 'free' || !subscription.is_paid}
                        onUpgrade={handleUpgrade}
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="pt-4 border-t flex flex-wrap gap-3">
                    {/* Show upgrade button for free users or when subscription not loaded */}
                    {(!subscription || subscription.plan_id === 'free' || !subscription.is_paid) ? (
                      <Button 
                        onClick={handleUpgrade}
                        disabled={billingActionLoading}
                        className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      >
                        {billingActionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {tBilling('upgradeToSolo')}
                      </Button>
                    ) : (
                      /* Only show manage button for paid subscribers */
                      <Button 
                        variant="outline" 
                        onClick={handleManageSubscription}
                        disabled={billingActionLoading}
                        className="gap-2"
                      >
                        {billingActionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                        {tBilling('manageSubscription')}
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      onClick={() => router.push('/pricing')}
                      className="gap-2"
                    >
                      {tBilling('viewAllPlans')}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
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

