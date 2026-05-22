import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { EDITORIAL_ARTICLES } from "@/data/editorial";
import BackButton from "@/components/BackButton";
import { SEO } from "@/components/seo/SEO";

/**
 * EditorialPage — story-led content hub for premium customers.
 * Grid-of-cards layout, one featured hero, rest in a 3-col responsive grid.
 * Every card deep-links to /editorial/:slug; hero also doubles as brand prop.
 */
const EditorialPage = () => {
  const [featured, ...rest] = EDITORIAL_ARTICLES;

  return (
    <div className="pb-28 bg-background overflow-x-hidden">
      <SEO
        title="The LIQZAR Journal — Whisky, Wine & Spirits Editorial"
        description="Long-form journalism for premium spirits collectors. Reviews, tasting notes, history, and culture of whisky, wine, champagne, and rare bottles in South Africa."
        path="/editorial"
        keywords="whisky reviews South Africa, wine editorial, spirits journalism, premium liquor magazine, LIQZAR Journal"
      />

      {/* Hero header — editorial kicker */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="container px-4 py-10 md:py-14">
          <div className="flex items-center gap-3 mb-3">
            <BackButton />
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] font-semibold text-primary">
              <BookOpen className="w-3.5 h-3.5" />
              Sip Stories
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-display font-bold text-foreground leading-tight max-w-2xl">
            The LIQZAR Editorial
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-3 max-w-xl">
            Heritage, craft, pairings, and the quiet rituals behind the finest
            pours. Written for the curious collector and the thoughtful host.
          </p>
        </div>
      </section>

      {/* Featured article — full-bleed image card */}
      <section className="container px-4 mt-8 md:mt-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link
            to={`/editorial/${featured.slug}`}
            className="group block relative rounded-3xl overflow-hidden border border-border/60 bg-card premium-shadow"
          >
            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] min-h-[320px] md:min-h-[420px]">
              <div className="relative overflow-hidden">
                <img
                  src={featured.heroImage}
                  alt={featured.title}
                  loading="eager"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent md:bg-gradient-to-r md:from-black/50 md:via-transparent md:to-transparent" />
                <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest shadow-sm">
                  Featured
                </span>
              </div>
              <div className="relative p-6 md:p-10 flex flex-col justify-center">
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary mb-2">
                  {featured.category}
                </span>
                <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                  {featured.title}
                </h2>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed line-clamp-4">
                  {featured.dek}
                </p>
                <div className="flex items-center gap-3 mt-5 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {featured.author.name}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {featured.readMinutes} min read
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
                  Read the feature
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </Link>
        </motion.div>
      </section>

      {/* Remaining articles grid */}
      <section className="container px-4 mt-12">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg md:text-xl font-display font-bold text-foreground">
            More from the Editorial
          </h3>
          <span className="text-xs text-muted-foreground">
            {rest.length} stories
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {rest.map((article, i) => (
            <motion.article
              key={article.slug}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
            >
              <Link
                to={`/editorial/${article.slug}`}
                className="group block rounded-2xl overflow-hidden border border-border/60 bg-card hover:border-primary/40 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 h-full"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <img
                    src={article.heroImage}
                    alt={article.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <span className="absolute top-3 left-3 inline-block px-2 py-0.5 rounded-full bg-card/95 backdrop-blur-sm text-[10px] font-bold uppercase tracking-widest text-primary">
                    {article.category}
                  </span>
                </div>
                <div className="p-5">
                  <h4 className="text-base md:text-lg font-display font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {article.title}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-3">
                    {article.dek}
                  </p>
                  <div className="flex items-center gap-2.5 mt-4 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground/80">
                      {article.author.name}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {article.readMinutes} min
                    </span>
                  </div>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default EditorialPage;
