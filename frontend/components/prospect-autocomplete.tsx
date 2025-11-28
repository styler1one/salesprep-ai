'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Search, Building2, FileText, Briefcase, MessageSquare, Check } from 'lucide-react'

interface Prospect {
    name: string
    has_research: boolean
    has_prep: boolean
    has_followup: boolean
    last_activity: string
    last_activity_type: string
    context_score: number
}

interface ProspectAutocompleteProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    disabled?: boolean
}

export function ProspectAutocomplete({
    value,
    onChange,
    placeholder = "Zoek of voer bedrijfsnaam in...",
    className,
    disabled = false
}: ProspectAutocompleteProps) {
    const supabase = createClientComponentClient()
    const [isOpen, setIsOpen] = useState(false)
    const [prospects, setProspects] = useState<Prospect[]>([])
    const [filteredProspects, setFilteredProspects] = useState<Prospect[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    // Fetch known prospects on mount
    useEffect(() => {
        const fetchProspects = async () => {
            setLoading(true)
            try {
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) return

                const response = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/prospects/known`,
                    {
                        headers: {
                            'Authorization': `Bearer ${session.access_token}`
                        }
                    }
                )

                if (response.ok) {
                    const data = await response.json()
                    setProspects(data)
                }
            } catch (error) {
                console.error('Error fetching prospects:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchProspects()
    }, [supabase])

    // Filter prospects based on input
    useEffect(() => {
        if (!value.trim()) {
            setFilteredProspects(prospects.slice(0, 10))
            return
        }

        const query = value.toLowerCase()
        const filtered = prospects.filter(p => 
            p.name.toLowerCase().includes(query)
        )

        // Sort: exact start match first, then by context score
        filtered.sort((a, b) => {
            const aStarts = a.name.toLowerCase().startsWith(query)
            const bStarts = b.name.toLowerCase().startsWith(query)
            if (aStarts && !bStarts) return -1
            if (!aStarts && bStarts) return 1
            return b.context_score - a.context_score
        })

        setFilteredProspects(filtered.slice(0, 10))
    }, [value, prospects])

    // Handle keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' && filteredProspects.length > 0) {
                setIsOpen(true)
                setSelectedIndex(0)
                e.preventDefault()
            }
            return
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => 
                    prev < filteredProspects.length - 1 ? prev + 1 : prev
                )
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => prev > 0 ? prev - 1 : prev)
                break
            case 'Enter':
                e.preventDefault()
                if (selectedIndex >= 0 && filteredProspects[selectedIndex]) {
                    selectProspect(filteredProspects[selectedIndex])
                }
                break
            case 'Escape':
                setIsOpen(false)
                setSelectedIndex(-1)
                break
        }
    }, [isOpen, selectedIndex, filteredProspects])

    const selectProspect = (prospect: Prospect) => {
        onChange(prospect.name)
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
    }

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current && 
                !dropdownRef.current.contains(e.target as Node) &&
                !inputRef.current?.contains(e.target as Node)
            ) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Check if current value matches a known prospect
    const isKnownProspect = prospects.some(
        p => p.name.toLowerCase() === value.toLowerCase()
    )

    return (
        <div className={cn("relative", className)}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value)
                        setIsOpen(true)
                        setSelectedIndex(-1)
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        "pl-10 pr-10",
                        isKnownProspect && "border-green-500 focus-visible:ring-green-500"
                    )}
                />
                {isKnownProspect && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
            </div>

            {/* Dropdown */}
            {isOpen && (filteredProspects.length > 0 || value.trim()) && (
                <div
                    ref={dropdownRef}
                    className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[300px] overflow-auto"
                >
                    {filteredProspects.length > 0 ? (
                        <>
                            <div className="px-3 py-2 text-xs text-muted-foreground border-b bg-muted/50">
                                Bekende prospects ({filteredProspects.length})
                            </div>
                            {filteredProspects.map((prospect, index) => (
                                <div
                                    key={prospect.name}
                                    className={cn(
                                        "px-3 py-2 cursor-pointer flex items-center justify-between",
                                        "hover:bg-accent",
                                        selectedIndex === index && "bg-accent"
                                    )}
                                    onClick={() => selectProspect(prospect)}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                >
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{prospect.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {prospect.has_research && (
                                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                                                <FileText className="h-3 w-3 mr-1" />
                                                Research
                                            </Badge>
                                        )}
                                        {prospect.has_prep && (
                                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                                                <Briefcase className="h-3 w-3 mr-1" />
                                                Prep
                                            </Badge>
                                        )}
                                        {prospect.has_followup && (
                                            <Badge variant="outline" className="text-xs px-1.5 py-0">
                                                <MessageSquare className="h-3 w-3 mr-1" />
                                                Follow-up
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </>
                    ) : value.trim() ? (
                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Geen bekende prospect gevonden</p>
                            <p className="text-xs mt-1">
                                Druk Enter om "{value}" te gebruiken als nieuwe prospect
                            </p>
                        </div>
                    ) : null}
                </div>
            )}

            {/* Helper text */}
            {!isOpen && !isKnownProspect && value.trim() && (
                <p className="text-xs text-amber-600 mt-1">
                    ⚠️ Nieuwe prospect - context wordt pas opgebouwd na research/prep
                </p>
            )}
            {!isOpen && isKnownProspect && (
                <p className="text-xs text-green-600 mt-1">
                    ✓ Bekende prospect - bestaande context wordt gebruikt
                </p>
            )}
        </div>
    )
}

