import React from "react";
import { Text, TextStyle, ViewStyle } from "react-native";
import IoniconsIcon from "@expo/vector-icons/Ionicons";

// In production builds (and dev clients), the font family registers as the
// unscoped name 'ionicons', so we render directly via <Text> with that name.
// (Expo SDK 53 removed expo-font's processFontFamily helper that was
// previously used to handle Expo Go's scoped family names.)

// eslint-disable-next-line @typescript-eslint/no-var-requires
const glyphMap: Record<string, number | string> = require("@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json");

type IoniconsName = React.ComponentProps<typeof IoniconsIcon>["name"];

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: ViewStyle | TextStyle;
}

const iconAliases: Record<string, string> = {
  wine: "wine-outline",
  beer: "beer-outline",
  cafe: "cafe-outline",
  restaurant: "restaurant-outline",
  grid: "grid-outline",
  bulb: "bulb-outline",
  sparkles: "sparkles-outline",
  diamond: "diamond-outline",
  flame: "flame-outline",
  mic: "mic-outline",
  bag: "bag-outline",
  pricetag: "pricetag-outline",
  gift: "gift-outline",
  card: "card-outline",
  cash: "cash-outline",
  wallet: "wallet-outline",
  receipt: "receipt-outline",
  create: "create-outline",
  pencil: "pencil-outline",
  trash: "trash-outline",
  share: "share-outline",
  copy: "copy-outline",
  filter: "filter-outline",
  options: "options-outline",
  menu: "menu-outline",
  list: "list-outline",
  refresh: "refresh-outline",
  reload: "reload-outline",
  sync: "sync-outline",
  flash: "flash-outline",
  airplane: "airplane-outline",
  car: "car-outline",
  bicycle: "bicycle-outline",
  barcode: "barcode-outline",
  scan: "scan-outline",
  camera: "camera-outline",
  chatbot: "chatbubble-ellipses-outline",
  ai: "sparkles-outline",
  fingerprint: "finger-print-outline",
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = "#FFFFFF",
  style,
}) => {
  const resolvedName = iconAliases[name] || name;
  const codePoint = glyphMap[resolvedName];
  const glyph =
    typeof codePoint === "number"
      ? String.fromCodePoint(codePoint)
      : typeof codePoint === "string"
      ? codePoint
      : "?";

  return (
    <Text
      allowFontScaling={false}
      selectable={false}
      style={[
        style,
        {
          fontFamily: "ionicons",
          fontSize: size,
          color,
          fontWeight: "normal" as const,
          fontStyle: "normal" as const,
        },
      ]}
    >
      {glyph}
    </Text>
  );
};

// Re-export the official Ionicons component for screens that import { Ionicons }
export const Ionicons = IoniconsIcon;

export default Icon;
