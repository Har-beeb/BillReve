import React from 'react';
import { ShieldCheck, Zap, Heart, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const VALUES = [
  {
    icon: <Zap size={24} className="text-amber-500" />,
    title: 'Offline-First',
    description: 'We believe your business tools shouldn\'t stop working when your internet does. That\'s why we built BillReve to run entirely in your browser until you reconnect.'
  },
  {
    icon: <ShieldCheck size={24} className="text-emerald-500" />,
    title: 'Your Data is Yours',
    description: 'We don\'t sell your data or hold your invoices hostage. Your business information is secure, private, and always accessible.'
  },
  {
    icon: <Heart size={24} className="text-purple-500" />,
    title: 'Built for the Independent',
    description: 'We designed BillReve for freelancers, agencies, and small businesses who need professional tools without the enterprise price tag.'
  },
  {
    icon: <Users size={24} className="text-blue-500" />,
    title: 'AI that Empowers',
    description: 'We use AI not to replace you, but to give you a financial assistant that handles the tedious formatting so you can focus on your craft.'
  }
];

const About: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto text-center mb-24">
        <h1 className="text-4xl md:text-5xl font-['Outfit'] font-black text-slate-900 dark:text-white mb-6">
          Our Mission
        </h1>
        <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
          To empower independent professionals with fast, beautiful, and resilient financial tools.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-16 items-center mb-24">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">The Story of BillReve</h2>
          <div className="space-y-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
            <p>
              It started with a simple frustration: why does every invoicing software require a constant internet connection, load slowly, and charge exorbitant monthly fees just to generate a PDF?
            </p>
            <p>
              We realized that freelancers and small businesses were being underserved by clunky legacy software. So we built BillReve from the ground up using modern web technologies like IndexedDB to create an offline-first experience that is blazing fast.
            </p>
            <p>
              Today, with the integration of Revenue AI, we're taking the friction out of billing entirely, allowing you to generate professional invoices with simple conversational commands.
            </p>
          </div>
        </div>
        <div className="relative">
          <div className="absolute inset-0 bg-purple-500/20 rounded-3xl blur-2xl -z-10 transform rotate-3" />
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl">
            <img 
              src="https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070&auto=format&fit=crop" 
              alt="Team collaborating" 
              className="rounded-2xl w-full h-auto object-cover mb-6"
            />
            <p className="text-center text-slate-500 dark:text-slate-400 font-medium italic">
              "We're building the tools we wished we had when we started."
            </p>
          </div>
        </div>
      </div>

      <div className="mb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Our Values</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {VALUES.map((value, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-purple-200 dark:hover:border-purple-800 transition-colors">
              <div className="w-14 h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-6">
                {value.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{value.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {value.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-purple-600 rounded-3xl p-12 text-center text-white">
        <h2 className="text-3xl font-black mb-6 font-['Outfit']">Join the offline-first revolution</h2>
        <p className="text-purple-100 mb-8 max-w-xl mx-auto text-lg">
          Stop waiting for loading spinners. Start invoicing at the speed of thought.
        </p>
        <Link to="/register" className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-white text-purple-600 hover:bg-slate-50 font-bold transition-all shadow-lg hover:shadow-xl">
          Create Your Free Account
        </Link>
      </div>
    </div>
  );
};

export default About;
