'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Icons } from '@/components/icons'
import { ContactMatchCard, ContactMatch } from './contact-match-card'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'

type ModalStep = 'search' | 'loading' | 'results' | 'confirm'

interface Contact {
  id: string
  prospect_id: string
  name: string
  role?: string
  linkedin_url?: string
  email?: string
  phone?: string
  is_primary: boolean
  created_at: string
}

interface ContactSearchModalProps {
  isOpen: boolean
  onClose: () => void
  companyName: string
  companyLinkedInUrl?: string
  researchId: string
  onContactAdded: (contact: Contact) => void
}

export function ContactSearchModal({
  isOpen,
  onClose,
  companyName,
  companyLinkedInUrl,
  researchId,
  onContactAdded
}: ContactSearchModalProps) {
  const t = useTranslations('contacts.search')
  const { toast } = useToast()

  // Form state
  const [step, setStep] = useState<ModalStep>('search')
  const [searchName, setSearchName] = useState('')
  const [searchRole, setSearchRole] = useState('')
  const [matches, setMatches] = useState<ContactMatch[]>([])
  const [selectedMatch, setSelectedMatch] = useState<ContactMatch | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Confirm step additional fields
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [isPrimary, setIsPrimary] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  // Reset state when modal closes
  const handleClose = () => {
    setStep('search')
    setSearchName('')
    setSearchRole('')
    setMatches([])
    setSelectedMatch(null)
    setError(null)
    setEmail('')
    setPhone('')
    setIsPrimary(false)
    onClose()
  }

  // Search for profiles
  const handleSearch = async () => {
    if (!searchName.trim()) {
      toast({
        variant: 'destructive',
        title: t('nameLabel'),
        description: t('namePlaceholder')
      })
      return
    }

    setStep('loading')
    setError(null)

    try {
      const { data, error } = await api.post<{
        matches: ContactMatch[]
        search_query_used: string
        error?: string
      }>('/api/v1/contacts/search', {
        name: searchName.trim(),
        role: searchRole.trim() || undefined,
        company_name: companyName,
        company_linkedin_url: companyLinkedInUrl
      })

      if (error || data?.error) {
        setError(error?.message || data?.error || 'Search failed')
        setStep('search')
        return
      }

      setMatches(data?.matches || [])
      setStep('results')
    } catch (err) {
      setError('Search failed. Please try again.')
      setStep('search')
    }
  }

  // Select a match
  const handleSelect = (match: ContactMatch) => {
    setSelectedMatch(match)
    setStep('confirm')
  }

  // Skip to manual entry
  const handleSkipSearch = () => {
    setSelectedMatch(null)
    setStep('confirm')
  }

  // Go back
  const handleBack = () => {
    if (step === 'results') {
      setStep('search')
      setMatches([])
    } else if (step === 'confirm') {
      if (matches.length > 0) {
        setStep('results')
      } else {
        setStep('search')
      }
      setSelectedMatch(null)
    }
  }

  // Add contact and start analysis
  const handleConfirm = async () => {
    const name = selectedMatch?.name || searchName
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: t('nameLabel'),
        description: t('namePlaceholder')
      })
      return
    }

    setIsAdding(true)

    try {
      const { data, error } = await api.post<Contact>(
        `/api/v1/research/${researchId}/contacts`,
        {
          name: name.trim(),
          role: selectedMatch?.title || searchRole || null,
          linkedin_url: selectedMatch?.linkedin_url || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          is_primary: isPrimary
        }
      )

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error.message || 'Failed to add contact'
        })
        setIsAdding(false)
        return
      }

      if (data) {
        toast({
          title: '✅ ' + t('addAndAnalyze'),
          description: `${name} added. Analysis starting...`
        })
        onContactAdded(data)
        handleClose()
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add contact'
      })
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step !== 'search' && step !== 'loading' && (
              <Button variant="ghost" size="icon" className="h-6 w-6 -ml-1" onClick={handleBack}>
                <Icons.arrowLeft className="h-4 w-4" />
              </Button>
            )}
            {step === 'search' && t('title')}
            {step === 'loading' && t('title')}
            {step === 'results' && t('resultsTitle')}
            {step === 'confirm' && t('confirmTitle')}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Search */}
        {step === 'search' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('subtitle', { company: companyName })}
            </p>

            <div className="space-y-3">
              <div>
                <Label htmlFor="search-name">{t('nameLabel')} *</Label>
                <Input
                  id="search-name"
                  placeholder={t('namePlaceholder')}
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="mt-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              <div>
                <Label htmlFor="search-role">{t('roleLabel')}</Label>
                <Input
                  id="search-role"
                  placeholder={t('rolePlaceholder')}
                  value={searchRole}
                  onChange={(e) => setSearchRole(e.target.value)}
                  className="mt-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button 
              onClick={handleSearch} 
              className="w-full"
              disabled={!searchName.trim()}
            >
              <Icons.search className="h-4 w-4 mr-2" />
              {t('searchButton')}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-950 px-2 text-slate-500">or</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              onClick={handleSkipSearch}
              className="w-full"
            >
              <Icons.plus className="h-4 w-4 mr-2" />
              {t('skipSearch')}
            </Button>
          </div>
        )}

        {/* Step 1.5: Loading */}
        {step === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Icons.spinner className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Searching for "{searchName}" at {companyName}...
            </p>
          </div>
        )}

        {/* Step 2: Results */}
        {step === 'results' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t('resultsSubtitle', { name: searchName, company: companyName })}
            </p>

            {matches.length > 0 ? (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {matches.map((match, index) => (
                  <ContactMatchCard
                    key={match.linkedin_url || index}
                    match={match}
                    isSelected={selectedMatch?.linkedin_url === match.linkedin_url}
                    onSelect={() => handleSelect(match)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Icons.search className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-600 dark:text-slate-400">{t('noResults')}</p>
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <Button 
                variant="outline" 
                onClick={handleSkipSearch}
                className="w-full"
              >
                <Icons.plus className="h-4 w-4 mr-2" />
                {t('addManually')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            {selectedMatch ? (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                  {t('selectedProfile')}
                </p>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-900 dark:text-blue-100 font-medium">
                    <span>👤</span>
                    <span>{selectedMatch.name}</span>
                  </div>
                  {(selectedMatch.title || selectedMatch.company) && (
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      {selectedMatch.title}
                      {selectedMatch.title && selectedMatch.company && ' @ '}
                      {selectedMatch.company}
                    </p>
                  )}
                  {selectedMatch.linkedin_url && (
                    <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mt-2">
                      <Icons.link className="h-3 w-3" />
                      <span className="truncate">{selectedMatch.linkedin_url}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Adding "{searchName}" manually without LinkedIn profile
                </p>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('extraInfo')}
              </p>

              <div>
                <Label htmlFor="confirm-email">{t('emailLabel')}</Label>
                <Input
                  id="confirm-email"
                  type="email"
                  placeholder="jan@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="confirm-phone">{t('phoneLabel')}</Label>
                <Input
                  id="confirm-phone"
                  type="tel"
                  placeholder="+31 6 1234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="primary-contact" 
                  checked={isPrimary}
                  onCheckedChange={(checked) => setIsPrimary(checked === true)}
                />
                <Label htmlFor="primary-contact" className="text-sm font-normal cursor-pointer">
                  {t('primaryContact')}
                </Label>
              </div>
            </div>

            <Button 
              onClick={handleConfirm}
              className="w-full"
              disabled={isAdding}
            >
              {isAdding ? (
                <>
                  <Icons.spinner className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Icons.plus className="h-4 w-4 mr-2" />
                  {t('addAndAnalyze')}
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

