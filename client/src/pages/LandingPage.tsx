import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  UserRound,
  BriefcaseBusiness,
  Paintbrush,
  Store,
  LayoutDashboard,
  Star,
  FileSpreadsheet,
  Bot,
  Send,
  MessageSquare,
  Loader2,
  HelpCircle,
  ShieldCheck,
  Clock3
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { useAppStore } from '../store/useAppStore';
import { PublicHeader } from '../components/PublicHeader';

import { Footer } from '../components/Footer';
import { SEO } from '../components/SEO';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';

const WORDS = ['Simplified.', 'Automated.', 'Perfected.'];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  const [wordIndex, setWordIndex] = useState(0);
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackType, setFeedbackType] = useState('bug');
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const location = useLocation();

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % WORDS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (location.hash) {
      const element = document.getElementById(location.hash.substring(1));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location.hash]);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/register');
    }
  };

  const handleExplorePro = () => {
    navigate(isAuthenticated ? '/upgrade' : '/register');
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim() || !feedbackEmail.trim()) {
      toast.error('Please provide an email and your feedback.');
      return;
    }
    
    if (!navigator.onLine) {
      toast.error('You need an active internet connection to send feedback.');
      return;
    }
    
    setIsSubmittingFeedback(true);
    try {
      const htmlContent = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>New Feedback Submission</h2>
          <p><strong>Email:</strong> ${feedbackEmail}</p>
          <p><strong>Type:</strong> ${feedbackType}</p>
          
          <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin-top: 16px; white-space: pre-wrap;">
            ${feedbackText}
          </div>
        </div>
      `;

      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: ['support@billreve.app'],
          subject: `New Feedback from ${feedbackEmail}`,
          html: htmlContent
        }
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error?.message || 'Failed to send');

      toast.success('Thank you! Your feedback has been sent.');
      setFeedbackText('');
      setFeedbackEmail('');
    } catch (err: any) {
      console.error('Feedback error:', err);
      toast.error('Failed to send feedback. Please try again later.');
    } finally {
      setIsSubmittingFeedback(false);
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
            Create professional invoices and quotes in seconds, send them with confidence, and keep your core business records moving, even when you're offline.
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
                  <div className="grid grid--grid-cols-1 md:grid-cols-3 gap-4">
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
                         { id: '#INV-042', client: 'Dangote Group', amount: '₦450,000', status: 'PAID', color: 'text-green-600 bg-green-100 dark:bg-green-900/30' },
                         { id: '#INV-043', client: 'MTN Nigeria', amount: '₦120,000', status: 'SENT', color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' },
                         { id: '#INV-044', client: 'Jumia', amount: '₦220,000', status: 'OVERDUE', color: 'text-red-600 bg-red-100 dark:bg-red-900/30' },
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

      {/* Workflow Section */}
      <section className="py-20 bg-slate-900 dark:bg-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-bold uppercase tracking-wider text-purple-300 mb-3">A calmer way to bill</p>
            <h2 className="text-3xl md:text-4xl font-black font-['Outfit'] mb-4">From first draft to payment, without the busywork.</h2>
            <p className="text-slate-300 text-lg">BillReve keeps the workflow simple so you can spend less time formatting documents and more time doing the work clients value.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { number: '01', title: 'Create', text: 'Start from a polished invoice or quote, or let Revenue AI turn a short description into a structured draft.', icon: <FileText size={24} /> },
              { number: '02', title: 'Send', text: 'Share a professional document or public payment link with clear terms, branding, and next steps.', icon: <Send size={24} /> },
              { number: '03', title: 'Track', text: 'Follow payment status, outstanding balances, and client activity from one focused workspace.', icon: <LayoutDashboard size={24} /> }
            ].map((step) => (
              <div key={step.number} className="group rounded-2xl border border-slate-700 bg-slate-800/60 p-7 transition-all duration-300 hover:-translate-y-2 hover:border-purple-400/70 hover:bg-slate-800 hover:shadow-2xl hover:shadow-purple-950/40">
                <div className="flex items-center justify-between mb-8">
                  <span className="text-sm font-black text-purple-300">{step.number}</span>
                  <div className="h-11 w-11 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-purple-500 group-hover:text-white">{step.icon}</div>
                </div>
                <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                <p className="text-slate-300 leading-relaxed">{step.text}</p>
              </div>
            ))}
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
              description="Create stunning invoices and quotes that reflect your brand. Add your logo, choose from professional templates, and stand out."
            />
            <FeatureCard 
              icon={<RefreshCw size={32} className="text-amber-500" />}
              title="Work Offline, Sync Later"
              description="Create and manage core business records locally first. BillReve syncs your changes automatically when you reconnect."
            />
            <FeatureCard 
              icon={<CreditCard size={32} className="text-green-500" />}
              title="Get Paid Faster"
              description="Share professional payment links and clear transfer instructions so clients always know what to do next."
            />
            <FeatureCard 
              icon={<Globe2 size={32} className="text-blue-500" />}
              title="Multi-Currency"
              description="Bill clients anywhere in the world. Support for custom currencies and automatic localized formatting."
            />
            <FeatureCard 
              icon={<Palette size={32} className="text-pink-500" />}
              title="Custom Branding"
              description="Make it yours. Upload your business logo and choose from multiple layout themes to match your unique brand identity."
            />
            <FeatureCard 
              icon={<CheckCircle2 size={32} className="text-teal-500" />}
              title="Client Management"
              description="Keep all your client details organized. Track invoice history, outstanding balances, and communication."
            />
          </div>
        </div>
      </section>

      {/* Audience Section */}
      <section className="py-24 bg-white dark:bg-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 font-['Outfit']">Built around the way you work</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">Whether you are sending your first invoice or managing recurring client work, BillReve keeps the essentials close.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { title: 'Freelancers', text: 'Send polished invoices, track payment, and keep your client history organised.', icon: <UserRound size={28} /> },
              { title: 'Consultants', text: 'Turn agreed scope into clear quotes, milestones, and payment terms.', icon: <BriefcaseBusiness size={28} /> },
              { title: 'Creative teams', text: 'Protect your brand with reusable themes, logos, and professional PDFs.', icon: <Paintbrush size={28} /> },
              { title: 'Small businesses', text: 'Keep clients, invoices, quotes, and reports together as you grow.', icon: <Store size={28} /> }
            ].map(({ title, text, icon }) => (
              <div key={title} className="group rounded-2xl border border-slate-200 dark:border-slate-700 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-lg hover:shadow-purple-500/10">
                <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 mb-5 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">{icon}</div>
                <h3 className="font-bold text-lg mb-2">{title}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-sm">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feedback Section */}
      <section className="py-24 bg-slate-50 dark:bg-slate-900 border-y border-slate-200 dark:border-slate-800 relative overflow-hidden">
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-3xl -z-10 -translate-y-1/2" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-3xl -z-10 -translate-y-1/2" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-lg max-w-5xl mx-auto flex flex-col md:flex-row">
            <div className="md:w-5/12 bg-slate-50 dark:bg-slate-800/50 p-8 md:p-12 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700">
              <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/50 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-6">
                <MessageSquare size={28} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Help us shape the future.</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                BillReve is built for businesses like yours. Have a feature request or noticed something we can improve? Your feedback goes directly to our product team.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-500 font-medium">
                We read every single message.
              </p>
            </div>
            
            <div className="md:w-7/12 p-8 md:p-12">
              <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                <div>
                  <label htmlFor="feedbackType" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Feedback Type
                  </label>
                  <select 
                    id="feedbackType"
                    value={feedbackType} 
                    onChange={(e) => setFeedbackType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="bug">Report a Bug</option>
                    <option value="feature">Feature Request</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="feedbackEmail" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Your Email
                  </label>
                  <input
                    id="feedbackEmail"
                    type="email"
                    required
                    value={feedbackEmail}
                    onChange={(e) => setFeedbackEmail(e.target.value)}
                    placeholder="hello@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label htmlFor="feedbackText" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Your Feedback
                  </label>
                  <textarea
                    id="feedbackText"
                    required
                    rows={4}
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="I would love to see a feature that..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isSubmittingFeedback}
                  className="w-full px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmittingFeedback ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  {isSubmittingFeedback ? 'Sending...' : 'Send Feedback'}
                </button>
              </form>
            </div>
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 md:items-start gap-8 max-w-4xl mx-auto">
            {/* Free Tier */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 md:p-10 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">The essentials for getting started and staying organised.</p>
              <div className="flex items-end gap-1 mb-8">
                 <span className="text-5xl font-black font-['Outfit']">₦0</span>
                 <span className="text-lg text-slate-500 font-normal mb-2">/mo</span>
              </div>
              
              <ul className="space-y-4 mb-10">
                <li className="flex items-start gap-3"><CheckCircle2 size={20} className="text-slate-400 shrink-0 mt-0.5" /> <span className="text-slate-600 dark:text-slate-300">10 invoices per month</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 size={20} className="text-slate-400 shrink-0 mt-0.5" /> <span className="text-slate-600 dark:text-slate-300">10 quotes per month</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 size={20} className="text-slate-400 shrink-0 mt-0.5" /> <span className="text-slate-600 dark:text-slate-300">Up to 5 clients</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 size={20} className="text-slate-400 shrink-0 mt-0.5" /> <span className="text-slate-600 dark:text-slate-300">10 AI prompts per month</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 size={20} className="text-slate-400 shrink-0 mt-0.5" /> <span className="text-slate-600 dark:text-slate-300">Offline-first workspace</span></li>
                <li className="flex items-start gap-3"><CheckCircle2 size={20} className="text-slate-400 shrink-0 mt-0.5" /> <span className="text-slate-600 dark:text-slate-300">7-day trash recovery</span></li>
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
                 <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4 text-left">
                   <div className="flex items-center justify-between gap-3 mb-3">
                     <p className="text-sm font-bold text-white">Save with a longer plan</p>
                     <span className="text-[11px] font-semibold uppercase tracking-wide text-purple-200">Pay once</span>
                   </div>
                   <div className="grid grid-cols-3 gap-2">
                     {[
                       { term: '3 months', price: '₦10,000', saving: 'Save 5%' },
                       { term: '6 months', price: '₦19,000', saving: 'Save 10%' },
                       { term: '12 months', price: '₦35,000', saving: 'Save 17%' }
                     ].map((plan) => (
                       <div key={plan.term} className="rounded-xl bg-white/10 px-2 py-3 text-center transition-colors hover:bg-white/20">
                         <p className="text-[11px] font-medium text-purple-200">{plan.term}</p>
                         <p className="mt-1 text-sm font-black text-white">{plan.price}</p>
                         <p className="mt-1 text-[10px] font-semibold text-emerald-200">{plan.saving}</p>
                       </div>
                     ))}
                   </div>
                   <p className="mt-3 text-xs leading-relaxed text-purple-200">One payment, no automatic renewal. Your Pro access continues for the full selected term.</p>
                 </div>
              </div>
              
              <ul className="space-y-4 mb-10 flex-1">
                <li className="flex items-start gap-3"><Bot size={20} className="text-purple-300 shrink-0 mt-0.5" /> <span>AI Document Drafting</span></li>
                <li className="flex items-start gap-3"><FileSpreadsheet size={20} className="text-emerald-300 shrink-0 mt-0.5" /> <span>Advanced CSV & Excel Exports</span></li>
                <li className="flex items-start gap-3"><Palette size={20} className="text-pink-300 shrink-0 mt-0.5" /> <span>Premium Templates & Logos</span></li>
                <li className="flex items-start gap-3"><Zap size={20} className="text-amber-300 shrink-0 mt-0.5" /> <span>Unlimited Clients & Invoices</span></li>
                <li className="flex items-start gap-3"><Send size={20} className="text-blue-300 shrink-0 mt-0.5" /> <span>Automated Email Reminders & Campaigns</span></li>
              </ul>
              
              <button onClick={handleExplorePro} className="w-full py-4 rounded-xl font-bold bg-white text-purple-700 hover:bg-purple-50 hover:text-purple-800 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-950/20 transition-all duration-200 shadow-lg mt-auto active:scale-[0.98]">
                Explore Pro
              </button>
            </div>
          </div>
          <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
            Pro upgrades support secure Paystack checkout, with manual bank transfer available as a fallback.
          </p>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-white dark:bg-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <HelpCircle className="mx-auto text-purple-600 dark:text-purple-400 mb-4" size={32} />
            <h2 className="text-3xl md:text-4xl font-bold font-['Outfit']">Questions, answered</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              ['Does BillReve work offline?', 'Core records such as clients, invoices, and quotes are created locally first and sync when you reconnect. Sending campaigns and online payment verification require a connection.'],
              ['Can clients pay online?', 'Public invoice links support configured Paystack or Flutterwave checkout for eligible Pro accounts, as well as manual transfer instructions.'],
              ['Is my data secure?', 'Supabase authentication, organization-scoped access policies, server-side quotas, and verified payment webhooks protect the cloud workflow.'],
              ['How does Pro activation work?', 'Paystack checkout is verified by webhook before Pro access is activated. Manual transfer is also available and is reviewed before activation.']
            ].map(([question, answer]) => (
              <div key={question} className="rounded-2xl border border-slate-200 dark:border-slate-700 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-lg hover:shadow-purple-500/10">
                <h3 className="font-bold mb-2">{question}</h3>
                <p className="text-sm leading-7 text-slate-600 dark:text-slate-400">{answer}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-500" /> Server-verified payments</span>
            <span className="inline-flex items-center gap-2"><Clock3 size={18} className="text-purple-500" /> Work locally first</span>
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
