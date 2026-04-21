import { useEffect, useState } from "react";
import { Box } from "lucide-react";

type Props = {
  usdzUrl?: string | null;
  glbUrl?: string | null;
  className?: string;
};

/**
 * Launches AR preview on supporting devices:
 *   iOS Safari / WebKit → AR Quick Look via <a rel="ar"> on the USDZ
 *   Android Chrome      → Scene Viewer via `intent://` + GLB
 * Falls back silently on unsupported browsers (button not rendered).
 */
const ArPreviewButton = ({ usdzUrl, glbUrl, className }: Props) => {
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/i.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/i.test(ua);
    if (isIOS) setPlatform("ios");
    else if (isAndroid) setPlatform("android");
  }, []);

  if (platform === "ios" && usdzUrl) {
    return (
      <a
        href={usdzUrl}
        rel="ar"
        className={
          className ??
          "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/15 transition-colors"
        }
      >
        <Box className="w-4 h-4" />
        View in AR
      </a>
    );
  }

  if (platform === "android" && glbUrl) {
    const sceneViewerUrl = `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(
      glbUrl,
    )}&mode=ar_preferred#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;end;`;
    return (
      <a
        href={sceneViewerUrl}
        className={
          className ??
          "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/40 text-primary text-sm font-semibold hover:bg-primary/15 transition-colors"
        }
      >
        <Box className="w-4 h-4" />
        View in AR
      </a>
    );
  }

  return null;
};

export default ArPreviewButton;
