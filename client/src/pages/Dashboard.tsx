import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, FileText, Plus, Zap, LineChart, BarChart3, ChevronDown } from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { Card, Badge } from '../components/ui';
import { SplitButton } from '../components/ui/SplitButton';
import { AiDraftModal } from '../components/AiDraftModal';
import { GettingStartedChecklist } from '../components/onboarding/GettingStartedChecklist';
import { useQuota } from '../hooks/useQuota';
import { RevenueChat } from '../components/RevenueChat';
import { formatMoney } from '../utils/formatters';
import { useAppStore } from '../store/useAppStore';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend, Cell, AreaChart, Area } from 'recharts';

/**
 * Dashboard Component
 * 
 * Main entry point for the user. Displays high-level business metrics,
 * revenue charts, and a feed of recent activity (invoices/quotes).
 */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { businessProfile } = useAppStore();
  const { checkQuota } = useQuota();
  const allClients = useLiveQuery(() => db.clients.toArray()) || [];
  const invoices = useLiveQuery(() => db.invoices.filter(i => !i.deletedAt).toArray()) || [];
  const quotes = useLiveQuery(() => db.quotes.filter(q => !q.deletedAt).toArray()) || [];
  const recurringSchedules = useLiveQuery(() => db.recurringSchedules.filter(s => !s.deletedAt).toArray()) || [];
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalDefaultTab, setAiModalDefaultTab] = useState<'text' | 'document'>('text');
  const [aiDocumentType, setAiDocumentType] = useState<'QUOTE' | 'INVOICE'>('QUOTE');
  const [selectedMonthOffset, setSelectedMonthOffset] = useState(0);

  const handleScroll = () => {
    if (carouselRef.current) {
      const scrollPosition = carouselRef.current.scrollLeft;
      const cardWidth = carouselRef.current.children[0].clientWidth;
      const newIndex = Math.round(scrollPosition / (cardWidth + 16)); // approx gap
      setActiveSlide(Math.min(newIndex, 3)); // 4 cards max
    }
  };

  const scrollToSlide = (index: number) => {
    if (carouselRef.current) {
      const cardWidth = carouselRef.current.children[0].clientWidth;
      carouselRef.current.scrollTo({
        left: index * (cardWidth + 16),
        behavior: 'smooth'
      });
    }
  };

  const selectedDate = subMonths(new Date(), selectedMonthOffset);
  const selectedMonth = selectedDate.getMonth();
  const selectedYear = selectedDate.getFullYear();

  const isSelectedMonth = (dateString: string) => {
    const d = new Date(dateString);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  };

  // Selected Month Calculations
  const selectedMonthInvoices = React.useMemo(() => invoices.filter(i => isSelectedMonth(i.updatedAt || i.createdAt)), [invoices, selectedMonthOffset]);
  const selectedMonthQuotes = React.useMemo(() => quotes.filter(q => isSelectedMonth(q.updatedAt || q.createdAt)), [quotes, selectedMonthOffset]);
  selectedMonthQuotes; // keep TS happy

  const paidInvoices = React.useMemo(() => selectedMonthInvoices.filter(i => i.status === 'PAID'), [selectedMonthInvoices]);
  const outstandingInvoices = React.useMemo(() => selectedMonthInvoices.filter(i => ['SENT', 'PARTIAL', 'OVERDUE'].includes(i.status)), [selectedMonthInvoices]);
  const overdueInvoices = React.useMemo(() => selectedMonthInvoices.filter(i => i.status === 'OVERDUE'), [selectedMonthInvoices]);

  const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0) + 
                       selectedMonthInvoices.filter(i => i.status === 'PARTIAL').reduce((sum, i) => sum + i.amountPaid, 0);
  
  const outstandingAmount = outstandingInvoices.reduce((sum, i) => sum + (i.total - i.amountPaid), 0);
  const overdueAmount = overdueInvoices.reduce((sum, i) => sum + (i.total - i.amountPaid), 0);

  // MRR Growth vs Previous Month
  const prevMonthDate = subMonths(new Date(), selectedMonthOffset + 1);
  const prevMonthRevenue = invoices
    .filter(i => {
      const d = new Date(i.updatedAt || i.createdAt);
      return i.status === 'PAID' && d.getMonth() === prevMonthDate.getMonth() && 
             d.getFullYear() === prevMonthDate.getFullYear();
    })
    .reduce((sum, i) => sum + i.total, 0);

  const mrrGrowth = prevMonthRevenue > 0 
    ? ((totalRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 
    : (totalRevenue > 0 ? 100 : 0);

  // Monthly Recurring Revenue (MRR) Calculation
  let trueMRR = 0;
  const activeSchedules = React.useMemo(() => recurringSchedules.filter(s => s.status === 'ACTIVE'), [recurringSchedules]);
  activeSchedules.forEach(schedule => {
     const template = invoices.find(i => i.localId === schedule.templateInvoiceId);
     if (template) {
        if (schedule.frequency === 'WEEKLY') trueMRR += template.total * 4.33;
        else if (schedule.frequency === 'MONTHLY') trueMRR += template.total;
        else if (schedule.frequency === 'YEARLY') trueMRR += template.total / 12;
     }
  });

  // Cash Flow Data (Last 6 Months)
  const cashFlowData = Array.from({ length: 6 }).map((_, i) => {
    const monthOffset = 5 - i; 
    const dateObj = subMonths(new Date(), monthOffset);
    const m = dateObj.getMonth();
    const y = dateObj.getFullYear();
    
    const invoiced = invoices
      .filter(inv => {
        const d = new Date(inv.createdAt);
        return d.getMonth() === m && d.getFullYear() === y && inv.status !== 'DRAFT';
      })
      .reduce((sum, inv) => sum + inv.total, 0);

    const collected = invoices
      .filter(inv => {
        const d = new Date(inv.updatedAt || inv.createdAt);
        return d.getMonth() === m && d.getFullYear() === y && ['PAID', 'PARTIAL'].includes(inv.status);
      })
      .reduce((sum, inv) => sum + (inv.status === 'PAID' ? inv.total : (inv.amountPaid || 0)), 0);

    return { 
      name: format(dateObj, 'MMM'), 
      fullDate: dateObj.toISOString(), 
      invoiced, 
      collected 
    };
  });

  // Aged Receivables Data (Buckets)
  const now = new Date();
  const getDaysOverdue = (dueDateStr: string | undefined | null) => {
    if (!dueDateStr) return 0;
    const dueDate = new Date(dueDateStr);
    const diffTime = Math.max(0, now.getTime() - dueDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  let bucket0_30 = 0;
  let bucket31_60 = 0;
  let bucket60Plus = 0;

  invoices.filter(i => ['SENT', 'PARTIAL', 'OVERDUE'].includes(i.status)).forEach(inv => {
    const amount = inv.total - (inv.amountPaid || 0);
    const days = getDaysOverdue(inv.dueDate);
    if (days > 60) bucket60Plus += amount;
    else if (days > 30) bucket31_60 += amount;
    else if (days > 0) bucket0_30 += amount;
  });

  const agedReceivablesData = [
    { name: '0-30 Days', value: bucket0_30, fill: '#f59e0b' },
    { name: '31-60 Days', value: bucket31_60, fill: '#ea580c' },
    { name: '60+ Days', value: bucket60Plus, fill: '#be123c' },
  ].filter(d => d.value > 0);

  const monthOptions = Array.from({ length: 12 }).map((_, i) => {
    const d = subMonths(new Date(), i);
    return {
      value: i,
      label: i === 0 ? 'This Month' : i === 1 ? 'Last Month' : format(d, 'MMM yyyy')
    };
  });

  // Recent Activity (combine quotes and invoices, sort by date)
  const recentActivity = [...invoices, ...quotes]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const getClientName = (id: string) => {
    return allClients.find(c => c.localId === id)?.name || 'Unknown Client';
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="w-full space-y-6 pb-20 md:pb-4 overflow-hidden">
      <GettingStartedChecklist />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Overview</h1>
          <div className="mt-1">
            <p className="text-base font-medium text-slate-700 dark:text-slate-300">
              {getGreeting()}, {businessProfile.name || 'there'}!
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Here is what's happening with your business today.
            </p>
          </div>
        </div>
        
        <AiDraftModal 
          isOpen={isAiModalOpen} 
          onClose={() => setIsAiModalOpen(false)} 
          onSuccess={(generatedData) => {
            if (aiDocumentType === 'QUOTE') {
              navigate('/quotes/new', { state: { quote: generatedData } });
            } else {
              navigate('/invoices/new', { state: { documentData: generatedData } });
            }
          }}
          defaultTab={aiModalDefaultTab}
          documentType={aiDocumentType}
        />

        <div className="grid grid-cols-2 sm:flex sm:justify-start gap-3 pb-2 md:pb-0 w-full md:w-auto mt-2 md:mt-0">
          <SplitButton
            mainLabel={<><Plus size={16} /> <span className="ml-1 truncate">New Quote</span></>}
            onMainClick={() => checkQuota('quote') && navigate('/quotes/new')}
            align="left"
            size="lg"
            variant="secondary"
            className="w-full sm:w-auto [&>button:first-child]:flex-1"
            options={[
              { label: 'Create Manually', onClick: () => checkQuota('quote') && navigate('/quotes/new') },
              { label: 'Draft with AI', onClick: () => { if (checkQuota('quote')) { setAiDocumentType('QUOTE'); setAiModalDefaultTab('text'); setIsAiModalOpen(true); } } }
            ]}
          />
          <SplitButton
            mainLabel={<><Plus size={16} /> <span className="ml-1 truncate">New Invoice</span></>}
            onMainClick={() => checkQuota('invoice') && navigate('/invoices/new')}
            align="right"
            size="lg"
            className="w-full sm:w-auto [&>button:first-child]:flex-1"
            options={[
              { label: 'Create Manually', onClick: () => checkQuota('invoice') && navigate('/invoices/new') },
              { label: 'Draft with AI', onClick: () => { if (checkQuota('invoice')) { setAiDocumentType('INVOICE'); setAiModalDefaultTab('text'); setIsAiModalOpen(true); } } }
            ]}
          />
        </div>
      </div>

      <div 
        ref={carouselRef}
        onScroll={handleScroll}
        className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 overflow-x-auto pb-4 md:pb-0 snap-x snap-mandatory hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0"
      >
        {/* Card 1: Total Revenue */}
        <Card className="min-w-[85vw] md:min-w-0 snap-center p-5 md:p-6 bg-indigo-50/30 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 animate-fade-in-up flex flex-col justify-between" style={{ animationDelay: '50ms' }}>
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <TrendingUp size={20} />
              </div>
              <span className={`whitespace-nowrap flex-shrink-0 text-xs font-medium px-2 py-1 rounded-full ${mrrGrowth >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                {mrrGrowth > 0 ? '+' : ''}{mrrGrowth.toFixed(1)}% this month
              </span>
            </div>
            <div>
              <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1 truncate">Total Revenue</h3>
              <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate" title={formatMoney(totalRevenue)}>{formatMoney(totalRevenue)}</div>
              <div className="mt-1 truncate text-xs text-slate-500">From paid invoices {selectedMonthOffset === 0 ? 'this month' : 'in selected month'}</div>
            </div>
          </div>
        </Card>

        {/* Card 2: Outstanding Balance */}
        <Card className="min-w-[85vw] md:min-w-0 snap-center p-5 md:p-6 bg-amber-50/30 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 animate-fade-in-up flex flex-col justify-between" style={{ animationDelay: '150ms' }}>
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Clock size={20} />
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors" onClick={() => navigate('/invoices')}>View Unpaid</span>
            </div>
            <div>
              <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1 truncate">Outstanding Balance</h3>
              <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate" title={formatMoney(outstandingAmount)}>{formatMoney(outstandingAmount)}</div>
              <div className="mt-1 truncate text-xs text-slate-500">{outstandingInvoices.length} invoices outstanding</div>
            </div>
          </div>
        </Card>

        {/* Card 3: Overdue Amount */}
        <Card 
          className="min-w-[85vw] md:min-w-0 snap-center p-5 md:p-6 bg-rose-50/30 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 animate-fade-in-up flex flex-col justify-between cursor-pointer hover:border-purple-300 transition-colors" 
          style={{ animationDelay: '250ms' }}
          onClick={() => navigate('/invoices?status=OVERDUE')}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
                <FileText size={20} />
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-full cursor-pointer hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors" onClick={(e) => { e.stopPropagation(); navigate('/invoices'); }}>View Overdue</span>
            </div>
            <div>
              <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1 truncate">Overdue Amount</h3>
              <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate" title={formatMoney(overdueAmount)}>
                {formatMoney(overdueAmount)}
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">{overdueInvoices.length} overdue invoices</div>
            </div>
          </div>
        </Card>

        {/* Card 4: Monthly Recurring Revenue */}
        <Card 
          className="min-w-[85vw] md:min-w-0 snap-center p-5 md:p-6 bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 animate-fade-in-up flex flex-col justify-between cursor-pointer hover:border-purple-300 transition-colors" 
          style={{ animationDelay: '350ms' }}
          onClick={() => navigate('/recurring')}
        >
          <div>
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={20} />
              </div>
              <span className="text-xs font-medium px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full cursor-pointer hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors" onClick={(e) => { e.stopPropagation(); navigate('/recurring'); }}>Manage MRR</span>
            </div>
            <div>
              <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1 truncate">Monthly Recurring Revenue</h3>
              <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate" title={formatMoney(trueMRR)}>
                {formatMoney(trueMRR)}
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">From {activeSchedules.length} active schedules</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Mobile Carousel Pagination */}
      <div className="flex md:hidden justify-center gap-2 -mt-4 mb-4">
        {[0, 1, 2, 3].map((index) => (
          <button
            key={index}
            onClick={() => scrollToSlide(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              activeSlide === index ? 'bg-purple-600 w-4' : 'bg-slate-300 dark:bg-slate-700'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '450ms' }}>
        {/* Cash Flow & Collections Chart */}
        <Card className="lg:col-span-2 p-6 flex flex-col">
          <div className="flex justify-between items-center gap-2 mb-6 w-full">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">Cash Flow & Collections</h2>
            <div className="flex items-center gap-1 sm:gap-3 shrink-0">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 sm:p-1">
                <button 
                  onClick={() => setChartType('line')}
                    className={`p-1.5 rounded-md transition-colors ${chartType === 'line' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    title="Cash Flow Area Chart"
                  >
                    <LineChart size={16} />
                </button>
                <button 
                  onClick={() => setChartType('bar')}
                    className={`p-1.5 rounded-md transition-colors ${chartType === 'bar' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    title="Aged Receivables Bar Chart"
                  >
                    <BarChart3 size={16} />
                </button>
              </div>
              <div className="relative shrink-0">
                <div className="flex items-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm py-1.5 pl-3 pr-8 rounded-md relative cursor-pointer hover:border-slate-300 transition-colors">
                  <select 
                    className="appearance-none bg-transparent font-medium text-slate-700 dark:text-slate-300 outline-none cursor-pointer w-full z-10"
                    value={selectedMonthOffset}
                    onChange={(e) => setSelectedMonthOffset(Number(e.target.value))}
                  >
                    {monthOptions.map(opt => (
                      <option key={opt.value} value={opt.value} className="text-slate-900">{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
          
                    {chartType === 'line' ? (
            <div className="flex-1 mt-4 h-64 min-h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorInvoiced" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9333ea" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} tickFormatter={(value: any) => value > 1000 ? `${(value/1000).toFixed(0)}k` : value.toString()} />
                  <RechartsTooltip formatter={(value: any) => formatMoney(value as number)} labelFormatter={(label) => `Month: ${label}`} contentStyle={{ backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Legend verticalAlign="top" height={36}/>
                  <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke="#9333ea" strokeWidth={3} fillOpacity={1} fill="url(#colorInvoiced)" dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: "#fff", stroke: "#9333ea" }} />
                  <Area type="monotone" dataKey="collected" name="Collected" stroke="#0d9488" strokeWidth={3} fillOpacity={1} fill="url(#colorCollected)" dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: "#fff", stroke: "#0d9488" }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 h-64 mt-4">
              {agedReceivablesData.length > 0 ? (
                <div className="flex-1 mt-2 w-full">
                  <h3 className="text-sm font-medium text-slate-500 mb-2 text-center md:text-left">Aged Receivables (Overdue)</h3>
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={agedReceivablesData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.5} />
                      <XAxis type="number" tickFormatter={(value: any) => value > 1000 ? `${(value/1000).toFixed(0)}k` : value.toString()} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} width={80} />
                      <RechartsTooltip formatter={(value: any) => formatMoney(value as number)} contentStyle={{ backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{fill: 'transparent'}} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {agedReceivablesData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-slate-500 flex items-center justify-center h-full">No overdue receivables</div>
              )}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="p-0 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Recent Activity</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {recentActivity.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {recentActivity.map((doc) => {
                  const isInvoice = 'amountPaid' in doc;
                  const displayId = isInvoice ? ((doc as any).invoiceNumber || doc.localId.substring(0, 8)) : ((doc as any).quoteNumber || doc.localId.substring(0, 8));
                  return (
                    <div 
                      key={doc.localId} 
                      onClick={() => navigate(isInvoice ? `/invoices?preview=${doc.localId}` : `/quotes?preview=${doc.localId}`)}
                      className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isInvoice ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                          <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors truncate max-w-[150px] sm:max-w-[200px]">
                            {getClientName(doc.clientId)}
                          </p>
                          <p className="text-xs text-slate-500 truncate max-w-[150px] sm:max-w-[200px]">
                            {isInvoice ? 'Invoice' : 'Quote'} {displayId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {formatMoney(doc.total, 'currency' in doc ? (doc as any).currency : (businessProfile?.currency || 'NGN'))}
                        </p>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <Badge variant={doc.status.toLowerCase() as any} className="mt-1 scale-90 origin-right">
                           {doc.status === 'PARTIAL' ? (
                             <span className="flex items-center gap-1"><Zap size={8} className="fill-current"/>{doc.status}</span>
                           ) : doc.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-purple-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                  <FileText size={32} className="text-purple-300 dark:text-slate-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No recent activity</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">When you create invoices or quotes, they'll appear here for quick access.</p>
                {invoices.length === 0 && (
                  <button 
                    onClick={() => checkQuota('invoice') && navigate('/invoices/new')} 
                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all shadow-sm hover:shadow shadow-purple-200 dark:shadow-none flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Create First Invoice
                  </button>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
      
      <RevenueChat />
    </div>
  );
};

export default Dashboard;

