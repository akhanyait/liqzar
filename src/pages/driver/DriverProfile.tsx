import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  User,
  Camera,
  Upload,
  Save,
  Mail,
  Phone,
  IdCard,
  Car,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface DriverProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string;
  id_number: string;
  profile_picture_url: string | null;
  driver_license_url: string | null;
  is_verified: boolean;
  created_at: string;
}

const DriverProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    id_number: "",
  });
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("driver_profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        const profileData = data as any;
        setProfile(profileData as DriverProfile);
        setFormData({
          full_name: profileData.full_name || "",
          phone: profileData.phone || "",
          email: profileData.email || "",
          id_number: profileData.id_number || "",
        });
      } else {
        // Initialize with user email
        setFormData((prev) => ({ ...prev, email: "" }));
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    field: "profile_picture" | "driver_license",
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(field);

      // Create unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id}_${field}_${Date.now()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("driver-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("driver-documents")
        .getPublicUrl(filePath);

      // Update profile with new URL
      const updateField =
        field === "profile_picture"
          ? "profile_picture_url"
          : "driver_license_url";

      const { error: updateError } = await (supabase as any)
        .from("driver_profiles")
        .upsert(
          {
            user_id: user?.id,
            [updateField]: urlData.publicUrl,
            full_name: formData.full_name,
            phone: formData.phone,
            email: formData.email,
            id_number: formData.id_number,
          },
          {
            onConflict: "user_id",
          },
        );

      if (updateError) throw updateError;

      toast({
        title: "Upload Successful",
        description: `${field === "profile_picture" ? "Profile picture" : "Driver license"} uploaded`,
      });

      fetchProfile();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(null);
    }
  };

  const handleSaveProfile = async () => {
    if (!formData.full_name || !formData.phone || !formData.id_number) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const { error } = await (supabase as any).from("driver_profiles").upsert(
        {
          user_id: user?.id,
          full_name: formData.full_name,
          phone: formData.phone,
          email: formData.email,
          id_number: formData.id_number,
        },
        {
          onConflict: "user_id",
        },
      );

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your information has been saved",
      });

      fetchProfile();
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Driver Profile
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your personal information and documents
            </p>
          </div>
          {profile?.is_verified && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-xs font-semibold text-green-600">
                Verified
              </span>
            </div>
          )}
        </div>

        {/* Verification Alert */}
        {!profile?.is_verified &&
          (profile?.profile_picture_url || profile?.driver_license_url) && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                    Pending Verification
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                    Your documents are under review. You'll be notified once
                    verified.
                  </p>
                </div>
              </div>
            </div>
          )}

        {/* Profile Picture */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Profile Picture
          </h2>
          <div className="flex items-center gap-6">
            <div className="relative">
              {profile?.profile_picture_url ? (
                <img
                  src={profile.profile_picture_url}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-4 border-border"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center border-4 border-border">
                  <User className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <input
                type="file"
                id="profile-picture"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, "profile_picture")}
                disabled={uploading === "profile_picture"}
              />
              <label
                htmlFor="profile-picture"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold text-sm cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploading === "profile_picture"
                  ? "Uploading..."
                  : "Upload Photo"}
              </label>
              <p className="text-xs text-muted-foreground mt-2">
                JPG, PNG or WEBP. Max 5MB.
              </p>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Personal Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Full Name *
              </label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => handleInputChange("full_name", e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="+27 82 123 4567"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block flex items-center gap-1">
                <IdCard className="w-3.5 h-3.5" />
                ID / License Number *
              </label>
              <input
                type="text"
                value={formData.id_number}
                onChange={(e) => handleInputChange("id_number", e.target.value)}
                placeholder="9012345678901"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Driver License */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <IdCard className="w-5 h-5" />
            Driver License
          </h2>
          {profile?.driver_license_url ? (
            <div className="space-y-3">
              <div className="border border-border rounded-xl overflow-hidden">
                <img
                  src={profile.driver_license_url}
                  alt="Driver License"
                  className="w-full h-48 object-cover"
                />
              </div>
              <input
                type="file"
                id="driver-license"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, "driver_license")}
                disabled={uploading === "driver_license"}
              />
              <label
                htmlFor="driver-license"
                className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-xl font-semibold text-sm cursor-pointer hover:bg-muted/80 transition-colors"
              >
                <Upload className="w-4 h-4" />
                {uploading === "driver_license"
                  ? "Uploading..."
                  : "Replace License"}
              </label>
            </div>
          ) : (
            <div>
              <input
                type="file"
                id="driver-license"
                className="hidden"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, "driver_license")}
                disabled={uploading === "driver_license"}
              />
              <label
                htmlFor="driver-license"
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Upload className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-sm font-semibold text-foreground">
                  {uploading === "driver_license"
                    ? "Uploading..."
                    : "Upload Driver License"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click to select file
                </p>
              </label>
            </div>
          )}
        </div>

        {/* Vehicle Registration */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Car className="w-5 h-5" />
              Vehicle Registration
            </h2>
          </div>
          <button
            onClick={() => navigate("/driver/vehicle")}
            className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            <Car className="w-4 h-4" />
            Manage Vehicle
          </button>
        </div>

        {/* Save Button */}
        <div className="flex gap-3">
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DriverProfile;
