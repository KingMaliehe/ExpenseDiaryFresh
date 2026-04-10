// app/(tabs)/add.tsx
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../src/services/supabase";
import { useAuthStore } from "../../src/store/authStore";
import { useTransactionStore } from "../../src/store/transactionStore";
import { Colors, Radius, Spacing, Typography } from "../../src/theme";
import { Category } from "../../src/types/database";

export default function AddScreen() {
  const { user } = useAuthStore();
  const { addTransaction } = useTransactionStore();
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

  // Date picker state
  const [showPicker, setShowPicker] = useState(false);
  // On Android the picker shows inline, on iOS we wrap it in a modal
  const [tempDate, setTempDate] = useState(new Date());

  useEffect(() => {
    if (!user) return;
    supabase
      .from("categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name")
      .then(({ data }) => setCategories(data ?? []));
  }, [user]);

  const filteredCategories = categories.filter((c) =>
    type === "income"
      ? c.name === "Income" || c.name === "Savings"
      : c.name !== "Income",
  );

  const formattedDate = format(selectedDate, "dd MMM yyyy");
  const dateForDB = format(selectedDate, "yyyy-MM-dd");

  const openDatePicker = () => {
    setTempDate(selectedDate);
    setShowPicker(true);
  };

  const onDateChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
      if (event.type === "set" && date) {
        setSelectedDate(date);
      }
    } else {
      if (date) setTempDate(date);
    }
  };

  const confirmIOSDate = () => {
    setSelectedDate(tempDate);
    setShowPicker(false);
  };

  const cancelIOSDate = () => {
    setShowPicker(false);
  };

  const handleSave = async () => {
    if (!description.trim()) {
      Alert.alert("Error", "Please enter a description.");
      return;
    }
    const parsedAmount = parseFloat(amount.replace(",", "."));
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert("Error", "Please enter a valid amount.");
      return;
    }
    if (!selectedCategory) {
      Alert.alert("Error", "Please select a category.");
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
      Alert.alert("Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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
          <Text style={styles.amountPrefix}>R</Text>
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

        {/* Category grid */}
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

        {/* Date picker button */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Date</Text>
          <TouchableOpacity style={styles.datePicker} onPress={openDatePicker}>
            <Text style={styles.dateIcon}>📅</Text>
            <Text style={styles.dateText}>{formattedDate}</Text>
            <Text style={styles.dateChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Android date picker - shows inline */}
        {Platform.OS === "android" && showPicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="calendar"
            onChange={onDateChange}
            maximumDate={new Date()}
          />
        )}

        {/* iOS date picker - shows in modal */}
        {Platform.OS === "ios" && (
          <Modal visible={showPicker} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={cancelIOSDate}>
                    <Text style={styles.modalCancel}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>Select date</Text>
                  <TouchableOpacity onPress={confirmIOSDate}>
                    <Text style={styles.modalConfirm}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  onChange={onDateChange}
                  maximumDate={new Date()}
                  textColor={Colors.text}
                  style={{ backgroundColor: Colors.surface }}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Notes */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Any extra details…"
            placeholderTextColor={Colors.subtle}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving…" : "Save entry"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.xl, paddingBottom: 40 },
  header: { marginBottom: Spacing.xl },
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
  typeBtn: { flex: 1, padding: 12, alignItems: "center" },
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
  notesInput: { height: 80, textAlignVertical: "top" },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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

  // Date picker button
  datePicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: 10,
  },
  dateIcon: { fontSize: 20 },
  dateText: {
    flex: 1,
    fontSize: Typography.md,
    color: Colors.text,
    fontWeight: Typography.medium,
  },
  dateChevron: { fontSize: 20, color: Colors.muted },

  // iOS modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.text,
  },
  modalCancel: { fontSize: Typography.base, color: Colors.muted },
  modalConfirm: {
    fontSize: Typography.base,
    color: Colors.accent,
    fontWeight: Typography.semibold,
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
