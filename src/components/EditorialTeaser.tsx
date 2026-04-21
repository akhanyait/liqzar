import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Clock } from "lucide-react";
import { EDITORIAL_ARTICLES } from "@/data/editorial";

/**
 * EditorialTeaser — homepage strip that funnels into /editorial.
 * Shows the 3 most recent stories as a compact horizontal row on mobile,
 * 3-col grid on desktop. Editorial is the conversion engine for LSM 9-10 —
 * premium buyers purchase the story first, the bottle second.
 */
const EditorialTeaser = () => {
  const featured = EDITORIAL_ARTICLES.slice(0, 3);

  return (
    <section className="container px-4 mt-14">
      <div className="flex items-end justify-between mb-6 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-semibold text-primary mb-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Sip Stories
          </div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground section-title-accent">
            The Editorial
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            Heritage, craft, and the quiet rituals behind the finest pours.
            Long reads for the curious collector.
          </p>
        </div>
        <Link
          to="/editorial"
          className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/8 px-3 py-1.5 rounded-full hover:bg-primary/15 hover:gap-2.5 transition-all flex-shrink-0"
        >
          All Stories <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {featured.map((article, i) => (
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
              <div className="relative aspect-[16/10] md:aspect-[16/9] overflow-hidden">
                <img
                  src={article.heroImage}
                  alt={article.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <span className="absolute top-3 left-3 inline-block px-2 py-0.5 rounded-full bg-card/95 backdrop-blur-sm text-[10px] font-bold uppercase tracking-widest text-primary">
                  {article.category}
                </span>
              </div>
              <div className="p-4">
                <h3 className="text-base md:text-lg font-display font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                  {article.title}
                </h3>
                <p className="text-xs md:text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                  {article.dek}
                </p>
                <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
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

      <div className="sm:hidden mt-4 flex justify-center">
        <Link
          to="/editorial"
          className="text-xs font-semibold text-primary inline-flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full"
        >
          All Stories <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </section>
  );
};

export default EditorialTeaser;
