import { Metadata } from 'next'
import Link from 'next/link'
import { AuthForm } from '@/components/auth/auth-form'
import { Icons } from '@/components/icons'
import { Alert, AlertDescription } from '@/components/ui/alert'

export const metadata: Metadata = {
    title: 'Login - SalesPrep AI',
    description: 'Login to your account',
}

// Error messages for OAuth errors
const errorMessages: Record<string, string> = {
    oauth_error: 'Authentication failed. Please try again.',
    access_denied: 'Sign in was cancelled.',
    server_error: 'The authentication provider is temporarily unavailable. Please try again later.',
}

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ error?: string }>
}) {
    const params = await searchParams
    const errorMessage = params.error ? errorMessages[params.error] || 'An error occurred during sign in.' : null

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-950">
            {/* Header */}
            <header className="p-4">
                <Link href="/" className="flex items-center gap-2 w-fit">
                    <Icons.zap className="h-6 w-6 text-blue-600" />
                    <span className="font-bold text-xl text-slate-900 dark:text-white">SalesPrep AI</span>
                </Link>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-[400px] space-y-6">
                    {/* Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border dark:border-slate-800 p-8">
                        <div className="flex flex-col space-y-2 text-center mb-6">
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Welcome back
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Sign in to your account to continue
                            </p>
                        </div>

                        {/* OAuth Error Alert */}
                        {errorMessage && (
                            <Alert variant="destructive" className="mb-6">
                                <Icons.alertCircle className="h-4 w-4" />
                                <AlertDescription>{errorMessage}</AlertDescription>
                            </Alert>
                        )}

                        <AuthForm view="login" />
                    </div>

                    {/* Footer Link */}
                    <p className="text-center text-sm text-muted-foreground">
                        Don&apos;t have an account?{' '}
                        <Link
                            href="/signup"
                            className="font-medium text-blue-600 hover:text-blue-500 underline underline-offset-4"
                        >
                            Sign up for free
                        </Link>
                    </p>
                </div>
            </main>

            {/* Footer */}
            <footer className="p-4 text-center text-sm text-muted-foreground">
                <p>© {new Date().getFullYear()} SalesPrep AI. All rights reserved.</p>
            </footer>
        </div>
    )
}
