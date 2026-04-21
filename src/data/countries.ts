/**
 * Curated origin countries for the "Shop by Country" section.
 * Ordered: South Africa first (proudly local) then global heavyweights
 * picked to reflect a diverse world of premium spirits.
 */

export interface OriginCountry {
  id: string;
  name: string;
  flag: string;
  tagline: string;
  heroBrands: string[];
  accent: string;
  searchTerm: string;
  local?: boolean;
}

export const ORIGIN_COUNTRIES: OriginCountry[] = [
  {
    id: "za",
    name: "South Africa",
    flag: "🇿🇦",
    tagline: "Proudly Local",
    heroBrands: ["Amarula", "Inverroche", "Three Ships", "KWV", "Bain's", "Klipdrift"],
    accent: "from-amber-500/20 via-emerald-500/10 to-transparent",
    searchTerm: "Amarula",
    local: true,
  },
  {
    id: "scotland",
    name: "Scotland",
    flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
    tagline: "Highlands & Legacy",
    heroBrands: ["Johnnie Walker", "Glenfiddich", "Macallan", "Chivas Regal"],
    accent: "from-blue-600/20 via-sky-400/10 to-transparent",
    searchTerm: "Scotch",
  },
  {
    id: "ireland",
    name: "Ireland",
    flag: "🇮🇪",
    tagline: "Smooth & Golden",
    heroBrands: ["Jameson", "Tullamore D.E.W.", "Bushmills"],
    accent: "from-emerald-500/20 via-lime-400/10 to-transparent",
    searchTerm: "Jameson",
  },
  {
    id: "japan",
    name: "Japan",
    flag: "🇯🇵",
    tagline: "Craft & Precision",
    heroBrands: ["Yamazaki", "Hibiki", "Nikka", "Suntory"],
    accent: "from-red-500/20 via-rose-300/10 to-transparent",
    searchTerm: "Japanese",
  },
  {
    id: "usa",
    name: "United States",
    flag: "🇺🇸",
    tagline: "Bourbon Country",
    heroBrands: ["Jack Daniel's", "Maker's Mark", "Woodford Reserve", "Jim Beam"],
    accent: "from-red-600/20 via-blue-600/10 to-transparent",
    searchTerm: "Bourbon",
  },
  {
    id: "france",
    name: "France",
    flag: "🇫🇷",
    tagline: "The Art of Cognac",
    heroBrands: ["Hennessy", "Rémy Martin", "Grey Goose", "Moët & Chandon"],
    accent: "from-indigo-600/20 via-rose-400/10 to-transparent",
    searchTerm: "Hennessy",
  },
  {
    id: "mexico",
    name: "Mexico",
    flag: "🇲🇽",
    tagline: "Agave Heritage",
    heroBrands: ["Patrón", "Don Julio", "Casamigos"],
    accent: "from-lime-500/20 via-amber-400/10 to-transparent",
    searchTerm: "Tequila",
  },
  {
    id: "italy",
    name: "Italy",
    flag: "🇮🇹",
    tagline: "La Dolce Vita",
    heroBrands: ["Campari", "Aperol", "Disaronno", "Martini"],
    accent: "from-rose-500/20 via-amber-300/10 to-transparent",
    searchTerm: "Campari",
  },
  {
    id: "caribbean",
    name: "Caribbean",
    flag: "🏝️",
    tagline: "Island Rhythm",
    heroBrands: ["Appleton Estate", "Havana Club", "Bacardí"],
    accent: "from-teal-500/20 via-yellow-400/10 to-transparent",
    searchTerm: "Rum",
  },
  {
    id: "sweden",
    name: "Sweden",
    flag: "🇸🇪",
    tagline: "Pure & Crisp",
    heroBrands: ["Absolut", "Belvedere", "Stolichnaya"],
    accent: "from-blue-500/20 via-yellow-300/10 to-transparent",
    searchTerm: "Absolut",
  },
];
