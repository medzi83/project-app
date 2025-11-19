// /app/dashboard/loading.tsx
export default function LoadingDashboard() {
  return (
    <>
      <main className="p-6 space-y-6">
        {/* Header Skeleton */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>

        {/* Notice Board Skeleton */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-2xl border bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="space-y-3">
              <div className="h-20 bg-gray-100 rounded animate-pulse" />
              <div className="h-20 bg-gray-100 rounded animate-pulse" />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border bg-white p-5 sm:p-6 shadow-sm">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="space-y-3">
              <div className="h-20 bg-gray-100 rounded animate-pulse" />
            </div>
          </section>
        </div>

        {/* KPI Tiles Skeleton */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
              <div className="h-3 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="mt-2 h-8 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </section>

        {/* Status Overview Skeleton */}
        <section className="rounded-2xl border">
          <div className="px-4 py-3 border-b bg-gray-50">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="space-y-6 p-4">
            {[...Array(3)].map((_, sectionIdx) => (
              <div key={sectionIdx} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2">
                  {[...Array(7)].map((_, tileIdx) => (
                    <div key={tileIdx} className="rounded-lg border bg-white p-2.5 shadow-sm">
                      <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
                      <div className="mt-1 h-6 w-10 bg-gray-200 rounded animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Loading Overlay with Spinner */}
      <div className="fixed inset-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center space-y-4">
          {/* Animated Spinner */}
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 dark:border-blue-500 rounded-full border-t-transparent animate-spin"></div>
          </div>

          {/* Loading Text */}
          <div className="space-y-2">
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Dashboard wird geladen...</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Daten werden vorbereitet</p>
          </div>
        </div>
      </div>
    </>
  )
}
