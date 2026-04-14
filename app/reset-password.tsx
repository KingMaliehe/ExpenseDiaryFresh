// app/reset-password.tsx
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "../src/services/supabase";
import { Colors, Radius, Spacing, Typography } from "../src/theme";

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase automatically picks up the token from the deep link
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async () => {
    if (!password) {
      Alert.alert("Error", "Please enter a new password.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert(
        "Password updated",
        "Your password has been changed successfully.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }],
      );
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Set new password</Text>
        <Text style={styles.subtitle}>
          {ready
            ? "Enter your new password below."
            : "Verifying your reset link…"}
        </Text>

        {ready && (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 8 characters"
                placeholderTextColor={Colors.subtle}
                secureTextEntry
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Repeat new password"
                placeholderTextColor={Colors.subtle}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={handleReset}
              disabled={loading}
            >
              <Text style={styles.btnText}>
                {loading ? "Updating…" : "Update password"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { flex: 1, padding: Spacing.xl, justifyContent: "center" },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: Typography.base,
    color: Colors.muted,
    marginBottom: Spacing.xxxl,
  },
  fieldGroup: { marginBottom: Spacing.lg },
  label: {
    fontSize: Typography.xs,
    fontWeight: Typography.medium,
    color: Colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    fontSize: Typography.md,
    color: Colors.text,
  },
  btn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.sm,
    padding: Spacing.lg,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  btnText: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.bg,
  },
});
