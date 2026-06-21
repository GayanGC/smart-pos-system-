/**
 * @file ChatDrawer.jsx
 * Sliding AI analytics chat drawer (right panel).
 *
 * Features:
 * - Starts a new chatbot session via POST /api/analytics/chatbot/sessions
 * - Sends messages via POST /api/analytics/chatbot/sessions/:id/message
 * - Renders user (violet) and assistant (slate) message bubbles
 * - Shows typing indicator during API calls
 * - Persists sessionId for the lifetime of the drawer
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../api/axios'

/* ── Message bubble ─────────────────────────────────────────────────── */
function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-up`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 shadow">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
          </svg>
        </div>
      )}
      <div
        className={`
          max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-violet-600 text-white rounded-tr-sm shadow-lg shadow-violet-900/30'
            : 'bg-slate-800/80 text-slate-200 border border-slate-700/50 rounded-tl-sm'}
        `}
      >
        {msg.content}
        <div className={`text-[10px] mt-1 ${isUser ? 'text-violet-300 text-right' : 'text-slate-600'}`}>
          {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

/* ── Typing indicator ───────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 animate-fade-up">
      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center flex-shrink-0 shadow">
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
        </svg>
      </div>
      <div className="bg-slate-800/80 border border-slate-700/50 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
        {[0, 150, 300].map((delay) => (
          <div
            key={delay}
            className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

/* ── Quick prompt chips ─────────────────────────────────────────────── */
const QUICK_PROMPTS = [
  "What's today's net profit?",
  "Which products are low on stock?",
  "Show me this week's top sellers",
  "Any expiring products this week?",
  "What was yesterday's revenue?",
]

/* ── Main Component ─────────────────────────────────────────────────── */
export default function ChatDrawer({ isOpen, onClose }) {
  const [messages,   setMessages]   = useState([])
  const [input,      setInput]      = useState('')
  const [sessionId,  setSessionId]  = useState(null)
  const [thinking,   setThinking]   = useState(false)
  const [sessionErr, setSessionErr] = useState(null)
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)

  // ── Voice & Speech API States ────────────────────────────────────────
  const [isListening, setIsListening] = useState(false)
  const [voiceMuted, setVoiceMuted] = useState(false)
  const recognitionRef = useRef(null)

  // ── Initialize Speech Recognition ────────────────────────────────────
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setInput((prev) => prev + (prev ? ' ' : '') + transcript)
        setIsListening(false)
      }
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }
      
      recognition.onend = () => {
        setIsListening(false)
      }
      
      recognitionRef.current = recognition
    }
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser.")
      return
    }
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch (err) {
        console.error(err)
      }
    }
  }

  const speakText = (text) => {
    if (voiceMuted || !window.speechSynthesis) return
    // Strip markdown bold, italics, bullets, and backticks for clear pronunciation
    const cleanedText = text.replace(/(\*\*|\*|#|-|`)/g, '').trim()
    const utterance = new SpeechSynthesisUtterance(cleanedText)
    window.speechSynthesis.speak(utterance)
  }

  // ── Start session when drawer opens ──────────────────────────────────
  useEffect(() => {
    if (!isOpen || sessionId) return
    let isMounted = true;

    const startSession = async () => {
      try {
        const { data } = await api.post('/analytics/chatbot/sessions', {
          systemPrompt:
            'You are the Smart ERP AI assistant. Help the business owner understand their sales data, inventory, and employee metrics. Be concise and insightful.',
        })
        if (isMounted) {
          setSessionId(data.data.sessionId)
          setMessages([{
            role: 'assistant',
            content: "👋 Hello! I'm your Smart ERP AI assistant. Ask me anything about your sales, inventory, or employee data.",
            timestamp: new Date().toISOString(),
          }])
        }
      } catch {
        if (isMounted) setSessionErr('Could not start AI session. Please try again.')
      }
    }
    startSession()

    return () => {
      isMounted = false;
    }
  }, [isOpen, sessionId])

  // ── Auto-scroll to bottom on new messages ────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  // ── Focus input when drawer opens ────────────────────────────────────
  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 350)
  }, [isOpen])

  // ── Send message ─────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim()
    if (!content || thinking || !sessionId) return
    setInput('')

    // Optimistically add user message
    const userMsg = { role: 'user', content, timestamp: new Date().toISOString() }
    setMessages((prev) => [...prev, userMsg])
    setThinking(true)

    try {
      // Send to server (server will save user msg, call Gemini, save AI msg, and return AI msg)
      const { data } = await api.post(`/analytics/chat`, {
        sessionId,
        content,
      })

      const reply = data.data.content
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      }])
      
      // Auto-speak the AI response
      speakText(reply)
    } catch (err) {
      const serverMsg = err.response?.data?.message || '⚠️ I had trouble fetching that data. Please check your connection and try again.'
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: serverMsg,
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setThinking(false)
    }
  }, [input, thinking, sessionId])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (!isOpen) return null

  return (
    /* ── Backdrop ──────────────────────────────────────────────────── */
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* ── Drawer panel ─────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-sm flex flex-col h-full bg-slate-950 border-l border-slate-800 shadow-2xl animate-slide-in-right">

        {/* ── Header ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-800 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-100 text-sm">AI Assistant</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-slate-500">Smart ERP Analytics</span>
            </div>
          </div>
          
          {/* Mute Toggle */}
          <button 
            onClick={() => setVoiceMuted(!voiceMuted)} 
            className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
            title={voiceMuted ? "Unmute Voice" : "Mute Voice"}
          >
            {voiceMuted ? '🔇' : '🔊'}
          </button>

          <button onClick={onClose} className="btn-icon flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Messages area ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sessionErr ? (
            <div className="text-center text-rose-400 text-sm py-8">{sessionErr}</div>
          ) : (
            <>
              {/* Quick prompts — shown when only welcome message exists */}
              {messages.length === 1 && (
                <div className="space-y-2 mt-2 animate-fade-up">
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider font-medium text-center">Quick questions</p>
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => sendMessage(p)}
                      className="w-full text-left px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-700/40 text-xs text-slate-300 hover:border-violet-500/40 hover:text-violet-300 transition-all duration-150"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}
              {thinking && <TypingIndicator />}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* ── Input area ────────────────────────────────────────── */}
        <div className="flex-shrink-0 p-4 border-t border-slate-800">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about sales, inventory, staff…"
              rows={1}
              className="input-field resize-none text-sm py-2.5 max-h-24"
              id="chat-input"
              disabled={thinking || !!sessionErr}
            />
            {/* Microphone Button */}
            <button
              onClick={toggleListening}
              disabled={thinking || !!sessionErr}
              className={`flex-shrink-0 w-10 h-10 p-0 flex items-center justify-center rounded-xl transition-colors border ${
                isListening 
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 animate-pulse' 
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
              }`}
              title="Voice Input"
            >
              🎤
            </button>
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || thinking || !!sessionErr}
              className="btn-primary flex-shrink-0 w-10 h-10 p-0 flex items-center justify-center rounded-xl"
            >
              {thinking ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-700 text-center mt-2">Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  )
}

/* ── Mock AI response generator ──────────────────────────────────────── */
// Replace this with a real LLM API call (OpenAI / Gemini) in production.
function generateMockResponse(input) {
  const q = input.toLowerCase()
  if (q.includes('profit') || q.includes('net'))
    return "📊 Based on today's data, your net profit is calculated from the dashboard. I'd recommend connecting this to the live `/api/billing/dashboard` endpoint for real-time figures. Your gross margin percentage indicates how efficiently you're converting revenue to profit."
  if (q.includes('stock') || q.includes('inventory') || q.includes('low'))
    return "⚠️ You can check low-stock items at `/api/inventory/alerts/low-stock`. I'll automatically flag any products at or below their configured threshold. Consider reordering the bottom-5 items by quantity."
  if (q.includes('top') || q.includes('sell') || q.includes('best'))
    return "🏆 Your top sellers are derived from invoice line items. The analytics summary at `/api/analytics/summary` provides the top 5 products by units sold. Focus promotions on your #2–#5 sellers to boost overall revenue."
  if (q.includes('expir'))
    return "📅 Products expiring within 30 days can be fetched from `/api/inventory/alerts/expiring?days=30`. I recommend creating bundle deals for near-expiry items to minimise waste."
  if (q.includes('yesterday') || q.includes('revenue'))
    return "💰 Yesterday's revenue can be queried via the dashboard endpoint with a custom date range. Historical trends show weekends typically generate 15–20% higher volume for most retail businesses."
  if (q.includes('employee') || q.includes('staff') || q.includes('attendance'))
    return "👥 Current employee attendance is tracked via QR clock-in. You can view today's attendance at `/api/employees/attendance`. Employees clocked in show a green indicator in the Live Feed."
  return "🤔 I understand your query about **" + input + "**. To give you a precise answer, I'd need to query the relevant backend endpoint. This assistant will be fully powered by an LLM in production (OpenAI GPT-4 / Google Gemini) with direct access to your ERP data."
}
