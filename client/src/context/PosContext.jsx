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
  const [bakeryProducts, setBakeryProducts] = useState([])
  
  const [bakeryTracking, setBakeryTracking] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('pos_shift_bakery_tracking')) || []
    } catch {
      return []
    }
  })

  // Persist bakery tracking
  useEffect(() => {
    localStorage.setItem('pos_shift_bakery_tracking', JSON.stringify(bakeryTracking))
  }, [bakeryTracking])

  // Load bakery products on mount
  useEffect(() => {
    const fetchBakeryProducts = async () => {
      try {
        const res = await api.get('/inventory/products', { params: { category: 'BAKERY', limit: 100 } })
        setBakeryProducts(res.data.data || [])
      } catch (err) {
        console.error('Failed to load bakery products for init:', err)
      }
    }
    if (user) {
      fetchBakeryProducts()
    }
  }, [user])

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

  const recordOpeningFloatAndBakery = async (floatAmount, bakeryQtys) => {
    try {
      // 1. Record float
      await api.post('/billing/cash', {
        amount: Number(floatAmount),
        reason: 'Opening Shift Float',
        type: 'starting_drawer'
      })
      setOpeningFloat(Number(floatAmount))
      
      // 2. Initialize bakery tracking
      const tracking = bakeryProducts.map(p => ({
        productId: p._id,
        name: p.name,
        price: p.sellingPrice,
        openingQty: Number(bakeryQtys[p._id]) || 0,
        salesQty: 0
      }))
      setBakeryTracking(tracking)
      
      setShowFloatModal(false)
    } catch (err) {
      console.error('Failed to initialize shift:', err)
      throw err
    }
  }

  const addCashSale = (amount) => {
    setTotalCashSalesToday(prev => prev + Number(amount))
  }

  const recordBakerySales = (soldItems) => {
    setBakeryTracking(prev => {
      return prev.map(tracked => {
        const match = soldItems.find(s => s.productId === tracked.productId)
        if (match) {
          return {
            ...tracked,
            salesQty: tracked.salesQty + (Number(match.quantity) || 0)
          }
        }
        return tracked
      })
    })
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
      addCashSale,
      bakeryProducts,
      bakeryTracking,
      recordOpeningFloatAndBakery,
      recordBakerySales
    }}>
      {children}
    </PosContext.Provider>
  )
}
