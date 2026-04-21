import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  Car,
  Upload,
  Save,
  ArrowLeft,
  Bike,
  Truck,
  TruckIcon,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface DriverVehicle {
  id: string;
  driver_id: string;
  vehicle_photo_url: string | null;
  vehicle_type:
    | "scooter"
    | "car"
    | "bakkie"
    | "small_truck"
    | "medium_truck"
    | "large_truck";
  license_plate: string;
  make_model: string;
  capacity_kg: number | null;
  is_verified: boolean;
  created_at: string;
}

const VEHICLE_TYPES = [
  {
    id: "scooter",
    name: "Scooter / Motorbike",
    icon: Bike,
    capacity: 20,
    description: "Small deliveries, up to 20kg",
  },
  {
    id: "car",
    name: "Small Car",
    icon: Car,
    capacity: 100,
    description: "Medium deliveries, up to 100kg",
  },
  {
    id: "bakkie",
    name: "Bakkie / Pickup",
    icon: Truck,
    capacity: 500,
    description: "Large deliveries, up to 500kg",
  },
  {
    id: "small_truck",
    name: "Small Delivery Truck",
    icon: Truck,
    capacity: 1000,
    description: "Bulk deliveries, up to 1 ton",
  },
  {
    id: "medium_truck",
    name: "Medium Truck",
    icon: TruckIcon,
    capacity: 2000,
    description: "Heavy deliveries, up to 2 tons",
  },
  {
    id: "large_truck",
    name: "Large Truck",
    icon: TruckIcon,
    capacity: 5000,
    description: "Industrial deliveries, up to 5 tons",
  },
] as const;

const DriverVehicle = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [vehicle, setVehicle] = useState<DriverVehicle | null>(null);
  const [driverProfileId, setDriverProfileId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    vehicle_type: "car" as DriverVehicle["vehicle_type"],
    license_plate: "",
    make_model: "",
    capacity_kg: null as number | null,
  });

  useEffect(() => {
    if (user) {
      fetchVehicle();
    }
  }, [user]);

  const fetchVehicle = async () => {
    try {
      setLoading(true);

      // First get driver profile ID
      const { data: profileData, error: profileError } = await (supabase as any)
        .from("driver_profiles")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        throw profileError;
      }

      if (!profileData) {
        toast({
          title: "Profile Required",
          description: "Please complete your driver profile first",
          variant: "destructive",
        });
        navigate("/driver/profile");
        return;
      }

      setDriverProfileId(profileData.id);

      // Get vehicle data
      const { data, error } = await (supabase as any)
        .from("driver_vehicles")
        .select("*")
        .eq("driver_id", profileData.id)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        const vehicleData = data as any;
        setVehicle(vehicleData as DriverVehicle);
        setFormData({
          vehicle_type: vehicleData.vehicle_type,
          license_plate: vehicleData.license_plate || "",
          make_model: vehicleData.make_model || "",
          capacity_kg: vehicleData.capacity_kg,
        });
      } else {
        // Set default capacity based on vehicle type
        const defaultType = VEHICLE_TYPES.find((t) => t.id === "car");
        setFormData((prev) => ({
          ...prev,
          capacity_kg: defaultType?.capacity || null,
        }));
      }
    } catch (error: any) {
      console.error("Error fetching vehicle:", error);
      toast({
        title: "Error",
        description: "Failed to load vehicle information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-set capacity when vehicle type changes
    if (field === "vehicle_type") {
      const vehicleType = VEHICLE_TYPES.find((t) => t.id === value);
      if (vehicleType) {
        setFormData((prev) => ({ ...prev, capacity_kg: vehicleType.capacity }));
      }
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id}_vehicle_${Date.now()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("driver-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("driver-documents")
        .getPublicUrl(filePath);

      const { error: updateError } = await (supabase as any)
        .from("driver_vehicles")
        .upsert(
          {
            driver_id: driverProfileId,
            vehicle_photo_url: urlData.publicUrl,
            vehicle_type: formData.vehicle_type,
            license_plate: formData.license_plate,
            make_model: formData.make_model,
            capacity_kg: formData.capacity_kg,
          },
          {
            onConflict: "driver_id",
          },
        );

      if (updateError) throw updateError;

      toast({
        title: "Upload Successful",
        description: "Vehicle photo uploaded",
      });

      fetchVehicle();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveVehicle = async () => {
    if (!formData.license_plate || !formData.make_model) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!driverProfileId) {
      toast({
        title: "Profile Required",
        description: "Please complete your driver profile first",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);

      const { error } = await (supabase as any).from("driver_vehicles").upsert(
        {
          driver_id: driverProfileId,
          vehicle_type: formData.vehicle_type,
          license_plate: formData.license_plate.toUpperCase(),
          make_model: formData.make_model,
          capacity_kg: formData.capacity_kg,
        },
        {
          onConflict: "driver_id",
        },
      );

      if (error) throw error;

      toast({
        title: "Vehicle Updated",
        description: "Your vehicle information has been saved",
      });

      fetchVehicle();
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
          <p className="text-muted-foreground">
            Loading vehicle information...
          </p>
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
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/driver/profile")}
            className="w-10 h-10 bg-card border border-border rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">
              Vehicle Registration
            </h1>
            <p className="text-sm text-muted-foreground">
              Register your delivery vehicle
            </p>
          </div>
          {vehicle?.is_verified && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-xs font-semibold text-green-600">
                Verified
              </span>
            </div>
          )}
        </div>

        {/* Verification Alert */}
        {!vehicle?.is_verified && vehicle?.vehicle_photo_url && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                  Pending Verification
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">
                  Your vehicle is under review. You'll be notified once
                  verified.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Vehicle Photo */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <Car className="w-5 h-5" />
            Vehicle Photo
          </h2>
          {vehicle?.vehicle_photo_url ? (
            <div className="space-y-3">
              <div className="border border-border rounded-xl overflow-hidden">
                <img
                  src={vehicle.vehicle_photo_url}
                  alt="Vehicle"
                  className="w-full h-64 object-cover"
                />
              </div>
              <input
                type="file"
                id="vehicle-photo"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
              />
              <label
                htmlFor="vehicle-photo"
                className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-xl font-semibold text-sm cursor-pointer hover:bg-muted/80 transition-colors"
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Uploading..." : "Replace Photo"}
              </label>
            </div>
          ) : (
            <div>
              <input
                type="file"
                id="vehicle-photo"
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading}
              />
              <label
                htmlFor="vehicle-photo"
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Upload className="w-8 h-8 text-muted-foreground mb-3" />
                <p className="text-sm font-semibold text-foreground">
                  {uploading ? "Uploading..." : "Upload Vehicle Photo"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Click to select file
                </p>
              </label>
            </div>
          )}
        </div>

        {/* Vehicle Type */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <h2 className="text-lg font-bold text-foreground mb-4">
            Vehicle Type
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {VEHICLE_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = formData.vehicle_type === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => handleInputChange("vehicle_type", type.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-foreground">
                        {type.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {type.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Vehicle Details */}
        <div className="bg-card rounded-2xl p-6 border border-border">
          <h2 className="text-lg font-bold text-foreground mb-4">
            Vehicle Details
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                License Plate *
              </label>
              <input
                type="text"
                value={formData.license_plate}
                onChange={(e) =>
                  handleInputChange(
                    "license_plate",
                    e.target.value.toUpperCase(),
                  )
                }
                placeholder="CA 123 GP"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary uppercase"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Make & Model *
              </label>
              <input
                type="text"
                value={formData.make_model}
                onChange={(e) =>
                  handleInputChange("make_model", e.target.value)
                }
                placeholder="Toyota Hilux 2.8 GD-6"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Capacity (kg)
              </label>
              <input
                type="number"
                value={formData.capacity_kg || ""}
                onChange={(e) =>
                  handleInputChange(
                    "capacity_kg",
                    parseInt(e.target.value) || null,
                  )
                }
                placeholder="500"
                className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum load capacity in kilograms
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/driver/profile")}
            className="px-6 py-3 bg-muted text-foreground rounded-xl font-semibold hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveVehicle}
            disabled={saving}
            className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Vehicle"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DriverVehicle;
