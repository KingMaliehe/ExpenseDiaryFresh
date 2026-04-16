// app/reset-password.tsx
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import React, { useEffect, useRef, useState } from "react";
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

/**
 * Parses Supabase-style auth redirect URLs and returns relevant tokens.
 *
 * Two shapes are supported:
 *   1. Query-string style (custom template with {{ .TokenHash }}):
 *        myapp://reset-password?token_hash=abc&type=recovery
 *   2. Hash-fragment style (default {{ .ConfirmationURL }} flow):
 *        myapp://reset-password#access_token=...&refresh_token=...&type=recovery
 */
function parseAuthUrl(url: string | null): {
  tokenHash?: string;
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  type?: string;
} {
  if (!url) return {};
  const result: ReturnType<typeof parseAuthUrl> = {};

  // Query-string params
  try {
    const parsed = Linking.parse(url);
    const qp = parsed.queryParams ?? {};
    if (typeof qp.token_hash === "string") result.tokenHash = qp.token_hash;
    if (typeof qp.code === "string") result.code = qp.code;
    if (typeof qp.type === "string") result.type = qp.type;
  } catch {
    // ignore
  }

  // Hash-fragment params (after "#")
  const hashIndex = url.indexOf("#");
  if (hashIndex >= 0) {
    const hash = url.slice(hashIndex + 1);
    const frag = new URLSearchParams(hash);
    const at = frag.get("access_token");
    const rt = frag.get("refresh_token");
    const ty = frag.get("type");
    const cd = frag.get("code");
    if (at) result.accessToken = at;
    if (rt) result.refreshToken = rt;
    if (ty) result.type = ty;
    if (cd) result.code = cd;
  }

  return result;
}

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [ready, setReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [debugUrl, setDebugUrl] = useState<string>("");
  const readyRef = useRef(false);

  const params = useLocalSearchParams();

  useEffect(() => {
    let cancelled = false;

    const markReady = () => {
      if (cancelled) return;
      readyRef.current = true;
      setReady(true);
      setVerifying(false);
    };

    const markError = (msg: string) => {
      if (cancelled) return;
      setErrorMsg(msg);
      setVerifying(false);
    };

    const tryProcess = async (url: string | null): Promise<boolean> => {
      if (url && !cancelled) setDebugUrl(url);
      const parsed = parseAuthUrl(url);

      // Also consider params coming in via expo-router
      const routerTokenHash = params.token_hash as string | undefined;
      const routerCode = params.code as string | undefined;
      const routerType = params.type as string | undefined;

      const tokenHash = parsed.tokenHash ?? routerTokenHash;
      const code = parsed.code ?? routerCode;
      const type = parsed.type ?? routerType;

      // 1. PKCE flow: exchange ?code=... for a session
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          markError("This reset link has expired or is invalid. Please request a new one.");
          return true;
        }
        markReady();
        return true;
      }

      // 2. Hash-fragment (implicit) flow: set the session directly with tokens
      if (parsed.accessToken && parsed.refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });
        if (error) {
          markError("This reset link has expired or is invalid. Please request a new one.");
          return true;
        }
        markReady();
        return true;
      }

      // 3. Token-hash (OTP) flow
      if (tokenHash && (type === "recovery" || type === undefined)) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });
        if (error) {
          markError("This reset link has expired or is invalid. Please request a new one.");
          return true;
        }
        markReady();
        return true;
      }

      return false;
    };

    (async () => {
      // Check the initial URL that launched the app (if any)
      const initialUrl = await Linking.getInitialURL();
      const handled = await tryProcess(initialUrl);

      if (!handled) {
        // Fallback: listen for PASSWORD_RECOVERY auth event
        // (the supabase client fires this when it auto-detects recovery tokens)
        const {
          data: { subscription: authSub },
        } = supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY") {
            markReady();
          }
        });

        // Also listen for further incoming deep links while we're on this screen
        const linkSub = Linking.addEventListener("url", ({ url }) => {
          tryProcess(url);
        });

        // Timeout after 6 seconds if nothing arrives
        const to = setTimeout(() => {
          if (!readyRef.current) {
            markError(
              "Could not verify reset link. Please request a new password reset.",
            );
          }
        }, 6000);

        return () => {
          clearTimeout(to);
          authSub.unsubscribe();
          linkSub.remove();
        };
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            {debugUrl.length > 0 && (
              <View style={styles.debugBox}>
                <Text style={styles.debugLabel}>Debug — received URL:</Text>
                <Text style={styles.debugText} selectable>
                  {debugUrl}
                </Text>
              </View>
            )}
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
  debugBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.xl,
  },
  debugLabel: {
    fontSize: Typography.xs,
    color: Colors.muted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  debugText: {
    fontSize: 11,
    color: Colors.subtle,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
