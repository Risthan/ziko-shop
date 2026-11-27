import Ionicons from "@expo/vector-icons/Ionicons";
import { type ComponentRef, forwardRef, useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import { colors, fonts, radius, spacing } from "@/theme";
import { AppText } from "./AppText";
import type { IconName } from "./Button";

interface Props extends Omit<TextInputProps, "style" | "onChange"> {
  label: string;
  value: string;
  onChange: (text: string) => void;
  icon?: IconName;
  /** Message d'erreur affiché sous le champ (et lu par le lecteur d'écran). */
  error?: string | null;
  hint?: string;
  /** Mot de passe : texte masqué, avec un bouton pour l'afficher. */
  secret?: boolean;
}

/** Ce qu'on obtient avec une ref sur un TextField (pour passer au champ suivant). */
export type TextFieldHandle = ComponentRef<typeof TextInput>;

/** Champ de formulaire du Design System : libellé, icône, erreur, mot de passe masquable. */
export const TextField = forwardRef<TextFieldHandle, Props>(function TextField(
  { label, value, onChange, icon, error, hint, secret, editable = true, ...input },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  // L'erreur disparaît dès que le client corrige la valeur concernée.
  const [errorFor, setErrorFor] = useState<string | null>(null);
  useEffect(() => setErrorFor(error ? value : null), [error]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownError = error && errorFor === value ? error : null;
  return (
    <View style={styles.wrap}>
      <AppText variant="small" color={colors.text} style={styles.label}>
        {label}
      </AppText>
      <View style={[styles.field, focused && styles.focused, !!shownError && styles.invalid, !editable && styles.readOnly]}>
        {icon ? <Ionicons name={icon} size={18} color={shownError ? colors.danger : focused ? colors.accent : colors.textSecondary} /> : null}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChange}
          editable={editable}
          secureTextEntry={secret && !visible}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          style={styles.input}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          accessibilityHint={shownError ?? hint}
          maxFontSizeMultiplier={1.3}
          {...input}
        />
        {secret ? (
          <Pressable
            onPress={() => setVisible((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={19} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {shownError ? (
        <AppText variant="caption" color={colors.danger} accessibilityLiveRegion="polite">
          {shownError}
        </AppText>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.semibold },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  focused: { borderColor: colors.accentBorder },
  invalid: { borderColor: colors.dangerBorder },
  readOnly: { opacity: 0.6 },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.text, paddingVertical: 14 },
});
