import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  /**
   * Set on pages that must never be indexed — chiefly the 404 page. Without
   * this, the SPA returns HTTP 200 for unknown URLs (vercel.json rewrites
   * everything to `/`), so Google saw a 200 with no content and classified
   * billreve.app as a soft 404.
   */
  noindex?: boolean;
  /** Canonical URL. Defaults to `url`. */
  canonical?: string;
}

export const SEO: React.FC<SEOProps> = ({
  title,
  description = "BillReve is the modern, AI-powered invoicing and billing platform for freelancers and agencies. Create smart quotes, track payments, and automate your finances.",
  image = "https://billreve.app/og-thumbnail.png",
  url = "https://billreve.app",
  noindex = false,
  canonical,
}) => {
  const fullTitle = `${title} | BillReve`;

  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical || url} />
      {noindex && <meta name="robots" content="noindex, follow" />}

      {/* OpenGraph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />
    </Helmet>
  );
};
