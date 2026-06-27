import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api/axios'

export default function EmployeePortalPage() {
  const { employeeId } = useParams()
  const [tasks, setTasks] = useState([])
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPortalData()
  }, [employeeId])

  const fetchPortalData = async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/employees/tasks/${employeeId}?date=${new Date().toISOString()}`)
      setTasks(data.data || [])
      
      try {
        const empRes = await api.get(`/employees/${employeeId}`)
        setEmployee(empRes.data.data)
      } catch {
        setEmployee({ firstName: 'Employee', _id: employeeId })
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load tasks.')
    } finally {
      setLoading(false)
    }
  }

  const markComplete = async (taskId) => {
    try {
      await api.patch(`/employees/tasks/${taskId}/status`, { status: 'Completed' })
      setTasks(tasks.map(t => t._id === taskId ? { ...t, status: 'Completed' } : t))
    } catch (err) {
      alert('Failed to update task.')
    }
  }

  if (loading) return <div className="p-8 text-center text-slate-400">Loading Portal...</div>
  if (error) return <div className="p-8 text-center text-rose-500">{error}</div>

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 flex flex-col items-center">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 bg-violet-600/20 text-violet-400 rounded-full flex items-center justify-center text-2xl font-bold mb-4">
            {employee?.firstName?.charAt(0) || 'U'}
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Today's To-Do List</h1>
          <p className="text-slate-400 text-sm">{employee?.firstName} {employee?.lastName}</p>
        </div>

        <div className="space-y-4">
          {tasks.length === 0 ? (
            <div className="text-center p-6 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <span className="text-4xl mb-2 block">🎉</span>
              <p className="text-slate-300 font-medium">No tasks assigned for today!</p>
              <p className="text-slate-500 text-sm mt-1">You're all caught up.</p>
            </div>
          ) : (
            tasks.map(task => (
              <div 
                key={task._id} 
                className={`p-4 rounded-xl border transition-all ${
                  task.status === 'Completed' 
                    ? 'bg-emerald-900/10 border-emerald-500/20 opacity-75' 
                    : 'bg-slate-800 border-slate-700 shadow-md'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {task.status === 'Completed' ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : (
                      <button 
                        onClick={() => markComplete(task._id)}
                        className="w-6 h-6 rounded-full border-2 border-slate-500 hover:border-violet-500 focus:outline-none cursor-pointer"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-base font-medium ${task.status === 'Completed' ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                      {task.taskDescription}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-semibold">
                      {task.status}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
