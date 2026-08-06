import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  FileSignature, 
  RefreshCw, 
  CreditCard, 
  Palette, 
  ArrowRight,
  CheckCircle2,
  Zap,
  Globe2
} from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { useAppStore } from '../store/useAppStore';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAppStore(state => state.isAuthenticated);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans selection:bg-purple-200 dark:selection:bg-purple-900 selection:text-purple-900 dark:selection:text-purple-100">
      
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
              <Logo size="md" />
              <span className="font-['Outfit'] font-black text-2xl tracking-tight text-purple-600 dark:text-purple-400">
                BillReve
              </span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Features</a>
              <a href="#pricing" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Pricing</a>
              
              <div className="flex items-center space-x-4 pl-4 border-l border-slate-200 dark:border-slate-700">
                <Link to="/login" className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                  Log in
                </Link>
                <button 
                  onClick={handleGetStarted}
                  className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-all shadow-lg hover:shadow-purple-500/25 active:scale-95"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/20 dark:bg-purple-600/10 rounded-full blur-3xl -z-10 opacity-70 animate-pulse" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-sm font-bold mb-8">
            <Zap size={16} className="text-amber-500" />
            <span>The future of offline-first invoicing</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-['Outfit'] font-black tracking-tight mb-8 leading-tight">
            Professional Invoicing, <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-500 dark:from-purple-400 dark:to-indigo-300">
              Simplified.
            </span>
          </h1>
          
          <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10">
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
          
          {/* Mockup Preview */}
          <div className="mt-20 relative max-w-5xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent dark:from-slate-900 z-10 h-full" />
            <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transform perspective-1000 rotateX-12 scale-95 hover:scale-100 hover:rotateX-0 transition-all duration-700 ease-out">
              <div className="h-8 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="p-4 md:p-8 flex gap-6 opacity-90">
                {/* Sidebar mock */}
                <div className="hidden md:flex flex-col gap-4 w-48 border-r border-slate-100 dark:border-slate-800 pr-6">
                  <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800/50 rounded mt-4" />
                  <div className="h-4 w-28 bg-slate-100 dark:bg-slate-800/50 rounded" />
                  <div className="h-4 w-36 bg-slate-100 dark:bg-slate-800/50 rounded" />
                </div>
                {/* Content mock */}
                <div className="flex-1 space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="h-10 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-10 w-32 bg-purple-600/20 dark:bg-purple-500/20 rounded" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="h-32 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800" />
                    <div className="h-32 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800" />
                    <div className="h-32 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800" />
                  </div>
                  <div className="h-64 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800" />
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
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
              <h3 className="text-2xl font-bold mb-2">Free</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6">Perfect for freelancers getting started.</p>
              <div className="text-4xl font-black mb-8 font-['Outfit']">$0<span className="text-lg text-slate-500 font-normal">/mo</span></div>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-purple-600" /> Unlimited Invoices & Quotes</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-purple-600" /> Up to 5 Clients</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-purple-600" /> Standard Templates</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-purple-600" /> Offline Mode</li>
              </ul>
              
              <button onClick={handleGetStarted} className="w-full py-4 rounded-xl font-bold bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                Get Started Free
              </button>
            </div>
            
            {/* Pro Tier */}
            <div className="bg-gradient-to-b from-purple-600 to-indigo-700 rounded-3xl p-8 border border-purple-500 shadow-2xl text-white flex flex-col relative transform md:-translate-y-4 md:scale-105">
              <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-lg">
                Most Popular
              </div>
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <p className="text-purple-200 mb-6">For growing businesses that need more.</p>
              <div className="text-4xl font-black mb-8 font-['Outfit']">$10<span className="text-lg text-purple-300 font-normal">/mo</span></div>
              
              <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-purple-300" /> Unlimited Everything</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-purple-300" /> Mass Email Campaigns</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-purple-300" /> Advanced Analytics & Reports</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-purple-300" /> AI Document Assistant</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={20} className="text-purple-300" /> Premium Templates</li>
              </ul>
              
              <button onClick={handleGetStarted} className="w-full py-4 rounded-xl font-bold bg-white text-purple-700 hover:bg-purple-50 transition-colors shadow-lg">
                Upgrade to Pro
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Logo size="sm" className="opacity-50 grayscale" />
            <span className="font-['Outfit'] font-black text-xl text-slate-400">BillReve</span>
          </div>
          
          <div className="flex space-x-6 text-sm text-slate-500">
            <Link to="/terms" className="hover:text-purple-600 transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-purple-600 transition-colors">Privacy Policy</Link>
          </div>
          
          <div className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} BillReve. All rights reserved.
          </div>
        </div>
      </footer>
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
