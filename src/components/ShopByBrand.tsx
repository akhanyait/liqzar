import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import johnnieWalkerImg from "@/assets/brands/johnnie-walker.png";
import hennessyImg from "@/assets/brands/hennessy.png";
import jackDanielsImg from "@/assets/brands/jack-daniels.png";
import glenfiddichImg from "@/assets/brands/glenfiddich.png";
import absolutImg from "@/assets/brands/absolut.png";
import bombaySapphireImg from "@/assets/brands/bombay-sapphire.png";
import patronImg from "@/assets/brands/patron.png";
import bacardiImg from "@/assets/brands/bacardi.png";
import moetImg from "@/assets/brands/moet.png";
import macallanImg from "@/assets/brands/macallan.png";
import greyGooseImg from "@/assets/brands/grey-goose.png";
import chivasRegalImg from "@/assets/brands/chivas-regal.png";

const brands = [
  { name: "Johnnie Walker", slug: "Johnnie Walker", image: johnnieWalkerImg },
  { name: "Hennessy", slug: "Hennessy", image: hennessyImg },
  { name: "Jack Daniel's", slug: "Jack Daniel's", image: jackDanielsImg },
  { name: "Glenfiddich", slug: "Glenfiddich", image: glenfiddichImg },
  { name: "Absolut", slug: "Absolut", image: absolutImg },
  { name: "Bombay Sapphire", slug: "Bombay Sapphire", image: bombaySapphireImg },
  { name: "Patrón", slug: "Patron", image: patronImg },
  { name: "Bacardi", slug: "Bacardi", image: bacardiImg },
  { name: "Moët & Chandon", slug: "Moët", image: moetImg },
  { name: "Macallan", slug: "Macallan", image: macallanImg },
  { name: "Grey Goose", slug: "Grey Goose", image: greyGooseImg },
  { name: "Chivas Regal", slug: "Chivas Regal", image: chivasRegalImg },
];

const ShopByBrand = () => {
  return (
    <section className="container px-4 mt-14 min-h-[260px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">Shop by Brand</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Explore your favourite labels</p>
        </div>
        <Link
          to="/catalogue"
          className="text-sm font-semibold text-gold-text flex items-center gap-1 hover:gap-2 transition-all"
        >
          All Brands <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {brands.map((brand, i) => (
          <motion.div
            key={brand.name}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.03 }}
          >
            <Link
              to={`/catalogue?search=${encodeURIComponent(brand.slug)}`}
              className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-300"
            >
              <div className="w-20 h-24 md:w-24 md:h-28 flex items-center justify-center">
                <img
                  src={brand.image}
                  alt={brand.name}
                  className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>
              <span className="text-[11px] md:text-xs font-semibold text-foreground text-center leading-tight">
                {brand.name}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

export default ShopByBrand;
