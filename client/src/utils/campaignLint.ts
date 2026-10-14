/**
 * Deterministic campaign lint rules.
 *
 * ---------------------------------------------------------------------------
 * THIS IS A MIRROR, NOT THE GATE.
 * ---------------------------------------------------------------------------
 * `server/supabase/functions/campaign-proofread/index.ts` holds the
 * authoritative copy of these rules, and `queue_campaign` independently
 * refuses any payload with a non-empty `blocking` array. This client copy
 * exists so the composer can show problems *as the user types* instead of only
 * when they press "Check campaign" — a lint that runs late is a lint people
 * learn to ignore.
 *
 * Edge Functions run on Deno and cannot import from the Vite bundle, and
 * `tsconfig.app.json` only includes `src`, so a single shared file is not
 * possible without restructuring both builds. The duplication is deliberate
 * and follows the same pattern as `money.ts` / `_shared/money.ts`.
 *
 * **If you change a rule here, change it there too.** The server copy is what
 * actually decides whether mail goes out.
 * ---------------------------------------------------------------------------
 */

export interface LintFinding {
  code: string;
  message: string;
  hint?: string;
}

export interface LintResult {
  blocking: LintFinding[];
  warnings: LintFinding[];
}

/** Hosts commonly used to obscure a destination. A redirector in bulk mail is a strong spam signal. */
export const SHORTENER_HOSTS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'rebrand.ly', 'cutt.ly', 'shorturl.at', 'rb.gy', 'tiny.cc',
];

/** Phrases that reliably correlate with spam folder placement. */
export const SPAM_PHRASES = [
  'act now', 'apply now', 'buy direct', 'call free', 'cash bonus', 'cheap',
  'click here', 'congratulations you', 'credit card offer', 'double your',
  'earn extra cash', 'free access', 'free gift', 'free money', 'get paid',
  'guaranteed', 'instant access', 'limited time only', 'lose weight',
  'lowest price', 'make money fast', 'no catch', 'no credit check',
  'no obligation', 'no strings attached', 'risk free', 'satisfaction guaranteed',
  'urgent', 'winner', 'you have been selected', '100% free', 'crypto',
];

/**
 * Strip HTML to readable text. Mirrors `htmlToPlainText` in
 * `_shared/email.ts`, which generates the plain-text part of every campaign.
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

export const extractAnchors = (html: string): { href: string; text: string }[] => {
  const out: { href: string; text: string }[] = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push({ href: m[1].trim(), text: m[2].replace(/<[^>]+>/g, '').trim() });
  }
  return out;
};

export const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};

export interface LintInput {
  subject: string;
  html: string;
  previewText?: string;
  recipientCount?: number;
}

/**
 * Run the deterministic rules.
 *
 * `blocking` means the campaign cannot be sent. `warnings` are advice.
 */
export const lintCampaign = (input: LintInput): LintResult => {
  const blocking: LintFinding[] = [];
  const warnings: LintFinding[] = [];

  const subject = (input.subject || '').trim();
  const html = input.html || '';
  const recipientCount = input.recipientCount ?? 0;
  const text = htmlToPlainText(html);

  // ---- Blocking ----

  if (!subject) {
    blocking.push({ code: 'NO_SUBJECT', message: 'The campaign has no subject line.' });
  }

  if (text.replace(/\s/g, '').length < 40) {
    blocking.push({
      code: 'TOO_LITTLE_TEXT',
      message: 'There is almost no readable text in this email.',
      hint: 'Image-only emails are filtered aggressively because spam filters cannot read them. Add at least a short paragraph of real text.',
    });
  }

  const anchors = extractAnchors(html);

  for (const a of anchors) {
    if (/^\s*javascript:/i.test(a.href) || /^\s*data:/i.test(a.href)) {
      blocking.push({
        code: 'UNSAFE_LINK',
        message: `A link uses an unsafe scheme: "${a.href.slice(0, 60)}"`,
        hint: 'Only http:// and https:// links can be sent.',
      });
      continue;
    }

    if (a.href && !/^https?:\/\//i.test(a.href) && !a.href.startsWith('#') && !/^mailto:/i.test(a.href)) {
      blocking.push({
        code: 'RELATIVE_LINK',
        message: `"${a.href.slice(0, 60)}" is not a full URL.`,
        hint: 'Links in email must be absolute, starting with https://',
      });
      continue;
    }

    // Link text claiming a different domain than its href is the classic
    // phishing pattern, and filters treat it as such.
    const textHost = hostOf(a.text.startsWith('http') ? a.text : `https://${a.text}`);
    const hrefHost = hostOf(a.href);
    const textLooksLikeDomain = /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/|$)/i.test(a.text);
    if (textLooksLikeDomain && textHost && hrefHost && textHost !== hrefHost) {
      blocking.push({
        code: 'LINK_MISMATCH',
        message: `A link displays "${a.text.slice(0, 40)}" but actually points to ${hrefHost}.`,
        hint: 'This is the signature of a phishing email and will get the message blocked. Make the visible text match the destination, or use plain descriptive text instead.',
      });
    }
  }

  // ---- Warnings ----

  if (subject.length > 78) {
    warnings.push({
      code: 'SUBJECT_TOO_LONG',
      message: `The subject is ${subject.length} characters and will be truncated in most inboxes.`,
      hint: 'Aim for under 60.',
    });
  }

  const letters = subject.replace(/[^A-Za-z]/g, '');
  if (letters.length >= 6 && letters === letters.toUpperCase()) {
    warnings.push({
      code: 'SUBJECT_ALL_CAPS',
      message: 'The subject line is entirely in capitals.',
      hint: 'This is treated as shouting by both readers and spam filters.',
    });
  }

  if ((subject.match(/!/g) || []).length > 1) {
    warnings.push({
      code: 'SUBJECT_EXCLAMATION',
      message: 'The subject contains multiple exclamation marks.',
    });
  }

  if (!input.previewText || !input.previewText.trim()) {
    warnings.push({
      code: 'NO_PREVIEW_TEXT',
      message: 'No preview text is set.',
      hint: 'Inboxes will show the first line of your email instead, which is usually not what you want.',
    });
  }

  for (const a of anchors) {
    const h = hostOf(a.href);
    if (h && SHORTENER_HOSTS.includes(h)) {
      warnings.push({
        code: 'SHORTENED_LINK',
        message: `"${h}" is a link shortener.`,
        hint: 'Shorteners hide the destination and are heavily penalised in bulk mail. Link directly instead.',
      });
    }
  }

  const haystack = `${subject} ${text}`.toLowerCase();
  const hits = SPAM_PHRASES.filter((p) => haystack.includes(p));
  if (hits.length > 0) {
    warnings.push({
      code: 'SPAM_PHRASES',
      message: `Contains phrases filters associate with spam: ${hits.slice(0, 5).join(', ')}${hits.length > 5 ? '…' : ''}`,
      hint: 'Rephrasing these usually improves placement noticeably.',
    });
  }

  const imgCount = (html.match(/<img\b/gi) || []).length;
  if (imgCount > 0 && text.length < 200) {
    warnings.push({
      code: 'IMAGE_HEAVY',
      message: 'This email is mostly images with little text.',
      hint: 'Many clients block images by default, so the message may arrive blank.',
    });
  }

  if (html.includes('<img') && !/<img\b[^>]*\balt\s*=/i.test(html)) {
    warnings.push({
      code: 'IMG_NO_ALT',
      message: 'Images have no alt text.',
      hint: 'Alt text is what recipients see when images are blocked.',
    });
  }

  if (recipientCount > 100) {
    warnings.push({
      code: 'LARGE_SEND',
      message: `This will go to ${recipientCount} recipients.`,
      hint: 'If your sending domain is new, large sends early on hurt reputation. Consider splitting across a few days.',
    });
  }

  return { blocking, warnings };
};

/** Readiness score for display only. Never used to gate a send. */
export const lintScore = (result: LintResult): number =>
  Math.max(0, 100 - result.blocking.length * 40 - result.warnings.length * 6);
