import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileSignature, 
  RefreshCw, 
  CreditCard, 
  Palette, 
  ArrowRight,
  CheckCircle2,
  Zap,
  Globe2,
  FileText,
  Users,
  LayoutDashboard,
  Star,
  FileSpreadsheet,
  Bot,
  Send
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { useAppStore } from '../store/useAppStore';
import { PublicHeader } from '../components/PublicHeader';

import { Footer } from '../components/Footer';
import { SEO } from '../components/SEO';

const WORDS = ['Simplified.', 'Automated.', 'Perfected.'];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % WORDS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans selection:bg-purple-200 dark:selection:bg-purple-900 selection:text-purple-900 dark:selection:text-purple-100">
      <SEO title="Home" />
      
      {/* Navigation */}
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/20 dark:bg-purple-600/10 rounded-full blur-3xl -z-10 opacity-70 animate-pulse" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-sm font-bold mb-8">
            <Zap size={16} className="text-amber-500" />
            <span>The future of offline-first invoicing</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-['Outfit'] font-black tracking-tight mb-8 leading-tight flex flex-col justify-center items-center">
            <span>Professional Invoicing,</span>
            <span className="text-purple-600 dark:text-purple-400 flex items-center justify-center min-w-[300px] min-h-[1.2em]">
              <AnimatePresence mode="wait">
                 <motion.span
                   key={wordIndex}
                   initial={{ opacity: 0, y: 15, filter: "blur(5px)" }}
                   animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                   exit={{ opacity: 0, y: -15, filter: "blur(5px)" }}
                   transition={{ duration: 0.3, ease: "easeOut" }}
                   className="inline-block origin-bottom"
                 >
                   {WORDS[wordIndex]}
                 </motion.span>
               </AnimatePresence>
            </span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 mt-4 md:mt-0">
            Create, send, and track stunning invoices and quotes in seconds. Get paid faster and manage your business effortlessly—even when you're offline.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={handleGetStarted}
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold text-lg transition-all shadow-xl hover:shadow-purple-500/30 active:scale-95 flex items-center justify-center gap-2 group"
            >
              Start for free
              <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
            </button>
            <a 
              href="#features"
              className="w-full sm:w-auto px-8 py-4 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-lg border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 hover:text-purple-600 transition-all shadow-sm active:scale-95 flex items-center justify-center"
            >
              See features
            </a>
          </div>
          
          {/* Mockup Preview populated with data */}
          <div className="mt-20 relative max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent dark:from-slate-900 z-20 h-full pointer-events-none" />
            <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transform perspective-1000 rotateX-12 scale-95 hover:scale-100 hover:rotateX-0 transition-all duration-700 ease-out text-left select-none">
              <div className="h-8 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="p-4 md:p-8 flex gap-6 opacity-90 h-[600px] overflow-hidden">
                {/* Sidebar mock */}
                <div className="hidden md:flex flex-col gap-4 w-56 border-r border-slate-100 dark:border-slate-800 pr-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Logo size="sm" className="flex-shrink-0" />
                    <span className="font-['Outfit'] font-black text-xl text-purple-600 dark:text-purple-400">BillReve</span>
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg font-medium">
                    <LayoutDashboard size={18} /> Dashboard
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2 text-slate-500">
                    <FileSignature size={18} /> Quotes
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2 text-slate-500">
                    <FileText size={18} /> Invoices
                  </div>
                  <div className="flex items-center gap-3 px-3 py-2 text-slate-500">
                    <Users size={18} /> Clients
                  </div>
                </div>
                {/* Content mock */}
                <div className="flex-1 space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold font-['Outfit']">Overview</h2>
                    <div className="flex gap-2">
                       <div className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                         <span className="text-lg leading-none">+</span> New Invoice
                       </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-500 mb-1">Total Revenue</p>
                      <p className="text-2xl font-black font-['Outfit']">₦1,245,000</p>
                      <p className="text-xs text-green-500 mt-2 flex items-center gap-1">↑ 12% vs last month</p>
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-500 mb-1">Outstanding</p>
                      <p className="text-2xl font-black font-['Outfit']">₦340,000</p>
                      <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">4 invoices pending</p>
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                      <p className="text-sm text-slate-500 mb-1">Drafts</p>
                      <p className="text-2xl font-black font-['Outfit']">₦45,000</p>
                      <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">2 documents</p>
                    </div>
                  </div>
                  
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 p-6">
                     <h3 className="font-bold mb-4">Recent Invoices</h3>
                     <div className="space-y-3">
                       {[
                         { id: '#INV-042', client: 'Acme Corp', amount: '₦450,000', status: 'PAID', color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
                         { id: '#INV-043', client: 'Stark Industries', amount: '₦120,000', status: 'SENT', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
                         { id: '#INV-044', client: 'Wayne Ent.', amount: '₦220,000', status: 'OVERDUE', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
                       ].map((inv, i) => (
                         <div key={i} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-700">
                           <div className="flex gap-4 items-center">
                             <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-400 text-sm">
                               {inv.client.charAt(0)}
                             </div>
                             <div>
                               <p className="font-bold">{inv.client}</p>
                               <p className="text-xs text-slate-500">{inv.id}</p>
                             </div>
                           </div>
                           <div className="flex items-center gap-6">
                             <p className="font-bold">{inv.amount}</p>
                             <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${inv.color}`}>{inv.status}</span>
                           </div>
                         </div>
                       ))}
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white dark:bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-['Outfit']">Everything you need to run your business</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Powerful tools wrapped in a beautiful, easy-to-use interface.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<FileSignature size={32} className="text-purple-600 dark:text-purple-400" />}
              title="Beautiful Documents"
              description="Create stunning invoices and quotes that reflect your brand. Add your logo, choose colors, and look professional."
            />
            <FeatureCard 
              icon={<RefreshCw size={32} className="text-amber-500" />}
              title="Work Offline, Sync Later"
              description="No internet? No problem. Full offline capability means you can keep working anywhere. We'll sync automatically when you reconnect."
            />
            <FeatureCard 
              icon={<CreditCard size={32} className="text-green-500" />}
              title="Get Paid Faster"
              description="Send secure payment links via Email or WhatsApp. Track views, signatures, and payments in real-time."
            />
            <FeatureCard 
              icon={<Globe2 size={32} className="text-blue-500" />}
              title="Multi-Currency"
              description="Bill clients anywhere in the world. Support for custom currencies and automatic localized formatting."
            />
            <FeatureCard 
              icon={<Palette size={32} className="text-pink-500" />}
              title="Custom Branding"
              description="Make it yours. Deep customization options let you tailor the app's look and feel to match your unique brand identity."
            />
            <FeatureCard 
              icon={<CheckCircle2 size={32} className="text-teal-500" />}
              title="Client Management"
              description="Keep all your client details organized. Track invoice history, outstanding balances, and communication."
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-3xl -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-['Outfit']">Simple, transparent pricing</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Start for free, upgrade when you need superpowers.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-10 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">Perfect for freelancers getting started.</p>
              <div className="flex items-end gap-1 mb-8">
                 <span className="text-5xl font-black font-['Outfit']">₦0</span>
                 <span className="text-lg text-slate-500 font-normal mb-2">/mo</span>
              </div>
              
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-start gap-3"><CheckCircle2 size={20} className="text-slate-400 shrink-0 mt-0.5" /> <span className="text-slate-600 dark:text-slate-300">Up to 10 Invoices & Quotes</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 size={20} className="text-slate-400 shrink-0 mt-0.5" /> <span className="text-slate-600 dark:text-slate-300">Up to 5 Clients</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 size={20} className="text-slate-400 shrink-0 mt-0.5" /> <span className="text-slate-600 dark:text-slate-300">Standard Templates</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 size={20} className="text-slate-400 shrink-0 mt-0.5" /> <span className="text-slate-600 dark:text-slate-300">Offline Mode</span></li>
              </ul>
              
              <button onClick={handleGetStarted} className="w-full py-4 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                Get Started Free
              </button>
            </div>
            
            {/* Pro Tier */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-3xl p-8 md:p-10 border border-purple-500 shadow-2xl text-white flex flex-col relative transform md:-translate-y-4 md:scale-105">
              <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-lg">
                Most Popular
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 text-white font-semibold text-xs mb-4 w-max border border-white/20">
                 <Star size={14} className="fill-white" /> BillReve Pro
              </div>
              <h3 className="text-2xl font-bold mb-2">Pro Subscription</h3>
              <p className="text-purple-200 mb-6">Everything you need to scale.</p>
              
              <div className="mb-8 flex flex-col gap-1">
                 <div className="flex items-center gap-2 mb-1">
                   <span className="text-lg text-purple-300 line-through decoration-red-400 decoration-2 font-bold">
                     ₦5,000
                   </span>
                   <span className="text-xs font-bold bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                     30% Off
                   </span>
                 </div>
                 <div className="flex items-end gap-1">
                   <span className="text-5xl font-black font-['Outfit'] tracking-tight">₦3,500</span>
                   <span className="text-lg text-purple-300 font-normal mb-2">/mo</span>
                 </div>
              </div>
              
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-start gap-3"><Bot size={20} className="text-purple-300 shrink-0 mt-0.5" /> <span>AI Document Drafting</span></li>
                <li className="flex items-start gap-3"><FileSpreadsheet size={20} className="text-emerald-300 shrink-0 mt-0.5" /> <span>Advanced CSV & Excel Exports</span></li>
                <li className="flex items-start gap-3"><Palette size={20} className="text-pink-300 shrink-0 mt-0.5" /> <span>Custom Brand Colors & Logos</span></li>
                <li className="flex items-start gap-3"><Zap size={20} className="text-amber-300 shrink-0 mt-0.5" /> <span>Unlimited Clients & Invoices</span></li>
                <li className="flex items-start gap-3"><Send size={20} className="text-blue-300 shrink-0 mt-0.5" /> <span>Automated Email Reminders & Campaigns</span></li>
              </ul>
              
              <button onClick={handleGetStarted} className="w-full py-4 rounded-xl font-bold bg-white text-purple-700 hover:bg-purple-50 transition-colors shadow-lg mt-auto">
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Professional Footer */}
      <Footer />
    </div>
  );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 hover:border-purple-200 dark:hover:border-purple-800 hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300 group">
    <div className="w-14 h-14 rounded-xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
      {icon}
    </div>
    <h3 className="text-xl font-bold mb-3">{title}</h3>
    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
      {description}
    </p>
  </div>
);

export default LandingPage;
