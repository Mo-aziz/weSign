import { Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthenticatedLayout from './components/AuthenticatedLayout'
import Login from './screens/Login'
import Contacts from './screens/Contacts'
import Settings from './screens/Settings'
import Translation from './screens/Translation'

const LoadingFallback = () => (
  <div className="flex min-h-screen items-center justify-center px-4 py-6 text-slate-100">
    <div className="phone-shell flex min-h-[720px] w-full max-w-[430px] items-center justify-center px-6 py-8 text-center">
      Loading experience...
    </div>
  </div>
)

const App = () => {
  return (
    <div className="min-h-screen">
      <HashRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AuthenticatedLayout />}>
              <Route index element={<Navigate to="/contacts" replace />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/translation" element={<Translation />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/contacts" replace />} />
          </Routes>
        </Suspense>
      </HashRouter>
    </div>
  )
}

export default App
