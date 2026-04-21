import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { spacing, borderRadius, typography } from "../theme";
import { Icon } from "../components/Icon";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../lib/supabase";

interface SavedAddress {
  id: string;
  label: string;
  street: string;
  city: string;
  province: string;
  postal_code: string;
  country: string;
  is_default?: boolean;
}

export default function SavedAddressesScreen() {
  const { user } = useAuth();
  const { colors, gradients, shadows, isDark } = useTheme();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    label: "",
    street: "",
    city: "",
    province: "",
    postal_code: "",
  });

  const fetchAddresses = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error) {
      console.error("Error loading addresses:", error);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const openAddModal = () => {
    setEditingAddress(null);
    setFormData({
      label: "",
      street: "",
      city: "",
      province: "",
      postal_code: "",
    });
    setModalVisible(true);
  };

  const openEditModal = (address: SavedAddress) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      street: address.street,
      city: address.city,
      province: address.province,
      postal_code: address.postal_code,
    });
    setModalVisible(true);
  };

  const handleEditAddress = async (addressId: string, updates: any) => {
    try {
      const { error } = await supabase
        .from('addresses')
        .update({
          label: updates.label,
          street: updates.street,
          city: updates.city,
          province: updates.province,
          postal_code: updates.postal_code,
          is_default: updates.is_default,
        })
        .eq('id', addressId);

      if (error) throw error;
      fetchAddresses(); // Refresh list
      Alert.alert('Updated', 'Address updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSave = async () => {
    if (
      !formData.label ||
      !formData.street ||
      !formData.city ||
      !formData.province ||
      !formData.postal_code
    ) {
      Alert.alert("Missing Information", "Please fill in all required fields.");
      return;
    }

    setSaving(true);
    try {
      if (editingAddress) {
        // Update existing address via Supabase
        await handleEditAddress(editingAddress.id, formData);
      } else {
        // Add new address
        if (user?.id) {
          const { data: newAddr, error } = await supabase
            .from('addresses')
            .insert({
              user_id: user.id,
              ...formData,
              country: "South Africa",
              is_default: addresses.length === 0,
            })
            .select()
            .single();

          if (error) throw error;
          if (newAddr) {
            setAddresses((prev) => [newAddr, ...prev]);
          }
        }
      }
      setModalVisible(false);
    } catch (error: any) {
      console.error("Error saving address:", error);
      Alert.alert("Error", error.message || "Failed to save address.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (addressId: string) => {
    Alert.alert(
      "Delete Address",
      "Are you sure you want to delete this address?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('addresses')
                .delete()
                .eq('id', addressId);
              if (error) throw error;
            } catch (e: any) {
              console.error("Error deleting address:", e);
            }
            setAddresses((prev) => prev.filter((a) => a.id !== addressId));
          },
        },
      ],
    );
  };

  const getLabelIcon = (label: string): string => {
    const lower = label.toLowerCase();
    if (lower === "home") return "home-outline";
    if (lower === "work" || lower === "office") return "business-outline";
    return "location-outline";
  };

  const renderAddress = ({ item }: { item: SavedAddress }) => (
    <View style={[styles.addressCard, { backgroundColor: colors.background.tertiary, borderColor: colors.gold.border }]}>
      <View style={styles.addressHeader}>
        <View style={styles.labelRow}>
          <View style={[styles.labelIconWrapper, { backgroundColor: colors.gold.faint }]}>
            <Icon
              name={getLabelIcon(item.label)}
              size={20}
              color={colors.gold.primary}
            />
          </View>
          <Text style={[styles.addressLabel, { color: colors.text.primary }]}>{item.label}</Text>
          {item.is_default && (
            <View style={styles.defaultBadge}>
              <Text style={[styles.defaultText, { color: colors.status.success }]}>Default</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => openEditModal(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="create-outline" size={18} color={colors.gold.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.addressBody}>
        <Text style={[styles.addressStreet, { color: colors.text.secondary }]}>{item.street}</Text>
        <Text style={[styles.addressCity, { color: colors.text.muted }]}>
          {item.city}, {item.province} {item.postal_code}
        </Text>
      </View>

      <View style={[styles.addressActions, { borderTopColor: colors.gold.border }]}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item.id)}
          activeOpacity={0.7}
        >
          <Icon name="trash-outline" size={16} color={colors.status.error} />
          <Text style={[styles.deleteText, { color: colors.status.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background.primary }]}>
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text style={[styles.loadingText, { color: colors.text.muted }]}>Loading addresses...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <FlatList
        data={addresses}
        renderItem={renderAddress}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrapper, { backgroundColor: colors.gold.faint }]}>
              <Icon
                name="location-outline"
                size={48}
                color={colors.gold.dark}
              />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No saved addresses</Text>
            <Text style={[styles.emptyText, { color: colors.text.muted }]}>
              Add your delivery addresses for faster checkout
            </Text>
          </View>
        }
      />

      {/* Add Address Button */}
      <View style={[styles.addButtonContainer, { backgroundColor: colors.background.primary, borderTopColor: colors.gold.border }]}>
        <TouchableOpacity onPress={openAddModal} activeOpacity={0.8}>
          <LinearGradient
            colors={[...gradients.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.addButton, shadows.gold]}
          >
            <Icon name="add-outline" size={22} color={colors.text.inverse} />
            <Text style={[styles.addButtonText, { color: colors.text.inverse }]}>Add New Address</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Add/Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.background.tertiary, borderColor: colors.gold.border }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.gold.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>
                {editingAddress ? "Edit Address" : "Add New Address"}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon name="close" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Modal Form */}
            <ScrollView
              style={styles.modalForm}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.inputLabel, { color: colors.gold.muted }]}>Label</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background.secondary, color: colors.text.primary, borderColor: colors.gold.border }]}
                placeholder="e.g. Home, Work, Office"
                placeholderTextColor={colors.text.dim}
                value={formData.label}
                onChangeText={(text) =>
                  setFormData({ ...formData, label: text })
                }
              />

              <Text style={[styles.inputLabel, { color: colors.gold.muted }]}>Street Address</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background.secondary, color: colors.text.primary, borderColor: colors.gold.border }]}
                placeholder="e.g. 123 Main Road"
                placeholderTextColor={colors.text.dim}
                value={formData.street}
                onChangeText={(text) =>
                  setFormData({ ...formData, street: text })
                }
              />

              <Text style={[styles.inputLabel, { color: colors.gold.muted }]}>City</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background.secondary, color: colors.text.primary, borderColor: colors.gold.border }]}
                placeholder="e.g. Johannesburg"
                placeholderTextColor={colors.text.dim}
                value={formData.city}
                onChangeText={(text) =>
                  setFormData({ ...formData, city: text })
                }
              />

              <Text style={[styles.inputLabel, { color: colors.gold.muted }]}>Province</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background.secondary, color: colors.text.primary, borderColor: colors.gold.border }]}
                placeholder="e.g. Gauteng"
                placeholderTextColor={colors.text.dim}
                value={formData.province}
                onChangeText={(text) =>
                  setFormData({ ...formData, province: text })
                }
              />

              <Text style={[styles.inputLabel, { color: colors.gold.muted }]}>Postal Code</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background.secondary, color: colors.text.primary, borderColor: colors.gold.border, width: 140 }]}
                placeholder="e.g. 2000"
                placeholderTextColor={colors.text.dim}
                value={formData.postal_code}
                onChangeText={(text) =>
                  setFormData({ ...formData, postal_code: text })
                }
                keyboardType="number-pad"
                maxLength={5}
              />

              {/* Save Button */}
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
                style={{ marginTop: spacing.sm }}
              >
                <LinearGradient
                  colors={[...gradients.gold]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveButton}
                >
                  {saving ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.text.inverse}
                    />
                  ) : (
                    <Text style={[styles.saveButtonText, { color: colors.text.inverse }]}>
                      {editingAddress ? "Update Address" : "Save Address"}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={{ height: spacing.xxl }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    ...typography.bodySmall,
    marginTop: spacing.sm,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: 100,
    flexGrow: 1,
  },
  addressCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  addressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  labelIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  addressLabel: {
    ...typography.body,
    fontWeight: "700",
  },
  defaultBadge: {
    backgroundColor: "rgba(16,185,129,0.15)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  defaultText: {
    ...typography.caption,
    fontWeight: "700",
    fontSize: 10,
  },
  editButton: {
    padding: spacing.xs,
  },
  addressBody: {
    marginBottom: spacing.sm,
    paddingLeft: spacing.xxl - 4,
  },
  addressStreet: {
    ...typography.body,
    marginBottom: 2,
  },
  addressCity: {
    ...typography.bodySmall,
  },
  addressActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    paddingTop: spacing.sm,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  deleteText: {
    ...typography.bodySmall,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrapper: {
    width: 90,
    height: 90,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
  },
  emptyText: {
    ...typography.bodySmall,
    textAlign: "center",
  },
  addButtonContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    borderTopWidth: 1,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  addButtonText: {
    ...typography.button,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: "90%",
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    ...typography.h3,
  },
  modalForm: {
    padding: spacing.lg,
  },
  inputLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  input: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...typography.body,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  saveButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: borderRadius.md,
  },
  saveButtonText: {
    ...typography.button,
  },
});
