import { useState, useCallback, useEffect } from "react";

// Types for inventory verification and theft prevention
export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  price: number;
  barcode?: string;
  imageUrl?: string;
  category: string;
  size?: string;
}

export interface PickupRecord {
  orderId: string;
  driverId: string;
  driverName: string;
  items: VerifiedItem[];
  pickupTime: string;
  pickupLocation: { lat: number; lng: number; address: string };
  warehouseId: string;
  warehouseName: string;
  driverSignature: string; // Base64 signature image
  warehouseStaffId?: string;
  warehouseStaffName?: string;
  warehouseSignature?: string;
  photos: string[]; // Base64 photos of items
  status: "pending" | "verified" | "dispatched";
  notes?: string;
}

export interface DeliveryRecord {
  orderId: string;
  driverId: string;
  driverName: string;
  items: VerifiedItem[];
  deliveryTime: string;
  deliveryLocation: { lat: number; lng: number; address: string };
  customerSignature?: string;
  customerName?: string;
  customerPhone?: string;
  proofPhotos: string[];
  status: "pending" | "delivered" | "partial" | "refused";
  discrepancies: ItemDiscrepancy[];
  notes?: string;
}

export interface VerifiedItem extends OrderItem {
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  scannedBarcode?: string;
  condition: "good" | "damaged" | "missing";
  photo?: string;
  notes?: string;
}

export interface ItemDiscrepancy {
  itemId: string;
  itemName: string;
  expectedQuantity: number;
  actualQuantity: number;
  reason: "missing" | "damaged" | "wrong_item" | "customer_refused";
  notes?: string;
  reportedAt: string;
  reportedBy: string;
}

export interface InventoryAuditLog {
  id: string;
  orderId: string;
  action:
    | "pickup_started"
    | "item_scanned"
    | "item_verified"
    | "pickup_signed"
    | "dispatch_started"
    | "delivery_attempted"
    | "item_delivered"
    | "delivery_signed"
    | "discrepancy_reported"
    | "photo_captured";
  itemId?: string;
  itemName?: string;
  driverId: string;
  driverName: string;
  timestamp: string;
  location: { lat: number; lng: number };
  details: Record<string, any>;
}

// Storage keys
const PICKUP_RECORDS_KEY = "liqzar_pickup_records";
const DELIVERY_RECORDS_KEY = "liqzar_delivery_records";
const AUDIT_LOG_KEY = "liqzar_audit_log";
const PENDING_SYNC_KEY = "liqzar_pending_sync";

/**
 * Hook for managing order item verification during pickup
 */
export function usePickupVerification(
  orderId: string,
  driverId: string,
  driverName: string,
  orderItems: OrderItem[],
) {
  const [items, setItems] = useState<VerifiedItem[]>(() =>
    orderItems.map((item) => ({
      ...item,
      verified: false,
      condition: "good" as const,
    })),
  );
  const [pickupStarted, setPickupStarted] = useState(false);
  const [allVerified, setAllVerified] = useState(false);
  const [driverSignature, setDriverSignature] = useState<string | null>(null);
  const [warehouseSignature, setWarehouseSignature] = useState<string | null>(
    null,
  );
  const [photos, setPhotos] = useState<string[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Check if all items are verified
  useEffect(() => {
    const allDone = items.every((item) => item.verified);
    setAllVerified(allDone);
  }, [items]);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => setCurrentLocation({ lat: -26.0875, lng: 28.0432 }), // Default to Johannesburg
      );
    }
  }, []);

  // Log audit event
  const logAudit = useCallback(
    (
      action: InventoryAuditLog["action"],
      itemId?: string,
      itemName?: string,
      details: Record<string, any> = {},
    ) => {
      const log: InventoryAuditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        orderId,
        action,
        itemId,
        itemName,
        driverId,
        driverName,
        timestamp: new Date().toISOString(),
        location: currentLocation || { lat: 0, lng: 0 },
        details,
      };

      // Store in localStorage
      const existing = JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) || "[]");
      existing.push(log);
      localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(existing.slice(-500))); // Keep last 500

      // Queue for sync
      const pending = JSON.parse(
        localStorage.getItem(PENDING_SYNC_KEY) || "[]",
      );
      pending.push({ type: "audit", data: log });
      localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pending));

      return log;
    },
    [orderId, driverId, driverName, currentLocation],
  );

  // Start pickup process
  const startPickup = useCallback(() => {
    setPickupStarted(true);
    logAudit("pickup_started", undefined, undefined, {
      totalItems: items.length,
      totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    });
  }, [items, logAudit]);

  // Verify item by scanning barcode
  const verifyItemByBarcode = useCallback(
    (barcode: string): VerifiedItem | null => {
      const itemIndex = items.findIndex(
        (i) => i.barcode === barcode && !i.verified,
      );

      if (itemIndex === -1) {
        // Check if already scanned
        const alreadyScanned = items.find(
          (i) => i.barcode === barcode && i.verified,
        );
        if (alreadyScanned) {
          return null; // Already verified
        }
        return null; // Not found
      }

      const updatedItem: VerifiedItem = {
        ...items[itemIndex],
        verified: true,
        verifiedAt: new Date().toISOString(),
        verifiedBy: driverName,
        scannedBarcode: barcode,
      };

      setItems((prev) => {
        const updated = [...prev];
        updated[itemIndex] = updatedItem;
        return updated;
      });

      logAudit("item_scanned", updatedItem.id, updatedItem.name, {
        barcode,
        quantity: updatedItem.quantity,
      });

      return updatedItem;
    },
    [items, driverName, logAudit],
  );

  // Manually verify item
  const verifyItemManually = useCallback(
    (
      itemId: string,
      condition: VerifiedItem["condition"] = "good",
      notes?: string,
    ) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            const updated = {
              ...item,
              verified: true,
              verifiedAt: new Date().toISOString(),
              verifiedBy: driverName,
              condition,
              notes,
            };

            logAudit("item_verified", item.id, item.name, {
              condition,
              notes,
              manual: true,
            });

            return updated;
          }
          return item;
        }),
      );
    },
    [driverName, logAudit],
  );

  // Mark item as damaged/missing
  const reportItemIssue = useCallback(
    (itemId: string, condition: "damaged" | "missing", notes: string) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            const updated = {
              ...item,
              verified: true, // Still mark as processed
              verifiedAt: new Date().toISOString(),
              verifiedBy: driverName,
              condition,
              notes,
            };

            logAudit("discrepancy_reported", item.id, item.name, {
              condition,
              notes,
            });

            return updated;
          }
          return item;
        }),
      );
    },
    [driverName, logAudit],
  );

  // Add photo proof
  const addPhoto = useCallback(
    (photoBase64: string) => {
      setPhotos((prev) => [...prev, photoBase64]);
      logAudit("photo_captured", undefined, undefined, {
        photoIndex: photos.length,
      });
    },
    [photos.length, logAudit],
  );

  // Complete pickup with signatures
  const completePickup = useCallback(
    (
      driverSig: string,
      warehouseSig?: string,
      warehouseStaffName?: string,
      warehouseStaffId?: string,
      warehouseName: string = "Main Warehouse",
    ): PickupRecord => {
      setDriverSignature(driverSig);
      if (warehouseSig) setWarehouseSignature(warehouseSig);

      const record: PickupRecord = {
        orderId,
        driverId,
        driverName,
        items,
        pickupTime: new Date().toISOString(),
        pickupLocation: {
          ...currentLocation!,
          address: warehouseName,
        },
        warehouseId: "warehouse_001",
        warehouseName,
        driverSignature: driverSig,
        warehouseStaffId,
        warehouseStaffName,
        warehouseSignature: warehouseSig,
        photos,
        status: "dispatched",
      };

      // Save to localStorage
      const existing = JSON.parse(
        localStorage.getItem(PICKUP_RECORDS_KEY) || "[]",
      );
      existing.push(record);
      localStorage.setItem(PICKUP_RECORDS_KEY, JSON.stringify(existing));

      logAudit("pickup_signed", undefined, undefined, {
        itemCount: items.length,
        verifiedCount: items.filter((i) => i.verified).length,
        hasWarehouseSignature: !!warehouseSig,
      });

      return record;
    },
    [orderId, driverId, driverName, items, currentLocation, photos, logAudit],
  );

  // Get verification progress
  const progress = {
    total: items.length,
    verified: items.filter((i) => i.verified).length,
    damaged: items.filter((i) => i.condition === "damaged").length,
    missing: items.filter((i) => i.condition === "missing").length,
    percentage:
      items.length > 0
        ? Math.round(
            (items.filter((i) => i.verified).length / items.length) * 100,
          )
        : 0,
  };

  return {
    items,
    pickupStarted,
    allVerified,
    driverSignature,
    warehouseSignature,
    photos,
    progress,
    startPickup,
    verifyItemByBarcode,
    verifyItemManually,
    reportItemIssue,
    addPhoto,
    completePickup,
  };
}

/**
 * Hook for managing delivery verification
 */
export function useDeliveryVerification(
  orderId: string,
  driverId: string,
  driverName: string,
  pickedItems: VerifiedItem[],
) {
  const [items, setItems] = useState<VerifiedItem[]>(
    pickedItems.map((i) => ({
      ...i,
      verified: false, // Reset for delivery verification
    })),
  );
  const [deliveryStarted, setDeliveryStarted] = useState(false);
  const [customerSignature, setCustomerSignature] = useState<string | null>(
    null,
  );
  const [proofPhotos, setProofPhotos] = useState<string[]>([]);
  const [discrepancies, setDiscrepancies] = useState<ItemDiscrepancy[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) =>
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => setCurrentLocation({ lat: -26.0875, lng: 28.0432 }),
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Log audit event
  const logAudit = useCallback(
    (
      action: InventoryAuditLog["action"],
      itemId?: string,
      itemName?: string,
      details: Record<string, any> = {},
    ) => {
      const log: InventoryAuditLog = {
        id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        orderId,
        action,
        itemId,
        itemName,
        driverId,
        driverName,
        timestamp: new Date().toISOString(),
        location: currentLocation || { lat: 0, lng: 0 },
        details,
      };

      const existing = JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) || "[]");
      existing.push(log);
      localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(existing.slice(-500)));

      return log;
    },
    [orderId, driverId, driverName, currentLocation],
  );

  // Start delivery
  const startDelivery = useCallback(() => {
    setDeliveryStarted(true);
    logAudit("dispatch_started");
  }, [logAudit]);

  // Confirm item delivered to customer
  const confirmItemDelivered = useCallback(
    (itemId: string) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id === itemId) {
            logAudit("item_delivered", item.id, item.name);
            return {
              ...item,
              verified: true,
              verifiedAt: new Date().toISOString(),
            };
          }
          return item;
        }),
      );
    },
    [logAudit],
  );

  // Report discrepancy during delivery
  const reportDiscrepancy = useCallback(
    (
      itemId: string,
      actualQuantity: number,
      reason: ItemDiscrepancy["reason"],
      notes?: string,
    ) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      const discrepancy: ItemDiscrepancy = {
        itemId,
        itemName: item.name,
        expectedQuantity: item.quantity,
        actualQuantity,
        reason,
        notes,
        reportedAt: new Date().toISOString(),
        reportedBy: driverName,
      };

      setDiscrepancies((prev) => [...prev, discrepancy]);

      logAudit("discrepancy_reported", itemId, item.name, {
        expected: item.quantity,
        actual: actualQuantity,
        reason,
        notes,
      });

      // Mark as verified with issue
      setItems((prev) =>
        prev.map((i) => {
          if (i.id === itemId) {
            return {
              ...i,
              verified: true,
              condition: reason === "damaged" ? "damaged" : "missing",
              notes,
            };
          }
          return i;
        }),
      );
    },
    [items, driverName, logAudit],
  );

  // Add proof photo
  const addProofPhoto = useCallback(
    (photoBase64: string) => {
      setProofPhotos((prev) => [...prev, photoBase64]);
      logAudit("photo_captured", undefined, undefined, { stage: "delivery" });
    },
    [logAudit],
  );

  // Complete delivery with customer signature
  const completeDelivery = useCallback(
    (
      customerSig: string,
      customerName: string,
      customerPhone: string,
      deliveryAddress: string,
      notes?: string,
    ): DeliveryRecord => {
      setCustomerSignature(customerSig);

      const allDelivered = items.every((i) => i.verified);
      const hasDiscrepancies = discrepancies.length > 0;

      const record: DeliveryRecord = {
        orderId,
        driverId,
        driverName,
        items,
        deliveryTime: new Date().toISOString(),
        deliveryLocation: {
          ...currentLocation!,
          address: deliveryAddress,
        },
        customerSignature: customerSig,
        customerName,
        customerPhone,
        proofPhotos,
        status: hasDiscrepancies
          ? "partial"
          : allDelivered
            ? "delivered"
            : "pending",
        discrepancies,
        notes,
      };

      // Save to localStorage
      const existing = JSON.parse(
        localStorage.getItem(DELIVERY_RECORDS_KEY) || "[]",
      );
      existing.push(record);
      localStorage.setItem(DELIVERY_RECORDS_KEY, JSON.stringify(existing));

      logAudit("delivery_signed", undefined, undefined, {
        status: record.status,
        discrepancyCount: discrepancies.length,
        hasCustomerSignature: true,
      });

      // Broadcast to admin for real-time monitoring
      const channel = new BroadcastChannel("liqzar_delivery");
      channel.postMessage({ type: "delivery_complete", record });
      channel.close();

      return record;
    },
    [
      orderId,
      driverId,
      driverName,
      items,
      currentLocation,
      proofPhotos,
      discrepancies,
      logAudit,
    ],
  );

  // Compare picked vs delivered
  const compareInventory = useCallback((): {
    matched: VerifiedItem[];
    discrepant: ItemDiscrepancy[];
    missing: VerifiedItem[];
  } => {
    const pickupRecord = JSON.parse(
      localStorage.getItem(PICKUP_RECORDS_KEY) || "[]",
    ).find((r: PickupRecord) => r.orderId === orderId);

    if (!pickupRecord) {
      return { matched: [], discrepant: discrepancies, missing: [] };
    }

    const matched: VerifiedItem[] = [];
    const missing: VerifiedItem[] = [];

    pickupRecord.items.forEach((pickedItem: VerifiedItem) => {
      const deliveredItem = items.find(
        (i) => i.id === pickedItem.id && i.verified,
      );
      if (deliveredItem) {
        matched.push(deliveredItem);
      } else {
        missing.push(pickedItem);
      }
    });

    return { matched, discrepant: discrepancies, missing };
  }, [orderId, items, discrepancies]);

  const progress = {
    total: items.length,
    delivered: items.filter((i) => i.verified).length,
    discrepancies: discrepancies.length,
    percentage:
      items.length > 0
        ? Math.round(
            (items.filter((i) => i.verified).length / items.length) * 100,
          )
        : 0,
  };

  return {
    items,
    deliveryStarted,
    customerSignature,
    proofPhotos,
    discrepancies,
    progress,
    startDelivery,
    confirmItemDelivered,
    reportDiscrepancy,
    addProofPhoto,
    completeDelivery,
    compareInventory,
  };
}

/**
 * Get all audit logs for an order
 */
export function getOrderAuditLogs(orderId: string): InventoryAuditLog[] {
  const allLogs = JSON.parse(localStorage.getItem(AUDIT_LOG_KEY) || "[]");
  return allLogs.filter((log: InventoryAuditLog) => log.orderId === orderId);
}

/**
 * Get pickup record for an order
 */
export function getPickupRecord(orderId: string): PickupRecord | null {
  const records = JSON.parse(localStorage.getItem(PICKUP_RECORDS_KEY) || "[]");
  return records.find((r: PickupRecord) => r.orderId === orderId) || null;
}

/**
 * Get delivery record for an order
 */
export function getDeliveryRecord(orderId: string): DeliveryRecord | null {
  const records = JSON.parse(
    localStorage.getItem(DELIVERY_RECORDS_KEY) || "[]",
  );
  return records.find((r: DeliveryRecord) => r.orderId === orderId) || null;
}
