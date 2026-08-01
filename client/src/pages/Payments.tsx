import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui';
import { CircleDollarSign, Save, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const Payments: React.FC = () => {
  const { businessProfile, updateBusinessProfile, user } = useAppStore();
  const [paystackPubKey, setPaystackPubKey] = useState(businessProfile.paystackPublicKey || '');
  const [paystackSecKey, setPaystackSecKey] = useState('');
  
  const [flutterwavePubKey, setFlutterwavePubKey] = useState(businessProfile.flutterwavePublicKey || '');
  const [flutterwaveSecKey, setFlutterwaveSecKey] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPaystackPubKey(businessProfile.paystackPublicKey || '');
    setFlutterwavePubKey(businessProfile.flutterwavePublicKey || '');
  }, [businessProfile.paystackPublicKey, businessProfile.flutterwavePublicKey]);

  useEffect(() => {
    const fetchSecrets = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('user_secrets')
          .select('paystack_secret_key, flutterwave_secret_key')
          .eq('user_id', user.id)
          .single();
          
        if (data) {
          setPaystackSecKey(data.paystack_secret_key || '');
          setFlutterwaveSecKey(data.flutterwave_secret_key || '');
        }
      } catch (err) {
        console.error('Error fetching secrets:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSecrets();
  }, [user?.id]);

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      // Update Public Keys in profiles (via zustand and API)
      updateBusinessProfile({
        ...businessProfile,
        paystackPublicKey: paystackPubKey,
        flutterwavePublicKey: flutterwavePubKey
      });

      // Update Secret Keys in user_secrets
      const { error: secretsError } = await supabase
        .from('user_secrets')
        .upsert({ 
          user_id: user.id,
          paystack_secret_key: paystackSecKey,
          flutterwave_secret_key: flutterwaveSecKey,
          updated_at: new Date().toISOString()
        });

      if (secretsError) throw secretsError;

      toast.success('Payment settings saved successfully!');
    } catch (err) {
      console.error('Error saving payments:', err);
      toast.error('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Payments</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage your connected payment gateways securely.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Paystack Card */}
        <Card className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t-4 border-t-teal-500">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-400 rounded-full flex items-center justify-center">
              <CircleDollarSign size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Paystack</h2>
              <p className="text-xs text-slate-500">For NGN and African currencies</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Public Key</label>
              <input 
                type="text" 
                value={paystackPubKey}
                onChange={e => setPaystackPubKey(e.target.value)}
                placeholder="pk_test_..."
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Secret Key (Webhook Verification)</label>
              <input 
                type="password" 
                value={paystackSecKey}
                onChange={e => setPaystackSecKey(e.target.value)}
                placeholder="sk_test_..."
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition-shadow"
              />
              <p className="text-xs text-slate-500 mt-2">Find these in Paystack Dashboard &gt; Settings &gt; API Keys &amp; Webhooks.</p>
            </div>
          </div>
        </Card>

        {/* Flutterwave Card */}
        <Card className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t-4 border-t-amber-500">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400 rounded-full flex items-center justify-center">
              <CircleDollarSign size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Flutterwave</h2>
              <p className="text-xs text-slate-500">For USD and International currencies</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Public Key</label>
              <input 
                type="text" 
                value={flutterwavePubKey}
                onChange={e => setFlutterwavePubKey(e.target.value)}
                placeholder="FLWPUBK_TEST-..."
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition-shadow"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Secret Hash (Webhook Verification)</label>
              <input 
                type="password" 
                value={flutterwaveSecKey}
                onChange={e => setFlutterwaveSecKey(e.target.value)}
                placeholder="Your Secret Hash"
                className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none transition-shadow"
              />
              <p className="text-xs text-slate-500 mt-2">Find these in Flutterwave Dashboard &gt; Settings &gt; API &amp; Webhooks.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Payments;
