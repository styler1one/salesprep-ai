'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { XCircle, ArrowLeft, MessageCircle } from 'lucide-react'
import Link from 'next/link'

export default function BillingCancelPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-slate-100 dark:bg-slate-800 w-fit">
            <XCircle className="h-12 w-12 text-slate-400" />
          </div>
          <CardTitle className="text-2xl">Betaling geannuleerd</CardTitle>
          <CardDescription className="text-base">
            Geen zorgen, er is niets in rekening gebracht
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Je kunt altijd later upgraden wanneer je er klaar voor bent. 
              Je behoudt toegang tot alle Free features.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => router.push('/pricing')}
              className="w-full gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Terug naar prijzen
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard')}
              className="w-full"
            >
              Ga naar Dashboard
            </Button>
          </div>

          <div className="text-center pt-4 border-t">
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
              Vragen over onze plannen?
            </p>
            <Link 
              href="mailto:support@salesprep.ai" 
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <MessageCircle className="h-4 w-4" />
              Neem contact op
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

