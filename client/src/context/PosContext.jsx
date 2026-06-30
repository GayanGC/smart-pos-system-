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
  const [totalDigitalSalesToday, setTotalDigitalSalesToday] = useState(0)
  const [totalCashInToday, setTotalCashInToday] = useState(0)
  const [totalCashOutToday, setTotalCashOutToday] = useState(0)
  const [showFloatModal, setShowFloatModal] = useState(() => {
    const isInit = localStorage.getItem('isSessionInitialized') === 'true';
    const hasCash = localStorage.getItem('hasSetOpeningCash') === 'true';
    return !isInit || !hasCash;
  })
  const [isLoading, setIsLoading] = useState(true)
  const [bakeryProducts, setBakeryProducts] = useState([])
  const [heldCartsList, setHeldCartsList] = useState({})
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

  // Sync products cache to c_cafe_local_db on boot
  useEffect(() => {
    const syncProductsCache = async () => {
      try {
        const { writeToStore, clearStore } = await import('../utils/localDb')
        const res = await api.get('/inventory/products', { params: { limit: 1000 } })
        const prods = res.data?.data || []
        if (prods.length > 0) {
          await clearStore('products_cache')
          await writeToStore('products_cache', prods)
          console.info('[PosContext] Cached products to products_cache in c_cafe_local_db.')
        }
      } catch (err) {
        console.warn('[PosContext] Offline or failed to sync products to c_cafe_local_db:', err)
      }
    }
    if (user) {
      syncProductsCache()
    }
  }, [user])

  // Background Sync Engine for offline_sales_queue
  useEffect(() => {
    const syncOfflineQueue = async () => {
      if (!navigator.onLine) return;
      try {
        const { readFromStore, deleteFromStore } = await import('../utils/localDb')
        const pending = await readFromStore('offline_sales_queue')
        if (pending.length === 0) return

        console.info(`[PosContext] Found ${pending.length} offline invoices. Syncing...`)
        for (const invoice of pending) {
          try {
            const { offlineRef, syncStatus, ...payload } = invoice
            await api.post('/billing/invoices', payload)
            await deleteFromStore('offline_sales_queue', offlineRef)
            console.info(`[PosContext] Synced offline invoice: ${offlineRef}`)
          } catch (singleErr) {
            console.error(`[PosContext] Failed to sync single invoice ${invoice?.offlineRef}:`, singleErr)
          }
        }
      } catch (err) {
        console.error('[PosContext] Error syncing offline sales queue:', err)
      }
    }

    const handleOnline = () => {
      console.info('[PosContext] Network restored — syncing offline sales queue...')
      syncOfflineQueue()
    }

    window.addEventListener('online', handleOnline)
    if (navigator.onLine) {
      syncOfflineQueue()
    }

    return () => window.removeEventListener('online', handleOnline)
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
      const isSessionInitialized = localStorage.getItem('isSessionInitialized') === 'true';
      const hasSetOpeningCash = localStorage.getItem('hasSetOpeningCash') === 'true';
      if (!isSessionInitialized || !hasSetOpeningCash || (!hasStartingDrawer && data.startingCash === 0)) {
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
      
      localStorage.setItem('isSessionInitialized', 'true')
      localStorage.setItem('hasSetOpeningCash', 'true')
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

  const addDigitalSale = (amount) => {
    setTotalDigitalSalesToday(prev => prev + Number(amount || 0))
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

  const holdCurrentCart = useCallback((slot, cartItems, promoDiscount, customer) => {
    setHeldCartsList(prev => ({
      ...prev,
      [slot]: {
        items: JSON.parse(JSON.stringify(cartItems || [])),
        promoDiscount: JSON.parse(JSON.stringify(promoDiscount || { type: 'percentage', value: 0 })),
        customer: customer || activeCustomer || 'Regular Customer',
        timestamp: Date.now()
      }
    }))
    setActiveCustomer('Regular Customer')
  }, [activeCustomer])

  const recallHeldCart = useCallback((slot) => {
    if (!heldCartsList[slot]) return null
    const result = heldCartsList[slot]
    setActiveCustomer(result.customer || 'Regular Customer')
    setHeldCartsList(prev => {
      const next = { ...prev }
      delete next[slot]
      return next
    })
    return result
  }, [heldCartsList])

  return (
    <PosContext.Provider value={{
      openingFloat,
      setOpeningFloat,
      totalCashSalesToday,
      setTotalCashSalesToday,
      totalCreditSalesToday,
      setTotalCreditSalesToday,
      totalDigitalSalesToday,
      setTotalDigitalSalesToday,
      totalCashInToday,
      totalCashOutToday,
      showFloatModal,
      setShowFloatModal,
      isLoading,
      fetchCashSummary,
      addCashSale,
      addCreditSale,
      addDigitalSale,
      bakeryProducts,
      bakeryTracking,
      recordOpeningFloatAndBakery,
      recordBakerySales,
      heldCartsList,
      activeCustomer,
      setActiveCustomer,
      holdCurrentCart,
      recallHeldCart
    }}>
      {children}
    </PosContext.Provider>
  )
}
