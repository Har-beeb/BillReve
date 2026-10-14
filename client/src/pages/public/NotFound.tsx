import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { SEO } from '../../components/SEO';

/**
 * 404 page.
 *
 * WHY THIS EXISTS: `vercel.json` rewrites `/(.*)` to `/` so the SPA can handle
 * routing, but `App.tsx` had no catch-all route. Any unknown URL therefore
 * returned HTTP 200 with an empty `<div id="root">` — content-free but
 * "successful". That is exactly the condition Google Search Console reports as
 * a **soft 404**, and it was blocking billreve.app from being indexed.
 *
 * A real page with real content, explicitly marked `noindex, follow`, gives the
 * crawler an unambiguous signal: this URL is not a page worth indexing, but the
 * links on it are worth following.
 */
const NotFound: React.FC = () => {
  return (
    <>
      <SEO
        title="Page Not Found"
        description="The page you are looking for does not exist or has been moved."
        noindex
      />
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-6">
            <FileQuestion size={32} />
          </div>

          <p className="text-sm font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2">
            Error 404
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">
            We couldn&rsquo;t find that page
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-8">
            The link may be broken, or the page may have been moved. If you followed a
            payment or quote link, please check with the business that sent it to you.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-5 rounded-xl transition-colors"
            >
              <ArrowLeft size={18} />
              Back to BillReve
            </Link>
            <Link
              to="/documentation"
              className="inline-flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium py-3 px-5 rounded-xl transition-colors"
            >
              Read the documentation
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotFound;
