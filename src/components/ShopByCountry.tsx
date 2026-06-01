import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Globe2, MapPin } from "lucide-react";
import { ORIGIN_COUNTRIES } from "@/data/countries";

/**
 * ShopByCountry — curated origin tiles celebrating diversity.
 * Horizontal snap-scrolling slider; leads with South Africa (Proudly Local)
 * then global premium picks. Desktop gets arrow buttons; mobile uses native
 * touch-drag. Links to /catalogue?search=<term> via the country's hero brand.
 */
const ShopByCountry = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="container px-4 mt-14">
      <div className="flex items-end justify-between mb-6 gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] font-semibold text-gold-text mb-1.5">
            <Globe2 className="w-3.5 h-3.5" />
            A World of Premium
          </div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground section-title-accent">
            Shop by Country
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
            From Cape Town to Kyoto — iconic spirits from every corner of the world,
            with a special shelf for our proudly South African labels.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => scrollBy("left")}
            aria-label="Scroll countries left"
            className="w-9 h-9 rounded-full bg-card border border-border/60 text-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy("right")}
            aria-label="Scroll countries right"
            className="w-9 h-9 rounded-full bg-card border border-border/60 text-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <Link
            to="/catalogue"
            className="ml-1 text-sm font-semibold text-gold-text inline-flex items-center gap-1.5 hover:gap-2.5 transition-all bg-primary/8 px-3 py-1.5 rounded-full hover:bg-primary/15"
          >
            All Origins <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Edge fade masks hint at "more to the right" on both sides */}
      <div className="relative -mx-4 px-4">
        <div
          ref={scrollerRef}
          className="flex gap-3 md:gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth pb-2"
          style={{ scrollPaddingLeft: "1rem" }}
        >
          {ORIGIN_COUNTRIES.map((country, i) => (
            <motion.div
              key={country.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
              className="snap-start flex-shrink-0 w-[185px] sm:w-[210px] md:w-[230px]"
            >
              <Link
                to={`/catalogue?search=${encodeURIComponent(country.searchTerm)}`}
                className={`group relative flex flex-col h-full min-h-[200px] md:min-h-[220px] p-4 rounded-2xl bg-card border overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                  country.local
                    ? "border-primary/50 shadow-[0_4px_20px_rgba(212,175,55,0.18)]"
                    : "border-border/60 hover:border-primary/40"
                }`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br opacity-80 group-hover:opacity-100 transition-opacity ${country.accent}`}
                  aria-hidden="true"
                />

                {country.local && (
                  <span className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider shadow-sm">
                    <MapPin className="w-2.5 h-2.5" />
                    Local
                  </span>
                )}

                <div className="relative flex flex-col h-full z-[1]">
                  <div className="text-4xl md:text-5xl mb-2 leading-none transition-transform duration-500 group-hover:scale-110 origin-left">
                    {country.flag}
                  </div>
                  <h3 className="text-base md:text-lg font-display font-bold text-foreground leading-tight">
                    {country.name}
                  </h3>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-text mt-0.5">
                    {country.tagline}
                  </p>

                  <div className="mt-auto pt-3 flex flex-wrap gap-1">
                    {country.heroBrands.slice(0, 3).map((brand) => (
                      <span
                        key={brand}
                        className="text-[10px] font-medium text-foreground/75 bg-background/60 backdrop-blur-sm border border-border/50 px-1.5 py-0.5 rounded"
                      >
                        {brand}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}

          {/* Trailing spacer so the last card can snap cleanly */}
          <div className="flex-shrink-0 w-4" aria-hidden="true" />
        </div>

        {/* Right-edge gradient fade — teases more content */}
        <div
          className="pointer-events-none absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent hidden md:block"
          aria-hidden="true"
        />
      </div>

      {/* Mobile-only "See all origins" pill under the slider */}
      <div className="sm:hidden mt-3 flex justify-center">
        <Link
          to="/catalogue"
          className="text-xs font-semibold text-gold-text inline-flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full"
        >
          All Origins <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </section>
  );
};

export default ShopByCountry;
