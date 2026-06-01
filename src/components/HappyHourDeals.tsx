import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Clock, ArrowRight } from "lucide-react";

interface Deal {
  id: string;
  name: string;
  image: string;
  originalPrice: number;
  dealPrice: number;
  endsAt: Date;
}

// Demo deals — in production these would come from the database
const generateDeals = (): Deal[] => {
  const now = new Date();
  return [
    {
      id: "deal-1",
      name: "Jameson Irish Whiskey 750ml",
      image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=300&h=300&fit=crop",
      originalPrice: 349,
      dealPrice: 249,
      endsAt: new Date(now.getTime() + 2 * 60 * 60 * 1000 + 15 * 60 * 1000),
    },
    {
      id: "deal-2",
      name: "Tanqueray Gin 750ml",
      image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=300&h=300&fit=crop",
      originalPrice: 299,
      dealPrice: 199,
      endsAt: new Date(now.getTime() + 1 * 60 * 60 * 1000 + 43 * 60 * 1000),
    },
    {
      id: "deal-3",
      name: "KWV 10 Year Brandy 750ml",
      image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=300&h=300&fit=crop",
      originalPrice: 259,
      dealPrice: 179,
      endsAt: new Date(now.getTime() + 3 * 60 * 60 * 1000 + 22 * 60 * 1000),
    },
    {
      id: "deal-4",
      name: "Moët & Chandon Brut 750ml",
      image: "https://images.unsplash.com/photo-1547595628-c61a29f496f0?w=300&h=300&fit=crop",
      originalPrice: 699,
      dealPrice: 549,
      endsAt: new Date(now.getTime() + 45 * 60 * 1000),
    },
  ];
};

function Countdown({ target }: { target: Date }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const tick = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) { setRemaining("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);

  return <span>{remaining}</span>;
}

export default function HappyHourDeals() {
  const [deals] = useState(generateDeals);

  return (
    <section className="container px-4 mt-12">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg champagne-gradient flex items-center justify-center">
            <Zap className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-display font-bold text-foreground">Happy Hour</h2>
            <p className="text-xs text-muted-foreground">Limited-time flash deals</p>
          </div>
        </div>
        <Link to="/catalogue?sort=deals" className="text-sm font-semibold text-gold-text flex items-center gap-1 hover:gap-2 transition-all">
          All deals <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {deals.map((deal, i) => (
          <motion.div
            key={deal.id}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
          >
            <Link
              to={`/catalogue`}
              className="group block rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="relative aspect-square bg-secondary/50">
                <img src={deal.image} alt={deal.name} className="w-full h-full object-cover" loading="lazy" />
                {/* Discount badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
                  −{Math.round(((deal.originalPrice - deal.dealPrice) / deal.originalPrice) * 100)}%
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-foreground line-clamp-2 mb-2">{deal.name}</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-base font-bold text-gold-text">R{deal.dealPrice}</span>
                  <span className="text-xs text-muted-foreground line-through">R{deal.originalPrice}</span>
                </div>
                <div className="flex items-center gap-1 text-destructive">
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px] font-bold">
                    <Countdown target={deal.endsAt} />
                  </span>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
