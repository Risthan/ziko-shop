import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { api } from "@/api/client";
import { checks, formErrorsFrom, noErrors, type FormErrors } from "@/lib/auth/formErrors";
import { session, useSession } from "@/lib/auth/session";
import { haptics } from "@/lib/haptics";
import { queryKeys } from "@/lib/queries";
import { AppText } from "@/ui/AppText";
import { authStyles as styles } from "@/ui/authStyles";
import { Button } from "@/ui/Button";
import { Header } from "@/ui/Header";
import { Notice } from "@/ui/Notice";
import { Screen } from "@/ui/Screen";
import { EmptyState } from "@/ui/States";
import { TextField } from "@/ui/TextField";

/** Modifier son nom et son téléphone. L'e-mail sert d'identifiant : il ne change pas ici. */
export default function EditProfileScreen() {
  const { user } = useSession();
  const client = useQueryClient();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <Screen>
        <Header back />
        <EmptyState icon="person-outline" title="Vous n'êtes pas connecté" action={<Button title="Se connecter" onPress={() => router.replace("/auth/login")} />} />
      </Screen>
    );
  }

  const save = async () => {
    const fields = Object.fromEntries(
      Object.entries({ fullName: checks.fullName(fullName), phone: checks.phone(phone) }).filter(([, v]) => v),
    ) as Record<string, string>;
    if (Object.keys(fields).length > 0) {
      haptics.error();
      return setErrors({ fields, general: null });
    }
    setBusy(true);
    setErrors(noErrors);
    try {
      const updated = await api.updateMe({ fullName: fullName.trim(), phone: phone.trim() });
      await session.setUser(updated);
      client.setQueryData(queryKeys.me, updated);
      haptics.success();
      router.back();
    } catch (error) {
      haptics.error();
      setErrors(formErrorsFrom(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={["top", "left", "right", "bottom"]}>
      <Header back />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.title}>
            <AppText variant="h1">Mon profil</AppText>
            <AppText variant="body">Ces informations accompagnent vos commandes.</AppText>
          </View>
          <TextField label="Nom complet" icon="person-outline" value={fullName} onChange={setFullName} error={errors.fields.fullName} autoCapitalize="words" autoComplete="name" />
          <TextField label="Adresse e-mail" icon="mail-outline" value={user.email} onChange={() => undefined} editable={false} hint="Votre identifiant de connexion." />
          <TextField
            label="Téléphone (facultatif)"
            icon="call-outline"
            value={phone}
            onChange={setPhone}
            error={errors.fields.phone}
            placeholder="+243 81 234 5678"
            keyboardType="phone-pad"
            autoComplete="tel"
          />
          {errors.general ? <Notice tone="danger" title="Enregistrement impossible" message={errors.general} /> : null}
          <Button title="Enregistrer" icon="checkmark" loading={busy} loadingLabel="Enregistrement…" onPress={() => void save()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
