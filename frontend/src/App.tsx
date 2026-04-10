import { Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AuthenticatedLayout from './components/AuthenticatedLayout'
import Login from './screens/Login'
import Contacts from './screens/Contacts'
import Settings from './screens/Settings'
import Translation from './screens/Translation'

const LoadingFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
    Loading experience...
  </div>
)

const App = () => {
  return (
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
  )
}

export default App
