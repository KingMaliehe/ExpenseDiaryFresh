// Reusable date field (web).
// Renders a real <input type="date"> so the browser's native calendar popup
// works — the native module (@react-native-community/datetimepicker) has no web
// implementation. Metro picks this file over DateField.tsx when bundling web.
import { format } from "date-fns";
import React from "react";
import { Colors, Radius, Spacing, Typography } from "../src/theme";

type Props = {
  value: Date;
  onChange: (d: Date) => void;
  maximumDate?: Date;
};

const toInputValue = (d: Date) => format(d, "yyyy-MM-dd");

export default function DateField({ value, onChange, maximumDate }: Props) {
  return (
    <input
      type="date"
      value={toInputValue(value)}
      max={maximumDate ? toInputValue(maximumDate) : undefined}
      onChange={(e) => {
        const v = e.target.value;
        if (!v) return;
        // Parse as a local date so we don't shift a day due to UTC.
        const [y, m, d] = v.split("-").map(Number);
        onChange(new Date(y, m - 1, d));
      }}
      style={{
        width: "100%",
        boxSizing: "border-box",
        backgroundColor: Colors.surface,
        border: `1px solid ${Colors.border2}`,
        borderRadius: Radius.sm,
        padding: Spacing.md,
        fontSize: Typography.md,
        color: Colors.text,
        colorScheme: "dark", // makes the native calendar icon/popup dark-themed
        fontFamily: "inherit",
        outline: "none",
      }}
    />
  );
}
