/**
 * Application monitoring and analytics.
 *
 * Previously this file was a stub: every init call was commented out, neither
 * SDK was imported, and it logged "Sentry initialized." while initialising
 * nothing — so production had zero telemetry despite both packages being
 * installed. That is why two consecutive audits found critical bugs that had
 * been live and invisible.
 *
 * Both SDKs are loaded via dynamic import so they are code-split out of the
 * main bundle and only fetched when the corresponding key is configured. That
 * matters for an offline-first PWA where first paint is the point.
 *
 * Required env vars (see .env.example):
 *   VITE_SENTRY_DSN   - enables error reporting
 *   VITE_POSTHOG_KEY  - enables product analytics
 *   VITE_POSTHOG_HOST - optional, defaults to PostHog cloud
 * If a key is absent that tool stays off, which is the correct behaviour for
 * local development and for forks.
 */

type SentryModule = typeof import('@sentry/react');

let sentry: SentryModule | null = null;
let posthogReady = false;

/** True once Sentry has actually been initialised, not merely imported. */
export const isErrorReportingEnabled = () => sentry !== null;

export const initMonitoring = async () => {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  const postHogKey = import.meta.env.VITE_POSTHOG_KEY;

  // Keep development noise out of production dashboards, but do not pretend to
  // have initialised anything.
  if (import.meta.env.DEV) {
    console.info('[monitoring] Development build — telemetry disabled.');
    return;
  }

  if (sentryDsn) {
    try {
      const Sentry = await import('@sentry/react');
      Sentry.init({
        dsn: sentryDsn,
        // v8+ integration API. The older `new Sentry.BrowserTracing()` form
        // was removed and would throw on @sentry/react 11.
        integrations: [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
        ],
        release: import.meta.env.VITE_APP_VERSION,
        // Financial data: sample conservatively and never record input values.
        tracesSampleRate: 0.2,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1.0,
        beforeSend(event) {
          // Public invoice and quote URLs contain a document id that acts as a
          // bearer token. Strip it so it never lands in an error report.
          if (event.request?.url) {
            event.request.url = event.request.url.replace(
              /\/(invoice|quote)\/[^/?#]+/gi,
              '/$1/[redacted]'
            );
          }
          return event;
        },
      });
      sentry = Sentry;
    } catch (err) {
      console.error('[monitoring] Sentry failed to initialise:', err);
    }
  }

  if (postHogKey) {
    try {
      const { default: posthog } = await import('posthog-js');
      posthog.init(postHogKey, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
        capture_pageview: true,
        autocapture: false,
        persistence: 'localStorage',
        // Do not ship the contents of financial documents to an analytics tool.
        mask_all_text: true,
        mask_all_element_attributes: true,
      });
      posthogReady = true;
    } catch (err) {
      console.error('[monitoring] PostHog failed to initialise:', err);
    }
  }
};

/**
 * Report a caught error. Safe to call unconditionally — it degrades to a
 * console error when Sentry is not configured.
 */
export const captureError = (error: unknown, context?: Record<string, unknown>) => {
  if (sentry) {
    sentry.captureException(error, context ? { extra: context } : undefined);
  } else {
    console.error('[monitoring] captureError:', error, context ?? '');
  }
};

/** Record a product event. No-ops when PostHog is not configured. */
export const trackEvent = async (event: string, properties?: Record<string, unknown>) => {
  if (!posthogReady) return;
  try {
    const { default: posthog } = await import('posthog-js');
    posthog.capture(event, properties);
  } catch {
    /* analytics must never break the app */
  }
};

/** Associate subsequent telemetry with the signed-in user. */
export const identifyUser = async (userId: string, organizationId?: string) => {
  if (sentry) {
    sentry.setUser({ id: userId });
  }
  if (posthogReady) {
    try {
      const { default: posthog } = await import('posthog-js');
      posthog.identify(userId, organizationId ? { organization_id: organizationId } : undefined);
    } catch {
      /* ignore */
    }
  }
};

/** Clear identity on logout so sessions are not conflated. */
export const resetUser = async () => {
  if (sentry) {
    sentry.setUser(null);
  }
  if (posthogReady) {
    try {
      const { default: posthog } = await import('posthog-js');
      posthog.reset();
    } catch {
      /* ignore */
    }
  }
};
