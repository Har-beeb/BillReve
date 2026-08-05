import React, { useMemo, useState } from 'react';
import { Card } from '../components/ui';
import { BarChart3, TrendingUp, Download, PieChart as PieChartIcon } from 'lucide-react';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { formatMoney } from '../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subMonths, subDays, isSameMonth, isSameDay, parseISO, isAfter, isBefore, startOfDay, endOfDay, subWeeks, subYears, differenceInDays } from 'date-fns';
import { generateTaxReportCsv } from '../utils/csvGenerator';
import { useAppStore } from '../store/useAppStore';
import toast from 'react-hot-toast';
import { RevenueChat } from '../components/RevenueChat';

type Timeframe = 'day' | 'week' | 'month' | '3month' | '6month' | 'year' | 'custom';

const Reports: React.FC = () => {
  const { businessProfile } = useAppStore();
  const invoices = useLiveQuery(() => db.invoices.filter(x => !x.deletedAt).toArray(), []) || [];
  const clients = useLiveQuery(() => db.clients.filter(x => !x.deletedAt).toArray(), []) || [];

  const [timeframe, setTimeframe] = useState<Timeframe>('6month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // 1. Filter Invoices by Timeframe
  const filteredInvoices = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = endOfDay(now);

    switch (timeframe) {
      case 'day':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = startOfDay(subWeeks(now, 1));
        break;
      case 'month':
        startDate = startOfDay(subMonths(now, 1));
        break;
      case '3month':
        startDate = startOfDay(subMonths(now, 3));
        break;
      case '6month':
        startDate = startOfDay(subMonths(now, 6));
        break;
      case 'year':
        startDate = startOfDay(subYears(now, 1));
        break;
      case 'custom':
        startDate = customStart ? startOfDay(new Date(customStart)) : new Date(0);
        endDate = customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now);
        break;
      default:
        startDate = startOfDay(subMonths(now, 6));
    }

    return invoices.filter(inv => {
      const d = inv.issuedAt ? parseISO(inv.issuedAt) : new Date(inv.createdAt);
      return isAfter(d, startDate) && isBefore(d, endDate);
    });
  }, [invoices, timeframe, customStart, customEnd]);

  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let outstandingBalance = 0;
    let totalTaxCollected = 0;

    filteredInvoices.forEach(inv => {
      if (inv.status === 'PAID') {
        totalRevenue += inv.total;
      } else if (inv.status === 'PARTIAL') {
        totalRevenue += (inv.amountPaid || 0);
        outstandingBalance += (inv.total - (inv.amountPaid || 0));
      } else if (inv.status !== 'DRAFT') {
        outstandingBalance += inv.total;
      }

      if ((inv.status === 'PAID' || inv.status === 'PARTIAL') && inv.taxes) {
        inv.taxes.forEach(tax => {
          totalTaxCollected += tax.amount;
        });
      }
    });

    return { totalRevenue, outstandingBalance, totalTaxCollected };
  }, [filteredInvoices]);

  const barChartData = useMemo(() => {
    const data = [];
    const now = new Date();
    
    // Determine bucketing strategy
    let startDate: Date;
    let endDate: Date = endOfDay(now);
    
    if (timeframe === 'day') startDate = startOfDay(now);
    else if (timeframe === 'week') startDate = startOfDay(subWeeks(now, 1));
    else if (timeframe === 'month') startDate = startOfDay(subMonths(now, 1));
    else if (timeframe === '3month') startDate = startOfDay(subMonths(now, 3));
    else if (timeframe === '6month') startDate = startOfDay(subMonths(now, 6));
    else if (timeframe === 'year') startDate = startOfDay(subYears(now, 1));
    else {
      startDate = customStart ? startOfDay(new Date(customStart)) : startOfDay(subMonths(now, 6));
      endDate = customEnd ? endOfDay(new Date(customEnd)) : endOfDay(now);
    }

    const daysDiff = differenceInDays(endDate, startDate);
    
    if (daysDiff <= 31) {
      // Group by Days
      for (let i = daysDiff; i >= 0; i--) {
        const dayDate = subDays(endDate, i);
        const dayInvoices = filteredInvoices.filter(inv => {
          const d = inv.issuedAt ? parseISO(inv.issuedAt) : new Date(inv.createdAt);
          return isSameDay(d, dayDate) && (inv.status === 'PAID' || inv.status === 'PARTIAL');
        });
        
        const revenue = dayInvoices.reduce((sum, inv) => sum + (inv.status === 'PARTIAL' ? (inv.amountPaid || 0) : inv.total), 0);
        data.push({
          name: format(dayDate, 'MMM dd'),
          revenue
        });
      }
    } else {
      // Group by Months
      const monthsDiff = Math.ceil(daysDiff / 30);
      for (let i = monthsDiff - 1; i >= 0; i--) {
        const monthDate = subMonths(endDate, i);
        const monthInvoices = filteredInvoices.filter(inv => {
          const d = inv.issuedAt ? parseISO(inv.issuedAt) : new Date(inv.createdAt);
          return isSameMonth(d, monthDate) && (inv.status === 'PAID' || inv.status === 'PARTIAL');
        });
        
        const revenue = monthInvoices.reduce((sum, inv) => sum + (inv.status === 'PARTIAL' ? (inv.amountPaid || 0) : inv.total), 0);
        data.push({
          name: format(monthDate, 'MMM yyyy'),
          revenue
        });
      }
    }
    return data;
  }, [filteredInvoices, timeframe, customStart, customEnd]);

  const pieChartData = useMemo(() => {
    let paid = 0, partial = 0, unpaid = 0, overdue = 0;
    filteredInvoices.forEach(inv => {
      if (inv.status === 'PAID') paid += inv.total;
      else if (inv.status === 'PARTIAL') {
        paid += (inv.amountPaid || 0);
        partial += (inv.total - (inv.amountPaid || 0));
      }
      else if (inv.status === 'OVERDUE') overdue += inv.total;
      else if (inv.status === 'SENT') unpaid += inv.total;
    });

    return [
      { name: 'Paid', value: paid, color: '#0d9488' },
      { name: 'Unpaid', value: unpaid + partial, color: '#f59e0b' },
      { name: 'Overdue', value: overdue, color: '#e11d48' },
    ].filter(d => d.value > 0);
  }, [filteredInvoices]);

  const handleExportCsv = () => {
    if (invoices.length === 0 || clients.length === 0) {
      toast.error("No data available to export.");
      return;
    }
    generateTaxReportCsv(filteredInvoices, clients, businessProfile.country || 'NG');
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h1>
          <p className="text-slate-500 dark:text-slate-400">Deep dive into your business analytics.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {timeframe === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <span className="text-slate-500 text-sm">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
          )}
          
          <select 
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium focus:ring-2 focus:ring-purple-500 outline-none"
          >
            <option value="day">Today</option>
            <option value="week">Past Week</option>
            <option value="month">Past Month</option>
            <option value="3month">Past 3 Months</option>
            <option value="6month">Past 6 Months</option>
            <option value="year">Past Year</option>
            <option value="custom">Custom Date Range</option>
          </select>
          
          <button 
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            <Download size={18} />
            Export Tax Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400 flex items-center justify-center">
              <BarChart3 size={20} />
            </div>
          </div>
          <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Total Revenue</h3>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{formatMoney(metrics.totalRevenue)}</div>
        </Card>
        <Card className="p-6 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400 flex items-center justify-center">
              <PieChartIcon size={20} />
            </div>
          </div>
          <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Outstanding Balances</h3>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{formatMoney(metrics.outstandingBalance)}</div>
        </Card>
        <Card className="p-6 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400 flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
          </div>
          <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">Tax & VAT Collected</h3>
          <div className="text-3xl font-bold text-slate-900 dark:text-white">{formatMoney(metrics.totalTaxCollected)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 h-[400px] flex flex-col">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Revenue Over Time</h2>
          <div className="flex-1 min-h-0">
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
                <Tooltip 
                  formatter={(value: any) => formatMoney(value as number)}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="revenue" fill="#0d9488" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 h-[400px] flex flex-col">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Revenue Breakdown</h2>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatMoney(value as number)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-500 text-sm">No data available for this timeframe</div>
            )}
          </div>
          {pieChartData.length > 0 && (
            <div className="flex justify-center gap-6 mt-4 flex-wrap">
              {pieChartData.map((entry, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{entry.name}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      
      <RevenueChat />
    </div>
  );
};

export default Reports;
