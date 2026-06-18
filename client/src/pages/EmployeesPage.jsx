import React, { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/axios'
import { QRCodeCanvas } from 'qrcode.react'
import { Html5Qrcode } from 'html5-qrcode'

const TABS = [
  { id: 'directory', label: 'Employee Directory' },
  { id: 'attendance', label: 'Live Attendance' },
  { id: 'payroll', label: 'Payroll Processor' },
]

export default function EmployeesPage() {
  const [activeTab, setActiveTab] = useState('directory')

  // Global states
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const res = await api.get('/employees')
      setEmployees(res.data.data)
    } catch (err) {
      setError('Failed to fetch employees.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in text-slate-100">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
          Staff Management
        </h1>
        <p className="text-slate-400 mt-1">Manage employees, track live attendance, and process payroll.</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-900/50 p-1 rounded-xl w-fit border border-slate-800">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-5 py-2 text-sm font-semibold rounded-lg transition-all duration-200
              ${activeTab === tab.id 
                ? 'bg-violet-600/20 text-violet-300 shadow-sm border border-violet-500/30' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'}
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Tab Content */}
      <div className="relative">
        {loading && activeTab === 'directory' ? (
          <div className="animate-pulse flex space-x-4">
            <div className="flex-1 space-y-4 py-1">
              <div className="h-4 bg-slate-800 rounded w-3/4"></div>
              <div className="space-y-2">
                <div className="h-4 bg-slate-800 rounded"></div>
                <div className="h-4 bg-slate-800 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'directory' && <DirectoryTab employees={employees} onRefresh={fetchEmployees} />}
            {activeTab === 'attendance' && <AttendanceTab employees={employees} />}
            {activeTab === 'payroll' && <PayrollTab employees={employees} />}
          </>
        )}
      </div>

    </div>
  )
}

/* ── 1. Directory Tab ────────────────────────────────────────────────────── */
function DirectoryTab({ employees, onRefresh }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedQrEmployee, setSelectedQrEmployee] = useState(null)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-200">Active Employees</h2>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-violet-900/40 transition-colors"
        >
          + Add Employee
        </button>
      </div>

      <div className="bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold tracking-wide">Employee</th>
                <th className="px-6 py-4 font-semibold tracking-wide">Role</th>
                <th className="px-6 py-4 font-semibold tracking-wide text-right">Hourly Rate</th>
                <th className="px-6 py-4 font-semibold tracking-wide text-center">QR Code</th>
                <th className="px-6 py-4 font-semibold tracking-wide text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    No employees found. Add one to get started.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp._id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold">
                          {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-slate-200 font-medium">{emp.firstName} {emp.lastName}</p>
                          <p className="text-slate-500 text-xs">ID: {emp.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{emp.designation || 'Staff'}</td>
                    <td className="px-6 py-4 text-slate-300 text-right font-mono">
                      Rs. {(emp.hourlyRate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedQrEmployee(emp)}
                        className="text-violet-400 hover:text-violet-300 bg-violet-400/10 hover:bg-violet-400/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      >
                        View QR
                      </button>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${emp.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddModalOpen && (
        <AddEmployeeModal onClose={() => setIsAddModalOpen(false)} onRefresh={onRefresh} />
      )}

      {selectedQrEmployee && (
        <QrCodeModal employee={selectedQrEmployee} onClose={() => setSelectedQrEmployee(null)} />
      )}
    </div>
  )
}

/* ── Add Employee Modal ──────────────────────────────────────────────────── */
function AddEmployeeModal({ onClose, onRefresh }) {
  const [formData, setFormData] = useState({
    employeeId: '',
    firstName: '',
    lastName: '',
    designation: '',
    hourlyRate: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/employees', {
        ...formData,
        hourlyRate: Number(formData.hourlyRate)
      })
      onRefresh()
      onClose()
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating employee')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-xl font-bold text-slate-100 mb-4">Add New Employee</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">First Name</label>
              <input required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-violet-500 transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Last Name</label>
              <input required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-violet-500 transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Employee ID (Unique)</label>
            <input required value={formData.employeeId} onChange={e => setFormData({...formData, employeeId: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Role / Designation</label>
            <input required value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Hourly Rate (Rs.)</label>
            <input required type="number" min="0" step="0.01" value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl font-medium transition-colors shadow-lg shadow-violet-900/40">
              {loading ? 'Saving...' : 'Save Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── QR Code Modal ───────────────────────────────────────────────────────── */
function QrCodeModal({ employee, onClose }) {
  const token = employee.qrCodeToken || employee.employeeId
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 w-full max-w-sm shadow-2xl flex flex-col items-center text-center">
        <h3 className="text-2xl font-bold text-slate-100 mb-2">{employee.firstName}'s QR Token</h3>
        <p className="text-slate-400 text-sm mb-8">Scan this code at the POS terminal to clock in and clock out.</p>
        
        <div className="bg-white p-4 rounded-2xl shadow-inner mb-6 ring-4 ring-violet-500/20">
          <QRCodeCanvas value={token} size={200} level="H" includeMargin={true} />
        </div>
        
        <p className="text-slate-500 font-mono text-xs mb-8 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">{token}</p>
        
        <button onClick={onClose} className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition-colors">
          Close
        </button>
      </div>
    </div>
  )
}

/* ── 2. Attendance Tab ───────────────────────────────────────────────────── */
function AttendanceTab() {
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(false)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]) // Today

  const fetchAttendance = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/employees/attendance?date=${date}`)
      setAttendance(res.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => {
    fetchAttendance()
  }, [date])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-200">Daily Attendance Log</h2>
          <input 
            type="date" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-violet-500 text-sm"
          />
        </div>

        <div className="bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 font-semibold">Employee</th>
                <th className="px-6 py-4 font-semibold text-center">Clock In</th>
                <th className="px-6 py-4 font-semibold text-center">Clock Out</th>
                <th className="px-6 py-4 font-semibold text-center">Total Hours</th>
                <th className="px-6 py-4 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">Loading...</td></tr>
              ) : attendance.length === 0 ? (
                <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No attendance records for this date.</td></tr>
              ) : (
                attendance.map((record) => (
                  <tr key={record._id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {record.employeeId?.firstName} {record.employeeId?.lastName}
                    </td>
                    <td className="px-6 py-4 text-center text-emerald-400 font-mono">
                      {new Date(record.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-center text-amber-400 font-mono">
                      {record.clockOut ? new Date(record.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-300">
                      {record.clockOut ? `${record.totalHoursWorked}h` : 'In Progress'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${!record.clockOut ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                        {!record.clockOut ? 'Clocked In' : 'Completed'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 40% Right Side QR Scanner */}
      <div className="lg:col-span-2">
        <QrScannerPanel onScanSuccess={fetchAttendance} />
      </div>
    </div>
  )
}

function QrScannerPanel({ onScanSuccess }) {
  const [scanError, setScanError] = useState(null)
  const [lastScanned, setLastScanned] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const onScanSuccessRef = useRef(onScanSuccess)

  // Keep callback ref fresh
  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess
  }, [onScanSuccess])

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, ctx.currentTime)
      osc.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    } catch (e) {
      // Ignore audio context errors
    }
  }

  useEffect(() => {
    let isMounted = true
    let isScanning = false
    const html5Qrcode = new Html5Qrcode("reader")

    html5Qrcode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: (width, height) => { return { w: width * 0.7, h: height * 0.7 } }
      },
      async (decodedText) => {
        if (!isMounted) return
        if (isScanning) return
        isScanning = true

        try {
          setScanError(null)
          setLastScanned(null)
          setIsProcessing(true)

          playBeep()

          let endpoint = '/employees/attendance/clock-in'
          let actionResponse = null

          try {
            actionResponse = await api.post(endpoint, { qrCodeToken: decodedText, terminal: 'Web-Scanner' })
          } catch (err) {
            if (err.response?.status === 409) {
              endpoint = '/employees/attendance/clock-out'
              actionResponse = await api.post(endpoint, { qrCodeToken: decodedText })
            } else {
              throw err
            }
          }

          if (isMounted) {
            setLastScanned({
              action: actionResponse.data.data.action,
              name: actionResponse.data.data.employee.name,
              message: actionResponse.data.message
            })
          }
          
          onScanSuccessRef.current()
          setTimeout(() => { isScanning = false }, 3000)
        } catch (err) {
          if (isMounted) {
            setScanError(err.response?.data?.message || 'Scan processing failed.')
          }
          setTimeout(() => { isScanning = false }, 3000)
        } finally {
          if (isMounted) {
            setIsProcessing(false)
          }
        }
      },
      (errorMessage) => { /* ignore verbose logs */ }
    ).then(() => {
      if (!isMounted) {
        if (html5Qrcode.isScanning) {
          html5Qrcode.stop()
            .then(() => html5Qrcode.clear())
            .catch(err => console.error("Scanner stop error", err))
        }
      }
    }).catch(err => {
      if (isMounted) {
        console.error("Scanner start error", err)
        setScanError(`Camera Initialization Error: ${err.message || err || 'Check permissions and secure HTTPS context.'}`)
      }
    })

    return () => {
      isMounted = false
      
      // Stop and clear the scanner instance
      if (html5Qrcode) {
        const stopScanner = async () => {
          try {
            if (html5Qrcode.isScanning) {
              await html5Qrcode.stop();
            }
            await html5Qrcode.clear();
          } catch (err) {
            console.error("Scanner cleanup error:", err);
          }
        };
        stopScanner();
      }

      // Stop any active camera tracks in the browser directly as a bulletproof safeguard
      try {
        const readerEl = document.getElementById("reader");
        if (readerEl) {
          const videos = readerEl.getElementsByTagName("video");
          for (let video of videos) {
            if (video.srcObject) {
              const stream = video.srcObject;
              if (stream && typeof stream.getTracks === 'function') {
                const tracks = stream.getTracks();
                tracks.forEach(track => {
                  track.stop();
                  console.log(`[Camera Release] Successfully stopped track: ${track.label}`);
                });
              }
              video.srcObject = null;
            }
          }
        }
      } catch (e) {
        console.error("Error stopping tracks manually:", e);
      }

      // Force stop all video track streams from window.localStream as a safeguard
      if (window.localStream) {
        try {
          window.localStream.getTracks().forEach(track => track.stop());
        } catch (e) {
          console.error("Error stopping window.localStream tracks:", e);
        }
      }
    }
  }, [])

  return (
    <div className="bg-slate-950 border border-slate-800/80 rounded-2xl shadow-xl shadow-black/20 p-6 flex flex-col h-full min-h-[500px]">
      <h2 className="text-xl font-bold text-slate-200 mb-4">Live QR Terminal</h2>
      
      <style>{`
        #reader { border: none !important; border-radius: 0.75rem; overflow: hidden; background: #0f172a; }
        #reader video { object-fit: cover; border-radius: 0.75rem; width: 100% !important; height: 100% !important; }
      `}</style>
      
      <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-800 relative w-full flex-shrink-0">
        <div id="reader" className="w-full aspect-square rounded-lg overflow-hidden"></div>
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center backdrop-blur-sm z-10">
            <span className="text-violet-400 font-bold animate-pulse text-lg tracking-wider">Processing...</span>
          </div>
        )}
      </div>
      
      <div className="mt-6 flex-1 flex flex-col justify-end">
        {scanError && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-4 py-4 rounded-xl text-sm font-medium animate-fade-in shadow-lg shadow-rose-500/10 flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <p>{scanError}</p>
          </div>
        )}
        {lastScanned && (
          <div className={`border px-4 py-4 rounded-xl text-sm font-medium animate-fade-in flex items-center gap-3 shadow-lg ${
            lastScanned.action === 'clock_in' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10' 
              : 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-amber-500/10'
          }`}>
             <span className="text-xl">{lastScanned.action === 'clock_in' ? '✅' : '👋'}</span>
             <p>{lastScanned.message}</p>
          </div>
        )}
        {!scanError && !lastScanned && (
           <div className="text-slate-500 text-sm text-center py-6 bg-slate-900/50 rounded-xl border border-slate-800/50">
             Position QR code squarely within the frame.<br/> It will scan automatically.
           </div>
        )}
      </div>
    </div>
  )
}

/* ── 3. Payroll Tab ──────────────────────────────────────────────────────── */
function PayrollTab({ employees }) {
  const [payroll, setPayroll] = useState([])
  const [loading, setLoading] = useState(false)
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)) // YYYY-MM
  const [generatingFor, setGeneratingFor] = useState(null)

  const fetchPayroll = async () => {
    setLoading(true)
    try {
      const res = await api.get('/employees/payroll')
      const targetMonth = new Date(month).getMonth()
      const targetYear = new Date(month).getFullYear()
      const filtered = res.data.data.filter(p => {
        const d = new Date(p.periodStart)
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear
      })
      setPayroll(filtered)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayroll()
  }, [month])

  const handleGenerate = async (empId) => {
    setGeneratingFor(empId)
    try {
      const year = parseInt(month.split('-')[0], 10)
      const m = parseInt(month.split('-')[1], 10) - 1
      const start = new Date(Date.UTC(year, m, 1))
      const end = new Date(Date.UTC(year, m + 1, 0, 23, 59, 59))
      
      await api.post('/employees/payroll/generate', {
        employeeId: empId,
        period: 'monthly',
        periodStart: start.toISOString(),
        periodEnd: end.toISOString()
      })
      await fetchPayroll()
    } catch (err) {
      alert(err.response?.data?.message || 'Error generating payroll')
    } finally {
      setGeneratingFor(null)
    }
  }

  const handlePay = async (payrollId) => {
    try {
      await api.patch(`/employees/payroll/${payrollId}/pay`)
      fetchPayroll()
    } catch (err) {
      alert('Failed to mark as paid')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-200">Monthly Payroll Processor</h2>
        <input 
          type="month" 
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-violet-500 text-sm"
        />
      </div>

      <div className="bg-slate-950 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-6 py-4 font-semibold">Employee</th>
              <th className="px-6 py-4 font-semibold text-center">Hours Logged</th>
              <th className="px-6 py-4 font-semibold text-right">Gross Salary</th>
              <th className="px-6 py-4 font-semibold text-center">Status</th>
              <th className="px-6 py-4 font-semibold text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {employees.length === 0 ? (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No employees found.</td></tr>
            ) : (
              employees.map((emp) => {
                const pRecord = payroll.find(p => p.employeeId._id === emp._id)
                
                return (
                  <tr key={emp._id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-200">
                      {emp.firstName} {emp.lastName}
                      <p className="text-xs text-slate-500 font-normal mt-0.5">Rate: Rs.{emp.hourlyRate || 0}/hr</p>
                    </td>
                    <td className="px-6 py-4 text-center font-mono text-slate-300">
                      {pRecord ? `${pRecord.totalHoursWorked}h` : '-'}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-emerald-400 font-semibold">
                      {pRecord ? `Rs. ${pRecord.grossPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {!pRecord ? (
                        <span className="text-slate-500 text-xs italic">Not Generated</span>
                      ) : pRecord.isPaid ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-full text-[10px] font-bold uppercase">Paid</span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-full text-[10px] font-bold uppercase">Unpaid</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {!pRecord ? (
                        <button 
                          onClick={() => handleGenerate(emp._id)}
                          disabled={generatingFor === emp._id}
                          className="text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                        >
                          {generatingFor === emp._id ? 'Generating...' : 'Compute Salary'}
                        </button>
                      ) : !pRecord.isPaid ? (
                        <button 
                          onClick={() => handlePay(pRecord._id)}
                          className="text-white bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-lg shadow-emerald-900/40"
                        >
                          Mark Paid
                        </button>
                      ) : (
                        <span className="text-slate-600 text-xs font-medium">Settled</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
