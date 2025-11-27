"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle2, ArrowRight, Sparkles } from "lucide-react"

interface Question {
  id: string
  text: string
  category: string
}

interface InterviewProgress {
  current: number
  total: number
}

interface InterviewResponse {
  session_id: string
  question: Question
  progress: InterviewProgress
}

export default function OnboardingPage() {
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [progress, setProgress] = useState<InterviewProgress>({ current: 0, total: 15 })
  const [answer, setAnswer] = useState("")
  const [loading, setLoading] = useState(false)
  const [starting, setStarting] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    checkProfileAndStartInterview()
  }, [])

  const checkProfileAndStartInterview = async () => {
    setStarting(true)
    setError(null)
    
    try {
      const token = await getAuthToken()
      if (!token) return

      // First check if profile already exists
      const checkResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/profile/sales/check`,
        {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        }
      )

      if (checkResponse.ok) {
        const checkData = await checkResponse.json()
        if (checkData.exists) {
          // Profile already exists, redirect to dashboard
          router.push("/dashboard?message=profile_exists")
          return
        }
      }

      // Profile doesn't exist, start interview
      await startInterview()
    } catch (err) {
      console.error("Error checking profile:", err)
      // If check fails, try to start interview anyway
      await startInterview()
    }
  }

  const getAuthToken = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push("/login")
      return null
    }
    return session.access_token
  }

  const startInterview = async () => {
    try {
      const token = await getAuthToken()
      if (!token) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/profile/sales/interview/start`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      )

      if (!response.ok) {
        throw new Error("Failed to start interview")
      }

      const data: InterviewResponse = await response.json()
      setSessionId(data.session_id)
      setCurrentQuestion(data.question)
      setProgress(data.progress)
    } catch (err) {
      setError("Failed to start interview. Please try again.")
      console.error(err)
    } finally {
      setStarting(false)
    }
  }

  const submitAnswer = async () => {
    if (!answer.trim() || !sessionId || !currentQuestion) return

    setLoading(true)
    setError(null)

    try {
      const token = await getAuthToken()
      if (!token) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/profile/sales/interview/answer`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
            question_id: currentQuestion.id,
            answer: answer,
          }),
        }
      )

      if (!response.ok) {
        throw new Error("Failed to submit answer")
      }

      const data: InterviewResponse = await response.json()
      
      // Check if interview is complete
      if (data.progress.current >= data.progress.total) {
        await completeInterview()
      } else {
        setCurrentQuestion(data.question)
        setProgress(data.progress)
        setAnswer("")
      }
    } catch (err) {
      setError("Failed to submit answer. Please try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const completeInterview = async () => {
    if (!sessionId) return

    setCompleting(true)
    setError(null)

    try {
      const token = await getAuthToken()
      if (!token) return

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/profile/sales/interview/complete`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
          }),
        }
      )

      if (!response.ok) {
        throw new Error("Failed to complete interview")
      }

      // Redirect to dashboard after successful completion
      router.push("/dashboard?onboarding=complete")
    } catch (err) {
      setError("Failed to complete interview. Please try again.")
      console.error(err)
      setCompleting(false)
    }
  }

  const progressPercentage = (progress.current / progress.total) * 100

  if (starting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-muted-foreground">Starting your onboarding interview...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (completing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
              <div className="text-center">
                <h3 className="text-lg font-semibold">Interview Complete!</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Creating your personalized profile...
                </p>
              </div>
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-blue-600 mr-2" />
            <h1 className="text-3xl font-bold">Welcome to SalesPrep AI</h1>
          </div>
          <p className="text-muted-foreground">
            Let's get to know you better to personalize your experience
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Question {progress.current} of {progress.total}</span>
            <span>{Math.round(progressPercentage)}% Complete</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Question Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">
              {currentQuestion?.text}
            </CardTitle>
            <CardDescription>
              Take your time to provide a thoughtful answer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              className="min-h-[150px] resize-none"
              disabled={loading}
            />
            {error && (
              <p className="text-sm text-red-600 mt-2">{error}</p>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <div className="text-sm text-muted-foreground">
              {answer.length} characters
            </div>
            <Button
              onClick={submitAnswer}
              disabled={!answer.trim() || loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Tips */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            💡 Tip: The more details you provide, the better we can personalize your experience
          </p>
        </div>
      </div>
    </div>
  )
}
