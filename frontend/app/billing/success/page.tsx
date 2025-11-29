'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, ArrowRight, Sparkles } from 'lucide-react'

export default function BillingSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    // Countdown and redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push('/dashboard')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full border-emerald-200 dark:border-emerald-800">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 w-fit">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">Welkom bij Solo! 🎉</CardTitle>
          <CardDescription className="text-base">
            Je abonnement is succesvol geactiveerd
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 text-center">
            <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-2">
              Je hebt nu toegang tot:
            </p>
            <ul className="text-sm text-emerald-600 dark:text-emerald-400 space-y-1">
              <li>✅ Onbeperkt research briefs</li>
              <li>✅ Onbeperkt meeting preps</li>
              <li>✅ 10 uur transcriptie per maand</li>
              <li>✅ Knowledge base (50 docs)</li>
            </ul>
          </div>

          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            Je wordt doorgestuurd naar het dashboard in {countdown} seconden...
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => router.push('/dashboard')}
              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Ga naar Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => router.push('/dashboard/settings')}
              className="w-full"
            >
              Bekijk abonnement instellingen
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

