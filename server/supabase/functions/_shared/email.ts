/**
 * Shared email presentation for all BillReve Edge Functions.
 *
 * Three functions send mail — `send-email`, `email-cron` and `email-worker` —
 * and each previously hardcoded its own `from` header and had no footer. That
 * meant client-facing mail arrived as "BillReve <noreply@billreve.app>" rather
 * than from the business the client actually hired, and nothing carried the
 * "Powered by BillReve" attribution.
 *
 * Put both here so a new sending path cannot forget them.
 */

export const SENDER_ADDRESS = 'noreply@billreve.app';
export const DEFAULT_SENDER_NAME = 'BillReve';

/**
 * Marketing mail sends from a SEPARATE subdomain with its own SPF/DKIM/DMARC.
 *
 * This is the single most important deliverability decision in the product.
 * Campaigns are inherently complaint-prone; invoices are what customers
 * actually depend on receiving. If both share a domain, one merchant's badly
 * received campaign degrades INVOICE delivery for every other merchant on the
 * platform. Separating them means campaign reputation can only ever hurt
 * campaigns.
 *
 * Set CAMPAIGN_SENDER_ADDRESS once the subdomain is verified in Resend. Until
 * then this falls back to the transactional address, so campaigns still work —
 * but the reputations stay coupled, which is the thing to fix.
 */
export const CAMPAIGN_SENDER_ADDRESS =
  Deno.env.get('CAMPAIGN_SENDER_ADDRESS') || SENDER_ADDRESS;

/** True when campaigns are genuinely on their own domain. */
export const campaignDomainIsSeparate = (): boolean =>
  CAMPAIGN_SENDER_ADDRESS !== SENDER_ADDRESS;

/**
 * Build a safe RFC 5322 `From` header using the organization's own name.
 *
 * SECURITY: the display name is attacker-controllable — it is whatever the
 * merchant typed into their business profile. Characters that would terminate
 * or extend the header (quotes, angle brackets, commas, colons, semicolons,
 * CR/LF) are stripped to prevent header injection, which could otherwise be
 * used to add recipients or forge headers. The name is then quoted.
 *
 * @example buildFrom('Acme Studios') -> '"Acme Studios" <noreply@billreve.app>'
 * @example buildFrom(undefined)      -> 'BillReve <noreply@billreve.app>'
 */
export const buildFrom = (orgName?: string | null): string => {
  return buildFromUsing(orgName, SENDER_ADDRESS);
};

/**
 * `From` header for marketing mail, on the campaign subdomain.
 */
export const buildCampaignFrom = (orgName?: string | null): string => {
  return buildFromUsing(orgName, CAMPAIGN_SENDER_ADDRESS);
};

const buildFromUsing = (orgName: string | null | undefined, address: string): string => {
  const cleaned = (orgName ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/["<>,;:\\]/g, '')
    .trim()
    .slice(0, 78); // keep the header comfortably inside line-length limits

  if (!cleaned) return `${DEFAULT_SENDER_NAME} <${address}>`;
  return `"${cleaned}" <${address}>`;
};

/** Minimal HTML escape. Exported because campaign content is user-authored. */
export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Wrap an email body with the standard BillReve footer.
 *
 * Idempotent: if the HTML already contains the footer marker it is returned
 * unchanged, so a caller that pre-wraps (or a double-wrap through two layers)
 * cannot produce two footers.
 */
export const wrapEmailHtml = (
  innerHtml: string,
  options?: { orgName?: string | null }
): string => {
  if (!innerHtml) innerHtml = '<p>Please see the attached document.</p>';
  if (innerHtml.includes('data-billreve-footer')) return innerHtml;

  const orgName = (options?.orgName ?? '').trim();
  const sentBy = orgName
    ? `This email was sent by ${escapeHtml(orgName)} using BillReve.`
    : 'This email was sent using BillReve.';

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;padding:24px 12px;">
  <div style="max-width:600px;margin:0 auto;">
    ${innerHtml}
    <div data-billreve-footer="1" style="margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;line-height:1.6;color:#64748b;">
      <p style="margin:0 0 4px 0;">${sentBy}</p>
      <p style="margin:0;">
        Powered by
        <a href="https://billreve.app" style="color:#7c3aed;text-decoration:none;font-weight:600;">BillReve</a>
        &middot; invoicing that works offline
      </p>
    </div>
  </div>
</div>`;
};

/**
 * Wrap a CAMPAIGN body. Same shell as transactional mail, plus the two things
 * bulk mail legally and practically requires: a visible unsubscribe link and
 * the sender's identity.
 *
 * Gmail and Yahoo's bulk sender rules (effective February 2024) require
 * one-click unsubscribe and a complaint rate under 0.3%. Campaigns previously
 * shipped with no unsubscribe mechanism at all, which is the fastest route to
 * being junked regardless of which ESP is used.
 */
export const wrapCampaignHtml = (
  innerHtml: string,
  options: { orgName?: string | null; unsubscribeUrl: string; orgAddress?: string | null }
): string => {
  const orgName = (options.orgName ?? '').trim();
  const sentBy = orgName
    ? `You are receiving this because you are a client of ${escapeHtml(orgName)}.`
    : 'You are receiving this because you are a client of this business.';

  // A postal address is a CAN-SPAM requirement and a positive trust signal to
  // spam filters. Rendered only when the business has one on file.
  const address = (options.orgAddress ?? '').trim();

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f8fafc;padding:24px 12px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;">
    ${innerHtml}
    <div data-billreve-footer="1" style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;line-height:1.7;color:#64748b;">
      <p style="margin:0 0 6px 0;">${sentBy}</p>
      ${address ? `<p style="margin:0 0 6px 0;">${escapeHtml(address)}</p>` : ''}
      <p style="margin:0 0 6px 0;">
        <a href="${options.unsubscribeUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe from these emails</a>
      </p>
      <p style="margin:0;">
        Powered by
        <a href="https://billreve.app" style="color:#7c3aed;text-decoration:none;font-weight:600;">BillReve</a>
      </p>
    </div>
  </div>
</div>`;
};

/**
 * RFC 8058 one-click unsubscribe headers.
 *
 * Both are required: `List-Unsubscribe-Post` is what makes the mail client show
 * a native "Unsubscribe" button and POST to the URL without the recipient ever
 * leaving their inbox. Supplying only `List-Unsubscribe` does not satisfy
 * Gmail's bulk sender requirements.
 */
export const unsubscribeHeaders = (unsubscribeUrl: string): Record<string, string> => ({
  'List-Unsubscribe': `<${unsubscribeUrl}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
});

/**
 * Plain-text alternative. An HTML-only bulk email is a strong spam signal, so
 * every campaign ships a text part derived from the HTML.
 */
export const htmlToPlainText = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
