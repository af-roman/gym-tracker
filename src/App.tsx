import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { initDatabase } from './db/seed'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { PlanPicker } from './pages/PlanPicker'
import { Session } from './pages/Session'
import { ExerciseDetail } from './pages/ExerciseDetail'
import { SessionSummary } from './pages/SessionSummary'
import { Dashboard } from './pages/Dashboard'
import { BodyMetrics } from './pages/BodyMetrics'
import { PlanEditor } from './pages/PlanEditor'
import { ExerciseManager } from './pages/ExerciseManager'

function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    initDatabase().then(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-slate-500">Loading Gym Tracker...</p>
      </div>
    )
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/start" element={<PlanPicker />} />
          <Route path="/session/:sessionId" element={<Session />} />
          <Route
            path="/session/:sessionId/exercise/:exerciseId"
            element={<ExerciseDetail />}
          />
          <Route
            path="/session/:sessionId/summary"
            element={<SessionSummary />}
          />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/metrics" element={<BodyMetrics />} />
          <Route path="/plans" element={<PlanEditor />} />
          <Route path="/plans/exercises" element={<ExerciseManager />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}

export default App
