import { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { AuthProvider } from '@/context/AuthContext'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { ErrorPage } from '@/pages/ErrorPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { Spinner } from '@/components/ui/Spinner'

const SeedsList = lazy(() => import('@/features/seeds/SeedsList').then(m => ({ default: m.SeedsList })))
const SeedDetail = lazy(() => import('@/features/seeds/SeedDetail').then(m => ({ default: m.SeedDetail })))
const GlobalPhrases = lazy(() => import('@/features/phrases/GlobalPhrases').then(m => ({ default: m.GlobalPhrases })))
const DrillingMode = lazy(() => import('@/features/drilling/DrillingMode').then(m => ({ default: m.DrillingMode })))

function PageLoader() {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Navigate to="/seeds" replace /> },
      {
        path: 'seeds',
        element: (
          <Suspense fallback={<PageLoader />}>
            <SeedsList />
          </Suspense>
        ),
      },
      {
        path: 'seeds/:seedId',
        element: (
          <Suspense fallback={<PageLoader />}>
            <SeedDetail />
          </Suspense>
        ),
      },
      {
        path: 'phrases',
        element: (
          <Suspense fallback={<PageLoader />}>
            <GlobalPhrases />
          </Suspense>
        ),
      },
      {
        path: 'drill',
        element: (
          <Suspense fallback={<PageLoader />}>
            <DrillingMode />
          </Suspense>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ErrorBoundary>
  )
}
