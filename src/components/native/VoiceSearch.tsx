import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Search, Loader2, Sparkles } from "lucide-react";
import { useHaptics, isNativeApp } from "@/hooks/useNativeFeatures";

interface VoiceSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
  placeholder?: string;
}

const VoiceSearch = ({
  isOpen,
  onClose,
  onResult,
  placeholder = "Try saying 'Johnnie Walker'",
}: VoiceSearchProps) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestions] = useState([
    "Single malt whisky",
    "Champagne under R1000",
    "Best red wine",
    "Gin and tonic set",
    "Birthday gift whisky",
  ]);
  const { impact, notification } = useHaptics();
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    setError(null);
    setTranscript("");

    // Check if Web Speech API is available
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Voice search not supported on this device");
      notification("error");
      return;
    }

    impact("medium");
    setIsListening(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-ZA"; // South African English

    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript;
      setTranscript(text);

      if (result.isFinal) {
        notification("success");
        onResult(text);
        setIsListening(false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setError(
        event.error === "not-allowed"
          ? "Microphone permission denied"
          : "Could not recognize speech. Try again.",
      );
      notification("error");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [impact, notification, onResult]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    impact("light");
  }, [impact]);

  const handleSuggestionClick = (suggestion: string) => {
    impact("light");
    onResult(suggestion);
  };

  useEffect(() => {
    if (isOpen) {
      // Auto-start listening when opened
      const timer = setTimeout(startListening, 300);
      return () => clearTimeout(timer);
    } else {
      stopListening();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-xl"
        >
          <div className="h-full flex flex-col p-4 pt-safe">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">
                  Voice Search
                </h2>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Microphone visualization */}
            <div className="flex-1 flex flex-col items-center justify-center -mt-20">
              {/* Animated rings */}
              <div className="relative">
                {isListening && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full bg-primary/20"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 0, 0.5],
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      style={{
                        width: 128,
                        height: 128,
                        marginLeft: -64,
                        marginTop: -64,
                        left: "50%",
                        top: "50%",
                      }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full bg-primary/10"
                      animate={{
                        scale: [1, 2, 1],
                        opacity: [0.3, 0, 0.3],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: 0.3,
                      }}
                      style={{
                        width: 128,
                        height: 128,
                        marginLeft: -64,
                        marginTop: -64,
                        left: "50%",
                        top: "50%",
                      }}
                    />
                  </>
                )}

                {/* Mic button */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={isListening ? stopListening : startListening}
                  className={`w-24 h-24 rounded-full flex items-center justify-center shadow-lg ${
                    isListening
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {isListening ? (
                    <MicOff className="w-10 h-10" />
                  ) : (
                    <Mic className="w-10 h-10" />
                  )}
                </motion.button>
              </div>

              {/* Status text */}
              <div className="mt-8 text-center">
                {isListening ? (
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Listening...
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">{placeholder}</p>
                )}
              </div>

              {/* Transcript */}
              {transcript && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 px-6 py-4 bg-muted rounded-2xl max-w-xs"
                >
                  <p className="text-foreground font-medium text-center">
                    "{transcript}"
                  </p>
                </motion.div>
              )}

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 px-6 py-4 bg-destructive/10 rounded-2xl max-w-xs"
                >
                  <p className="text-destructive text-sm text-center">
                    {error}
                  </p>
                </motion.div>
              )}
            </div>

            {/* Suggestions */}
            <div className="pb-safe">
              <p className="text-xs text-muted-foreground mb-3">
                Or try these:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="px-4 py-2 bg-muted rounded-full text-sm text-foreground hover:bg-muted/80 transition-colors"
                  >
                    <Search className="w-3 h-3 inline mr-1.5 text-muted-foreground" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VoiceSearch;
