// app/(tabs)/add.tsx
import { format } from "date-fns";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateField from "../../components/DateField";
import { api } from "../../src/services/apiClient";
import { currencyInfo } from "../../src/lib/currency";
import { useAuthStore } from "../../src/store/authStore";
import { useTransactionStore } from "../../src/store/transactionStore";
import { Colors, Radius, Spacing, Typography } from "../../src/theme";
import { Category } from "../../src/types/database";

export default function AddScreen() {
  const { user, profile } = useAuthStore();
  const symbol = currencyInfo(profile?.currency).symbol;
  const { addTransaction } = useTransactionStore();
  const scrollRef = useRef<ScrollView>(null);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [notes, setNotes] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.categories
      .list()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [user]);

  const filteredCategories = categories.filter((c) =>
    type === "income"
      ? c.name === "Income" || c.name === "Savings"
      : c.name !== "Income",
  );

  const dateForDB = format(selectedDate, "yyyy-MM-dd");

  // When notes is focused, scroll down so keyboard doesn't cover it
  const handleNotesFocus = () => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert("Missing description", "Please enter a description.");
      return;
    }
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert(
        "Invalid amount",
        "Please enter a valid amount greater than 0.",
      );
      return;
    }
    if (!selectedCategory) {
      Alert.alert("No category", "Please select a category.");
      return;
    }

    setSaving(true);
    try {
      await addTransaction({
        description: description.trim(),
        amount: parsedAmount,
        type,
        date: dateForDB,
        category_id: selectedCategory.id,
        notes: notes.trim() || null,
        is_recurring: false,
      });
      setDescription("");
      setAmount("");
      setSelectedCategory(null);
      setNotes("");
      setSelectedDate(new Date());
      router.push("/(tabs)/dashboard");
    } catch (e: any) {
      Alert.alert("Error saving", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>New entry</Text>
        </View>

        {/* Type toggle */}
        <View style={styles.typeToggle}>
          {(["expense", "income"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[
                styles.typeBtn,
                type === t &&
                  (t === "expense"
                    ? styles.typeBtnExpense
                    : styles.typeBtnIncome),
              ]}
              onPress={() => {
                setType(t);
                setSelectedCategory(null);
              }}
            >
              <Text
                style={[
                  styles.typeBtnText,
                  type === t &&
                    (t === "expense"
                      ? styles.typeTextExpense
                      : styles.typeTextIncome),
                ]}
              >
                {t === "expense" ? "💸 Expense" : "💰 Income"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Amount */}
        <View style={styles.amountCard}>
          <Text style={styles.amountPrefix}>{symbol}</Text>
          <TextInput
            style={styles.amountInput}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={Colors.subtle}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Description */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="e.g. Woolworths groceries"
            placeholderTextColor={Colors.subtle}
          />
        </View>

        {/* Categories */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.catGrid}>
            {filteredCategories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catChip,
                  selectedCategory?.id === cat.id && {
                    borderColor: cat.color,
                    backgroundColor: cat.color + "22",
                  },
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={styles.catChipIcon}>{cat.icon}</Text>
                <Text
                  style={[
                    styles.catChipLabel,
                    selectedCategory?.id === cat.id && { color: cat.color },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date picker */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Date</Text>
          <DateField
            value={selectedDate}
            onChange={setSelectedDate}
            maximumDate={new Date()}
          />
        </View>

        {/* Notes — scrolls into view when keyboard opens */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            onFocus={handleNotesFocus}
            placeholder="Any extra details…"
            placeholderTextColor={Colors.subtle}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving…" : "Save entry"}
          </Text>
        </TouchableOpacity>

        {/* Extra space at bottom so save button is never hidden by keyboard */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: Spacing.xl,
    paddingBottom: 80,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.text,
  },
  typeToggle: {
    flexDirection: "row",
    backgroundColor: Colors.surface2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    marginBottom: Spacing.xl,
  },
  typeBtn: {
    flex: 1,
    padding: 12,
    alignItems: "center",
  },
  typeBtnExpense: { backgroundColor: "rgba(248,81,73,0.15)" },
  typeBtnIncome: { backgroundColor: "rgba(63,185,80,0.15)" },
  typeBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.muted,
  },
  typeTextExpense: { color: Colors.red },
  typeTextIncome: { color: Colors.green },
  amountCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    justifyContent: "center",
  },
  amountPrefix: {
    fontSize: 32,
    fontWeight: Typography.bold,
    color: Colors.accent,
    marginRight: 4,
  },
  amountInput: {
    fontSize: 42,
    fontWeight: Typography.bold,
    color: Colors.text,
    minWidth: 120,
  },
  fieldGroup: {
    marginBottom: Spacing.lg,
  },
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
  // Notes input — separate style so color is guaranteed
  notesInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    fontSize: Typography.md,
    color: Colors.text,
    height: 110,
    textAlignVertical: "top",
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  catChipIcon: { fontSize: 16 },
  catChipLabel: {
    fontSize: Typography.sm,
    color: Colors.muted,
    fontWeight: Typography.medium,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.sm,
    padding: Spacing.lg,
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.bg,
  },
});
