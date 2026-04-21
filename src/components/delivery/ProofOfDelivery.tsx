/**
 * Proof of Delivery Component
 * Handles delivery verification including OTP, signature, age verification, and ID check
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Camera,
  Pen,
  KeyRound,
  UserCheck,
  Calendar,
  CheckCircle2,
  X,
  AlertTriangle,
  Wine,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/native/SignaturePad";
import { toast } from "@/hooks/use-toast";
import { useHaptics } from "@/hooks/useNativeFeatures";

interface ProofOfDeliveryProps {
  orderId: string;
  customerName: string;
  customerPhone: string;
  items: Array<{ name: string; quantity: number; isAlcohol?: boolean }>;
  onComplete: (proof: DeliveryProof) => void;
  onCancel: () => void;
}

export interface DeliveryProof {
  orderId: string;
  method: "otp" | "signature" | "photo";
  recipientName: string;
  recipientRelation?: string;
  otpCode?: string;
  signatureData?: string;
  photoUrl?: string;
  ageVerified: boolean;
  idChecked: boolean;
  idLastFour?: string;
  dateOfBirth?: string;
  deliveredAt: string;
  deliveryNotes?: string;
}

type VerificationStep =
  | "select-method"
  | "otp-entry"
  | "signature"
  | "recipient-info"
  | "age-verification"
  | "id-check"
  | "photo-capture"
  | "complete";

const ProofOfDelivery = ({
  orderId,
  customerName,
  customerPhone,
  items,
  onComplete,
  onCancel,
}: ProofOfDeliveryProps) => {
  const { impact, notification } = useHaptics();
  const [step, setStep] = useState<VerificationStep>("select-method");
  const [method, setMethod] = useState<"otp" | "signature" | "photo" | null>(
    null,
  );

  // Recipient info
  const [recipientName, setRecipientName] = useState(customerName);
  const [recipientRelation, setRecipientRelation] = useState("");

  // OTP
  const [otpCode, setOtpCode] = useState(["", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Signature
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  // Photo
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Age verification
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [ageVerified, setAgeVerified] = useState(false);

  // ID check
  const [idLastFour, setIdLastFour] = useState("");
  const [idChecked, setIdChecked] = useState(false);

  // Delivery notes
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // Check if order contains alcohol
  const hasAlcohol = items.some((item) => item.isAlcohol !== false);

  // OTP resend timer
  useEffect(() => {
    if (otpResendTimer > 0) {
      const timer = setTimeout(
        () => setOtpResendTimer(otpResendTimer - 1),
        1000,
      );
      return () => clearTimeout(timer);
    }
  }, [otpResendTimer]);

  const sendOtp = () => {
    setOtpSent(true);
    setOtpResendTimer(60);
    toast({
      title: "OTP Sent",
      description: `Verification code sent to ${customerPhone.slice(-4).padStart(customerPhone.length, "*")}`,
    });
    impact("medium");
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);

    // Auto-focus next input
    if (value && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Check if complete
    if (newOtp.every((digit) => digit) && index === 3) {
      verifyOtp(newOtp.join(""));
    }
  };

  const verifyOtp = (code: string) => {
    // In production, verify against backend
    if (code === "1234") {
      // Demo OTP
      notification("success");
      toast({ title: "OTP Verified", description: "Verification successful" });
      proceedAfterVerification();
    } else {
      impact("heavy");
      toast({
        title: "Invalid OTP",
        description: "Please enter the correct code",
        variant: "destructive",
      });
      setOtpCode(["", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    }
  };

  const handleSignatureSave = (signature: string) => {
    setSignatureData(signature);
    setShowSignaturePad(false);
    notification("success");
    proceedAfterVerification();
  };

  const capturePhoto = () => {
    // In production, this would open the camera
    // For demo, we'll simulate a photo capture
    setPhotoUrl("photo-captured-" + Date.now());
    notification("success");
    toast({ title: "Photo Captured", description: "Proof photo saved" });
    proceedAfterVerification();
  };

  const proceedAfterVerification = () => {
    if (hasAlcohol && !ageVerified) {
      setStep("age-verification");
    } else {
      setStep("complete");
    }
  };

  const verifyAge = () => {
    if (!dateOfBirth) {
      toast({
        title: "Date of Birth Required",
        description: "Please enter the recipient's date of birth",
        variant: "destructive",
      });
      return;
    }

    const dob = new Date(dateOfBirth);
    const today = new Date();
    const age = Math.floor(
      (today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
    );

    if (age >= 18) {
      setAgeVerified(true);
      notification("success");
      setStep("id-check");
    } else {
      impact("heavy");
      toast({
        title: "Age Verification Failed",
        description: "Recipient must be 18 or older to receive alcohol",
        variant: "destructive",
      });
    }
  };

  const verifyId = () => {
    if (idLastFour.length !== 4) {
      toast({
        title: "ID Required",
        description: "Please enter the last 4 digits of the ID",
        variant: "destructive",
      });
      return;
    }
    setIdChecked(true);
    notification("success");
    setStep("complete");
  };

  const completeDelivery = () => {
    const proof: DeliveryProof = {
      orderId,
      method: method!,
      recipientName,
      recipientRelation: recipientRelation || undefined,
      otpCode: method === "otp" ? otpCode.join("") : undefined,
      signatureData: signatureData || undefined,
      photoUrl: photoUrl || undefined,
      ageVerified,
      idChecked,
      idLastFour: idLastFour || undefined,
      dateOfBirth: dateOfBirth || undefined,
      deliveredAt: new Date().toISOString(),
      deliveryNotes: deliveryNotes || undefined,
    };

    onComplete(proof);
    notification("success");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-card p-4 border-b border-border flex items-center justify-between rounded-t-3xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Proof of Delivery</h2>
              <p className="text-xs text-muted-foreground">Order {orderId}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4">
          <AnimatePresence mode="wait">
            {/* Step 1: Select Verification Method */}
            {step === "select-method" && (
              <motion.div
                key="select-method"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Choose how to verify delivery to {customerName}
                </p>

                <button
                  onClick={() => {
                    setMethod("otp");
                    setStep("recipient-info");
                    impact("light");
                  }}
                  className="w-full p-4 rounded-2xl border border-border bg-card hover:bg-muted transition-colors flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <KeyRound className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-bold text-foreground">
                      OTP Verification
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Send code to customer's phone
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setMethod("signature");
                    setStep("recipient-info");
                    impact("light");
                  }}
                  className="w-full p-4 rounded-2xl border border-border bg-card hover:bg-muted transition-colors flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Pen className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-bold text-foreground">
                      Digital Signature
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Customer signs to confirm receipt
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setMethod("photo");
                    setStep("recipient-info");
                    impact("light");
                  }}
                  className="w-full p-4 rounded-2xl border border-border bg-card hover:bg-muted transition-colors flex items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Camera className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-bold text-foreground">
                      Photo Confirmation
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Take photo of delivered items
                    </p>
                  </div>
                </button>
              </motion.div>
            )}

            {/* Step 2: Recipient Info */}
            {step === "recipient-info" && (
              <motion.div
                key="recipient-info"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 mb-4">
                  <UserCheck className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-foreground">
                    Recipient Information
                  </h3>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Recipient Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Enter recipient name"
                    className="w-full h-12 px-4 rounded-xl bg-muted border border-border text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Relationship to Customer (if different)
                  </label>
                  <select
                    value={recipientRelation}
                    onChange={(e) => setRecipientRelation(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-muted border border-border text-foreground"
                  >
                    <option value="">Same as customer</option>
                    <option value="spouse">Spouse</option>
                    <option value="family">Family Member</option>
                    <option value="colleague">Colleague</option>
                    <option value="security">Security/Reception</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <Button
                  onClick={() => {
                    if (!recipientName.trim()) {
                      toast({
                        title: "Name Required",
                        description: "Please enter recipient name",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (method === "otp") {
                      sendOtp();
                      setStep("otp-entry");
                    } else if (method === "signature") {
                      setShowSignaturePad(true);
                    } else {
                      setStep("photo-capture");
                    }
                  }}
                  className="w-full h-12 rounded-xl"
                >
                  Continue
                </Button>
              </motion.div>
            )}

            {/* Step 3a: OTP Entry */}
            {step === "otp-entry" && (
              <motion.div
                key="otp-entry"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                    <KeyRound className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-foreground mb-1">Enter OTP</h3>
                  <p className="text-xs text-muted-foreground">
                    Code sent to{" "}
                    {customerPhone
                      .slice(-4)
                      .padStart(customerPhone.length, "*")}
                  </p>
                </div>

                {/* OTP Input */}
                <div className="flex justify-center gap-3">
                  {otpCode.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => (otpInputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !digit && index > 0) {
                          otpInputRefs.current[index - 1]?.focus();
                        }
                      }}
                      className="w-14 h-14 text-center text-2xl font-bold rounded-xl bg-muted border-2 border-border focus:border-primary outline-none"
                      maxLength={1}
                    />
                  ))}
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  Demo OTP: 1234
                </p>

                {/* Resend */}
                <div className="text-center">
                  {otpResendTimer > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Resend in {otpResendTimer}s
                    </p>
                  ) : (
                    <button
                      onClick={sendOtp}
                      className="text-xs text-primary flex items-center gap-1 mx-auto"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Resend OTP
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 3b: Photo Capture */}
            {step === "photo-capture" && (
              <motion.div
                key="photo-capture"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
                    <Camera className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="font-bold text-foreground mb-1">
                    Photo Confirmation
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Take a photo of the delivered items
                  </p>
                </div>

                {photoUrl ? (
                  <div className="text-center">
                    <div className="w-32 h-32 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-12 h-12 text-green-600" />
                    </div>
                    <p className="text-sm text-green-600 font-medium">
                      Photo captured!
                    </p>
                  </div>
                ) : (
                  <Button
                    onClick={capturePhoto}
                    className="w-full h-14 rounded-xl bg-purple-500 hover:bg-purple-600"
                  >
                    <Camera className="w-5 h-5 mr-2" />
                    Take Photo
                  </Button>
                )}
              </motion.div>
            )}

            {/* Step 4: Age Verification */}
            {step === "age-verification" && (
              <motion.div
                key="age-verification"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <Wine className="w-6 h-6 text-amber-600" />
                    <div>
                      <h3 className="font-bold text-amber-800 dark:text-amber-200">
                        Age Verification Required
                      </h3>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        This order contains alcohol
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Recipient's Date of Birth{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      max={
                        new Date(
                          new Date().setFullYear(new Date().getFullYear() - 18),
                        )
                          .toISOString()
                          .split("T")[0]
                      }
                      className="w-full h-12 pl-12 pr-4 rounded-xl bg-muted border border-border text-foreground"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Recipient must be 18 years or older
                  </p>
                </div>

                <Button onClick={verifyAge} className="w-full h-12 rounded-xl">
                  Verify Age
                </Button>
              </motion.div>
            )}

            {/* Step 5: ID Check */}
            {step === "id-check" && (
              <motion.div
                key="id-check"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-foreground mb-1">
                    ID Verification
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Ask to see the recipient's ID
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Last 4 digits of ID Number{" "}
                    <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={idLastFour}
                    onChange={(e) =>
                      setIdLastFour(
                        e.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                    placeholder="e.g. 5083"
                    maxLength={4}
                    className="w-full h-12 px-4 rounded-xl bg-muted border border-border text-foreground text-center text-2xl tracking-widest"
                  />
                </div>

                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-green-700 dark:text-green-300">
                      Age verified: 18+ confirmed
                    </span>
                  </div>
                </div>

                <Button onClick={verifyId} className="w-full h-12 rounded-xl">
                  Confirm ID Check
                </Button>
              </motion.div>
            )}

            {/* Step 6: Complete */}
            {step === "complete" && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center mb-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4"
                  >
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                  </motion.div>
                  <h3 className="font-bold text-xl text-foreground mb-1">
                    Ready to Complete
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    All verifications passed
                  </p>
                </div>

                {/* Summary */}
                <div className="space-y-2 p-4 rounded-2xl bg-muted">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Recipient</span>
                    <span className="font-medium text-foreground">
                      {recipientName}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Verification</span>
                    <span className="font-medium text-foreground capitalize">
                      {method}
                    </span>
                  </div>
                  {hasAlcohol && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Age Verified
                        </span>
                        <span className="font-medium text-green-600">
                          Yes ✓
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          ID Checked
                        </span>
                        <span className="font-medium text-green-600">
                          Yes (***{idLastFour}) ✓
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Delivery Notes (optional)
                  </label>
                  <textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    className="w-full h-20 p-3 rounded-xl bg-muted border border-border text-foreground resize-none"
                  />
                </div>

                <Button
                  onClick={completeDelivery}
                  className="w-full h-14 rounded-xl bg-green-500 hover:bg-green-600 text-lg font-bold"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Complete Delivery
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Signature Pad Modal */}
        <AnimatePresence>
          {showSignaturePad && (
            <SignaturePad
              onSave={handleSignatureSave}
              onCancel={() => setShowSignaturePad(false)}
              title="Customer Signature"
              subtitle="Please sign to confirm receipt"
              signerName={recipientName}
              signerRole="customer"
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default ProofOfDelivery;
