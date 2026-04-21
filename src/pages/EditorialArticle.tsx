import { useParams, Navigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Clock, BookOpen } from "lucide-react";
import BackButton from "@/components/BackButton";
import {
  getEditorialBySlug,
  getRelatedEditorial,
} from "@/data/editorial";

/**
 * EditorialArticle — long-form detail view.
 * Editorial layout: wide hero, centered prose column, pull-quote, related CTA
 * into the catalogue if the article has a relatedSearchTerm, and a
 * "More stories" strip at the bottom.
 */
const EditorialArticle = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getEditorialBySlug(slug) : undefined;

  if (!article) {
    return <Navigate to="/editorial" replace />;
  }

  const related = getRelatedEditorial(article.slug, 3);
  const publishedLabel = new Date(article.publishedAt).toLocaleDateString(
    "en-ZA",
    { year: "numeric", month: "long", day: "numeric" },
  );

  return (
    <article className="pb-28 bg-background overflow-x-hidden">
      {/* Hero */}
      <header className="relative">
        <div className="relative h-[44vh] min-h-[340px] md:h-[60vh] md:min-h-[460px] overflow-hidden">
          <img
            src={article.heroImage}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/30" />
        </div>

        <div className="container px-4 -mt-24 md:-mt-32 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <BackButton />
            <Link
              to="/editorial"
              className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] font-semibold text-primary"
            >
              <BookOpen className="w-3.5 h-3.5" /> Sip Stories
            </Link>
          </div>
          <span className="inline-block px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold uppercase tracking-widest">
            {article.category}
          </span>
          <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground leading-tight mt-3 max-w-3xl">
            {article.title}
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mt-3 max-w-2xl leading-relaxed">
            {article.dek}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {article.author.name}
            </span>
            <span className="text-muted-foreground/80">
              {article.author.role}
            </span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
            <span>{publishedLabel}</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {article.readMinutes} min read
            </span>
          </div>
        </div>
      </header>

      {/* Body */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="container px-4 mt-10 md:mt-14"
      >
        <div className="max-w-2xl mx-auto">
          {article.body.map((paragraph, i) => (
            <p
              key={i}
              className="text-[15px] md:text-[17px] leading-[1.75] text-foreground/90 mb-5 first:first-letter:text-5xl first:first-letter:font-display first:first-letter:font-bold first:first-letter:text-primary first:first-letter:float-left first:first-letter:mr-2 first:first-letter:mt-1 first:first-letter:leading-[0.9]"
            >
              {paragraph}
            </p>
          ))}

          {article.pullQuote && (
            <blockquote className="my-10 pl-6 border-l-[3px] border-primary">
              <p className="text-xl md:text-2xl font-display font-semibold text-foreground leading-snug italic">
                “{article.pullQuote}”
              </p>
            </blockquote>
          )}

          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border/60">
              {article.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-full bg-secondary text-[11px] font-medium text-foreground/75"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Shop CTA — bridges editorial → commerce */}
          {article.relatedSearchTerm && (
            <Link
              to={`/catalogue?search=${encodeURIComponent(article.relatedSearchTerm)}`}
              className="group mt-8 flex items-center justify-between gap-4 p-5 rounded-2xl warm-gradient text-primary-foreground hover:shadow-lg transition-all"
            >
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] font-semibold opacity-90">
                  Continue the story
                </p>
                <p className="text-base md:text-lg font-display font-bold mt-0.5">
                  {article.relatedSearchLabel || "Shop the range"}
                </p>
              </div>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>
      </motion.section>

      {/* More stories */}
      {related.length > 0 && (
        <section className="container px-4 mt-16">
          <div className="max-w-5xl mx-auto">
            <h3 className="text-lg md:text-xl font-display font-bold text-foreground mb-5">
              More Stories
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  to={`/editorial/${r.slug}`}
                  className="group block rounded-2xl overflow-hidden border border-border/60 bg-card hover:border-primary/40 hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
                >
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <img
                      src={r.heroImage}
                      alt={r.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-primary">
                      {r.category}
                    </span>
                    <h4 className="text-sm md:text-base font-display font-bold text-foreground mt-1 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {r.title}
                    </h4>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
};

export default EditorialArticle;
