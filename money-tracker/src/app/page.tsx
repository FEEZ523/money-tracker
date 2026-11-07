'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Bot,
  Trash2,
  RotateCcw,
  Download,
  Mic,
  MicOff,
  CheckCircle2,
  AlertCircle,
  Search,
  SlidersHorizontal,
  ChevronRight,
  X,
  Sparkles,
  Plus,
  Utensils,
  Car,
  ShoppingBag,
  Receipt,
  Film,
  HeartPulse,
  MoreHorizontal,
  Copy,
  Check
} from 'lucide-react';
import { FinancialSummary, Transaction } from '@/lib/types';
import { parseThaiExpenseInput } from '@/lib/thai-nlp';
import FerrariBackgroundMotion from '@/components/FerrariBackgroundMotion';

const CATEGORY_META: Record<string, { label: string; dotColor: string; icon: any }> = {
  cat_food: { label: 'อาหารและเครื่องดื่ม', dotColor: '#f97316', icon: Utensils },
  cat_transport: { label: 'การเดินทาง/พาหนะ', dotColor: '#3b82f6', icon: Car },
  cat_shopping: { label: 'ช้อปปิ้ง/ของใช้', dotColor: '#a855f7', icon: ShoppingBag },
  cat_bills: { label: 'บิล/สาธารณูปโภค', dotColor: '#ef4444', icon: Receipt },
  cat_entertainment: { label: 'บันเทิง/สังสรรค์', dotColor: '#ec4899', icon: Film },
  cat_health: { label: 'สุขภาพ/รักษาพยาบาล', dotColor: '#10b981', icon: HeartPulse },
  cat_salary: { label: 'เงินเดือน/โบนัส', dotColor: '#22c55e', icon: Wallet },
  cat_side_income: { label: 'รายได้เสริม/ขายของ', dotColor: '#06b6d4', icon: ArrowUpRight },
  cat_other: { label: 'อื่นๆ', dotColor: '#64748b', icon: MoreHorizontal },
};

interface ChatMessage {
  id: string;
  sender: 'user' | 'gemini';
  text: string;
  time: string;
  recorded?: boolean;
}

export default function LuxuryMoneyTrackerApp() {
  const [inputText, setInputText] = useState('');
  const [showInputDrawer, setShowInputDrawer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [period, setPeriod] = useState<'month' | 'today' | 'all'>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'expense' | 'income' | 'ai'>('all');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
    undoId?: string;
  } | null>(null);

  // AI & Voice States
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiModalTab, setAiModalTab] = useState<'gemini' | 'chatgpt' | 'api_key'>('gemini');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [keySavedToast, setKeySavedToast] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [copiedOpenApi, setCopiedOpenApi] = useState(false);
  const recognitionRef = useRef<any>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Chatbot conversation thread
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'gemini',
      text: 'สวัสดีครับบอส! ผม Scuderia AI พร้อมช่วยดูแลการเงิน สั่งจดรายจ่าย หรือถามสรุปยอด ถามว่าเงินหายไปไหนหมด ได้เลยครับ 🏎️💨',
      time: 'เมื่อสักครู่',
    },
  ]);

  // Load saved Gemini API Key on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('user_gemini_api_key');
      if (savedKey) setGeminiApiKey(savedKey);
    }
  }, []);

  const saveGeminiKey = (key: string) => {
    setGeminiApiKey(key);
    if (typeof window !== 'undefined') {
      localStorage.setItem('user_gemini_api_key', key.trim());
      setKeySavedToast(true);
      setTimeout(() => setKeySavedToast(false), 2500);
    }
  };

  // Auto-dismiss notification toast after 4 seconds
  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => {
      setNotification(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [notification]);

  // Live parsed items for instant feedback
  const liveParsed = useMemo(() => {
    if (!inputText.trim()) return [];
    return parseThaiExpenseInput(inputText);
  }, [inputText]);

  // Fetch summary
  const fetchData = async (p = period) => {
    try {
      const res = await fetch(`/api/summary?period=${p}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSummary(data);

        // Client-side backup & sync to safeguard data across cold starts
        if (typeof window !== 'undefined') {
          if (data?.recentTransactions && data.recentTransactions.length > 0) {
            localStorage.setItem('user_transactions_backup', JSON.stringify(data.recentTransactions));
          } else if ((!data?.recentTransactions || data.recentTransactions.length === 0) && data?.totalExpenseSatang === 0) {
            const backup = localStorage.getItem('user_transactions_backup');
            if (backup) {
              try {
                const items = JSON.parse(backup);
                if (Array.isArray(items) && items.length > 0) {
                  fetch('/api/transactions', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transactions: items }),
                  }).then(() => {
                    fetch(`/api/summary?period=${p}`, { cache: 'no-store' })
                      .then((r) => r.json())
                      .then((fresh) => setSummary(fresh));
                  });
                }
              } catch (e) {
                console.warn('Backup parse error', e);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData(period);
  }, [period]);

  // Web Speech API for Thai voice input
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
    ) {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'th-TH';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (showAiModal) {
          setChatInput(transcript);
          handleSendChatMessage(transcript);
        } else {
          setInputText(transcript);
          setShowInputDrawer(true);
        }
        setIsRecording(false);
      };

      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceRecording = () => {
    if (!recognitionRef.current) {
      alert('กรุณาใช้ Google Chrome หรือ Edge เพื่อรองรับการแปลงเสียงภาษาไทยครับ');
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Submit new expense / income
  const handleSubmit = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText || inputText;
    if (!textToSend.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToSend, source: 'web' }),
      });
      const data = await res.json();
      if (res.ok) {
        setInputText('');
        setShowInputDrawer(false);
        setNotification({ type: 'success', message: data.message });
        await fetchData(period);
      } else {
        setNotification({ type: 'error', message: data.error || 'เกิดข้อผิดพลาด' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Send message to Gemini Financial Chatbot
  const handleSendChatMessage = async (msgToSend?: string) => {
    const text = (msgToSend || chatInput).trim();
    if (!text || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          apiKey: geminiApiKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const botMsg: ChatMessage = {
          id: `msg-${Date.now()}-b`,
          sender: 'gemini',
          text: data.reply || 'เรียบร้อยครับ!',
          time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          recorded: data.recorded,
        };
        setChatMessages((prev) => [...prev, botMsg]);
        if (data.recorded) {
          await fetchData(period);
          setNotification({ type: 'success', message: 'บันทึกรายการลงระบบเรียบร้อย!' });
        }
      } else {
        const errMsg: ChatMessage = {
          id: `msg-${Date.now()}-err`,
          sender: 'gemini',
          text: `ขออภัยครับ: ${data.error || 'โปรดลองใหม่อีกครั้ง'}`,
          time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        };
        setChatMessages((prev) => [...prev, errMsg]);
      }
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        sender: 'gemini',
        text: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${err.message}`,
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errMsg]);
    } finally {
      setChatLoading(false);
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({
          top: chatScrollRef.current.scrollHeight,
          behavior: 'smooth',
        });
      }, 100);
    }
  };

  // Soft delete & undo
  const handleDelete = async (id: string, note: string) => {
    try {
      const res = await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotification({
          type: 'success',
          message: `ลบ "${note}" เรียบร้อยแล้ว`,
          undoId: id,
        });
        await fetchData(period);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUndo = async (id: string) => {
    try {
      const res = await fetch(`/api/transactions?id=${id}&restore=true`, { method: 'DELETE' });
      if (res.ok) {
        setNotification({ type: 'success', message: 'กู้คืนรายการเรียบร้อย!' });
        await fetchData(period);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Filtered transactions
  const filteredList = useMemo(() => {
    if (!summary) return [];
    return summary.recentTransactions.filter((t) => {
      if (activeFilter === 'expense' && t.type !== 'expense') return false;
      if (activeFilter === 'income' && t.type !== 'income') return false;
      if (activeFilter === 'ai' && t.source === 'web') return false;
      if (searchQuery.trim() && !t.note.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [summary, activeFilter, searchQuery]);

  // Balance breakdown for big typography
  const netBalanceBaht = summary ? summary.netBalanceSatang / 100 : 0;
  const netIntegerStr = Math.floor(Math.abs(netBalanceBaht)).toLocaleString('th-TH');
  const netDecimalStr = (Math.abs(netBalanceBaht) % 1).toFixed(2).substring(1);
  const totalExpenseBaht = summary ? summary.totalExpenseSatang / 100 : 0;

  return (
    <div className="luxury-workspace flex justify-center selection:bg-rose-600 selection:text-white">
      {/* Centered Mobile/Fintech Luxury Canvas Container */}
      <div className="w-full max-w-md min-h-screen flex flex-col justify-between relative bg-[#0e121a] shadow-2xl overflow-hidden pb-24">
        {/* ===================== TOP DARK LUXURY SECTION ===================== */}
        <section className="pt-8 px-6 pb-6 text-white relative overflow-hidden">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-16 left-0 w-52 h-52 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Living Ferrari Supercar & Speed Streaks Motion Canvas (in the background) */}
          <FerrariBackgroundMotion />

          {/* Top Row: User Avatar & Notification / Period Icon */}
          <div className="flex justify-between items-center relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-600 via-amber-500 to-yellow-400 p-[2px] shadow-lg">
                <div className="w-full h-full rounded-full bg-[#131722] flex items-center justify-center text-base">
                  🏎️
                </div>
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-400 tracking-wider uppercase block">
                  SCUDERIA ACCOUNT
                </span>
                <span className="text-xs font-semibold text-white">Ferrari Edition</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPeriod(period === 'month' ? 'today' : period === 'today' ? 'all' : 'month')}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/10 hover:bg-white/15 text-slate-300 transition"
              >
                {period === 'month' ? 'เดือนนี้' : period === 'today' ? 'วันนี้' : 'ทั้งหมด'}
              </button>

              <button
                onClick={() => setShowAiModal(true)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-200 transition relative"
                title="เชื่อมต่อ AI"
              >
                <Bot className="w-4 h-4 text-rose-400" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400"></span>
              </button>
            </div>
          </div>

          {/* Main Balance Display with Luxury Peeking Card */}
          <div className="mt-8 flex justify-between items-center relative z-10">
            <div>
              <span className="text-xs text-slate-400 tracking-wide font-medium block">
                Total balance (ยอดเงินสุทธิ)
              </span>
              <div className="mt-1 flex items-baseline font-mono tracking-tight">
                <span className="text-xl sm:text-2xl font-semibold text-slate-300 mr-2">฿</span>
                <span className="text-4xl sm:text-5xl font-extrabold text-white">
                  {netBalanceBaht < 0 ? '-' : ''}
                  {netIntegerStr}
                </span>
                <span className="text-xl sm:text-2xl font-bold text-slate-400 ml-0.5">
                  {netDecimalStr}
                </span>
              </div>

              {/* Action Buttons: Record & AI */}
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={() => setShowInputDrawer(true)}
                  className="px-5 py-2.5 rounded-full bg-white text-slate-950 font-bold text-xs shadow-xl hover:bg-slate-100 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Plus className="w-4 h-4 text-slate-950 stroke-[3]" />
                  <span>จดเงินด่วน</span>
                </button>

                <button
                  onClick={() => setShowAiModal(true)}
                  className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/15 transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>สั่ง AI จด</span>
                </button>
              </div>
            </div>

            {/* Peeking Luxury Supercar Card */}
            <div className="relative -mr-6 w-16 h-36 rounded-l-3xl peeking-card overflow-hidden flex flex-col justify-between p-2 shadow-2xl opacity-90 hover:opacity-100 transition cursor-pointer">
              <div className="w-6 h-6 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-[10px] font-bold text-slate-900">
                SC
              </div>
              <div className="writing-vertical text-[9px] font-mono font-black text-slate-950 uppercase tracking-widest rotate-180 text-center">
                FERRARI PASS
              </div>
            </div>
          </div>

          {/* Monthly Spending Metric Pill with Mini Category Icons */}
          <div className="mt-6 flex items-center justify-between bg-white/[0.06] border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
            <div>
              <span className="text-[11px] text-slate-400 block">Spending (รายจ่าย)</span>
              <span className="text-lg font-bold font-mono text-white mt-0.5 block">
                ฿ {totalExpenseBaht.toLocaleString('th-TH', { minimumFractionDigits: 0 })}
              </span>
            </div>

            {/* Category Stack Avatars */}
            <div className="flex -space-x-2 items-center">
              <div className="w-7 h-7 rounded-full bg-orange-500/90 border-2 border-[#131722] flex items-center justify-center text-white text-[10px]">
                🍛
              </div>
              <div className="w-7 h-7 rounded-full bg-blue-500/90 border-2 border-[#131722] flex items-center justify-center text-white text-[10px]">
                🚕
              </div>
              <div className="w-7 h-7 rounded-full bg-purple-500/90 border-2 border-[#131722] flex items-center justify-center text-white text-[10px]">
                🛍️
              </div>
              <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-[#131722] flex items-center justify-center text-white text-[10px] font-mono font-bold">
                +{summary?.categoryBreakdown.length || 0}
              </div>
            </div>
          </div>
        </section>

        {/* ===================== BOTTOM SHEET: CLEAN WHITE TRANSACTIONS ===================== */}
        <section className="luxury-bottom-sheet flex-1 px-6 pt-6 pb-20 text-slate-900 min-h-[460px] flex flex-col">
          {/* Sheet Header */}
          <div className="flex justify-between items-center pb-4 border-b border-slate-100">
            <button
              onClick={() => {
                setActiveFilter(activeFilter === 'all' ? 'expense' : activeFilter === 'expense' ? 'income' : 'all');
              }}
              className="p-2 text-slate-400 hover:text-slate-800 transition rounded-lg"
              title="สลับตัวกรอง"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Transactions</h2>

            <button
              onClick={() => {
                const query = prompt('ค้นหารายการ:', searchQuery);
                if (query !== null) setSearchQuery(query);
              }}
              className="p-2 text-slate-400 hover:text-slate-800 transition rounded-lg"
              title="ค้นหา"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 py-3 overflow-x-auto text-[11px] font-medium no-scrollbar">
            {[
              { id: 'all', label: 'ทั้งหมด' },
              { id: 'expense', label: 'รายจ่าย' },
              { id: 'income', label: 'รายรับ' },
              { id: 'ai', label: '🤖 จาก AI' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id as any)}
                className={`px-3 py-1 rounded-full transition shrink-0 ${
                  activeFilter === f.id
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-slate-100 text-slate-500 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Clean Transaction List */}
          <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
            {filteredList.length > 0 ? (
              filteredList.map((tx: Transaction) => {
                const meta = CATEGORY_META[tx.categoryId] || CATEGORY_META.cat_other;
                const isIncome = tx.type === 'income';

                return (
                  <div
                    key={tx.id}
                    className="group py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition rounded-xl px-1"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center text-white shadow-sm">
                          {tx.categoryId === 'cat_food' ? (
                            <Utensils className="w-4 h-4 text-orange-400" />
                          ) : tx.categoryId === 'cat_transport' ? (
                            <Car className="w-4 h-4 text-blue-400" />
                          ) : tx.categoryId === 'cat_salary' ? (
                            <Wallet className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Receipt className="w-4 h-4 text-slate-300" />
                          )}
                        </div>
                        <span
                          className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white"
                          style={{ backgroundColor: meta.dotColor }}
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 truncate block">
                            {tx.note}
                          </span>
                          {tx.source === 'chatgpt' ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                              ChatGPT
                            </span>
                          ) : tx.source === 'gemini' ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-cyan-100 text-cyan-800">
                              Gemini
                            </span>
                          ) : tx.source === 'antigravity' ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-purple-100 text-purple-800">
                              Antigravity
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-slate-400 mt-0.5 block font-mono">
                          {tx.transactionDate}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <div className="text-right">
                        <span
                          className={`text-sm font-bold font-mono tabular-nums block ${
                            isIncome ? 'text-emerald-600' : 'text-slate-900'
                          }`}
                        >
                          {isIncome ? '+ ' : '- '}
                          {(tx.amountSatang / 100).toLocaleString('th-TH', {
                            minimumFractionDigits: 0,
                          })}{' '}
                          ฿
                        </span>
                      </div>

                      <button
                        onClick={() => handleDelete(tx.id, tx.note)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-600 transition"
                        title="ลบรายการ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 text-slate-400 text-xs">
                ยังไม่มีรายการ กดปุ่ม &quot;+ จดเงินด่วน&quot; ด้านบนเพื่อบันทึกได้เลยครับ
              </div>
            )}
          </div>
        </section>

        {/* ===================== FLOATING DYNAMIC ISLAND DOCK ===================== */}
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-auto">
          <div className="floating-dock rounded-full px-5 py-2.5 flex items-center gap-6 text-white shadow-2xl">
            <button
              onClick={() => {
                setActiveFilter('all');
                setSearchQuery('');
              }}
              className="p-1 text-white hover:text-rose-400 transition"
              title="หน้าหลัก"
            >
              <div className="w-8 h-8 rounded-full bg-white text-slate-950 flex items-center justify-center font-bold text-sm shadow-md">
                🏎️
              </div>
            </button>

            <button
              onClick={toggleVoiceRecording}
              className={`p-2 rounded-full transition ${
                isRecording
                  ? 'bg-rose-600 text-white animate-pulse'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="กดพูดบันทึกภาษาไทย"
            >
              {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setShowAiModal(true)}
              className="p-2 text-slate-300 hover:text-amber-400 transition"
              title="ต่อกับ ChatGPT / Gemini"
            >
              <Bot className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowInputDrawer(true)}
              className="p-2 text-slate-300 hover:text-white transition"
              title="พิมพ์จดเงิน"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ===================== FAST INPUT MODAL / DRAWER ===================== */}
        {showInputDrawer && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-[#121622] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 text-white shadow-2xl">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" /> จดเงินภาษาธรรมชาติ
                </span>
                <button onClick={() => setShowInputDrawer(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={(e) => handleSubmit(e)} className="mt-4">
                <input
                  type="text"
                  autoFocus
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder='พิมพ์เช่น "ข้าวมันไก่ 60 กาแฟ 55"...'
                  className="w-full bg-black/60 border border-white/15 rounded-2xl px-4 py-3 text-white text-base outline-none focus:border-rose-500"
                />

                {liveParsed.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {liveParsed.map((p, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-xl bg-white/10 border border-white/10 text-slate-200">
                        {p.note} • <strong>{(p.amountSatang / 100).toLocaleString()} ฿</strong>
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex gap-2">
                  <button
                    type="submit"
                    disabled={loading || !inputText.trim()}
                    className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 font-bold text-xs shadow-lg transition"
                  >
                    {loading ? 'กำลังบันทึก...' : 'บันทึกรายการ'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===================== AI CONNECTOR MODAL ===================== */}
        {showAiModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#121622] border border-white/10 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-rose-500 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      Scuderia Gemini AI
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-normal">
                        ฟรี 100%
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400">สั่งจดเงินด้วยเสียงหรือพิมพ์ภาษาไทย</p>
                  </div>
                </div>
                <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mt-4 pb-2 border-b border-white/10 text-xs font-semibold">
                <button
                  onClick={() => setAiModalTab('gemini')}
                  className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                    aiModalTab === 'gemini' ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>สั่ง Gemini จด</span>
                </button>
                <button
                  onClick={() => setAiModalTab('api_key')}
                  className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 ${
                    aiModalTab === 'api_key' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🔑 คีย์ฟรี AI Studio</span>
                </button>
                <button
                  onClick={() => setAiModalTab('chatgpt')}
                  className={`px-2.5 py-1.5 rounded-xl transition ${
                    aiModalTab === 'chatgpt' ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  ChatGPT / MCP
                </button>
              </div>

              {/* Content */}
              {aiModalTab === 'gemini' && (
                <div className="mt-3 text-xs flex flex-col space-y-3">
                  {/* Chat Messages Thread */}
                  <div
                    ref={chatScrollRef}
                    className="h-64 sm:h-72 overflow-y-auto space-y-2.5 p-3 bg-black/60 rounded-2xl border border-white/10 scrollbar-thin scrollbar-thumb-white/10"
                  >
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-2.5 ${
                          msg.sender === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.sender === 'gemini' && (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-rose-600 to-amber-500 p-[1.5px] shrink-0 shadow-md">
                            <div className="w-full h-full rounded-full bg-[#131722] flex items-center justify-center text-xs">
                              🏎️
                            </div>
                          </div>
                        )}

                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-md ${
                            msg.sender === 'user'
                              ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white rounded-br-xs'
                              : 'bg-white/[0.08] border border-white/10 text-slate-100 rounded-bl-xs'
                          }`}
                        >
                          <div className="text-xs leading-relaxed whitespace-pre-line">
                            {msg.text}
                          </div>
                          <span
                            className={`text-[9px] block text-right mt-1 font-mono ${
                              msg.sender === 'user' ? 'text-white/70' : 'text-slate-400'
                            }`}
                          >
                            {msg.time}
                          </span>
                        </div>
                      </div>
                    ))}

                    {chatLoading && (
                      <div className="flex gap-2.5 justify-start">
                        <div className="w-7 h-7 rounded-full bg-rose-600/30 flex items-center justify-center shrink-0">
                          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                        </div>
                        <div className="bg-white/[0.06] border border-white/10 rounded-2xl px-3.5 py-2 text-slate-300 text-[11px] flex items-center gap-2">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                          <span>Scuderia AI กำลังวิเคราะห์ข้อมูลการเงิน...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* One-Tap Suggested Question Pills */}
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block mb-1 uppercase tracking-wider">
                      คำถามด่วน (แตะเพื่อถาม):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        '📊 สรุปค่าใช้จ่ายเดือนนี้',
                        '💸 เงินหายไปไหนหมด',
                        '🏆 เดือนนี้ใช้จ่ายอะไรมากที่สุด',
                        '📅 วันนี้ใช้ไปกี่บาท',
                        '☕ กาแฟ 65 ข้าว 60',
                      ].map((chip) => (
                        <button
                          key={chip}
                          onClick={() => handleSendChatMessage(chip)}
                          disabled={chatLoading}
                          className="px-2.5 py-1 rounded-lg bg-white/[0.07] hover:bg-white/15 active:scale-95 border border-white/10 text-[11px] text-slate-200 hover:text-white transition cursor-pointer"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input & Voice Bar */}
                  <div className="space-y-1.5">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendChatMessage();
                        }}
                        placeholder="ถามเรื่องเงิน หรือบอกให้จด เช่น 'เงินหายไปไหนหมด'..."
                        className="w-full bg-black/80 border border-white/20 focus:border-rose-500 rounded-2xl pl-3.5 pr-20 py-2.5 text-white placeholder-slate-500 outline-none text-xs"
                      />

                      <div className="absolute right-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (!recognitionRef.current) {
                              alert('เบราว์เซอร์ของท่านไม่รองรับ Web Speech API');
                              return;
                            }
                            if (isRecording) {
                              recognitionRef.current.stop();
                              setIsRecording(false);
                            } else {
                              try {
                                recognitionRef.current.start();
                                setIsRecording(true);
                              } catch (err) {
                                console.error(err);
                              }
                            }
                          }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                            isRecording
                              ? 'bg-rose-600 text-white animate-pulse shadow-[0_0_12px_#f43f5e]'
                              : 'bg-white/10 hover:bg-white/20 text-slate-300'
                          }`}
                          title="แตะเพื่อพูดภาษาไทย"
                        >
                          {isRecording ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-cyan-400" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendChatMessage()}
                          disabled={chatLoading || !chatInput.trim()}
                          className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs shadow-md transition cursor-pointer"
                        >
                          {chatLoading ? '...' : 'ส่ง'}
                        </button>
                      </div>
                    </div>

                    {isRecording && (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-rose-500/20 border border-rose-500/30 text-[11px] text-rose-300">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                        <span>กำลังฟังเสียงพูดภาษาไทย... ถามหรือจดเงินได้เลยครับ</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {aiModalTab === 'api_key' && (
                <div className="mt-4 text-xs space-y-3">
                  <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-2xl text-cyan-200 text-[11px] leading-relaxed">
                    🌟 <strong>Google Gemini API ฟรี 100%!</strong> ใครมีบัญชี Google สามารถกดรับคีย์ได้ฟรี ไม่ต้องผูกบัตรเครดิต ใช้งานได้วันละ 1,500 ครั้ง
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                      วาง Gemini API Key ของคุณที่นี่:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={geminiApiKey}
                        onChange={(e) => setGeminiApiKey(e.target.value)}
                        placeholder="AIzaSy..."
                        className="flex-1 bg-black/70 border border-white/15 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-cyan-500"
                      />
                      <button
                        onClick={() => saveGeminiKey(geminiApiKey)}
                        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-white text-xs"
                      >
                        บันทึก
                      </button>
                    </div>
                    {keySavedToast && (
                      <span className="text-[11px] text-emerald-400 mt-1 block">
                        ✓ บันทึกคีย์ลงเครื่องเรียบร้อยแล้ว!
                      </span>
                    )}
                  </div>

                  <div className="pt-2">
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/15 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                      <span>กดรับ API Key ฟรีจาก Google AI Studio ↗</span>
                    </a>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                      *หากยังไม่มีคีย์ ระบบจะใช้ตัววิเคราะห์ภาษาไทยอัจฉริยะ (Local NLP Engine) บันทึกให้ได้ทันทีอยู่แล้วครับ!
                    </p>
                  </div>
                </div>
              )}

              {aiModalTab === 'chatgpt' && (
                <div className="mt-4 text-xs space-y-3">
                  <p className="text-slate-300 leading-relaxed">
                    สำหรับผู้ใช้ <strong>ChatGPT Plus</strong> หรือเชื่อมต่อผ่าน <strong>MCP Server</strong>:
                  </p>
                  <div className="p-3 bg-black/70 rounded-2xl border border-white/10 flex items-center justify-between">
                    <code className="text-emerald-300 font-mono text-[11px] select-all truncate max-w-[200px]">
                      https://accidents-southwest-sleeve-idea.trycloudflare.com/api/openapi
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('https://accidents-southwest-sleeve-idea.trycloudflare.com/api/openapi');
                        setCopiedOpenApi(true);
                        setTimeout(() => setCopiedOpenApi(false), 2000);
                      }}
                      className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold shrink-0 ml-2"
                    >
                      {copiedOpenApi ? 'คัดลอกแล้ว' : 'คัดลอก'}
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowAiModal(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== NOTIFICATION TOAST ===================== */}
        {notification && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm p-3.5 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-white/15 text-white text-xs shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 transition-all">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {notification.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span className="whitespace-pre-line truncate">{notification.message}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {notification.undoId && (
                <button
                  onClick={() => {
                    handleUndo(notification.undoId!);
                    setNotification(null);
                  }}
                  className="px-2.5 py-1 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-lg font-semibold transition"
                >
                  Undo
                </button>
              )}
              <button
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition"
                title="ปิดการแจ้งเตือน"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
