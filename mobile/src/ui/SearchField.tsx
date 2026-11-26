import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { colors, fonts, radius, spacing } from "@/theme";

/** Champ de recherche arrondi. */
export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (text: string) => void; placeholder: string }) {
  return (
    <View style={styles.field}>
      <Ionicons name="search" size={19} color={colors.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        selectionColor={colors.accent}
        accessibilityLabel={placeholder}
        maxFontSizeMultiplier={1.3}
      />
      {value ? (
        <Pressable onPress={() => onChange("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
          <Ionicons name="close-circle" size={19} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.text, paddingVertical: 12 },
});
