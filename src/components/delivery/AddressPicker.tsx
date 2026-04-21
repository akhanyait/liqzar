/**
 * Intelligent Address Picker Component
 * Uber-style address selection with geolocation + Google Places + local fallback
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Search,
  Navigation,
  Clock,
  Star,
  Home,
  Building2,
  X,
  ChevronRight,
  Loader2,
  Locate,
  Plus,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  useGooglePlaces,
  PlacePrediction,
  PlaceDetails,
} from "@/hooks/useGooglePlaces";
import { SA_PROVINCES } from "@/lib/address-intelligence";
// Geolocation is now handled via the browser Geolocation API only.

export interface AddressData {
  fullName?: string;
  phone?: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  coordinates?: { lat: number; lng: number };
  placeId?: string;
  label?: "home" | "work" | "other";
  isRecent?: boolean;
}

interface AddressPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAddress: (address: AddressData) => void;
  currentAddress?: Partial<AddressData>;
}

// Storage keys
const RECENT_ADDRESSES_KEY = "liqzar_recent_addresses";
const SAVED_ADDRESSES_KEY = "liqzar_saved_addresses";
const GEO_PERMISSION_KEY = "liqzar_geo_permission";

// South African suburbs fallback database
const SA_SUBURBS: Array<{
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  coordinates: { lat: number; lng: number };
}> = [
  // Gauteng - Johannesburg
  {
    suburb: "Sandton",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2196",
    coordinates: { lat: -26.1076, lng: 28.0567 },
  },
  {
    suburb: "Rosebank",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2196",
    coordinates: { lat: -26.1454, lng: 28.0436 },
  },
  {
    suburb: "Fourways",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2191",
    coordinates: { lat: -26.0195, lng: 28.0127 },
  },
  {
    suburb: "Bryanston",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2191",
    coordinates: { lat: -26.057, lng: 28.0204 },
  },
  {
    suburb: "Midrand",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1685",
    coordinates: { lat: -25.9889, lng: 28.1267 },
  },
  {
    suburb: "Randburg",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2194",
    coordinates: { lat: -26.0936, lng: 27.9941 },
  },
  {
    suburb: "Roodepoort",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1724",
    coordinates: { lat: -26.1625, lng: 27.8727 },
  },
  {
    suburb: "Bedfordview",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2008",
    coordinates: { lat: -26.183, lng: 28.139 },
  },
  {
    suburb: "Edenvale",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1609",
    coordinates: { lat: -26.1388, lng: 28.1529 },
  },
  {
    suburb: "Kempton Park",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1619",
    coordinates: { lat: -26.1043, lng: 28.2296 },
  },
  {
    suburb: "Boksburg",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1459",
    coordinates: { lat: -26.2128, lng: 28.2564 },
  },
  {
    suburb: "Benoni",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1501",
    coordinates: { lat: -26.1882, lng: 28.321 },
  },
  {
    suburb: "Germiston",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1401",
    coordinates: { lat: -26.2183, lng: 28.1697 },
  },
  {
    suburb: "Alberton",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1449",
    coordinates: { lat: -26.2667, lng: 28.1167 },
  },
  {
    suburb: "Soweto",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1818",
    coordinates: { lat: -26.2485, lng: 27.854 },
  },
  {
    suburb: "Parktown",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2193",
    coordinates: { lat: -26.172, lng: 28.037 },
  },
  {
    suburb: "Melrose",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2196",
    coordinates: { lat: -26.145, lng: 28.068 },
  },
  {
    suburb: "Norwood",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2192",
    coordinates: { lat: -26.153, lng: 28.078 },
  },
  {
    suburb: "Greenside",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2193",
    coordinates: { lat: -26.15, lng: 28.015 },
  },
  {
    suburb: "Parkhurst",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2120",
    coordinates: { lat: -26.139, lng: 28.018 },
  },
  // Gauteng - Pretoria
  {
    suburb: "Centurion",
    city: "Pretoria",
    province: "Gauteng",
    postalCode: "0157",
    coordinates: { lat: -25.8603, lng: 28.1894 },
  },
  {
    suburb: "Menlyn",
    city: "Pretoria",
    province: "Gauteng",
    postalCode: "0181",
    coordinates: { lat: -25.7827, lng: 28.2751 },
  },
  {
    suburb: "Brooklyn",
    city: "Pretoria",
    province: "Gauteng",
    postalCode: "0181",
    coordinates: { lat: -25.7695, lng: 28.2376 },
  },
  {
    suburb: "Hatfield",
    city: "Pretoria",
    province: "Gauteng",
    postalCode: "0083",
    coordinates: { lat: -25.7486, lng: 28.2387 },
  },
  {
    suburb: "Waterkloof",
    city: "Pretoria",
    province: "Gauteng",
    postalCode: "0181",
    coordinates: { lat: -25.79, lng: 28.26 },
  },
  {
    suburb: "Arcadia",
    city: "Pretoria",
    province: "Gauteng",
    postalCode: "0083",
    coordinates: { lat: -25.745, lng: 28.22 },
  },
  {
    suburb: "Sunnyside",
    city: "Pretoria",
    province: "Gauteng",
    postalCode: "0002",
    coordinates: { lat: -25.753, lng: 28.21 },
  },
  // Western Cape
  {
    suburb: "Sea Point",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "8005",
    coordinates: { lat: -33.9152, lng: 18.3853 },
  },
  {
    suburb: "Camps Bay",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "8005",
    coordinates: { lat: -33.951, lng: 18.3777 },
  },
  {
    suburb: "Claremont",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "7708",
    coordinates: { lat: -33.9857, lng: 18.4609 },
  },
  {
    suburb: "Constantia",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "7806",
    coordinates: { lat: -34.0279, lng: 18.4209 },
  },
  {
    suburb: "Bellville",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "7530",
    coordinates: { lat: -33.9017, lng: 18.6289 },
  },
  {
    suburb: "Century City",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "7441",
    coordinates: { lat: -33.8919, lng: 18.5114 },
  },
  {
    suburb: "Green Point",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "8005",
    coordinates: { lat: -33.9033, lng: 18.4067 },
  },
  {
    suburb: "Woodstock",
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "7925",
    coordinates: { lat: -33.9273, lng: 18.4459 },
  },
  {
    suburb: "Stellenbosch",
    city: "Stellenbosch",
    province: "Western Cape",
    postalCode: "7600",
    coordinates: { lat: -33.9321, lng: 18.8602 },
  },
  {
    suburb: "Paarl",
    city: "Paarl",
    province: "Western Cape",
    postalCode: "7646",
    coordinates: { lat: -33.7342, lng: 18.9725 },
  },
  // KwaZulu-Natal
  {
    suburb: "Umhlanga",
    city: "Durban",
    province: "KwaZulu-Natal",
    postalCode: "4320",
    coordinates: { lat: -29.7245, lng: 31.085 },
  },
  {
    suburb: "Berea",
    city: "Durban",
    province: "KwaZulu-Natal",
    postalCode: "4001",
    coordinates: { lat: -29.8522, lng: 31.0119 },
  },
  {
    suburb: "Morningside",
    city: "Durban",
    province: "KwaZulu-Natal",
    postalCode: "4001",
    coordinates: { lat: -29.8261, lng: 31.0088 },
  },
  {
    suburb: "Ballito",
    city: "Durban",
    province: "KwaZulu-Natal",
    postalCode: "4420",
    coordinates: { lat: -29.539, lng: 31.214 },
  },
  {
    suburb: "Westville",
    city: "Durban",
    province: "KwaZulu-Natal",
    postalCode: "3629",
    coordinates: { lat: -29.83, lng: 30.93 },
  },
  {
    suburb: "Hillcrest",
    city: "Durban",
    province: "KwaZulu-Natal",
    postalCode: "3610",
    coordinates: { lat: -29.78, lng: 30.77 },
  },
  {
    suburb: "La Lucia",
    city: "Durban",
    province: "KwaZulu-Natal",
    postalCode: "4051",
    coordinates: { lat: -29.76, lng: 31.05 },
  },
  // Eastern Cape
  {
    suburb: "Summerstrand",
    city: "Port Elizabeth",
    province: "Eastern Cape",
    postalCode: "6001",
    coordinates: { lat: -33.98, lng: 25.66 },
  },
  {
    suburb: "Greenacres",
    city: "Port Elizabeth",
    province: "Eastern Cape",
    postalCode: "6057",
    coordinates: { lat: -33.95, lng: 25.58 },
  },
  // Free State
  {
    suburb: "Westdene",
    city: "Bloemfontein",
    province: "Free State",
    postalCode: "9301",
    coordinates: { lat: -29.12, lng: 26.2 },
  },
  // Mpumalanga
  {
    suburb: "White River",
    city: "White River",
    province: "Mpumalanga",
    postalCode: "1240",
    coordinates: { lat: -25.33, lng: 31.01 },
  },
  {
    suburb: "Nelspruit",
    city: "Mbombela",
    province: "Mpumalanga",
    postalCode: "1200",
    coordinates: { lat: -25.47, lng: 30.97 },
  },
  // Limpopo
  {
    suburb: "Polokwane Central",
    city: "Polokwane",
    province: "Limpopo",
    postalCode: "0700",
    coordinates: { lat: -23.9, lng: 29.45 },
  },
  // North West
  {
    suburb: "Potchefstroom",
    city: "Potchefstroom",
    province: "North West",
    postalCode: "2520",
    coordinates: { lat: -26.715, lng: 27.1 },
  },
  {
    suburb: "Rustenburg",
    city: "Rustenburg",
    province: "North West",
    postalCode: "0299",
    coordinates: { lat: -25.67, lng: 27.24 },
  },
];

/**
 * Search local SA suburbs database
 */
const searchLocalSuburbs = (query: string): AddressData[] => {
  if (!query || query.length < 2) return [];

  const normalizedQuery = query.toLowerCase().trim();
  const results: AddressData[] = [];

  SA_SUBURBS.forEach((suburb) => {
    if (
      suburb.suburb.toLowerCase().includes(normalizedQuery) ||
      suburb.city.toLowerCase().includes(normalizedQuery) ||
      suburb.province.toLowerCase().includes(normalizedQuery)
    ) {
      results.push({
        addressLine1: "",
        addressLine2: "",
        addressLine3: "",
        suburb: suburb.suburb,
        city: suburb.city,
        province: suburb.province,
        postalCode: suburb.postalCode,
        country: "South Africa",
        coordinates: suburb.coordinates,
      });
    }
  });

  return results.slice(0, 8);
};

/**
 * Find nearest suburb based on coordinates
 */
const findNearestSuburb = (lat: number, lng: number): AddressData | null => {
  let nearest: (typeof SA_SUBURBS)[0] | null = null;
  let minDistance = Infinity;

  SA_SUBURBS.forEach((suburb) => {
    const distance = Math.sqrt(
      Math.pow(lat - suburb.coordinates.lat, 2) +
        Math.pow(lng - suburb.coordinates.lng, 2),
    );
    if (distance < minDistance) {
      minDistance = distance;
      nearest = suburb;
    }
  });

  if (nearest && minDistance < 0.5) {
    return {
      addressLine1: "",
      addressLine2: "",
      addressLine3: "",
      suburb: nearest.suburb,
      city: nearest.city,
      province: nearest.province,
      postalCode: nearest.postalCode,
      country: "South Africa",
      coordinates: { lat, lng },
    };
  }

  return null;
};

export const AddressPicker: React.FC<AddressPickerProps> = ({
  isOpen,
  onClose,
  onSelectAddress,
  currentAddress,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [googlePredictions, setGooglePredictions] = useState<PlacePrediction[]>(
    [],
  );
  const [localResults, setLocalResults] = useState<AddressData[]>([]);
  const [recentAddresses, setRecentAddresses] = useState<AddressData[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<AddressData[]>([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [showGeoPrompt, setShowGeoPrompt] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualAddress, setManualAddress] = useState<AddressData>({
    addressLine1: "",
    addressLine2: "",
    addressLine3: "",
    suburb: "",
    city: "",
    province: "",
    postalCode: "",
    country: "South Africa",
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDebounceRef = useRef<NodeJS.Timeout>();

  // Google Places hook
  const {
    isLoaded: googleLoaded,
    error: placesError,
    searchPlaces,
    getPlaceDetails,
    reverseGeocode,
  } = useGooglePlaces();

  // Load saved and recent addresses
  useEffect(() => {
    const recent = localStorage.getItem(RECENT_ADDRESSES_KEY);
    if (recent) {
      try {
        setRecentAddresses(JSON.parse(recent).slice(0, 5));
      } catch (e) {
        console.error("Failed to parse recent addresses:", e);
      }
    }

    const saved = localStorage.getItem(SAVED_ADDRESSES_KEY);
    if (saved) {
      try {
        setSavedAddresses(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved addresses:", e);
      }
    }
  }, []);

  // Show geolocation prompt on open
  useEffect(() => {
    if (isOpen) {
      const geoPermission = localStorage.getItem(GEO_PERMISSION_KEY);
      // Always show geo prompt if no address selected and not previously declined
      if (geoPermission !== "denied" && !currentAddress?.suburb) {
        setShowGeoPrompt(true);
      }
      // Reset states
      setSearchQuery("");
      setGooglePredictions([]);
      setLocalResults([]);
      setGeoError(null);
      setManualEntry(false);
    }
  }, [isOpen, currentAddress]);

  // Search with debounce - use Google Places or local fallback
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (searchQuery.length >= 2) {
      searchDebounceRef.current = setTimeout(async () => {
        // Always search local database
        const local = searchLocalSuburbs(searchQuery);
        setLocalResults(local);

        // Also try Google Places if available
        if (googleLoaded && !placesError) {
          try {
            const results = await searchPlaces(searchQuery);
            setGooglePredictions(results);
          } catch (e) {
            console.error("Google Places search error:", e);
            setGooglePredictions([]);
          }
        }
      }, 300);
    } else {
      setGooglePredictions([]);
      setLocalResults([]);
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, googleLoaded, placesError, searchPlaces]);

  // Request geolocation
  const requestGeolocation = useCallback(async () => {
    setIsLocating(true);
    setGeoError(null);
    setShowGeoPrompt(false);

    // Helper function to process position
    const processPosition = async (latitude: number, longitude: number) => {
      localStorage.setItem(GEO_PERMISSION_KEY, "granted");

      // Try Google reverse geocode first
      if (googleLoaded && !placesError) {
        try {
          const placeDetails = await reverseGeocode(latitude, longitude);
          if (placeDetails) {
            setIsLocating(false);
            const address = convertPlaceToAddress(placeDetails);
            toast({
              title: "Location found",
              description: `${address.suburb}, ${address.city}`,
            });
            handleSelectAddress(address);
            return;
          }
        } catch (e) {
          console.error("Google reverse geocode failed:", e);
        }
      }

      // Fallback to local suburb lookup
      const nearestSuburb = findNearestSuburb(latitude, longitude);
      setIsLocating(false);

      if (nearestSuburb) {
        toast({
          title: "Location found",
          description: `${nearestSuburb.suburb}, ${nearestSuburb.city}`,
        });
        handleSelectAddress(nearestSuburb);
      } else {
        setGeoError(
          "We deliver to limited areas. Please search for your suburb.",
        );
      }
    };

    // Use the browser Geolocation API
    if (!("geolocation" in navigator)) {
      setIsLocating(false);
      setGeoError("Location services not available. Please search for your address.");
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000,
          });
        },
      );

      await processPosition(
        position.coords.latitude,
        position.coords.longitude,
      );
    } catch (browserError: any) {
      console.error("Geolocation error:", browserError);
      setIsLocating(false);
      localStorage.setItem(GEO_PERMISSION_KEY, "denied");

      if (browserError.code === 1) {
        setGeoError(
          "Location access was denied. Please enable location in Settings, or search for your address.",
        );
      } else if (browserError.code === 2) {
        setGeoError("Location unavailable. Please search for your address.");
      } else if (browserError.code === 3) {
        setGeoError("Location request timed out. Please try again or search.");
      } else {
        setGeoError("Could not get your location. Please search for your address.");
      }
    }
  }, [googleLoaded, placesError, reverseGeocode]);

  // Convert Google PlaceDetails to our AddressData format
  const convertPlaceToAddress = (place: PlaceDetails): AddressData => {
    const streetAddress = [place.streetNumber, place.streetName]
      .filter(Boolean)
      .join(" ");

    return {
      addressLine1: streetAddress,
      addressLine2: "",
      addressLine3: "",
      suburb: place.suburb || place.city,
      city: place.city,
      province: place.province,
      postalCode: place.postalCode,
      country: place.country || "South Africa",
      coordinates: place.coordinates,
      placeId: place.placeId,
    };
  };

  // Handle Google prediction selection
  const handleSelectGooglePrediction = async (prediction: PlacePrediction) => {
    setIsLoadingDetails(true);

    try {
      const details = await getPlaceDetails(prediction.placeId);
      if (details) {
        const address = convertPlaceToAddress(details);
        handleSelectAddress(address);
      } else {
        toast({
          title: "Error",
          description: "Could not get address details. Please try again.",
          variant: "destructive",
        });
      }
    } catch (e) {
      console.error("Error getting place details:", e);
      toast({
        title: "Error",
        description: "Failed to load address details",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Handle address selection
  const handleSelectAddress = (address: AddressData) => {
    // Save to recent addresses
    const recent = [
      address,
      ...recentAddresses.filter(
        (a) =>
          a.suburb !== address.suburb ||
          a.addressLine1 !== address.addressLine1,
      ),
    ].slice(0, 5);
    setRecentAddresses(recent);
    localStorage.setItem(RECENT_ADDRESSES_KEY, JSON.stringify(recent));

    onSelectAddress(address);
    onClose();
  };

  // Handle manual address confirmation
  const handleConfirmManualAddress = () => {
    if (
      !manualAddress.suburb ||
      !manualAddress.city ||
      !manualAddress.province
    ) {
      toast({
        title: "Please complete required fields",
        description: "Suburb, city, and province are required",
        variant: "destructive",
      });
      return;
    }

    handleSelectAddress(manualAddress);
  };

  // Decline geolocation
  const declineGeolocation = () => {
    localStorage.setItem(GEO_PERMISSION_KEY, "declined");
    setShowGeoPrompt(false);
    // Focus search input
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  if (!isOpen) return null;

  // Combine Google predictions and local results, prioritizing Google
  const hasGoogleResults = googlePredictions.length > 0;
  const hasLocalResults = localResults.length > 0;
  const hasAnyResults = hasGoogleResults || hasLocalResults;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-3 p-4">
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-secondary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h1 className="font-serif text-lg font-bold flex-1">
              Delivery Address
            </h1>
          </div>

          {/* Search Input */}
          {!manualEntry && !showGeoPrompt && (
            <div className="px-4 pb-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search suburb or street address..."
                  className="w-full h-12 pl-12 pr-10 rounded-xl bg-secondary border border-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/30"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-muted-foreground/20 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div
          className="px-4 py-4 overflow-y-auto"
          style={{
            maxHeight:
              "calc(100vh - 140px - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
          }}
        >
          {/* Geolocation Prompt - Full screen modal style */}
          <AnimatePresence>
            {showGeoPrompt && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center justify-center py-8"
              >
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Navigation className="w-10 h-10 text-primary" />
                </div>

                <h2 className="text-xl font-serif font-bold text-foreground text-center mb-2">
                  Enable Location
                </h2>
                <p className="text-sm text-muted-foreground text-center mb-8 max-w-xs">
                  Allow LIQZAR to access your location to automatically find
                  your delivery address
                </p>

                <div className="flex flex-col gap-3 w-full max-w-xs">
                  <Button
                    onClick={requestGeolocation}
                    disabled={isLocating}
                    className="w-full gold-gradient text-primary-foreground h-12 rounded-xl font-semibold"
                  >
                    {isLocating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Finding location...
                      </>
                    ) : (
                      <>
                        <Locate className="w-5 h-5 mr-2" />
                        Use My Current Location
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={declineGeolocation}
                    variant="outline"
                    className="w-full h-12 rounded-xl"
                    disabled={isLocating}
                  >
                    <Search className="w-5 h-5 mr-2" />
                    Search Address Instead
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Geo Error */}
          {geoError && !showGeoPrompt && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-foreground font-medium">
                  Location unavailable
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {geoError}
                </p>
              </div>
            </motion.div>
          )}

          {/* Main content when not showing geo prompt */}
          {!showGeoPrompt && !manualEntry && (
            <>
              {/* Locating Indicator */}
              {isLocating && (
                <div className="mb-4 p-4 rounded-2xl bg-secondary flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <span className="text-sm text-foreground">
                    Finding your location...
                  </span>
                </div>
              )}

              {/* Loading Details Indicator */}
              {isLoadingDetails && (
                <div className="mb-4 p-4 rounded-2xl bg-secondary flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  <span className="text-sm text-foreground">
                    Loading address details...
                  </span>
                </div>
              )}

              {/* Google Places Results */}
              {hasGoogleResults && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground px-1 mb-2">
                    Search Results
                  </p>
                  <div className="space-y-1">
                    {googlePredictions.map((prediction) => (
                      <button
                        key={prediction.placeId}
                        onClick={() => handleSelectGooglePrediction(prediction)}
                        className="w-full p-3 rounded-xl hover:bg-secondary transition-colors text-left flex items-start gap-3"
                        disabled={isLoadingDetails}
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {prediction.mainText}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {prediction.secondaryText}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Local Suburb Results (shown when no Google results or as supplement) */}
              {hasLocalResults && !hasGoogleResults && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground px-1 mb-2">
                    Suburbs in our delivery area
                  </p>
                  <div className="space-y-1">
                    {localResults.map((addr, idx) => (
                      <button
                        key={`local-${idx}`}
                        onClick={() => handleSelectAddress(addr)}
                        className="w-full p-3 rounded-xl hover:bg-secondary transition-colors text-left flex items-start gap-3"
                      >
                        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-5 h-5 text-green-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {addr.suburb}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {addr.city}, {addr.province}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Use Current Location Button (when not searching) */}
              {!searchQuery && !isLocating && (
                <button
                  onClick={requestGeolocation}
                  className="w-full p-4 rounded-xl hover:bg-secondary transition-colors flex items-center gap-3 mb-4"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Navigation className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-foreground">
                      Use current location
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Find your address automatically
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              )}

              {/* Recent Addresses */}
              {recentAddresses.length > 0 && !searchQuery && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground px-1 mb-2 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Recent
                  </p>
                  <div className="space-y-1">
                    {recentAddresses.map((addr, idx) => (
                      <button
                        key={`recent-${idx}`}
                        onClick={() => handleSelectAddress(addr)}
                        className="w-full p-3 rounded-xl hover:bg-secondary transition-colors text-left flex items-start gap-3"
                      >
                        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {addr.addressLine1 || addr.suburb}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {addr.addressLine1 ? `${addr.suburb}, ` : ""}
                            {addr.city}, {addr.province}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Saved Addresses */}
              {savedAddresses.length > 0 && !searchQuery && (
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground px-1 mb-2 flex items-center gap-1">
                    <Star className="w-3 h-3" />
                    Saved
                  </p>
                  <div className="space-y-1">
                    {savedAddresses.map((addr, idx) => (
                      <button
                        key={`saved-${idx}`}
                        onClick={() => handleSelectAddress(addr)}
                        className="w-full p-3 rounded-xl hover:bg-secondary transition-colors text-left flex items-start gap-3"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          {addr.label === "home" ? (
                            <Home className="w-4 h-4 text-primary" />
                          ) : addr.label === "work" ? (
                            <Building2 className="w-4 h-4 text-primary" />
                          ) : (
                            <Star className="w-4 h-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground capitalize">
                            {addr.label || "Saved"}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {addr.addressLine1 || addr.suburb}, {addr.city}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Entry Option */}
              {!searchQuery && (
                <button
                  onClick={() => setManualEntry(true)}
                  className="w-full p-4 rounded-xl hover:bg-secondary transition-colors flex items-center gap-3 border-t border-border mt-4 pt-4"
                >
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-foreground">
                      Enter address manually
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Type in your full address
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              )}

              {/* No results message */}
              {searchQuery.length >= 2 &&
                !hasAnyResults &&
                !isLoadingDetails && (
                  <div className="text-center py-8">
                    <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No addresses found for "{searchQuery}"
                    </p>
                    <button
                      onClick={() => setManualEntry(true)}
                      className="text-primary text-sm font-medium mt-2"
                    >
                      Enter address manually
                    </button>
                  </div>
                )}
            </>
          )}

          {/* Manual Entry Mode */}
          {manualEntry && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <button
                onClick={() => setManualEntry(false)}
                className="flex items-center gap-2 text-primary text-sm font-medium mb-2"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to search
              </button>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={manualAddress.addressLine1}
                    onChange={(e) =>
                      setManualAddress((prev) => ({
                        ...prev,
                        addressLine1: e.target.value,
                      }))
                    }
                    placeholder="e.g. 123 Main Road"
                    className="w-full h-11 px-3 rounded-xl bg-secondary border border-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Unit / Apartment (Optional)
                  </label>
                  <input
                    type="text"
                    value={manualAddress.addressLine2}
                    onChange={(e) =>
                      setManualAddress((prev) => ({
                        ...prev,
                        addressLine2: e.target.value,
                      }))
                    }
                    placeholder="e.g. Unit 4B, Block C"
                    className="w-full h-11 px-3 rounded-xl bg-secondary border border-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Suburb <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={manualAddress.suburb}
                    onChange={(e) =>
                      setManualAddress((prev) => ({
                        ...prev,
                        suburb: e.target.value,
                      }))
                    }
                    placeholder="e.g. Sandton"
                    className="w-full h-11 px-3 rounded-xl bg-secondary border border-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      City <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={manualAddress.city}
                      onChange={(e) =>
                        setManualAddress((prev) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                      placeholder="Johannesburg"
                      className="w-full h-11 px-3 rounded-xl bg-secondary border border-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Province <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={manualAddress.province}
                      onChange={(e) =>
                        setManualAddress((prev) => ({
                          ...prev,
                          province: e.target.value,
                        }))
                      }
                      className="w-full h-11 px-3 rounded-xl bg-secondary border border-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="">Select</option>
                      {SA_PROVINCES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="w-1/2">
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={manualAddress.postalCode}
                    onChange={(e) =>
                      setManualAddress((prev) => ({
                        ...prev,
                        postalCode: e.target.value,
                      }))
                    }
                    placeholder="e.g. 2196"
                    className="w-full h-11 px-3 rounded-xl bg-secondary border border-transparent text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    maxLength={5}
                  />
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={handleConfirmManualAddress}
                  className="w-full gold-gradient text-primary-foreground h-12 rounded-xl font-semibold"
                >
                  Confirm Address
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Safe area bottom padding */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </motion.div>
    </AnimatePresence>
  );
};

export default AddressPicker;
