import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui';
import { CircleDollarSign, Save, Loader2, Trash2, Plus, Lock, Building2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { BankAccount } from '../types';
import { InstructionNote } from '../components/ui';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const Payments: React.FC = () => {
  const { businessProfile, updateBusinessProfile, user, isProUser } = useAppStore();
  const [paystackPubKey, setPaystackPubKey] = useState(businessProfile.paystackPublicKey || '');
  const [paystackSecKey, setPaystackSecKey] = useState('');
  
  const [flutterwavePubKey, setFlutterwavePubKey] = useState(businessProfile.flutterwavePublicKey || '');
  const [flutterwaveSecKey, setFlutterwaveSecKey] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    setPaystackPubKey(businessProfile.paystackPublicKey || '');
    setFlutterwavePubKey(businessProfile.flutterwavePublicKey || '');
    
    // Set the webhook URL based on the current domain
    const apiUrl = import.meta.env.VITE_API_URL || 'https://api.billreve.app/v1';
    setWebhookUrl(apiUrl.replace('/api/v1', '') + '/api/v1/payments/webhook');
  }, [businessProfile.paystackPublicKey, businessProfile.flutterwavePublicKey]);

  useEffect(() => {
    const fetchSecrets = async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from('user_secrets')
          .select('paystack_secret_key, flutterwave_secret_key')
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (data) {
          setPaystackSecKey(data.paystack_secret_key || '');
          setFlutterwaveSecKey(data.flutterwave_secret_key || '');
        }
        
        // Also populate bank accounts
        if (businessProfile?.bankAccounts) {
          setBankAccounts(businessProfile.bankAccounts);
        }

      } catch (err) {
        console.error('Error fetching secrets:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSecrets();
  }, [user?.id]);


  const addBankAccount = () => {
    setBankAccounts([...bankAccounts, { id: uuidv4(), bankName: '', accountName: '', accountNumber: '', isDefault: bankAccounts.length === 0 }]);
  };

  const removeBankAccount = (id: string) => {
    const updated = bankAccounts.filter(b => b.id !== id);
    if (updated.length > 0 && !updated.some(b => b.isDefault)) {
      updated[0].isDefault = true;
    }
    setBankAccounts(updated);
  };

  const setBankAccountDefault = (id: string) => {
    setBankAccounts(bankAccounts.map(b => ({ ...b, isDefault: b.id === id })));
  };

  const updateBankAccount = (id: string, field: 'bankName' | 'accountName' | 'accountNumber', value: string) => {
    setBankAccounts(bankAccounts.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      // Update Public Keys in profiles (via zustand and API)
      updateBusinessProfile({
        ...businessProfile,
        paystackPublicKey: paystackPubKey,
        flutterwavePublicKey: flutterwavePubKey,
        bankAccounts: bankAccounts
      });

      // Update Public Keys and bank accounts in Supabase DB
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          paystack_public_key: paystackPubKey,
          flutterwave_public_key: flutterwavePubKey,
          bank_accounts: bankAccounts
        })
        .eq('id', user.id);
        
      if (profileError) throw profileError;

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

            {/* Manual Bank Transfers (Free) */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="text-purple-600" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Manual Bank Transfers</h2>
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Free</span>
        </div>
        <Card className="p-6 bg-white dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Add your bank details. These will be displayed on your invoices and public payment pages for clients to make direct transfers.
          </p>

          <div className="space-y-4">
            {bankAccounts.map((account, index) => (
              <div key={account.id} className={`p-4 rounded-lg border ${account.isDefault ? 'border-purple-500 bg-purple-50/30 dark:bg-purple-900/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50'}`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-sm">Account {index + 1}</span>
                    {account.isDefault && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">Default</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {!account.isDefault && (
                      <button onClick={() => setBankAccountDefault(account.id)} className="text-xs text-purple-600 hover:underline">Set as Default</button>
                    )}
                    <button onClick={() => removeBankAccount(account.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Bank Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Chase Bank"
                      value={account.bankName}
                      onChange={(e) => updateBankAccount(account.id, 'bankName', e.target.value)}
                      className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Account Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. John Doe / Business LLC"
                      value={account.accountName}
                      onChange={(e) => updateBankAccount(account.id, 'accountName', e.target.value)}
                      className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Account Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 1234567890"
                      value={account.accountNumber}
                      onChange={(e) => updateBankAccount(account.id, 'accountNumber', e.target.value)}
                      className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}

            <button 
              onClick={addBankAccount}
              className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium hover:text-purple-700 transition-colors text-sm mt-2"
            >
              <Plus size={16} /> Add Another Bank Account
            </button>
          </div>
        </Card>
      </div>

      {/* Online Payment Gateways (Pro) */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-4">
          <CircleDollarSign className="text-purple-600" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Online Payment Gateways</h2>
          {!isProUser && (
             <span className="flex items-center gap-1 px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full"><Lock size={12}/> Pro</span>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
          Accept credit cards, mobile money, and USSD payments directly on your invoices.
        </p>
      </div>
      
      {!isProUser && (
        <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-purple-800 dark:text-purple-300 text-sm">
          Online payment integrations are available on the Pro plan. <a href="/settings" className="font-bold underline">Upgrade now</a> to enable automatic payment collection.
        </div>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${!isProUser ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
        {/* Paystack Card */}
        <Card className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t-4 border-t-teal-500 flex flex-col h-full">
          <div className="flex-1">
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
            
            <InstructionNote type="info" title="Webhook Setup" className="mt-4">
              To automatically mark invoices as PAID, copy and paste this Webhook URL into your Paystack Dashboard:
              <br />
              <code className="block mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded border text-purple-600 select-all font-mono text-xs break-all">
                {webhookUrl}/paystack
              </code>
            </InstructionNote>
          </div>
          </div>
        </Card>

        {/* Flutterwave Card */}
        <Card className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t-4 border-t-amber-500 flex flex-col h-full">
          <div className="flex-1">
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
            
            <InstructionNote type="info" title="Webhook Setup" className="mt-4">
              To automatically mark invoices as PAID, copy and paste this Webhook URL into your Flutterwave Dashboard:
              <br />
              <code className="block mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded border text-purple-600 select-all font-mono text-xs break-all">
                {webhookUrl}/flutterwave
              </code>
            </InstructionNote>
          </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Payments;
