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
const DrillingMode = lazy(() => import('@/features/drilling/DrillingMode').then(m => ({ default: m.DrillingMode })))
const RecallLayout = lazy(() => import('@/features/recall/RecallLayout').then(m => ({ default: m.RecallLayout })))
const Translate = lazy(() => import('@/features/recall/Translate').then(m => ({ default: m.Translate })))
const QaPage = lazy(() => import('@/features/recall/QaPage').then(m => ({ default: m.QaPage })))

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
        path: 'drill',
        element: (
          <Suspense fallback={<PageLoader />}>
            <DrillingMode />
          </Suspense>
        ),
      },
      {
        path: 'recall',
        element: (
          <Suspense fallback={<PageLoader />}>
            <RecallLayout />
          </Suspense>
        ),
        children: [
          { index: true, element: <Navigate to="translate" replace /> },
          {
            path: 'translate',
            element: (
              <Suspense fallback={<PageLoader />}>
                <Translate />
              </Suspense>
            ),
          },
          {
            path: 'qa',
            element: (
              <Suspense fallback={<PageLoader />}>
                <QaPage />
              </Suspense>
            ),
          },
        ],
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
