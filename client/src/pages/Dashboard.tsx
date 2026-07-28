import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, AlertCircle, FileText, Plus, ArrowRight, Zap, BarChart2, PieChart, ChevronDown } from 'lucide-react';
import { Card, Badge } from '../components/ui';
import { SplitButton } from '../components/ui/SplitButton';
import { AiDraftModal } from '../components/AiDraftModal';
import { RevenueChat } from '../components/RevenueChat';
import { formatMoney } from '../utils/formatters';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';

/**
 * Dashboard Component
 * 
 * Main entry point for the user. Displays high-level business metrics,
 * revenue charts, and a feed of recent activity (invoices/quotes).
 */
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const invoices = useLiveQuery(() => db.invoices.toArray()) || [];
  const quotes = useLiveQuery(() => db.quotes.toArray()) || [];
  const clients = useLiveQuery(() => db.clients.toArray()) || [];
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalDefaultTab, setAiModalDefaultTab] = useState<'text' | 'document'>('text');
  const [aiDocumentType, setAiDocumentType] = useState<'QUOTE' | 'INVOICE'>('QUOTE');
  const [timeframe, setTimeframe] = useState('Last 6 months');
  const [timeframeMenuOpen, setTimeframeMenuOpen] = useState(false);

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

  // Calculations
  const paidInvoices = invoices.filter(i => i.status === 'PAID');
  const outstandingInvoices = invoices.filter(i => ['SENT', 'PARTIAL', 'OVERDUE'].includes(i.status));
  const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE');
  const acceptedQuotes = quotes.filter(q => q.status === 'ACCEPTED');

  const totalRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0) + 
                       invoices.filter(i => i.status === 'PARTIAL').reduce((sum, i) => sum + i.amountPaid, 0);
  
  const outstandingAmount = outstandingInvoices.reduce((sum, i) => sum + (i.total - i.amountPaid), 0);
  const overdueAmount = overdueInvoices.reduce((sum, i) => sum + (i.total - i.amountPaid), 0);
  const acceptedQuotesAmount = acceptedQuotes.reduce((sum, q) => sum + q.total, 0);


  // MRR / Monthly Revenue Calculation (Standard: Sum of paid invoices in the current month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const currentMonthRevenue = paidInvoices
    .filter(i => {
      const d = new Date(i.updatedAt || i.createdAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((sum, i) => sum + i.total, 0);

  const lastMonthRevenue = paidInvoices
    .filter(i => {
      const d = new Date(i.updatedAt || i.createdAt);
      return d.getMonth() === (currentMonth === 0 ? 11 : currentMonth - 1) && 
             d.getFullYear() === (currentMonth === 0 ? currentYear - 1 : currentYear);
    })
    .reduce((sum, i) => sum + i.total, 0);

  const mrrGrowth = lastMonthRevenue > 0 
    ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
    : 100;

  // Chart Data Preparation
  const generateMonths = () => {
    if (timeframe === 'This Year') {
      return Array.from({ length: 12 }).map((_, i) => {
        const d = new Date(currentYear, i, 1);
        return {
          month: d.toLocaleString('default', { month: 'short' }),
          year: currentYear,
          monthNum: i
        };
      });
    } else {
      // Last 6 months
      return Array.from({ length: 6 }).map((_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        return {
          month: d.toLocaleString('default', { month: 'short' }),
          year: d.getFullYear(),
          monthNum: d.getMonth()
        };
      });
    }
  };

  const chartMonths = generateMonths();

  const barChartData = chartMonths.map(m => {
    const revenue = paidInvoices
      .filter(inv => {
        const d = new Date(inv.updatedAt || inv.createdAt);
        return d.getMonth() === m.monthNum && d.getFullYear() === m.year;
      })
      .reduce((sum, inv) => sum + inv.total, 0);
    return { name: m.month, revenue };
  });

  const pieChartData = [
    { name: 'Paid', value: paidInvoices.reduce((sum, i) => sum + i.total, 0), color: '#0d9488' }, // Teal-600
    { name: 'Unpaid/Partial', value: outstandingAmount, color: '#f59e0b' }, // Amber-500
    { name: 'Overdue', value: overdueAmount, color: '#e11d48' } // Rose-600
  ].filter(d => d.value > 0);

  // Recent Activity (combine quotes and invoices, sort by date)
  const recentActivity = [...invoices, ...quotes]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const getClientName = (id: string) => {
    return clients.find(c => c.localId === id)?.name || 'Unknown Client';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">Here is what's happening with your business today.</p>
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
            mainLabel={<><Plus size={20} className="hidden sm:block" /><span>Quote</span></>}
            onMainClick={() => navigate('/quotes/new')}
            align="left"
            size="lg"
            className="w-full sm:w-auto [&>button:first-child]:flex-1"
            options={[
              { label: 'Create Manually', onClick: () => navigate('/quotes/new') },
              { label: 'Draft with AI', onClick: () => { setAiDocumentType('QUOTE'); setAiModalDefaultTab('text'); setIsAiModalOpen(true); } }
            ]}
          />
          <SplitButton
            mainLabel={<><Plus size={20} className="hidden sm:block" /><span>Invoice</span></>}
            onMainClick={() => navigate('/invoices/new')}
            align="right"
            size="lg"
            className="w-full sm:w-auto [&>button:first-child]:flex-1"
            options={[
              { label: 'Create Manually', onClick: () => navigate('/invoices/new') },
              { label: 'Draft with AI', onClick: () => { setAiDocumentType('INVOICE'); setAiModalDefaultTab('text'); setIsAiModalOpen(true); } }
            ]}
          />
        </div>
      </div>

      {/* Metrics Cards */}
      <div 
        ref={carouselRef}
        onScroll={handleScroll}
        className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 overflow-x-auto pb-4 md:pb-0 snap-x snap-mandatory hide-scrollbar -mx-4 px-4 md:mx-0 md:px-0"
      >
        <Card className="min-w-[85vw] md:min-w-0 snap-center p-5 md:p-6 bg-indigo-50/30 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <TrendingUp size={20} />
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${mrrGrowth >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
              {mrrGrowth > 0 ? '+' : ''}{mrrGrowth.toFixed(1)}% this month
            </span>
          </div>
          <div>
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1 truncate">Total Revenue</h3>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate" title={formatMoney(totalRevenue)}>{formatMoney(totalRevenue)}</div>
          </div>
        </Card>

        <Card className="min-w-[85vw] md:min-w-0 snap-center p-5 md:p-6 bg-amber-50/30 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Clock size={20} />
            </div>
          </div>
          <div>
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1 truncate">Outstanding Balance</h3>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate" title={formatMoney(outstandingAmount)}>{formatMoney(outstandingAmount)}</div>
            <p className="text-xs text-slate-500 mt-2 truncate">{outstandingInvoices.length} invoices outstanding</p>
          </div>
        </Card>

        <Card className="min-w-[85vw] md:min-w-0 snap-center p-5 md:p-6 bg-rose-50/30 dark:bg-rose-900/10 border-rose-100 dark:border-rose-900/30 animate-fade-in-up" style={{ animationDelay: '250ms' }}>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertCircle size={20} />
            </div>
          </div>
          <div>
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1 truncate">Overdue Amount</h3>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate" title={formatMoney(overdueAmount)}>{formatMoney(overdueAmount)}</div>
            <p className="text-xs text-slate-500 mt-2 truncate">{overdueInvoices.length} invoices overdue</p>
          </div>
        </Card>

        <Card className="min-w-[85vw] md:min-w-0 snap-center p-5 md:p-6 bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 animate-fade-in-up" style={{ animationDelay: '350ms' }}>
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <FileText size={20} />
            </div>
            <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded-full cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors" onClick={() => navigate('/quotes')}>Convert</span>
          </div>
          <div>
            <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1 truncate">Accepted Quotes</h3>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white truncate" title={formatMoney(acceptedQuotesAmount)}>{formatMoney(acceptedQuotesAmount)}</div>
            <p className="text-xs text-slate-500 mt-2 truncate">{acceptedQuotes.length} quotes pending invoice</p>
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
        {/* Revenue Overview Chart */}
        <Card className="lg:col-span-2 p-6 flex flex-col">
          <div className="flex justify-between items-center gap-2 mb-6 w-full">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">Revenue Overview</h2>
            <div className="flex items-center gap-1 sm:gap-3 shrink-0">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 sm:p-1">
                <button 
                  onClick={() => setChartType('bar')}
                  className={`p-1.5 rounded-md transition-colors ${chartType === 'bar' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  title="Bar Chart"
                >
                  <BarChart2 size={16} />
                </button>
                <button 
                  onClick={() => setChartType('pie')}
                  className={`p-1.5 rounded-md transition-colors ${chartType === 'pie' ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  title="Pie Chart"
                >
                  <PieChart size={16} />
                </button>
              </div>
              <div className="relative shrink-0">
                <button 
                  onClick={() => setTimeframeMenuOpen(!timeframeMenuOpen)}
                  className="flex items-center gap-1 sm:gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm py-1.5 px-2 sm:px-3 rounded-md outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
                >
                  <span>{timeframe}</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>
                {timeframeMenuOpen && (
                  <div className="absolute right-0 mt-1 w-36 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-slate-200 dark:border-slate-700 z-50 overflow-hidden py-1">
                    {['Last 6 months', 'This Year'].map(option => (
                      <button 
                        key={option}
                        onClick={() => { setTimeframe(option); setTimeframeMenuOpen(false); }} 
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {chartType === 'bar' ? (
            <div className="flex-1 mt-4 h-64 min-h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12 }} 
                    tickFormatter={(value: any) => value > 1000 ? `${(value/1000).toFixed(0)}k` : value}
                  />
                  <RechartsTooltip 
                    formatter={(value: any) => formatMoney(value as number)}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="revenue" fill="var(--color-purple-600)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12 h-64 mt-4">
              {pieChartData.length > 0 ? (
                <>
                  <div className="h-48 w-48 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value: any) => formatMoney(value as number)} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-row md:flex-col flex-wrap justify-center gap-3 md:gap-4 w-full md:w-auto px-2">
                    {pieChartData.map((data, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: data.color }}></div>
                        <div className="flex flex-row md:flex-col items-center md:items-start gap-1 md:gap-0">
                          <p className="text-xs md:text-sm font-medium text-slate-900 dark:text-white">{data.name}</p>
                          <p className="text-xs text-slate-500 hidden md:block">{formatMoney(data.value)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-slate-500 flex items-center justify-center h-full">No data to display</div>
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
                            {displayId}
                          </p>
                          <p className="text-xs text-slate-500 truncate max-w-[150px] sm:max-w-[200px]">
                            {getClientName(doc.clientId)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {formatMoney(doc.total, 'currency' in doc ? (doc as any).currency : 'NGN')}
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
              <div className="p-8 text-center text-slate-500">
                <FileText size={48} className="mx-auto mb-4 opacity-20" />
                <p>No recent activity.</p>
                <button onClick={() => navigate('/invoices/new')} className="mt-4 text-sm text-purple-600 hover:underline">Create your first invoice</button>
              </div>
            )}
          </div>
          
          {recentActivity.length > 0 && (
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-center">
              <button 
                onClick={() => navigate('/invoices')}
                className="text-sm font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400 transition-colors flex items-center justify-center gap-1 w-full"
              >
                View all history <ArrowRight size={14} />
              </button>
            </div>
          )}
        </Card>
      </div>
      
      <RevenueChat />
    </div>
  );
};

export default Dashboard;
