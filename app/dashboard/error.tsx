'use client'

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Fehler im Dashboard</h1>
      <p className="text-sm text-red-600">{error.message}</p>
      <button
        onClick={reset}
        className="inline-flex items-center px-4 py-2 rounded-lg border hover:bg-gray-50"
      >
        Erneut versuchen
      </button>
    </main>
  )
}
