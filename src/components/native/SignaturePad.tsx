import { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Check, X, RotateCcw, Pen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SignaturePadProps {
  onSave: (signatureBase64: string) => void;
  onCancel: () => void;
  title?: string;
  subtitle?: string;
  signerName?: string;
  signerRole?: "driver" | "warehouse" | "customer";
}

export const SignaturePad = ({
  onSave,
  onCancel,
  title = "Sign Here",
  subtitle = "Use your finger to sign",
  signerName,
  signerRole = "driver",
}: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [ctx, setCtx] = useState<CanvasRenderingContext2D | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    context.scale(2, 2);

    // Set drawing style
    context.strokeStyle = "#1a1a2e";
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";

    // Fill with white background
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw baseline
    context.strokeStyle = "#e5e5e5";
    context.lineWidth = 1;
    context.setLineDash([5, 5]);
    context.beginPath();
    context.moveTo(20, rect.height - 40);
    context.lineTo(rect.width - 20, rect.height - 40);
    context.stroke();
    context.setLineDash([]);

    // Reset for drawing
    context.strokeStyle = "#1a1a2e";
    context.lineWidth = 3;

    setCtx(context);
  }, []);

  const getCoordinates = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();

      if ("touches" in e) {
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      }

      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  const startDrawing = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!ctx) return;
      e.preventDefault();

      const { x, y } = getCoordinates(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
      setHasSignature(true);
    },
    [ctx, getCoordinates],
  );

  const draw = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!isDrawing || !ctx) return;
      e.preventDefault();

      const { x, y } = getCoordinates(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    },
    [isDrawing, ctx, getCoordinates],
  );

  const stopDrawing = useCallback(() => {
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);
  }, [ctx]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Redraw baseline
    ctx.strokeStyle = "#e5e5e5";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(20, rect.height - 40);
    ctx.lineTo(rect.width - 20, rect.height - 40);
    ctx.stroke();
    ctx.setLineDash([]);

    // Reset for drawing
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 3;

    setHasSignature(false);
  }, [ctx]);

  const saveSignature = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    const signatureData = canvas.toDataURL("image/png");
    onSave(signatureData);
  }, [hasSignature, onSave]);

  const roleColors = {
    driver: "from-blue-500 to-blue-600",
    warehouse: "from-purple-500 to-purple-600",
    customer: "from-green-500 to-green-600",
  };

  const roleIcons = {
    driver: "🚗",
    warehouse: "📦",
    customer: "👤",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-card rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div
          className={`bg-gradient-to-r ${roleColors[signerRole]} p-4 text-white`}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
              {roleIcons[signerRole]}
            </div>
            <div>
              <h3 className="text-lg font-bold">{title}</h3>
              <p className="text-sm opacity-80">{subtitle}</p>
            </div>
          </div>
          {signerName && (
            <p className="mt-2 text-sm bg-white/10 rounded-lg px-3 py-1.5 inline-block">
              Signing as: <strong>{signerName}</strong>
            </p>
          )}
        </div>

        {/* Canvas */}
        <div className="p-4">
          <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 overflow-hidden relative">
            <canvas
              ref={canvasRef}
              className="w-full h-48 touch-none"
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />

            {!hasSignature && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-gray-400">
                  <Pen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sign above the line</p>
                </div>
              </div>
            )}
          </div>

          {/* Timestamp */}
          <p className="text-xs text-muted-foreground text-center mt-2">
            {new Date().toLocaleString("en-ZA", {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-border flex gap-3">
          <Button
            variant="outline"
            onClick={clearCanvas}
            className="flex-1 h-12 rounded-xl"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            className="h-12 w-12 rounded-xl"
          >
            <X className="w-5 h-5" />
          </Button>
          <Button
            onClick={saveSignature}
            disabled={!hasSignature}
            className="flex-1 h-12 rounded-xl"
          >
            <Check className="w-4 h-4 mr-2" />
            Confirm
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Display saved signature
interface SignatureDisplayProps {
  signature: string;
  signerName?: string;
  signedAt?: string;
  role?: "driver" | "warehouse" | "customer";
  compact?: boolean;
}

export const SignatureDisplay = ({
  signature,
  signerName,
  signedAt,
  role = "driver",
  compact = false,
}: SignatureDisplayProps) => {
  const roleLabels = {
    driver: "Driver Signature",
    warehouse: "Warehouse Staff",
    customer: "Customer Signature",
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
        <Check className="w-4 h-4 text-green-500" />
        <span className="text-xs text-green-700 dark:text-green-400">
          Signed by {signerName || role}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-muted/50 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">
          {roleLabels[role]}
        </span>
        <Check className="w-4 h-4 text-green-500" />
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-lg p-2">
        <img
          src={signature}
          alt="Signature"
          className="w-full h-16 object-contain"
        />
      </div>
      {(signerName || signedAt) && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          {signerName && <span>{signerName}</span>}
          {signedAt && (
            <span>
              {new Date(signedAt).toLocaleString("en-ZA", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default SignaturePad;
