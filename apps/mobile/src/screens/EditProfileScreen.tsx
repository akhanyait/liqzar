import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../components/Icon";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, borderRadius } from "../theme";
import { supabase } from "../lib/supabase";
let ImagePicker: any = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  // Native module not available in this build
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors, isDark, shadows } = useTheme();

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [originalEmail] = useState(user?.email || "");
  const [phone] = useState(user?.phone || "");
  const [dob, setDob] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const userId = (await supabase.auth.getUser()).data.user?.id;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          email: email,
          date_of_birth: dob,
        })
        .eq('id', userId);

      if (error) throw error;

      // Also update auth email if changed
      if (email !== originalEmail) {
        await supabase.auth.updateUser({ email });
      }

      Alert.alert('Saved', 'Profile updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        const fileName = `avatars/${userId}/${Date.now()}.jpg`;

        const response = await fetch(result.assets[0].uri);
        const blob = await response.blob();

        await supabase.storage.from('avatars').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
        const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);

        await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId);
        setAvatarUrl(data.publicUrl);
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to upload photo.');
      }
    }
  };

  const renderField = (
    label: string,
    value: string,
    onChangeText: (t: string) => void,
    options?: {
      placeholder?: string;
      disabled?: boolean;
      keyboardType?: "default" | "email-address" | "phone-pad";
      autoCapitalize?: "none" | "sentences" | "words";
    },
  ) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={[st.fieldLabel, { color: colors.text.muted }]}>{label}</Text>
      <TextInput
        style={[
          st.fieldInput,
          {
            color: options?.disabled ? colors.text.dim : colors.text.primary,
            borderColor: colors.gold.border,
            backgroundColor: options?.disabled
              ? colors.background.tertiary
              : colors.background.card,
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={options?.placeholder || ""}
        placeholderTextColor={colors.text.dim}
        editable={!options?.disabled}
        keyboardType={options?.keyboardType || "default"}
        autoCapitalize={options?.autoCapitalize || "sentences"}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#0f1628", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 16,
          paddingHorizontal: spacing.md,
        }}
      >
        <View style={st.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={st.backBtn}
          >
            <Icon name="arrow-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: colors.text.primary }]}>
            Edit Profile
          </Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View style={st.avatarSection}>
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={st.avatarImage}
            />
          ) : (
            <LinearGradient
              colors={[colors.gold.primary, colors.gold.dark]}
              style={st.avatarCircle}
            >
              <Icon name="person" size={36} color={colors.white} />
            </LinearGradient>
          )}
          <TouchableOpacity onPress={handleChangePhoto} activeOpacity={0.7}>
            <Text style={[st.changePhotoText, { color: colors.gold.primary }]}>
              Change Photo
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: 8 }}>
          <View
            style={[
              st.formCard,
              {
                backgroundColor: colors.background.card,
                borderColor: colors.gold.border,
              },
            ]}
          >
            {renderField("Full Name", fullName, setFullName, {
              placeholder: "Enter your full name",
              autoCapitalize: "words",
            })}
            {renderField("Email", email, setEmail, {
              placeholder: "Enter your email",
              keyboardType: "email-address",
              autoCapitalize: "none",
            })}
            {renderField("Phone Number", phone, () => {}, {
              placeholder: "Phone number",
              disabled: true,
              keyboardType: "phone-pad",
            })}
            {renderField("Date of Birth", dob, setDob, {
              placeholder: "DD/MM/YYYY",
            })}
          </View>
        </View>

        {/* Save Button */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: 20 }}>
          <TouchableOpacity onPress={handleSave} activeOpacity={0.8} disabled={saving}>
            <LinearGradient colors={[colors.gold.primary, colors.gold.dark]} style={st.saveBtn}>
              {saving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={st.saveBtnText}>Save Changes</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  avatarSection: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 12,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 10,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: "700",
  },
  formCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    height: 48,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  saveBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
