// app/(auth)/forgot-password.tsx
import { router } from "expo-router";
import React, { useState } from "react";
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
import { supabase } from "../../src/services/supabase";
import { Colors, Radius, Spacing, Typography } from "../../src/theme";

type Step = "email" | "otp" | "password";

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1 — send OTP
  const handleSendOTP = async () => {
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
      );
      if (error) throw error;
      setStep("otp");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify OTP
  const handleVerifyOTP = async () => {
    if (otp.length !== 8) {
      Alert.alert("Error", "Please enter the 8-digit code from your email.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: "recovery",
      });
      if (error) throw error;
      setStep("password");
    } catch (e: any) {
      Alert.alert(
        "Invalid code",
        "The code is incorrect or has expired. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 3 — set new password
  const handleSetPassword = async () => {
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
        "Your password has been changed. Please sign in.",
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
        {/* Back button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => {
            if (step === "otp") setStep("email");
            else if (step === "password") setStep("otp");
            else router.back();
          }}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>

        {/* Step indicators */}
        <View style={styles.steps}>
          {(["email", "otp", "password"] as Step[]).map((s, i) => (
            <View
              key={s}
              style={[
                styles.stepDot,
                step === s && styles.stepDotActive,
                (step === "otp" && i === 0) || (step === "password" && i <= 1)
                  ? styles.stepDotDone
                  : null,
              ]}
            />
          ))}
        </View>

        {/* STEP 1 — Email */}
        {step === "email" && (
          <View style={styles.card}>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a 8-digit code.
            </Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.subtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSendOTP}
              disabled={loading}
            >
              <Text style={styles.btnText}>
                {loading ? "Sending…" : "Send reset code"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2 — OTP code */}
        {step === "otp" && (
          <View style={styles.card}>
            <Text style={styles.title}>Enter code</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to{"\n"}
              <Text style={styles.emailHighlight}>{email}</Text>
            </Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>6-digit code</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                value={otp}
                onChangeText={(v) =>
                  setOtp(v.replace(/[^0-9]/g, "").slice(0, 8))
                }
                placeholder="00000000"
                placeholderTextColor={Colors.subtle}
                keyboardType="number-pad"
                maxLength={8}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={[
                styles.btn,
                (loading || otp.length !== 8) && styles.btnDisabled,
              ]}
              onPress={handleVerifyOTP}
              disabled={loading || otp.length !== 8}
            >
              <Text style={styles.btnText}>
                {loading ? "Verifying…" : "Verify code"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.resendBtn}
              onPress={handleSendOTP}
              disabled={loading}
            >
              <Text style={styles.resendText}>
                Didn't receive it? Resend code
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3 — New password */}
        {step === "password" && (
          <View style={styles.card}>
            <Text style={styles.title}>New password</Text>
            <Text style={styles.subtitle}>
              Choose a strong password for your account.
            </Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 8 characters"
                placeholderTextColor={Colors.subtle}
                secureTextEntry
                autoFocus
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
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSetPassword}
              disabled={loading}
            >
              <Text style={styles.btnText}>
                {loading ? "Updating…" : "Update password"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { flex: 1, padding: Spacing.xl, justifyContent: "center" },
  backBtn: { position: "absolute", top: 60, left: Spacing.xl },
  backText: { fontSize: Typography.md, color: Colors.accent },
  steps: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: Spacing.xxxl,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surface3,
  },
  stepDotActive: {
    backgroundColor: Colors.accent,
    width: 24,
  },
  stepDotDone: {
    backgroundColor: Colors.green,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
  },
  title: {
    fontSize: Typography.xl,
    fontWeight: Typography.semibold,
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: Typography.base,
    color: Colors.muted,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  emailHighlight: {
    color: Colors.accent,
    fontWeight: Typography.medium,
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
    backgroundColor: Colors.surface2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    fontSize: Typography.md,
    color: Colors.text,
  },
  otpInput: {
    fontSize: 32,
    fontWeight: Typography.bold,
    textAlign: "center",
    letterSpacing: 12,
    paddingVertical: Spacing.lg,
    color: Colors.accent,
  },
  btn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.sm,
    padding: Spacing.lg,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.bg,
  },
  resendBtn: {
    alignItems: "center",
    marginTop: Spacing.lg,
    padding: Spacing.sm,
  },
  resendText: {
    fontSize: Typography.sm,
    color: Colors.muted,
  },
});
