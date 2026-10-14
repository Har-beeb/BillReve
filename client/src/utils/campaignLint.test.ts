import { describe, it, expect } from 'vitest';
import { lintCampaign, lintScore, htmlToPlainText } from './campaignLint';

/**
 * These rules decide whether a campaign may be sent at all, so they are the
 * part of the campaign system most worth testing. The mirrored copy in
 * `campaign-proofread` is the authoritative gate — if a test here changes,
 * that copy must change with it.
 *
 * A note on what is being protected: the blocking rules exist to stop BillReve
 * being used, deliberately or accidentally, to send phishing. Every merchant
 * shares a sending reputation, so one campaign with a disguised link can get
 * invoice email blocked for everyone.
 */

// A body long enough to clear the minimum-text rule, so each test isolates the
// rule it is actually about.
const BODY = '<p>Hello, this is a genuine update about our services this quarter and what is changing for you.</p>';

interface Overrides {
  subject?: string;
  html?: string;
  previewText?: string;
  recipientCount?: number;
}

// `??` rather than a spread, so an intentional empty string (e.g. clearing
// previewText) is preserved instead of falling back to the default.
const lint = (over: Overrides = {}) =>
  lintCampaign({
    subject: over.subject ?? 'A quarterly update from us',
    html: over.html ?? BODY,
    previewText: over.previewText ?? 'Here is what changed',
    recipientCount: over.recipientCount ?? 10,
  });

const codes = (findings: { code: string }[]) => findings.map((f) => f.code);

describe('campaignLint', () => {
  it('passes a clean, ordinary business email', () => {
    const result = lint();
    expect(result.blocking).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(lintScore(result)).toBe(100);
  });

  describe('blocking rules', () => {
    it('blocks a missing subject', () => {
      expect(codes(lint({ subject: '   ' }).blocking)).toContain('NO_SUBJECT');
    });

    it('blocks an email with almost no readable text', () => {
      // An image with no copy — spam filters cannot read it, so it is filtered.
      const result = lint({ html: '<p><img src="https://cdn.example.com/a.png" alt="promo" /></p>' });
      expect(codes(result.blocking)).toContain('TOO_LITTLE_TEXT');
    });

    it('blocks javascript: and data: link schemes', () => {
      const js = lint({ html: `${BODY}<p><a href="javascript:alert(1)">Click</a></p>` });
      expect(codes(js.blocking)).toContain('UNSAFE_LINK');

      const data = lint({ html: `${BODY}<p><a href="data:text/html,<h1>x</h1>">Click</a></p>` });
      expect(codes(data.blocking)).toContain('UNSAFE_LINK');
    });

    it('blocks relative links, which cannot resolve in an inbox', () => {
      const result = lint({ html: `${BODY}<p><a href="/dashboard">Open</a></p>` });
      expect(codes(result.blocking)).toContain('RELATIVE_LINK');
    });

    it('blocks a link whose visible text claims a different domain than its href', () => {
      // The phishing signature: text says one bank, href goes elsewhere.
      const result = lint({
        html: `${BODY}<p><a href="https://evil-collector.example/login">secure.mybank.com</a></p>`,
      });
      expect(codes(result.blocking)).toContain('LINK_MISMATCH');
    });

    it('allows a link whose text matches its destination', () => {
      const result = lint({
        html: `${BODY}<p><a href="https://billreve.app/pricing">billreve.app/pricing</a></p>`,
      });
      expect(codes(result.blocking)).not.toContain('LINK_MISMATCH');
    });

    it('allows ordinary descriptive link text', () => {
      // "View your invoice" is not a domain, so the mismatch rule must not fire.
      const result = lint({
        html: `${BODY}<p><a href="https://billreve.app/pay/abc">View your invoice</a></p>`,
      });
      expect(result.blocking).toEqual([]);
    });

    it('allows mailto: and in-document anchors', () => {
      const result = lint({
        html: `${BODY}<p><a href="mailto:hi@example.com">Email us</a> <a href="#top">Top</a></p>`,
      });
      expect(result.blocking).toEqual([]);
    });
  });

  describe('warnings', () => {
    it('warns on an over-long subject', () => {
      expect(codes(lint({ subject: 'x'.repeat(90) }).warnings)).toContain('SUBJECT_TOO_LONG');
    });

    it('warns on an all-caps subject', () => {
      expect(codes(lint({ subject: 'URGENT NOTICE INSIDE' }).warnings)).toContain('SUBJECT_ALL_CAPS');
    });

    it('does not treat a short acronym as shouting', () => {
      // Fewer than 6 letters, so "VAT" must not trip the all-caps rule.
      expect(codes(lint({ subject: 'Your VAT' }).warnings)).not.toContain('SUBJECT_ALL_CAPS');
    });

    it('warns on multiple exclamation marks but tolerates one', () => {
      expect(codes(lint({ subject: 'Big news!! Really!!' }).warnings)).toContain('SUBJECT_EXCLAMATION');
      expect(codes(lint({ subject: 'Big news!' }).warnings)).not.toContain('SUBJECT_EXCLAMATION');
    });

    it('warns when preview text is missing', () => {
      expect(codes(lint({ previewText: '' }).warnings)).toContain('NO_PREVIEW_TEXT');
    });

    it('warns on link shorteners, which hide the destination', () => {
      const result = lint({ html: `${BODY}<p><a href="https://bit.ly/3xYz">Read more</a></p>` });
      expect(codes(result.warnings)).toContain('SHORTENED_LINK');
    });

    it('warns on known spam phrasing', () => {
      const result = lint({ subject: 'Act now for a risk free guaranteed offer' });
      expect(codes(result.warnings)).toContain('SPAM_PHRASES');
    });

    it('warns when images carry no alt text', () => {
      const result = lint({
        html: `${BODY}<p>${'More real copy to clear the text minimum. '.repeat(6)}<img src="https://cdn.example.com/a.png" /></p>`,
      });
      expect(codes(result.warnings)).toContain('IMG_NO_ALT');
    });

    it('warns about a large send, which hurts a young sending domain', () => {
      expect(codes(lint({ recipientCount: 500 }).warnings)).toContain('LARGE_SEND');
      expect(codes(lint({ recipientCount: 50 }).warnings)).not.toContain('LARGE_SEND');
    });

    it('never lets a warning become a block', () => {
      // Everything questionable at once, but nothing structurally unsendable.
      const result = lint({
        subject: 'ACT NOW GUARANTEED FREE MONEY!! ' + 'x'.repeat(80),
        previewText: '',
        recipientCount: 900,
        html: `${BODY}<p><a href="https://bit.ly/x">Read</a></p>`,
      });
      expect(result.blocking).toEqual([]);
      expect(result.warnings.length).toBeGreaterThan(3);
    });
  });

  describe('lintScore', () => {
    it('is 100 for a clean campaign and lower with findings', () => {
      expect(lintScore({ blocking: [], warnings: [] })).toBe(100);
      expect(lintScore({ blocking: [], warnings: [{ code: 'A', message: 'a' }] })).toBe(94);
      expect(lintScore({ blocking: [{ code: 'B', message: 'b' }], warnings: [] })).toBe(60);
    });

    it('never goes negative', () => {
      const many = Array.from({ length: 10 }, (_, i) => ({ code: `C${i}`, message: 'x' }));
      expect(lintScore({ blocking: many, warnings: many })).toBe(0);
    });
  });

  describe('htmlToPlainText', () => {
    it('produces a readable text alternative', () => {
      // An HTML-only bulk email is a strong spam signal, so this output is
      // actually sent as the text part of every campaign.
      const text = htmlToPlainText('<h2>Hi</h2><p>One</p><ul><li>Two</li></ul>');
      expect(text).toContain('Hi');
      expect(text).toContain('One');
      expect(text).toContain('• Two');
      expect(text).not.toContain('<');
    });

    it('keeps link destinations visible', () => {
      const text = htmlToPlainText('<p><a href="https://billreve.app">Our site</a></p>');
      expect(text).toContain('Our site (https://billreve.app)');
    });

    it('strips script and style blocks entirely', () => {
      const text = htmlToPlainText('<style>p{color:red}</style><script>alert(1)</script><p>Safe</p>');
      expect(text).toBe('Safe');
    });

    it('decodes the entities the editor emits', () => {
      expect(htmlToPlainText('<p>Tom &amp; Jerry &quot;quoted&quot;</p>')).toBe('Tom & Jerry "quoted"');
    });
  });
});
