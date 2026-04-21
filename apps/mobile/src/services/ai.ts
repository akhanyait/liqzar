import { supabase } from "../lib/supabase";

interface SommelierMessage {
  role: "user" | "assistant";
  content: string;
  products?: Array<{
    id: string;
    name: string;
    price: number;
    category: string;
  }>;
}

const PRODUCT_RECOMMENDATIONS: Record<
  string,
  { response: string; search: string }
> = {
  whisky: {
    response:
      "For whisky lovers, I'd recommend exploring our single malts. Glenfiddich 12 Year Old is a classic choice with notes of pear and butterscotch — perfect for sipping neat. If you prefer something bolder, try Johnnie Walker Black Label which offers rich, smoky complexity.",
    search: "whisky",
  },
  whiskey: {
    response:
      "Great choice! Our bourbon selection features excellent options. Jack Daniel's Old No. 7 is an iconic Tennessee whiskey with notes of vanilla and caramel. For Irish whiskey, Jameson is smooth and triple-distilled.",
    search: "whiskey",
  },
  wine: {
    response:
      "For wine enthusiasts, I'd suggest a full-bodied Cabernet Sauvignon for red meat pairings, or a crisp Sauvignon Blanc for seafood. Our South African wines from Stellenbosch are particularly excellent value.",
    search: "wine",
  },
  vodka: {
    response:
      "For premium vodka, Absolut and Grey Goose are outstanding choices. Grey Goose is distilled from French wheat and has an exceptionally smooth finish — perfect for martinis or sipping chilled.",
    search: "vodka",
  },
  gin: {
    response:
      "Gin is having a renaissance! Bombay Sapphire offers classic juniper-forward flavour, while Hendrick's brings a unique cucumber and rose petal twist. Both make excellent G&Ts.",
    search: "gin",
  },
  beer: {
    response:
      "Our beer selection ranges from crisp lagers to craft ales. For something local, try a Windhoek or Castle Lager. For craft lovers, we have excellent IPAs and stouts.",
    search: "beer",
  },
  champagne: {
    response:
      "For celebrations, Moët & Chandon Impérial is a timeless choice. If you're looking for exceptional value, our selection of South African MCC (Méthode Cap Classique) sparkling wines rivals French champagne.",
    search: "champagne",
  },
  pair: {
    response:
      "Food pairing is an art! Red meats pair beautifully with Cabernet Sauvignon or a peaty Scotch. Seafood loves Sauvignon Blanc or a light gin cocktail. For cheese boards, try a Port or aged whisky. Chocolate desserts? A smooth rum or cream liqueur is perfect.",
    search: "",
  },
  budget: {
    response:
      "Great spirits don't have to break the bank! Our value picks include Jameson Irish Whiskey, Absolut Vodka, and Gordon's London Dry Gin — all offer excellent quality at accessible prices. Check our Happy Hour deals for even better savings!",
    search: "vodka",
  },
  recommend: {
    response:
      "Based on current trends, I'd suggest: 1) A Japanese whisky like Suntory Toki for something unique, 2) Hendrick's Gin for a refined G&T, or 3) Moët Champagne if you're celebrating. What's the occasion?",
    search: "whisky",
  },
};

const DEFAULT_RESPONSE: SommelierMessage = {
  role: "assistant",
  content:
    "I'm your AI Sommelier, here to help you discover the perfect spirit! Ask me about wine pairings, whisky recommendations, cocktail ideas, or anything about our premium selection. What are you in the mood for?",
};

export async function getSommelierResponse(
  userMessage: string,
): Promise<SommelierMessage> {
  const lower = userMessage.toLowerCase();

  // Find matching recommendation
  for (const [keyword, rec] of Object.entries(PRODUCT_RECOMMENDATIONS)) {
    if (lower.includes(keyword)) {
      let products: SommelierMessage["products"] = undefined;

      if (rec.search) {
        try {
          const { data } = await supabase
            .from("products")
            .select("id, name, price, category")
            .ilike("category", `%${rec.search}%`)
            .eq("in_stock", true)
            .limit(3);
          if (data && data.length > 0) {
            products = data;
          }
        } catch {
          // Ignore fetch errors
        }
      }

      return { role: "assistant", content: rec.response, products };
    }
  }

  return { ...DEFAULT_RESPONSE };
}

export const SUGGESTED_PROMPTS = [
  "Best whisky under R500?",
  "Wine for date night",
  "What pairs with steak?",
  "Top trending spirits",
  "Recommend a gin",
  "Budget-friendly options",
];
