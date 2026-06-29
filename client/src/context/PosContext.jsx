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
  const [totalCreditSalesToday, setTotalCreditSalesToday] = useState(0)
  const [totalCashInToday, setTotalCashInToday] = useState(0)
  const [totalCashOutToday, setTotalCashOutToday] = useState(0)
  const [showFloatModal, setShowFloatModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [bakeryProducts, setBakeryProducts] = useState([])
  const [heldCart, setHeldCart] = useState(null)
  const [activeCustomer, setActiveCustomer] = useState('Regular Customer')
  
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
      setTotalCreditSalesToday(data.creditSalesTotal || 0)

      let cashIn = Number(data.customerDebtCollections || 0)
      let cashOut = Number(data.totalPayouts || 0) + Number(data.supplierDebtPayments || 0)
      
      // Look up any generic payins in transactions
      if (data.transactions) {
        data.transactions.forEach(t => {
          if (t.type === 'payin') {
            cashIn += Number(t.amount || 0)
          }
        })
      }
      
      setTotalCashInToday(cashIn)
      setTotalCashOutToday(cashOut)

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
      const tracking = (bakeryProducts || []).map(p => ({
        productId: p?._id,
        name: p?.name || 'Unnamed Bakery Item',
        price: Number(p?.sellingPrice || 0),
        openingQty: Number(bakeryQtys?.[p?._id]) || 0,
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
    setTotalCashSalesToday(prev => prev + Number(amount || 0))
  }

  const addCreditSale = (amount) => {
    setTotalCreditSalesToday(prev => prev + Number(amount || 0))
  }

  const recordBakerySales = (soldItems) => {
    setBakeryTracking(prev => {
      const itemsArr = Array.isArray(soldItems) ? soldItems : []
      return (prev || []).map(tracked => {
        const match = itemsArr.find(s => s?.productId === tracked?.productId)
        if (match) {
          return {
            ...tracked,
            salesQty: Number(tracked.salesQty || 0) + Number(match.quantity || 0)
          }
        }
        return tracked
      })
    })
  }

  const holdCurrentCart = useCallback((cartItems, promoDiscount, customer) => {
    setHeldCart({
      items: JSON.parse(JSON.stringify(cartItems || [])),
      promoDiscount: JSON.parse(JSON.stringify(promoDiscount || { type: 'percentage', value: 0 })),
      customer: customer || activeCustomer || 'Regular Customer'
    })
    setActiveCustomer('Regular Customer')
  }, [activeCustomer])

  const recallHeldCart = useCallback(() => {
    if (!heldCart) return null
    const result = heldCart
    setActiveCustomer(result.customer || 'Regular Customer')
    setHeldCart(null)
    return result
  }, [heldCart])

  return (
    <PosContext.Provider value={{
      openingFloat,
      setOpeningFloat,
      totalCashSalesToday,
      setTotalCashSalesToday,
      totalCreditSalesToday,
      setTotalCreditSalesToday,
      totalCashInToday,
      totalCashOutToday,
      showFloatModal,
      setShowFloatModal,
      isLoading,
      fetchCashSummary,
      addCashSale,
      addCreditSale,
      bakeryProducts,
      bakeryTracking,
      recordOpeningFloatAndBakery,
      recordBakerySales,
      heldCart,
      activeCustomer,
      setActiveCustomer,
      holdCurrentCart,
      recallHeldCart
    }}>
      {children}
    </PosContext.Provider>
  )
}
