import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Mail, Send, Loader2, CheckSquare, Square, Search, ShieldCheck,
  AlertTriangle, XCircle, Sparkles, Monitor, Smartphone, History,
  PenLine, MailX, Zap, Info, TrendingUp, RefreshCw,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { requireOrganizationId } from '../lib/organization';
import { Card } from '../components/ui';
import { ProFeature } from '../components/ui/ProFeature';
import { RichTextEditor } from '../components/campaigns/RichTextEditor';
import { lintCampaign } from '../utils/campaignLint';
import { formatDate } from '../utils/formatters';
import toast from 'react-hot-toast';

interface Finding {
  code: string;
  message: string;
  hint?: string;
}

interface ProofreadReport {
  blocking: Finding[];
  warnings: Finding[];
  score: number;
  aiSummary?: string | null;
  aiAvailable?: boolean;
}

interface QuotaState {
  allowed: boolean;
  reason?: string;
  message?: string;
  monthlyCap?: number;
  sentThisMonth?: number;
  baseRemaining?: number;
  credits?: number;
  remaining?: number;
  campaignsThisWeek?: number;
  weeklyCampaignCap?: number;
}

interface CampaignRow {
  id: string;
  subject: string;
  status: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  bounced_count: number;
  complained_count: number;
  unsubscribed_count: number;
  created_at: string;
  sent_at: string | null;
  last_error: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  QUEUED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  SENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  SENT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  PARTIAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  FAILED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  BLOCKED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

const Campaigns: React.FC = () => {
  const { businessProfile, isProUser } = useAppStore();
  const clients = useLiveQuery(() => db.clients.filter((c) => !c.deletedAt).toArray()) || [];

  const [tab, setTab] = useState<'compose' | 'history'>('compose');

  // Composer state
  const [subject, setSubject] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  // Server state
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [suppressed, setSuppressed] = useState<Set<string>>(new Set());
  const [report, setReport] = useState<ProofreadReport | null>(null);
  const [history, setHistory] = useState<CampaignRow[]>([]);

  const [isChecking, setIsChecking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  /** Suppressed addresses must be visible in the picker, not silently dropped later. */
  const loadSuppressions = useCallback(async () => {
    const { data, error } = await supabase.from('email_suppressions').select('email');
    if (error) {
      console.error('Could not load suppression list:', error);
      return;
    }
    setSuppressed(new Set((data || []).map((r: { email: string }) => r.email.toLowerCase())));
  }, []);

  const loadQuota = useCallback(async () => {
    const { data, error } = await supabase.rpc('check_campaign_quota', { p_recipient_count: 0 });
    if (error) {
      console.error('Could not load campaign quota:', error);
      return;
    }
    setQuota(data as QuotaState);
  }, []);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    const { data, error } = await supabase
      .from('campaigns')
      .select('id, subject, status, recipient_count, sent_count, failed_count, bounced_count, complained_count, unsubscribed_count, created_at, sent_at, last_error')
      .order('created_at', { ascending: false })
      .limit(50);
    setIsLoadingHistory(false);
    if (error) {
      console.error('Could not load campaign history:', error);
      return;
    }
    setHistory((data || []) as CampaignRow[]);
  }, []);

  useEffect(() => {
    if (!isProUser) return;
    loadQuota();
    loadSuppressions();
    loadHistory();
  }, [isProUser, loadQuota, loadSuppressions, loadHistory]);

  // Any content edit invalidates a previous proofread — otherwise a user could
  // pass the check, then change the body, and send unreviewed content.
  useEffect(() => { setReport(null); }, [subject, contentHtml, previewText]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const mailableSelected = useMemo(
    () =>
      clients.filter(
        (c) =>
          selectedClients.has(c.localId) &&
          c.email &&
          !suppressed.has(c.email.toLowerCase())
      ),
    [clients, selectedClients, suppressed]
  );

  const skippedSelected = useMemo(
    () =>
      clients.filter(
        (c) =>
          selectedClients.has(c.localId) &&
          (!c.email || suppressed.has(c.email.toLowerCase()))
      ),
    [clients, selectedClients, suppressed]
  );

  /**
   * Live lint, recomputed as the user types.
   *
   * This runs the same deterministic rules as the `campaign-proofread` edge
   * function, so problems surface while they are still being created rather
   * than only when "Check campaign" is pressed. The server copy remains the
   * authority — `queue_campaign` independently rejects anything with blocking
   * findings — so this is purely about telling the user sooner.
   */
  const liveLint = useMemo(
    () =>
      lintCampaign({
        subject,
        html: contentHtml,
        previewText,
        recipientCount: mailableSelected.length,
      }),
    [subject, contentHtml, previewText, mailableSelected.length]
  );

  const uploadImage = useCallback(async (file: File): Promise<string> => {    const orgId = await requireOrganizationId();
    const ext = (file.name.split('.').pop() || 'png').toLowerCase();
    const path = `${orgId}/${uuidv4()}.${ext}`;

    const { error } = await supabase.storage
      .from('campaign-assets')
      .upload(path, file, { cacheControl: '31536000', upsert: false });

    if (error) throw error;

    const { data } = supabase.storage.from('campaign-assets').getPublicUrl(path);
    return data.publicUrl;
  }, []);

  const runProofread = async (): Promise<ProofreadReport | null> => {
    setIsChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke('campaign-proofread', {
        body: {
          subject,
          html: contentHtml,
          previewText,
          recipientCount: mailableSelected.length,
        },
      });

      if (error) {
        // The real message is on error.context, not error.message.
        let detail = error.message;
        try {
          const body = await (error as any)?.context?.clone?.()?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* not JSON */ }
        throw new Error(detail);
      }
      if (!data?.success) throw new Error(data?.error || 'Proofread failed');

      const result = data.data as ProofreadReport;
      setReport(result);
      return result;
    } catch (err: any) {
      console.error('Proofread failed:', err);
      toast.error(err.message || 'Could not check the campaign. Please try again.');
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  const handleSend = async () => {
    if (mailableSelected.length === 0) {
      toast.error('Select at least one client with a valid, subscribed email address.');
      return;
    }
    if (!subject.trim()) {
      toast.error('Add a subject line.');
      return;
    }

    // Always proofread immediately before sending, even if the user already
    // ran it — the gate must act on the content being sent, not an earlier draft.
    const fresh = report ?? (await runProofread());
    if (!fresh) return;

    if (fresh.blocking.length > 0) {
      toast.error('Resolve the blocking issues before sending.');
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.rpc('queue_campaign', {
        p_subject: subject.trim(),
        p_title: null,
        p_preview_text: previewText || null,
        p_content_html: contentHtml,
        p_content_json: null,
        p_client_ids: Array.from(selectedClients),
        p_proofread: fresh,
      });

      if (error) throw error;

      if (!data?.success) {
        toast.error(data?.message || 'Could not queue the campaign.');
        if (data?.quota) setQuota(data.quota as QuotaState);
        return;
      }

      toast.success(
        `Queued for ${data.queued} recipient${data.queued === 1 ? '' : 's'}. Sending now…`,
        { duration: 5000 }
      );

      /*
       * Kick the worker immediately rather than waiting for the next cron tick.
       *
       * The worker accepts a signed-in user and scopes itself to that user's
       * organization, so this only ever sends the campaign just queued. Cron
       * remains the retry backstop for anything this call does not finish.
       *
       * Deliberately not awaited for correctness — if it fails (offline, cold
       * start, misconfiguration) the campaign is already safely QUEUED in
       * Postgres and cron will pick it up. Failing to trigger must never lose
       * the send.
       */
      supabase.functions
        .invoke('campaign-worker', { body: {} })
        .then(({ error: dispatchError }) => {
          if (dispatchError) {
            console.warn('Immediate dispatch failed; cron will retry.', dispatchError);
          }
        })
        .catch((dispatchError) => {
          console.warn('Immediate dispatch failed; cron will retry.', dispatchError);
        })
        .finally(() => {
          // Refresh so the user sees SENDING/SENT rather than a stale QUEUED.
          loadHistory();
        });

      setSubject('');
      setPreviewText('');
      setContentHtml('');
      setSelectedClients(new Set());
      setReport(null);
      await Promise.all([loadQuota(), loadHistory()]);
      setTab('history');
    } catch (err: any) {
      console.error('Failed to queue campaign:', err);
      toast.error(err.message || 'Could not queue the campaign.');
    } finally {
      setIsSending(false);
    }
  };

  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = async (campaignId: string) => {
    setRetryingId(campaignId);
    try {
      const { data, error } = await supabase.rpc('retry_campaign', { p_campaign_id: campaignId });
      if (error) throw error;
      if (!data?.success) {
        toast.error(data?.message || 'Could not retry this campaign.');
        return;
      }
      toast.success(data.message || 'Campaign requeued.');

      // Same immediate-dispatch pattern as a fresh send: kick the worker now,
      // fall back to cron. Not awaited for correctness — the campaign is QUEUED
      // in Postgres, so a failed trigger only delays, never loses.
      supabase.functions.invoke('campaign-worker', { body: {} })
        .catch((e) => console.warn('Retry dispatch failed; cron will retry.', e))
        .finally(() => { loadHistory(); loadQuota(); });
    } catch (err: any) {
      console.error('Retry failed:', err);
      toast.error(err.message || 'Could not retry this campaign.');
    } finally {
      setRetryingId(null);
    }
  };

  const remaining = quota?.remaining ?? 0;
  const overAllowance = mailableSelected.length > remaining;
  const canSend =
    !isSending &&
    !isChecking &&
    mailableSelected.length > 0 &&
    subject.trim().length > 0 &&
    contentHtml.trim().length > 0 &&
    !overAllowance &&
    liveLint.blocking.length === 0 &&
    (!report || report.blocking.length === 0);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="text-purple-600" size={26} />
            Email Campaigns
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Write, check and send a campaign to your client list.
          </p>
        </div>

        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start">
          <button
            onClick={() => setTab('compose')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'compose'
                ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <PenLine size={16} /> Compose
          </button>
          <button
            onClick={() => { setTab('history'); loadHistory(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === 'history'
                ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <History size={16} /> History
          </button>
        </div>
      </div>

      <ProFeature isProUser={isProUser}>
        {/* Allowance */}
        {quota && (
          <Card className="p-5 bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-900 border-purple-100 dark:border-purple-900/40">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {remaining} email{remaining === 1 ? '' : 's'} available
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {quota.baseRemaining ?? 0} of your monthly {quota.monthlyCap ?? 250} remaining
                    {(quota.credits ?? 0) > 0 && ` · ${quota.credits} purchased credits`}
                    {typeof quota.campaignsThisWeek === 'number' &&
                      ` · ${quota.campaignsThisWeek}/${quota.weeklyCampaignCap} campaigns this week`}
                  </p>
                </div>
              </div>
              <a
                href="/upgrade"
                className="inline-flex items-center gap-2 text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl transition-colors self-start"
              >
                <Zap size={16} /> Buy 1,000 more — ₦2,000
              </a>
            </div>

            {quota.allowed === false && quota.message && (
              <div className="mt-4 flex gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg p-3">
                <Info size={16} className="shrink-0 mt-0.5" />
                <span>{quota.message}</span>
              </div>
            )}
          </Card>
        )}

        {tab === 'compose' ? (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mt-6">
            {/* Composer */}
            <div className="xl:col-span-3 space-y-5">
              <Card className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    Subject line
                  </label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="A short, honest description of what's inside"
                    maxLength={150}
                    className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all font-medium"
                  />
                  <p className={`text-xs mt-1 ${subject.length > 60 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                    {subject.length} characters{subject.length > 60 ? ' — most inboxes truncate around 60' : ''}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    Preview text
                  </label>
                  <input
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    placeholder="The line shown after the subject in the inbox"
                    maxLength={160}
                    className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    Content
                  </label>
                  <RichTextEditor
                    value={contentHtml}
                    onChange={setContentHtml}
                    onUploadImage={uploadImage}
                    placeholder="Write your message. Keep it short, specific and genuinely useful."
                    disabled={isSending}
                  />
                </div>
              </Card>

              {/* Proofread */}
              <Card className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4">
                  <div>
                    <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <ShieldCheck size={18} className="text-purple-600" />
                      Pre-send check
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      Catches the things that get campaigns filtered or blocked.
                    </p>
                  </div>
                  <button
                    onClick={runProofread}
                    disabled={isChecking || !contentHtml.trim() || !subject.trim()}
                    className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-2 text-sm font-medium border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 px-4 py-2.5 rounded-xl disabled:opacity-50 transition-colors"
                  >
                    {isChecking ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {isChecking ? 'Checking…' : 'Check campaign'}
                  </button>
                </div>

                {!report && liveLint.blocking.length === 0 && liveLint.warnings.length === 0 && (
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Nothing obvious so far. Run a full check before sending — it also looks at
                    tone and whether your subject matches the body.
                  </p>
                )}

                {/*
                  Live findings, shown before the server check has run. Same
                  rules, so there are no surprises when the real check happens.
                */}
                {!report && (liveLint.blocking.length > 0 || liveLint.warnings.length > 0) && (
                  <div className="space-y-3">
                    {liveLint.blocking.map((f) => (
                      <div key={f.code + f.message} className="flex gap-2 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40 rounded-lg p-3">
                        <XCircle size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">{f.message}</p>
                          {f.hint && <p className="opacity-80 mt-0.5">{f.hint}</p>}
                        </div>
                      </div>
                    ))}
                    {liveLint.warnings.map((f) => (
                      <div key={f.code + f.message} className="flex gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg p-3">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">{f.message}</p>
                          {f.hint && <p className="opacity-80 mt-0.5">{f.hint}</p>}
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-slate-400">
                      Run the full check for tone and subject-line review as well.
                    </p>
                  </div>
                )}

                {report && (
                  <div className="space-y-3">
                    {report.blocking.length === 0 && report.warnings.length === 0 && (
                      <div className="flex gap-2 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/40 rounded-lg p-3">
                        <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                        <span>No issues found. This looks ready to send.</span>
                      </div>
                    )}

                    {report.blocking.map((f) => (
                      <div key={f.code + f.message} className="flex gap-2 text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40 rounded-lg p-3">
                        <XCircle size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">{f.message}</p>
                          {f.hint && <p className="opacity-80 mt-0.5">{f.hint}</p>}
                        </div>
                      </div>
                    ))}

                    {report.warnings.map((f) => (
                      <div key={f.code + f.message} className="flex gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-lg p-3">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium">{f.message}</p>
                          {f.hint && <p className="opacity-80 mt-0.5">{f.hint}</p>}
                        </div>
                      </div>
                    ))}

                    {report.aiSummary && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 italic pt-1">
                        {report.aiSummary}
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {/* Recipients + preview */}
            <div className="xl:col-span-2 space-y-5">
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-slate-900 dark:text-white">
                    Recipients
                    <span className="ml-2 text-sm font-normal text-slate-500">
                      {mailableSelected.length} selected
                    </span>
                  </h2>
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => setSelectedClients(new Set(clients.map((c) => c.localId)))}
                      className="text-purple-600 hover:underline"
                    >
                      All
                    </button>
                    <button
                      onClick={() => setSelectedClients(new Set())}
                      className="text-slate-500 hover:underline"
                    >
                      None
                    </button>
                  </div>
                </div>

                <div className="relative mb-3">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search clients"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>

                <div className="max-h-[320px] overflow-y-auto -mx-1 px-1 space-y-1">
                  {filteredClients.length === 0 && (
                    <p className="text-sm text-slate-400 py-6 text-center">No clients match that search.</p>
                  )}
                  {filteredClients.map((c) => {
                    const isSelected = selectedClients.has(c.localId);
                    const email = c.email?.toLowerCase();
                    const isSuppressed = Boolean(email && suppressed.has(email));
                    const hasNoEmail = !c.email;

                    return (
                      <button
                        key={c.localId}
                        onClick={() => {
                          const next = new Set(selectedClients);
                          if (next.has(c.localId)) next.delete(c.localId);
                          else next.add(c.localId);
                          setSelectedClients(next);
                        }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare size={18} className="text-purple-600 shrink-0" />
                        ) : (
                          <Square size={18} className="text-slate-300 dark:text-slate-600 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                            {c.name}
                          </span>
                          <span className="block text-xs text-slate-400 truncate">
                            {c.email || 'No email address'}
                          </span>
                        </span>
                        {isSuppressed && (
                          <span title="This contact unsubscribed or their address bounced" className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                            <MailX size={11} /> Unsubscribed
                          </span>
                        )}
                        {hasNoEmail && !isSuppressed && (
                          <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            No email
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {skippedSelected.length > 0 && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-2.5">
                    {skippedSelected.length} selected contact{skippedSelected.length === 1 ? '' : 's'} will be
                    skipped — they have no email address or have unsubscribed. Unsubscribes cannot be overridden.
                  </p>
                )}

                {overAllowance && (
                  <p className="mt-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2.5">
                    This selection needs {mailableSelected.length} emails but only {remaining} are available.
                    Deselect some recipients or buy a credit pack.
                  </p>
                )}
              </Card>

              {/* Preview */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-slate-900 dark:text-white">Preview</h2>
                  <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <button
                      onClick={() => setPreviewMode('desktop')}
                      aria-label="Desktop preview"
                      className={`p-1.5 rounded ${previewMode === 'desktop' ? 'bg-white dark:bg-slate-700 text-purple-600' : 'text-slate-500'}`}
                    >
                      <Monitor size={16} />
                    </button>
                    <button
                      onClick={() => setPreviewMode('mobile')}
                      aria-label="Mobile preview"
                      className={`p-1.5 rounded ${previewMode === 'mobile' ? 'bg-white dark:bg-slate-700 text-purple-600' : 'text-slate-500'}`}
                    >
                      <Smartphone size={16} />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-100 dark:bg-slate-950 rounded-xl p-3 overflow-x-auto">
                  <div
                    className={`mx-auto bg-white rounded-lg p-5 transition-all ${
                      previewMode === 'mobile' ? 'max-w-[340px]' : 'max-w-full'
                    }`}
                  >
                    <p className="text-xs text-slate-400 mb-1">
                      From: {businessProfile?.name || 'Your business'}
                    </p>
                    <p className="font-semibold text-slate-900 mb-0.5 break-words">
                      {subject || 'Your subject line'}
                    </p>
                    <p className="text-xs text-slate-500 mb-4 break-words">
                      {previewText || 'Your preview text appears here'}
                    </p>
                    <div
                      className="text-slate-800 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-purple-600 [&_a]:underline [&_p]:mb-2 [&_img]:max-w-full [&_img]:rounded"
                      // Content originates from our own editor and is sanitised
                      // with an email-safe allow-list on every keystroke, and
                      // again server-side before sending.
                      dangerouslySetInnerHTML={{ __html: contentHtml || '<p style="color:#94a3b8">Your content will appear here.</p>' }}
                    />
                    <div className="mt-6 pt-3 border-t border-slate-200 text-center text-[11px] text-slate-400 leading-relaxed">
                      <p>You are receiving this because you are a client of {businessProfile?.name || 'this business'}.</p>
                      <p className="underline">Unsubscribe from these emails</p>
                      <p>Powered by BillReve</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  The unsubscribe link and footer are added automatically to every campaign.
                </p>
              </Card>

              <button
                onClick={handleSend}
                disabled={!canSend}
                className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 px-5 rounded-xl transition-colors"
              >
                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {isSending
                  ? 'Queueing…'
                  : `Send to ${mailableSelected.length} recipient${mailableSelected.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        ) : (
          /* History */
          <Card className="p-3 sm:p-5 mt-6">
            {isLoadingHistory ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 size={24} className="animate-spin mx-auto mb-3" />
                Loading campaigns…
              </div>
            ) : history.length === 0 ? (
              <div className="py-12 text-center">
                <Mail size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="font-medium text-slate-700 dark:text-slate-200">No campaigns yet</p>
                <p className="text-sm text-slate-500 mt-1">Your sent campaigns and their results will appear here.</p>
              </div>
            ) : (
              <div>
                <div className="space-y-3 md:hidden">
                  {history.map((c) => {
                    const canRetry = c.status === 'FAILED' || c.status === 'PARTIAL';
                    return (
                      <article
                        key={c.id}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="min-w-0 font-medium text-slate-800 dark:text-slate-100 break-words">
                            {c.subject}
                          </h3>
                          <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[c.status] || STATUS_STYLES.DRAFT}`}>
                            {c.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3 text-xs">
                          <div>
                            <span className="block text-slate-400 dark:text-slate-500">Sent</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{c.sent_count}/{c.recipient_count}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 dark:text-slate-500">Date</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{formatDate(c.sent_at || c.created_at)}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 dark:text-slate-500">Bounced</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300">{c.bounced_count}</span>
                          </div>
                          <div>
                            <span className="block text-slate-400 dark:text-slate-500">Complaints / unsubs</span>
                            <span className={`font-medium ${c.complained_count > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                              {c.complained_count} / {c.unsubscribed_count}
                            </span>
                          </div>
                        </div>
                        {c.last_error && (
                          <div className="flex gap-2 mt-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40 rounded-lg p-2.5">
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span><span className="font-semibold">Why it failed:</span> {c.last_error}</span>
                          </div>
                        )}
                        {canRetry && (
                          <button
                            onClick={() => handleRetry(c.id)}
                            disabled={retryingId === c.id}
                            className="w-full mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 px-2.5 py-2 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            {retryingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                            Retry failed
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>

                <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3 pr-4 font-semibold">Subject</th>
                      <th className="py-3 pr-4 font-semibold">Status</th>
                      <th className="py-3 pr-4 font-semibold text-right">Sent</th>
                      <th className="py-3 pr-4 font-semibold text-right">Bounced</th>
                      <th className="py-3 pr-4 font-semibold text-right">Complaints</th>
                      <th className="py-3 pr-4 font-semibold text-right">Unsubs</th>
                      <th className="py-3 pr-4 font-semibold">Date</th>
                      <th className="py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((c) => {
                      const canRetry = c.status === 'FAILED' || c.status === 'PARTIAL';
                      return (
                      <React.Fragment key={c.id}>
                      <tr className={`border-b border-slate-100 dark:border-slate-800/60 ${c.last_error ? 'border-b-0' : ''}`}>
                        <td className="py-3 pr-4 font-medium text-slate-800 dark:text-slate-100 max-w-[240px] truncate">
                          {c.subject}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_STYLES[c.status] || STATUS_STYLES.DRAFT}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right text-slate-700 dark:text-slate-300">
                          {c.sent_count}/{c.recipient_count}
                        </td>
                        <td className="py-3 pr-4 text-right text-slate-700 dark:text-slate-300">{c.bounced_count}</td>
                        <td className={`py-3 pr-4 text-right ${c.complained_count > 0 ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}>
                          {c.complained_count}
                        </td>
                        <td className="py-3 pr-4 text-right text-slate-700 dark:text-slate-300">{c.unsubscribed_count}</td>
                        <td className="py-3 pr-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(c.sent_at || c.created_at)}
                        </td>
                        <td className="py-3 text-right">
                          {canRetry ? (
                            <button
                              onClick={() => handleRetry(c.id)}
                              disabled={retryingId === c.id}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 px-2.5 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                            >
                              {retryingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                              Retry failed
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                      {c.last_error && (
                        <tr className="border-b border-slate-100 dark:border-slate-800/60">
                          <td colSpan={8} className="pb-3 px-1">
                            <div className="flex gap-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-900/40 rounded-lg p-2.5">
                              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                              <span><span className="font-semibold">Why it failed:</span> {c.last_error}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <p className="text-xs text-slate-400 mt-4">
                  A complaint rate above 0.3% puts your delivery at risk. If complaints appear here, send less
                  often and only to clients who expect to hear from you.
                </p>
              </div>
            )}
          </Card>
        )}
      </ProFeature>
    </div>
  );
};

export default Campaigns;
