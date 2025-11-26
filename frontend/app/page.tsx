export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">
          Welcome to SalesPrep AI
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          AI-powered sales enablement platform for B2B SaaS teams
        </p>
        <div className="mt-8">
          <span className="inline-block bg-green-100 text-green-800 px-6 py-3 rounded-lg font-semibold">
            ✅ Frontend is running!
          </span>
        </div>
        <div className="mt-12 text-sm text-gray-500">
          <p>Tech Stack: Next.js 15 + TypeScript + Tailwind CSS</p>
        </div>
      </div>
    </main>
  )
}
