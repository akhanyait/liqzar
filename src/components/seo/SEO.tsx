import { Helmet } from "react-helmet-async";

const SITE_URL = "https://liqzar.co.za";
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;
const DEFAULT_TITLE = "LIQZAR — Premium Liquor Delivery Johannesburg | 2-4 Hour Whisky, Wine & Champagne";
const DEFAULT_DESCRIPTION = "South Africa's premium liquor delivery service. Curated whisky, wine, champagne, and rare spirits delivered in 2-4 hours across Johannesburg & Gauteng.";

export interface SEOProps {
  /** Page title — appended with " | LIQZAR" suffix unless `titleAsIs` is true. */
  title?: string;
  /** Use the title exactly as-is (no LIQZAR suffix). For home page. */
  titleAsIs?: boolean;
  description?: string;
  /** Path relative to root (e.g. "/catalogue"). Used for canonical + og:url. */
  path?: string;
  /** Absolute URL or root-relative path. Defaults to brand OG image. */
  image?: string;
  /** Set to true on /auth, /checkout, /admin pages. */
  noindex?: boolean;
  /** Additional JSON-LD structured data (already stringified or as object). */
  structuredData?: object | object[];
  /** Article-specific metadata for editorial pages. */
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
  };
  keywords?: string;
}

export function SEO({
  title,
  titleAsIs = false,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image,
  noindex = false,
  structuredData,
  article,
  keywords,
}: SEOProps) {
  const fullTitle = !title
    ? DEFAULT_TITLE
    : titleAsIs
      ? title
      : `${title} | LIQZAR`;

  const canonicalUrl = `${SITE_URL}${path}`;
  const ogImage = image
    ? image.startsWith("http")
      ? image
      : `${SITE_URL}${image.startsWith("/") ? "" : "/"}${image}`
    : DEFAULT_OG_IMAGE;

  const ldArray = structuredData
    ? Array.isArray(structuredData)
      ? structuredData
      : [structuredData]
    : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonicalUrl} />

      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
      )}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:type" content={article ? "article" : "website"} />
      <meta property="og:site_name" content="LIQZAR" />
      <meta property="og:locale" content="en_ZA" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Article-specific */}
      {article?.publishedTime && <meta property="article:published_time" content={article.publishedTime} />}
      {article?.modifiedTime && <meta property="article:modified_time" content={article.modifiedTime} />}
      {article?.author && <meta property="article:author" content={article.author} />}
      {article?.section && <meta property="article:section" content={article.section} />}
      {article?.tags?.map((tag) => <meta key={tag} property="article:tag" content={tag} />)}

      {/* JSON-LD structured data */}
      {ldArray.map((data, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
}

/* ── Structured-data builders ─────────────────────────────────────────────── */

export function productJsonLd(p: {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  brand?: string;
  category?: string;
  inStock?: boolean;
  sku?: string;
  barcode?: string | null;
  reviewCount?: number;
  averageRating?: number;
}) {
  const url = `${SITE_URL}/product/${p.id}`;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": url,
    name: p.name,
    description: p.description || `${p.name} — premium liquor delivered across Johannesburg by LIQZAR.`,
    image: p.image || DEFAULT_OG_IMAGE,
    sku: p.sku || p.id,
    ...(p.barcode ? { gtin13: p.barcode } : {}),
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    ...(p.category ? { category: p.category } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "ZAR",
      price: p.price.toFixed(2),
      availability: p.inStock !== false ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: "LIQZAR",
      },
    },
    ...(p.reviewCount && p.averageRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: p.averageRating.toFixed(1),
            reviewCount: p.reviewCount,
          },
        }
      : {}),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function articleJsonLd(a: {
  headline: string;
  description?: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  author?: string;
  slug: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.headline,
    description: a.description,
    image: a.image ? (a.image.startsWith("http") ? a.image : `${SITE_URL}${a.image}`) : DEFAULT_OG_IMAGE,
    datePublished: a.datePublished,
    dateModified: a.dateModified || a.datePublished,
    author: { "@type": "Organization", name: a.author || "LIQZAR Editorial" },
    publisher: {
      "@type": "Organization",
      name: "LIQZAR",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/liqzar-logo.png` },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": `${SITE_URL}/editorial/${a.slug}` },
  };
}

export function collectionJsonLd(c: { name: string; description?: string; path: string; itemCount?: number }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: c.name,
    description: c.description,
    url: `${SITE_URL}${c.path}`,
    ...(c.itemCount ? { numberOfItems: c.itemCount } : {}),
  };
}
