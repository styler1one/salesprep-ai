'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { 
  Check, 
  X, 
  Sparkles, 
  Loader2,
  ArrowLeft,
  Building2,
  Zap,
  Crown,
  Users,
  Mail
} from 'lucide-react'
import { useBilling } from '@/lib/billing-context'
import { useToast } from '@/components/ui/use-toast'
import { useTranslations } from 'next-intl'
import Link from 'next/link'

export default function PricingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { subscription, createCheckoutSession } = useBilling()
  const t = useTranslations('billing')
  const tErrors = useTranslations('errors')
  const [isYearly, setIsYearly] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)

  const monthlyPrice = 29
  const yearlyPrice = 19 // per month when paid yearly
  const yearlyTotal = 228

  // Features arrays using translations
  const features = {
    free: [
      { text: t('features.free.research'), included: true },
      { text: t('features.free.prep'), included: true },
      { text: t('features.free.followup'), included: true },
      { text: t('features.free.support'), included: true },
      { text: t('features.free.users'), included: true },
      { text: t('features.free.kb'), included: false },
      { text: t('features.free.contacts'), included: false },
      { text: t('features.free.pdf'), included: false },
    ],
    solo: [
      { text: t('features.solo.research'), included: true },
      { text: t('features.solo.prep'), included: true },
      { text: t('features.solo.followup'), included: true },
      { text: t('features.solo.transcription'), included: true },
      { text: t('features.solo.kb'), included: true },
      { text: t('features.solo.contacts'), included: true },
      { text: t('features.solo.pdf'), included: true },
      { text: t('features.solo.support'), included: true },
      { text: t('features.solo.users'), included: true },
    ],
    teams: [
      { text: t('features.teams.everything'), included: true },
      { text: t('features.teams.users'), included: true },
      { text: t('features.teams.transcription'), included: true },
      { text: t('features.teams.kb'), included: true },
      { text: t('features.teams.crm'), included: true },
      { text: t('features.teams.sharing'), included: true },
      { text: t('features.teams.analytics'), included: true },
      { text: t('features.teams.sso'), included: true },
      { text: t('features.teams.support'), included: true },
      { text: t('features.teams.onboarding'), included: true },
    ],
  }

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'free') {
      // Already on free or want to downgrade
      toast({
        title: 'Free plan',
        description: t('pricing.currentPlan'),
      })
      return
    }

    if (planId === 'teams') {
      // Contact sales
      window.location.href = 'mailto:sales@salesprep.ai?subject=Teams%20Plan%20Request'
      return
    }

    setLoading(planId)
    try {
      const checkoutPlanId = isYearly ? 'solo_yearly' : 'solo_monthly'
      const checkoutUrl = await createCheckoutSession(checkoutPlanId)
      if (checkoutUrl) {
        window.location.href = checkoutUrl
      }
    } catch (error) {
      console.error('Checkout failed:', error)
      toast({
        title: tErrors('generic'),
        description: t('checkoutError'),
        variant: 'destructive',
      })
    } finally {
      setLoading(null)
    }
  }

  const isCurrentPlan = (planId: string) => {
    if (!subscription) return planId === 'free'
    if (planId === 'solo' && subscription.plan_id.startsWith('solo')) return true
    return subscription.plan_id === planId
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
              {t('pricing.backToDashboard')}
            </Link>
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              SalesPrep AI
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {t('pricing.title')}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            {t('pricing.subtitle')}
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm ${!isYearly ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-500'}`}>
              {t('pricing.monthly')}
            </span>
            <Switch
              checked={isYearly}
              onCheckedChange={setIsYearly}
            />
            <span className={`text-sm ${isYearly ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-500'}`}>
              {t('pricing.yearly')}
            </span>
            {isYearly && (
              <Badge className="bg-emerald-500">{t('pricing.save', { percent: '34' })}</Badge>
            )}
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Free Plan */}
          <Card className="relative border-2 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <Zap className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
                <CardTitle>{t('plans.free.name')}</CardTitle>
              </div>
              <CardDescription>{t('plans.free.description')}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-slate-900 dark:text-white">€0</span>
                <span className="text-slate-500">{t('perMonth')}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {features.free.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    {feature.included ? (
                      <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-slate-300 dark:text-slate-600 flex-shrink-0" />
                    )}
                    <span className={feature.included ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}>
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                disabled={isCurrentPlan('free')}
              >
                {isCurrentPlan('free') ? t('pricing.currentPlan') : t('pricing.select')}
              </Button>
            </CardFooter>
          </Card>

          {/* Solo Plan */}
          <Card className="relative border-2 border-blue-500 shadow-lg shadow-blue-500/10 scale-105">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 px-4">
                {t('pricing.popular')}
              </Badge>
            </div>
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Crown className="h-5 w-5 text-blue-600" />
                </div>
                <CardTitle>{t('plans.solo.name')}</CardTitle>
              </div>
              <CardDescription>{t('plans.solo.description')}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-slate-900 dark:text-white">
                  €{isYearly ? yearlyPrice : monthlyPrice}
                </span>
                <span className="text-slate-500">{t('perMonth')}</span>
                {isYearly && (
                  <p className="text-sm text-slate-500 mt-1">
                    €{yearlyTotal} {t('pricing.perYear')}
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {features.solo.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300">{feature.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                onClick={() => handleSelectPlan('solo')}
                disabled={loading === 'solo' || isCurrentPlan('solo')}
              >
                {loading === 'solo' ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : isCurrentPlan('solo') ? (
                  t('pricing.currentPlan')
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t('pricing.startTrial')}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>

          {/* Teams Plan */}
          <Card className="relative border-2 hover:border-purple-300 dark:hover:border-purple-600 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <CardTitle>{t('plans.teams.name')}</CardTitle>
              </div>
              <CardDescription>{t('plans.teams.description')}</CardDescription>
              <div className="mt-4">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{t('pricing.custom')}</span>
                <p className="text-sm text-slate-500 mt-1">
                  {t('pricing.contactForPricing')}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {features.teams.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-purple-500 flex-shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300">{feature.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                onClick={() => handleSelectPlan('teams')}
              >
                <Mail className="h-4 w-4 mr-2" />
                {t('pricing.contactUs')}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* FAQ / Trust Section */}
        <div className="mt-16 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('pricing.trustBadges')}
          </p>
        </div>

        {/* Feature Comparison - Simple */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-8">
            {t('pricing.compareFeatures')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-slate-700 dark:text-slate-300">{t('pricing.feature')}</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-700 dark:text-slate-300">{t('plans.free.name')}</th>
                  <th className="text-center py-3 px-4 font-medium text-blue-600">{t('plans.solo.name')}</th>
                  <th className="text-center py-3 px-4 font-medium text-purple-600">{t('plans.teams.name')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{t('features.researchBriefs')}</td>
                  <td className="py-3 px-4 text-center">3{t('features.perMonth')}</td>
                  <td className="py-3 px-4 text-center text-emerald-600">∞</td>
                  <td className="py-3 px-4 text-center text-emerald-600">∞</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{t('features.meetingPreps')}</td>
                  <td className="py-3 px-4 text-center">3{t('features.perMonth')}</td>
                  <td className="py-3 px-4 text-center text-emerald-600">∞</td>
                  <td className="py-3 px-4 text-center text-emerald-600">∞</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{t('features.followups')}</td>
                  <td className="py-3 px-4 text-center">1{t('features.perMonth')}</td>
                  <td className="py-3 px-4 text-center text-emerald-600">∞</td>
                  <td className="py-3 px-4 text-center text-emerald-600">∞</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{t('features.transcription')}</td>
                  <td className="py-3 px-4 text-center">—</td>
                  <td className="py-3 px-4 text-center">10 {t('features.hours')}{t('features.perMonth')}</td>
                  <td className="py-3 px-4 text-center text-emerald-600">∞</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{t('features.knowledgeBase')}</td>
                  <td className="py-3 px-4 text-center">—</td>
                  <td className="py-3 px-4 text-center">50 {t('features.docs')}</td>
                  <td className="py-3 px-4 text-center text-emerald-600">∞</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{t('features.users')}</td>
                  <td className="py-3 px-4 text-center">1</td>
                  <td className="py-3 px-4 text-center">1</td>
                  <td className="py-3 px-4 text-center text-emerald-600">∞</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{t('features.crmIntegration')}</td>
                  <td className="py-3 px-4 text-center"><X className="h-4 w-4 mx-auto text-slate-300" /></td>
                  <td className="py-3 px-4 text-center"><X className="h-4 w-4 mx-auto text-slate-300" /></td>
                  <td className="py-3 px-4 text-center"><Check className="h-4 w-4 mx-auto text-emerald-500" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

