import Ionicons from "@expo/vector-icons/Ionicons";
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius, spacing } from "@/theme";
import { AppText } from "./AppText";
import type { IconName } from "./Button";

interface Props {
  visible: boolean;
  onClose: () => void;
  icon?: IconName;
  tone?: "accent" | "warning" | "danger";
  title: string;
  message?: string;
  children?: ReactNode;
}

const TONE = { accent: colors.accent, warning: colors.warning, danger: colors.danger } as const;

/** Fenêtre modale en bas d'écran (stock insuffisant, refus, informations…). */
export function Sheet({ visible, onClose, icon = "information-circle-outline", tone = "warning", title, message, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View entering={FadeIn.duration(180)} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <Animated.View entering={SlideInDown.springify().damping(20)} style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.handle} />
          <View style={[styles.iconWrap, { borderColor: TONE[tone] }]}>
            <Ionicons name={icon} size={28} color={TONE[tone]} />
          </View>
          <AppText variant="h2" center>
            {title}
          </AppText>
          {message ? (
            <AppText variant="body" center>
              {message}
            </AppText>
          ) : null}
          <View style={styles.actions}>{children}</View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.backgroundSecondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
    alignItems: "stretch",
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.sm },
  iconWrap: { alignSelf: "center", width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
