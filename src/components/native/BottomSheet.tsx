import { useState, useEffect, useRef, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  PanInfo,
  useDragControls,
} from "framer-motion";
import { X, GripHorizontal } from "lucide-react";
import { useHaptics } from "@/hooks/useNativeFeatures";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: number[]; // [0.3, 0.5, 0.9] = 30%, 50%, 90% of screen height
  defaultSnap?: number;
  showDragHandle?: boolean;
  showCloseButton?: boolean;
  onSnapChange?: (snapIndex: number) => void;
}

const BottomSheet = ({
  isOpen,
  onClose,
  children,
  title,
  snapPoints = [0.5, 0.9],
  defaultSnap = 0,
  showDragHandle = true,
  showCloseButton = true,
  onSnapChange,
}: BottomSheetProps) => {
  const [currentSnap, setCurrentSnap] = useState(defaultSnap);
  const { impact, selectionChanged } = useHaptics();
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const screenHeight = typeof window !== "undefined" ? window.innerHeight : 800;

  const getSnapPosition = (snapIndex: number) => {
    return screenHeight * (1 - snapPoints[snapIndex]);
  };

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      const velocity = info.velocity.y;
      const currentY = info.offset.y;

      // If dragged down fast, close
      if (velocity > 500) {
        onClose();
        return;
      }

      // Find closest snap point
      const currentHeight =
        screenHeight - getSnapPosition(currentSnap) - currentY;
      const currentPercentage = currentHeight / screenHeight;

      let closestSnap = 0;
      let minDistance = Infinity;

      snapPoints.forEach((snap, index) => {
        const distance = Math.abs(snap - currentPercentage);
        if (distance < minDistance) {
          minDistance = distance;
          closestSnap = index;
        }
      });

      // If dragged below minimum, close
      if (currentPercentage < snapPoints[0] * 0.5) {
        onClose();
        return;
      }

      if (closestSnap !== currentSnap) {
        selectionChanged();
        setCurrentSnap(closestSnap);
        onSnapChange?.(closestSnap);
      }
    },
    [
      currentSnap,
      snapPoints,
      screenHeight,
      onClose,
      selectionChanged,
      onSnapChange,
    ],
  );

  useEffect(() => {
    if (isOpen) {
      impact("medium");
      setCurrentSnap(defaultSnap);
    }
  }, [isOpen, defaultSnap, impact]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: screenHeight }}
            animate={{ y: getSnapPosition(currentSnap) }}
            exit={{ y: screenHeight }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{
              top: getSnapPosition(snapPoints.length - 1),
              bottom: screenHeight,
            }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            className="fixed left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl overflow-hidden"
            style={{ height: screenHeight, touchAction: "none" }}
          >
            {/* Drag handle */}
            {showDragHandle && (
              <div
                className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
              </div>
            )}

            {/* Header */}
            {(title || showCloseButton) && (
              <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
                <h3 className="text-lg font-bold text-foreground">{title}</h3>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            )}

            {/* Content */}
            <div
              className="overflow-auto"
              style={{
                maxHeight:
                  snapPoints[snapPoints.length - 1] * screenHeight - 80,
              }}
            >
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BottomSheet;
