/**
 * Shared event form used by both new.tsx and [id].tsx.
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import type { CalendarEvent, VisibleCalendarEvent } from "@constellation/types";
import { theme } from "../../src/theme";

export type EventFormData = Omit<CalendarEvent, "id" | "creator_id" | "created_at">;

function toLocalDateString(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeString(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

interface Props {
  initialData?: VisibleCalendarEvent;
  readOnly?: boolean;
  onSave: (data: EventFormData) => Promise<void>;
  onDelete?: () => void;
  onCancel: () => void;
}

export default function EventForm({ initialData, readOnly, onSave, onDelete, onCancel }: Props) {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  const later = new Date(now.getTime() + 3600000);

  const [title, setTitle] = useState(initialData?.title ?? "");
  const [isAllDay, setIsAllDay] = useState(initialData?.is_all_day ?? false);
  const [startDate, setStartDate] = useState(
    initialData ? toLocalDateString(initialData.start_time) : toLocalDateString(now.toISOString())
  );
  const [startTime, setStartTime] = useState(
    initialData ? toLocalTimeString(initialData.start_time) : toLocalTimeString(now.toISOString())
  );
  const [endDate, setEndDate] = useState(
    initialData ? toLocalDateString(initialData.end_time) : toLocalDateString(later.toISOString())
  );
  const [endTime, setEndTime] = useState(
    initialData ? toLocalTimeString(initialData.end_time) : toLocalTimeString(later.toISOString())
  );
  const [location, setLocation] = useState(initialData?.location ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [isPrivate, setIsPrivate] = useState(initialData?.is_private ?? false);
  const [saving, setSaving] = useState(false);

  const isRecurring = !!initialData?.recurrence_rule || !!initialData?.recurrence_parent_id;

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert("Required", "Title is required.");
      return;
    }
    const startIso = isAllDay
      ? new Date(startDate + "T00:00:00").toISOString()
      : combineDateTime(startDate, startTime);
    const endIso = isAllDay
      ? new Date(startDate + "T00:00:00").toISOString()
      : combineDateTime(endDate, endTime);

    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        start_time: startIso,
        end_time: endIso,
        is_all_day: isAllDay,
        location: location.trim() || null,
        description: description.trim() || null,
        is_private: isPrivate,
        recurrence_rule: null,
        recurrence_parent_id: null,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!onDelete) return;
    if (isRecurring) {
      Alert.alert(
        "Delete Recurring Event",
        "Delete this instance or all instances?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "This Instance",
            style: "destructive",
            onPress: () => onDelete(),
          },
          {
            text: "All Instances",
            style: "destructive",
            onPress: () => onDelete(),
          },
        ]
      );
    } else {
      Alert.alert("Delete Event", "Delete this event? This cannot be undone.", [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete() },
      ]);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Title */}
      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={[styles.input, readOnly && styles.inputDisabled]}
        value={title}
        onChangeText={setTitle}
        placeholder="Event title"
        placeholderTextColor={theme.colors.neutral[500]}
        editable={!readOnly}
      />

      {/* All-day */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>All-day</Text>
        <Switch
          value={isAllDay}
          onValueChange={setIsAllDay}
          disabled={readOnly}
          trackColor={{ true: theme.colors.primary[600], false: theme.colors.neutral[600] }}
          thumbColor="#fff"
        />
      </View>

      {/* Start date */}
      <Text style={styles.label}>Start date *</Text>
      <TextInput
        style={[styles.input, readOnly && styles.inputDisabled]}
        value={startDate}
        onChangeText={setStartDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={theme.colors.neutral[500]}
        editable={!readOnly}
      />

      {/* Start time */}
      {!isAllDay && (
        <>
          <Text style={styles.label}>Start time *</Text>
          <TextInput
            style={[styles.input, readOnly && styles.inputDisabled]}
            value={startTime}
            onChangeText={setStartTime}
            placeholder="HH:MM"
            placeholderTextColor={theme.colors.neutral[500]}
            editable={!readOnly}
          />
        </>
      )}

      {/* End date/time */}
      {!isAllDay && (
        <>
          <Text style={styles.label}>End date *</Text>
          <TextInput
            style={[styles.input, readOnly && styles.inputDisabled]}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.colors.neutral[500]}
            editable={!readOnly}
          />
          <Text style={styles.label}>End time *</Text>
          <TextInput
            style={[styles.input, readOnly && styles.inputDisabled]}
            value={endTime}
            onChangeText={setEndTime}
            placeholder="HH:MM"
            placeholderTextColor={theme.colors.neutral[500]}
            editable={!readOnly}
          />
        </>
      )}

      {/* Location */}
      <Text style={styles.label}>Location</Text>
      <TextInput
        style={[styles.input, readOnly && styles.inputDisabled]}
        value={location}
        onChangeText={setLocation}
        placeholder="Optional"
        placeholderTextColor={theme.colors.neutral[500]}
        editable={!readOnly}
      />

      {/* Notes */}
      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea, readOnly && styles.inputDisabled]}
        value={description}
        onChangeText={setDescription}
        placeholder="Optional"
        placeholderTextColor={theme.colors.neutral[500]}
        multiline
        numberOfLines={3}
        editable={!readOnly}
      />

      {/* Private */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>Private</Text>
        <Switch
          value={isPrivate}
          onValueChange={setIsPrivate}
          disabled={readOnly}
          trackColor={{ true: theme.colors.primary[600], false: theme.colors.neutral[600] }}
          thumbColor="#fff"
        />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {onDelete && !readOnly && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        )}
        <View style={styles.rightActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          {!readOnly && (
            <TouchableOpacity
              style={[styles.saveBtn, (!title.trim() || saving) && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!title.trim() || saving}
            >
              <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.neutral[950],
  },
  content: {
    padding: theme.spacing[4],
    paddingBottom: theme.spacing[8],
  },
  label: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.neutral[400],
    marginBottom: theme.spacing[1],
    marginTop: theme.spacing[3],
  },
  input: {
    backgroundColor: theme.colors.neutral[800],
    borderWidth: 1,
    borderColor: theme.colors.neutral[600],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    color: theme.colors.neutral[50],
    fontSize: theme.fontSize.sm,
  },
  inputDisabled: {
    opacity: 0.6,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing[3],
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing[6],
  },
  rightActions: {
    flexDirection: "row",
    gap: theme.spacing[2],
    marginLeft: "auto",
  },
  cancelBtn: {
    backgroundColor: theme.colors.neutral[700],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
  },
  cancelBtnText: {
    color: theme.colors.neutral[100],
    fontSize: theme.fontSize.sm,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary[600],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
  },
  deleteBtn: {
    paddingVertical: theme.spacing[2],
  },
  deleteBtnText: {
    color: "#f87171",
    fontSize: theme.fontSize.sm,
  },
});
