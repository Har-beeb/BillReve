import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Mail, Send, Loader2, Sparkles, CheckSquare, Square } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { ProFeature } from '../components/ui/ProFeature';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

const Campaigns: React.FC = () => {
  const { businessProfile, isProUser } = useAppStore();
  const clients = useLiveQuery(() => db.clients.filter(c => !c.deletedAt).toArray()) || [];
  
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [title, setTitle] = useState('');
  const [previewText, setPreviewText] = useState('');
  const [content, setContent] = useState('');
  const [ctaText, setCtaText] = useState('');
  const [ctaLink, setCtaLink] = useState('');
  
  const [isSending, setIsSending] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);

  const toggleClientSelection = (clientId: string) => {
    const newSelection = new Set(selectedClients);
    if (newSelection.has(clientId)) {
      newSelection.delete(clientId);
    } else {
      newSelection.add(clientId);
    }
    setSelectedClients(newSelection);
  };

  const selectAll = () => {
    setSelectedClients(new Set(clients.map(c => c.localId)));
  };

  const deselectAll = () => {
    setSelectedClients(new Set());
  };

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClients.size === 0) {
      toast.error('Please select at least one client to send the campaign to.');
      return;
    }
    
    if (!subject || !content) {
      toast.error('Subject and content are required.');
      return;
    }

    setIsSending(true);
    try {
      const selectedClientEmails = clients
        .filter(c => selectedClients.has(c.localId) && c.email)
        .map(c => c.email as string);
        
      if (selectedClientEmails.length === 0) {
        toast.error('None of the selected clients have valid email addresses.');
        setIsSending(false);
        return;
      }

      // 1. Construct HTML for the marketing campaign
      // Convert newlines to <br/> and wrap in a clean template
      const formattedContent = content
        .split('\n')
        .map(line => line.trim() ? `<p style="margin: 0 0 16px 0;">${line}</p>` : '<br/>')
        .join('');
        
      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${title ? `<h1 style="color: #4F46E5; margin-bottom: 20px;">${title}</h1>` : ''}
          <div style="color: #374151; font-size: 16px; line-height: 1.6;">${formattedContent}</div>
          ${ctaText && ctaLink ? `<div style="margin-top: 30px; text-align: center;"><a href="${ctaLink}" style="background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">${ctaText}</a></div>` : ''}
        </div>
      `;

      // 2. Send to Supabase Edge Function
      const { data: result, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: selectedClientEmails,
          subject,
          html: htmlContent
        }
      });

      if (error) throw new Error(error.message);
      if (!result?.success) throw new Error(result?.error?.message || 'Failed to send campaign');

      toast.success(`Campaign sent successfully to ${selectedClientEmails.length} recipients!`);
      // Reset form
      setSubject('');
      setTitle('');
      setPreviewText('');
      setContent('');
      setCtaText('');
      setCtaLink('');
      setSelectedClients(new Set());
    } catch (err: any) {
      console.error('Failed to send campaign:', err);
      toast.error(err.message || 'Failed to send campaign. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleDraftAI = async () => {
    setIsDrafting(true);
    try {
      const response = await supabase.functions.invoke('ai/draft-campaign', {
        body: {
          businessName: businessProfile.name || 'Your Business',
          businessProfile: businessProfile,
          campaignContext: title || subject || 'A general update and newsletter',
        }
      });
      
      if (response.error) throw new Error(response.error.message);
      
      const { data } = response.data;
      
      setContent(data.content);
      if (!subject && data.subject) {
        setSubject(data.subject);
      }
    } catch (err) {
      console.error('Failed to draft email:', err);
      toast.error('Failed to generate draft.');
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="text-purple-600 dark:text-purple-400" /> Campaigns
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Send marketing emails, announcements, and newsletters to your clients.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSendCampaign} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Compose Email</h2>
              <ProFeature isProUser={isProUser} className="inline-block">
                <button
                  type="button"
                  onClick={handleDraftAI}
                  disabled={isDrafting}
                  className="px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium text-sm rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isDrafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Draft with AI
                </button>
              </ProFeature>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Subject <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. Summer Sale, Important Update"
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title (Header)</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Optional prominent heading"
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Preview Text</label>
                  <input
                    type="text"
                    value={previewText}
                    onChange={e => setPreviewText(e.target.value)}
                    placeholder="Text shown in email client previews"
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Message Content <span className="text-red-500">*</span></label>
                <textarea
                  required
                  rows={8}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Write your email content here..."
                  className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                <div className="md:col-span-2">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Call to Action (Optional button)</h3>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Button Text</label>
                  <input
                    type="text"
                    value={ctaText}
                    onChange={e => setCtaText(e.target.value)}
                    placeholder="e.g. View Offer"
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Button Link</label>
                  <input
                    type="url"
                    value={ctaLink}
                    onChange={e => setCtaLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                type="submit"
                disabled={isSending || selectedClients.size === 0}
                className="w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {isSending ? 'Sending Campaign...' : `Send to ${selectedClients.size} Recipients`}
              </button>
            </div>
          </form>
        </div>

        {/* Recipients Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 flex items-center justify-between">
                Recipients 
                <span className="text-xs font-normal px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 rounded-full">
                  {selectedClients.size} selected
                </span>
              </h2>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs font-medium text-purple-600 dark:text-purple-400 hover:underline">Select All</button>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <button onClick={deselectAll} className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline">Clear</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {clients.length === 0 ? (
                <div className="text-center p-6 text-slate-500 text-sm">
                  No clients available. Add clients to send campaigns.
                </div>
              ) : (
                <div className="space-y-1">
                  {clients.map(client => {
                    const isSelected = selectedClients.has(client.localId);
                    const hasEmail = Boolean(client.email);
                    
                    return (
                      <div 
                        key={client.id}
                        onClick={() => hasEmail && toggleClientSelection(client.localId)}
                        className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${hasEmail ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50' : 'opacity-50 cursor-not-allowed'} ${isSelected ? 'bg-purple-50/50 dark:bg-purple-900/20' : ''}`}
                      >
                        <div className={`text-${isSelected ? 'purple-600' : 'slate-300'} dark:text-${isSelected ? 'purple-400' : 'slate-600'}`}>
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{client.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {client.email || 'No email address'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
