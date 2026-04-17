// app/reset-password.tsx
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  const [verifying, setVerifying] = useState(true);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const params = useLocalSearchParams();

  useEffect(() => {
    verifyToken();
  }, []);

  const verifyToken = async (): Promise<void> => {
    try {
      const tokenHash = params.token_hash as string | undefined;
      const type = params.type as string | undefined;
      const accessToken = params.access_token as string | undefined;
      const refreshToken = params.refresh_token as string | undefined;

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          setErrorMsg("This reset link has expired. Please request a new one.");
        } else {
          setReady(true);
        }
        setVerifying(false);
        return;
      }

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (error) {
          setErrorMsg("This reset link has expired. Please request a new one.");
        } else {
          setReady(true);
        }
        setVerifying(false);
        return;
      }

      let resolved = false;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") {
          resolved = true;
          setReady(true);
          setVerifying(false);
          subscription.unsubscribe();
        }
      });

      setTimeout(() => {
        subscription.unsubscribe();
        if (!resolved) {
          setErrorMsg(
            "Could not verify reset link. Please request a new password reset.",
          );
          setVerifying(false);
        }
      }, 6000);
    } catch (e: any) {
      setErrorMsg("Something went wrong. Please try again.");
      setVerifying(false);
    }
  };

  const handleReset = async (): Promise<void> => {
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
        "Password updated ✓",
        "Your password has been changed successfully.",
        [{ text: "Sign in", onPress: () => router.replace("/(auth)/login") }],
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

        {verifying && (
          <View style={styles.centerRow}>
            <ActivityIndicator color={Colors.accent} size="small" />
            <Text style={styles.subtitle}>Verifying your reset link…</Text>
          </View>
        )}

        {!verifying && errorMsg.length > 0 && (
          <View>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.replace("/(auth)/forgot-password")}
            >
              <Text style={styles.btnText}>Request new reset link</Text>
            </TouchableOpacity>
          </View>
        )}

        {!verifying && ready && (
          <>
            <Text style={styles.subtitle}>Enter your new password below.</Text>
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
    marginBottom: 16,
  },
  subtitle: {
    fontSize: Typography.base,
    color: Colors.muted,
    marginBottom: Spacing.xxxl,
  },
  centerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: Spacing.xl,
  },
  errorText: {
    fontSize: Typography.base,
    color: Colors.red,
    marginBottom: Spacing.xl,
    lineHeight: 22,
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
