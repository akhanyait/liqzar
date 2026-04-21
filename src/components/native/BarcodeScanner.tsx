import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  X,
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  Scan,
  QrCode,
  ImagePlus,
} from "lucide-react";
import { isNativeApp, useHaptics } from "@/hooks/useNativeFeatures";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string, type: string) => void;
  mode?: "barcode" | "qr" | "both";
  title?: string;
}

const BarcodeScanner = ({
  isOpen,
  onClose,
  onScan,
  mode = "both",
  title,
}: BarcodeScannerProps) => {
  const [flashOn, setFlashOn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const { impact, notification } = useHaptics();

  // Simulate barcode scanning for demo
  const simulateScan = useCallback(() => {
    setIsScanning(true);
    impact("medium");

    setTimeout(() => {
      const mockCodes = [
        {
          code: "5060466510012",
          type: "EAN-13",
          name: "Johnnie Walker Black Label",
        },
        { code: "5000267014067", type: "EAN-13", name: "Glenfiddich 12 Year" },
        {
          code: "082000765493",
          type: "UPC-A",
          name: "Jack Daniel's Tennessee",
        },
        { code: "LIQZAR-PROMO-2024", type: "QR", name: "Promo Code" },
      ];

      const randomCode =
        mockCodes[Math.floor(Math.random() * mockCodes.length)];
      notification("success");
      onScan(randomCode.code, randomCode.type);
      setIsScanning(false);
    }, 1500);
  }, [impact, notification, onScan]);

  useEffect(() => {
    if (isOpen) {
      // Auto-start scanning simulation
      const timer = setTimeout(simulateScan, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, simulateScan]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black"
        >
          {/* Camera View (simulated) */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/80">
            {/* Simulated camera feed */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="w-full h-full bg-gray-900">
                {/* Fake viewfinder grid */}
                <div className="absolute inset-0 opacity-20">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute w-full h-px bg-white/30"
                      style={{ top: `${i * 10}%` }}
                    />
                  ))}
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute h-full w-px bg-white/30"
                      style={{ left: `${i * 10}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-4 pt-safe flex items-center justify-between z-10">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <h3 className="text-white font-bold">
              {title ||
                (mode === "qr"
                  ? "Scan QR Code"
                  : mode === "barcode"
                    ? "Scan Barcode"
                    : "Scan Code")}
            </h3>
            <div className="w-10" />
          </div>

          {/* Scanning Frame */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Frame */}
              <div
                className={`w-64 h-64 relative ${isScanning ? "animate-pulse" : ""}`}
              >
                {/* Corner brackets */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-primary rounded-br-lg" />

                {/* Scan line */}
                <motion.div
                  className="absolute left-2 right-2 h-0.5 bg-primary"
                  animate={{
                    top: ["10%", "90%", "10%"],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                {/* Center icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {mode === "qr" ? (
                    <QrCode className="w-16 h-16 text-white/20" />
                  ) : (
                    <Scan className="w-16 h-16 text-white/20" />
                  )}
                </div>
              </div>

              {/* Status text */}
              <p className="text-center text-white/70 text-sm mt-4">
                {isScanning
                  ? "Processing..."
                  : "Position code within the frame"}
              </p>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 pb-safe">
            <div className="flex items-center justify-center gap-8">
              {/* Flash toggle */}
              <button
                onClick={() => {
                  setFlashOn(!flashOn);
                  impact("light");
                }}
                className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"
              >
                {flashOn ? (
                  <Flashlight className="w-6 h-6 text-primary" />
                ) : (
                  <FlashlightOff className="w-6 h-6 text-white" />
                )}
              </button>

              {/* Capture button */}
              <button
                onClick={simulateScan}
                disabled={isScanning}
                className="w-20 h-20 rounded-full bg-primary flex items-center justify-center"
              >
                <div className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </button>

              {/* Gallery */}
              <button
                onClick={() => impact("light")}
                className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"
              >
                <ImagePlus className="w-6 h-6 text-white" />
              </button>
            </div>

            {/* Mode indicator */}
            <div className="flex justify-center mt-4 gap-2">
              {(mode === "both" || mode === "barcode") && (
                <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold">
                  Barcode
                </span>
              )}
              {(mode === "both" || mode === "qr") && (
                <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold">
                  QR Code
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BarcodeScanner;
