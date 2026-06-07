import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db } from '../db/schema'
import type { WorkoutPlan } from '../db/schema'

export function PlanPicker() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<
    (WorkoutPlan & { lastCompleted?: string; exerciseCount: number })[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const allPlans = await db.workoutPlans.toArray()
      const enriched = await Promise.all(
        allPlans.map(async (plan) => {
          const planSessions = await db.sessions
            .where('planId')
            .equals(plan.id)
            .toArray()
          const last = planSessions
            .filter((s) => s.completed)
            .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0]
          return {
            ...plan,
            exerciseCount: plan.exercises.length,
            lastCompleted: last
              ? last.startedAt.toLocaleDateString()
              : undefined,
          }
        }),
      )
      setPlans(enriched)
      setLoading(false)
    }
    load()
  }, [])

  const startPlan = async (planId: string) => {
    const id = await db.sessions.add({
      planId,
      startedAt: new Date(),
      completed: false,
      completedExerciseIds: [],
    })
    navigate(`/session/${id}`)
  }

  if (loading) {
    return <p className="text-center text-slate-500">Loading plans...</p>
  }

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm text-emerald-600">
        ← Back
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Choose a plan</h1>
      <p className="mb-6 text-sm text-slate-500">
        Alternate Full Body A and B on gym days.
      </p>

      <div className="space-y-4">
        {plans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => startPlan(plan.id)}
            className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700"
          >
            <h2 className="text-lg font-bold">{plan.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
            <div className="mt-3 flex gap-4 text-xs text-slate-400">
              <span>{plan.exerciseCount} exercises</span>
              {plan.lastCompleted && (
                <span>Last done: {plan.lastCompleted}</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
