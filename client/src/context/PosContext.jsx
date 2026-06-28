import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import { useAuth } from './AuthContext'

const PosContext = createContext(null)

export const usePos = () => {
  const ctx = useContext(PosContext)
  if (!ctx) throw new Error('usePos must be used within <PosProvider>')
  return ctx
}

export function PosProvider({ children }) {
  const { user } = useAuth()
  const [openingFloat, setOpeningFloat] = useState(0)
  const [totalCashSalesToday, setTotalCashSalesToday] = useState(0)
  const [showFloatModal, setShowFloatModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchCashSummary = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const res = await api.get('/billing/cash/summary')
      const data = res.data.data
      setOpeningFloat(data.startingCash || 0)
      setTotalCashSalesToday(data.cashSalesTotal || 0)

      // Check if starting_drawer transaction exists
      const hasStartingDrawer = data.transactions && data.transactions.some(tx => tx.type === 'starting_drawer')
      if (!hasStartingDrawer && data.startingCash === 0) {
        setShowFloatModal(true)
      } else {
        setShowFloatModal(false)
      }
    } catch (err) {
      console.error('Failed to fetch cash drawer summary:', err)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      fetchCashSummary()
    }
  }, [user, fetchCashSummary])

  const recordOpeningFloat = async (amount) => {
    try {
      await api.post('/billing/cash', {
        amount: Number(amount),
        reason: 'Opening Shift Float',
        type: 'starting_drawer'
      })
      setOpeningFloat(Number(amount))
      setShowFloatModal(false)
    } catch (err) {
      console.error('Failed to log opening cash float:', err)
      throw err
    }
  }

  const addCashSale = (amount) => {
    setTotalCashSalesToday(prev => prev + Number(amount))
  }

  return (
    <PosContext.Provider value={{
      openingFloat,
      setOpeningFloat,
      totalCashSalesToday,
      setTotalCashSalesToday,
      showFloatModal,
      setShowFloatModal,
      isLoading,
      fetchCashSummary,
      recordOpeningFloat,
      addCashSale
    }}>
      {children}
    </PosContext.Provider>
  )
}
