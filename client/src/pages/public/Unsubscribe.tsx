import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Loader2, MailX } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SEO } from '../../components/SEO';

/**
 * Public unsubscribe page, reached from the link in every campaign email.
 *
 * Gmail and Yahoo's bulk sender requirements (February 2024) expect one-click
 * unsubscribe: the `List-Unsubscribe-Post` header makes the mail client POST
 * to this URL directly, and this page is the fallback for recipients who click
 * the visible link in the footer instead.
 *
 * Two deliberate choices:
 *
 *   - It unsubscribes on load rather than asking for a confirmation click.
 *     Some mail clients and security scanners pre-fetch links, so a
 *     confirmation step means a meaningful share of genuine unsubscribes never
 *     complete — and failing to honour an unsubscribe is both a legal problem
 *     and the fastest way to collect spam complaints. The RPC is idempotent, so
 *     a pre-fetch followed by a real click is harmless.
 *   - It never reveals the email address or the business. The token is the only
 *     credential on a public endpoint, so echoing back who it belongs to would
 *     turn it into a contact-enumeration tool.
 */
const Unsubscribe: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [message, setMessage] = useState('');

  const run = useCallback(async () => {
    if (!token) {
      setState('error');
      setMessage('That unsubscribe link is incomplete.');
      return;
    }

    setState('working');
    try {
      const { data, error } = await supabase.rpc('unsubscribe_by_token', { p_token: token });
      if (error) throw error;

      if (data?.success) {
        setState('done');
        setMessage(data.message || 'You have been unsubscribed.');
      } else {
        setState('error');
        setMessage(data?.message || 'That unsubscribe link is not valid or has expired.');
      }
    } catch (err) {
      console.error('Unsubscribe failed:', err);
      setState('error');
      setMessage('Something went wrong on our side. Please try again in a moment.');
    }
  }, [token]);

  useEffect(() => { run(); }, [run]);

  return (
    <>
      <SEO
        title="Unsubscribe"
        description="Manage your email preferences."
        noindex
      />
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center">
          {state === 'working' && (
            <>
              <Loader2 size={40} className="mx-auto mb-6 text-purple-600 animate-spin" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Updating your preferences…
              </h1>
              <p className="text-slate-600 dark:text-slate-400">One moment.</p>
            </>
          )}

          {state === 'done' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={32} />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-3">
                You&rsquo;re unsubscribed
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-8">{message}</p>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 text-left">
                <div className="flex gap-3">
                  <MailX size={18} className="text-slate-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    You will still receive invoices, quotes and payment receipts from
                    this business, since those are part of your transactions rather
                    than marketing.
                  </p>
                </div>
              </div>
            </>
          )}

          {state === 'error' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-3">
                We couldn&rsquo;t process that
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mb-8">{message}</p>
              <button
                onClick={run}
                className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-5 rounded-xl transition-colors"
              >
                Try again
              </button>
              <p className="text-sm text-slate-500 dark:text-slate-500 mt-6">
                If this keeps happening, reply to the email you received and ask the
                sender to remove you from their list.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Unsubscribe;
