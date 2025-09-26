// /app/dashboard/loading.tsx
export default function LoadingDashboard() {
  return (
    <main className="p-6 space-y-6 animate-pulse">
      <div className="h-7 w-48 bg-gray-200 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border p-4">
            <div className="h-4 w-28 bg-gray-200 rounded" />
            <div className="mt-2 h-8 w-20 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border">
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="h-5 w-64 bg-gray-200 rounded" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="px-4 py-3 border-t">
            <div className="h-4 w-80 bg-gray-200 rounded" />
            <div className="mt-2 h-3 w-56 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </main>
  )
}
