// Reusable date field (native: iOS/Android).
// Renders a tappable pill showing the date; opens the platform date picker.
// On web this file is shadowed by DateField.web.tsx (an <input type="date">).
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors, Radius, Spacing, Typography } from "../src/theme";

type Props = {
  value: Date;
  onChange: (d: Date) => void;
  maximumDate?: Date;
};

export default function DateField({ value, onChange, maximumDate }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState(value);

  const open = () => {
    setTempDate(value);
    setShowPicker(true);
  };

  const onNativeChange = (event: any, date?: Date) => {
    if (Platform.OS === "android") {
      setShowPicker(false);
      if (event.type === "set" && date) onChange(date);
    } else if (date) {
      setTempDate(date);
    }
  };

  const confirmIOS = () => {
    onChange(tempDate);
    setShowPicker(false);
  };
  const cancelIOS = () => setShowPicker(false);

  return (
    <>
      <TouchableOpacity style={styles.datePicker} onPress={open}>
        <Text style={styles.dateIcon}>📅</Text>
        <Text style={styles.dateText}>{format(value, "dd MMM yyyy")}</Text>
        <Text style={styles.dateChevron}>›</Text>
      </TouchableOpacity>

      {Platform.OS === "android" && showPicker && (
        <DateTimePicker
          value={value}
          mode="date"
          display="calendar"
          onChange={onNativeChange}
          maximumDate={maximumDate}
        />
      )}

      {Platform.OS === "ios" && (
        <Modal visible={showPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={cancelIOS}>
                  <Text style={styles.modalCancel}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select date</Text>
                <TouchableOpacity onPress={confirmIOS}>
                  <Text style={styles.modalConfirm}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={onNativeChange}
                maximumDate={maximumDate}
                textColor={Colors.text}
                style={{ backgroundColor: Colors.surface }}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
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
});
