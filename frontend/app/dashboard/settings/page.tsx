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
  Power,
  Palette,
  Smile,
  Type,
  FileText,
  Zap,
  Infinity,
  ArrowRight,
  Check
} from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import { useToast } from '@/components/ui/use-toast'
import { useSettings } from '@/lib/settings-context'
import { LanguageSelect } from '@/components/language-select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useBilling } from '@/lib/billing-context'
import { UsageMeter } from '@/components/usage-meter'
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
  
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [billingActionLoading, setBillingActionLoading] = useState(false)
  const [coachResetting, setCoachResetting] = useState(false)
  const [coachToggling, setCoachToggling] = useState(false)
  const [coachEnabled, setCoachEnabled] = useState<boolean | null>(null)
  const [coachSettingsLoading, setCoachSettingsLoading] = useState(true)
  
  // Style guide state
  const [styleGuide, setStyleGuide] = useState({
    tone: 'professional',
    formality: 'professional',
    emoji_usage: false,
    signoff: 'Best regards',
    writing_length: 'concise'
  })
  const [styleGuideLoading, setStyleGuideLoading] = useState(true)
  const [styleSaving, setStyleSaving] = useState(false)
  const [styleHasChanges, setStyleHasChanges] = useState(false)
  const [originalStyleGuide, setOriginalStyleGuide] = useState(styleGuide)
  
  // Fetch coach settings directly (independent of CoachProvider)
  useEffect(() => {
    const fetchCoachSettings = async () => {
      try {
        const { data, error } = await api.get<{ is_enabled: boolean }>('/api/v1/coach/settings')
        if (!error && data) {
          setCoachEnabled(data.is_enabled)
        }
      } catch (err) {
        console.error('Failed to fetch coach settings:', err)
      } finally {
        setCoachSettingsLoading(false)
      }
    }
    fetchCoachSettings()
  }, [])
  
  // Fetch style guide
  useEffect(() => {
    const fetchStyleGuide = async () => {
      try {
        const { data, error } = await api.get<typeof styleGuide>('/api/v1/profile/sales/style-guide')
        if (!error && data) {
          setStyleGuide(data)
          setOriginalStyleGuide(data)
        }
      } catch (err) {
        console.error('Failed to fetch style guide:', err)
      } finally {
        setStyleGuideLoading(false)
      }
    }
    fetchStyleGuide()
  }, [])
  
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

  const handleUpgradeToPlan = async (planId: string) => {
    setBillingActionLoading(true)
    try {
      const checkoutUrl = await createCheckoutSession(planId)
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
    setCoachToggling(true)
    try {
      // Update settings via API directly
      const { error } = await api.patch('/api/v1/coach/settings', { 
        is_enabled: enabled,
        widget_state: enabled ? 'minimized' : 'hidden'
      })
      
      if (error) {
        throw new Error(error.message || 'Failed to update settings')
      }
      
      // Update local state immediately
      setCoachEnabled(enabled)
      
      toast({
        title: enabled ? t('coach.enabled') : t('coach.disabled'),
        description: enabled ? t('coach.enabledDesc') : t('coach.disabledDesc'),
      })
      
      // Reload page to ensure coach widget updates
      window.location.reload()
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
      // Reset endpoint now also enables coach
      const { error } = await api.post('/api/v1/coach/suggestions/reset', {})
      if (error) {
        throw new Error(error.message || 'Reset failed')
      }
      
      toast({
        title: t('coach.reset'),
        description: t('coach.resetDesc'),
      })
      // Refresh the page to reset all coach state
      window.location.reload()
    } catch (error) {
      console.error('Failed to reset coach:', error)
      toast({
        title: tErrors('generic'),
        variant: 'destructive',
      })
      setCoachResetting(false)
    }
  }
  
  // Style guide handlers
  const updateStyleField = (field: keyof typeof styleGuide, value: string | boolean) => {
    setStyleGuide(prev => ({ ...prev, [field]: value }))
    setStyleHasChanges(true)
  }
  
  const handleStyleSave = async () => {
    setStyleSaving(true)
    try {
      const { error } = await api.put('/api/v1/profile/sales/style-guide', styleGuide)
      if (error) {
        throw new Error(error.message || 'Save failed')
      }
      
      setOriginalStyleGuide(styleGuide)
      setStyleHasChanges(false)
      
      toast({
        title: t('style.saved'),
        description: t('style.savedDesc'),
      })
    } catch (error) {
      console.error('Failed to save style guide:', error)
      toast({
        title: tErrors('generic'),
        variant: 'destructive',
      })
    } finally {
      setStyleSaving(false)
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
    // v2 plans
    if (subscription.plan_id === 'light_solo') {
      return <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500">Light Solo</Badge>
    }
    if (subscription.plan_id === 'unlimited_solo') {
      return <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500">Unlimited Solo</Badge>
    }
    // v1 legacy plans
    if (subscription.plan_id.startsWith('solo')) {
      return <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500">Solo</Badge>
    }
    if (subscription.plan_id === 'teams' || subscription.plan_id === 'enterprise') {
      return <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Enterprise</Badge>
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

        {/* Two-column layout for better overview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT COLUMN */}
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
{coachSettingsLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : (
                  <Switch
                    checked={coachEnabled ?? true}
                    onCheckedChange={handleCoachToggle}
                    disabled={coachToggling}
                  />
                )}
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

          {/* Communication Style Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-pink-500" />
                <CardTitle>{t('style.title')}</CardTitle>
              </div>
              <CardDescription>
                {t('style.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {styleGuideLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <>
                  {/* Tone */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-slate-400" />
                      {t('style.tone')}
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('style.toneDesc')}
                    </p>
                    <select
                      value={styleGuide.tone}
                      onChange={(e) => updateStyleField('tone', e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    >
                      <option value="direct">{t('style.toneDirect')}</option>
                      <option value="warm">{t('style.toneWarm')}</option>
                      <option value="formal">{t('style.toneFormal')}</option>
                      <option value="casual">{t('style.toneCasual')}</option>
                      <option value="professional">{t('style.toneProfessional')}</option>
                    </select>
                  </div>

                  {/* Formality */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      <Type className="h-4 w-4 text-slate-400" />
                      {t('style.formality')}
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('style.formalityDesc')}
                    </p>
                    <select
                      value={styleGuide.formality}
                      onChange={(e) => updateStyleField('formality', e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    >
                      <option value="formal">{t('style.formalityFormal')}</option>
                      <option value="professional">{t('style.formalityProfessional')}</option>
                      <option value="casual">{t('style.formalityCasual')}</option>
                    </select>
                  </div>

                  {/* Emoji Usage */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <Smile className="h-4 w-4 text-slate-400" />
                        {t('style.emoji')}
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('style.emojiDesc')}
                      </p>
                    </div>
                    <Switch
                      checked={styleGuide.emoji_usage}
                      onCheckedChange={(checked) => updateStyleField('emoji_usage', checked)}
                    />
                  </div>

                  {/* Writing Length */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-400" />
                      {t('style.length')}
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('style.lengthDesc')}
                    </p>
                    <select
                      value={styleGuide.writing_length}
                      onChange={(e) => updateStyleField('writing_length', e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    >
                      <option value="concise">{t('style.lengthConcise')}</option>
                      <option value="detailed">{t('style.lengthDetailed')}</option>
                    </select>
                  </div>

                  {/* Email Sign-off */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      {t('style.signoff')}
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('style.signoffDesc')}
                    </p>
                    <input
                      type="text"
                      value={styleGuide.signoff}
                      onChange={(e) => updateStyleField('signoff', e.target.value)}
                      placeholder="Best regards"
                      className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                    />
                  </div>

                  {/* Save Button */}
                  <div className="pt-4 border-t">
                    <Button 
                      onClick={handleStyleSave} 
                      disabled={styleSaving || !styleHasChanges}
                      className="gap-2"
                    >
                      {styleSaving ? (
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
                    {styleHasChanges && (
                      <span className="ml-3 text-sm text-amber-600 dark:text-amber-400">
                        {t('unsavedChanges')}
                      </span>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
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
                          €{(subscription.price_cents / 100).toFixed(2).replace('.', ',')}{subscription.billing_interval === 'year' ? tBilling('perYear') : tBilling('perMonth')}
                        </span>
                      )}
                    </div>
                    {subscription?.cancel_at_period_end && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                        ⚠️ {tBilling('cancelWarning', { date: subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '' })}
                      </p>
                    )}
                  </div>

                  {/* Usage Meters - v2: Flow-based */}
                  {usage && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {tBilling('usageThisMonth')}
                      </h4>
                      {/* Primary: Flow usage */}
                      {usage.flow && (
                        <UsageMeter
                          label={tBilling('flowsUsed')}
                          used={usage.flow.used}
                          limit={usage.flow.limit}
                          unlimited={usage.flow.unlimited}
                          showUpgrade={false}
                        />
                      )}
                      {/* Fallback: Individual metrics if flow not available */}
                      {!usage.flow && (
                        <>
                          <UsageMeter
                            label="Research"
                            used={usage.research.used}
                            limit={usage.research.limit}
                            unlimited={usage.research.unlimited}
                            showUpgrade={false}
                          />
                          <UsageMeter
                            label="Preparation"
                            used={usage.preparation.used}
                            limit={usage.preparation.limit}
                            unlimited={usage.preparation.unlimited}
                            showUpgrade={false}
                          />
                          <UsageMeter
                            label="Follow-up"
                            used={usage.followup.used}
                            limit={usage.followup.limit}
                            unlimited={usage.followup.unlimited}
                            showUpgrade={false}
                          />
                        </>
                      )}
                    </div>
                  )}

                  {/* Upgrade Options - Context-aware */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    {/* FREE USERS: Show both plan options */}
                    {(!subscription || subscription.plan_id === 'free' || !subscription.is_paid) && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {tBilling('upgradePlan')}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Pro Solo Card */}
                          <div className="relative p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                              <Zap className="h-5 w-5 text-blue-500" />
                              <span className="font-semibold text-slate-900 dark:text-white">Pro Solo</span>
                            </div>
                            <div className="mb-3">
                              <span className="text-2xl font-bold text-slate-900 dark:text-white">€9,95</span>
                              <span className="text-sm text-slate-500">/mo</span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">5 flows per month</p>
                            <Button 
                              size="sm"
                              onClick={() => handleUpgradeToPlan('pro_solo')}
                              disabled={billingActionLoading}
                              className="w-full gap-2"
                            >
                              {billingActionLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ArrowRight className="h-4 w-4" />
                              )}
                              Upgrade
                            </Button>
                          </div>
                          
                          {/* Unlimited Solo Card */}
                          <div className="relative p-4 rounded-lg border-2 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20 hover:border-purple-400 dark:hover:border-purple-600 transition-colors">
                            <div className="absolute -top-2 right-3">
                              <Badge className="bg-purple-500 text-white text-xs">Popular</Badge>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <Infinity className="h-5 w-5 text-purple-500" />
                              <span className="font-semibold text-slate-900 dark:text-white">Unlimited Solo</span>
                            </div>
                            <div className="mb-3">
                              <span className="text-sm text-slate-400 line-through mr-2">€99,95</span>
                              <span className="text-2xl font-bold text-slate-900 dark:text-white">€49,95</span>
                              <span className="text-sm text-slate-500">/mo</span>
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">Unlimited flows</p>
                            <Button 
                              size="sm"
                              onClick={() => handleUpgradeToPlan('unlimited_solo')}
                              disabled={billingActionLoading}
                              className="w-full gap-2 bg-purple-600 hover:bg-purple-700"
                            >
                              {billingActionLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4" />
                              )}
                              Upgrade
                            </Button>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => router.push('/pricing')}
                          className="gap-2 text-slate-500"
                        >
                          Compare all features <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* PRO SOLO USERS: Show upgrade to Unlimited + Manage */}
                    {subscription?.is_paid && subscription.plan_id === 'pro_solo' && (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-3">
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
                          <Button 
                            onClick={() => handleUpgradeToPlan('unlimited_solo')}
                            disabled={billingActionLoading}
                            className="gap-2 bg-purple-600 hover:bg-purple-700"
                          >
                            {billingActionLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Infinity className="h-4 w-4" />
                            )}
                            Upgrade to Unlimited
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* UNLIMITED USERS: Only Manage */}
                    {subscription?.is_paid && subscription.plan_id === 'unlimited_solo' && (
                      <div className="flex items-center gap-3">
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
                        <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                          <Check className="h-4 w-4" />
                          You have the best plan!
                        </span>
                      </div>
                    )}
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
      </div>
    </DashboardLayout>
  )
}

