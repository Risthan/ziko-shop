import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { api } from "@/api/client";
import { checks, formErrorsFrom, noErrors, type FormErrors } from "@/lib/auth/formErrors";
import { leaveAuth } from "@/lib/auth/leaveAuth";
import { session } from "@/lib/auth/session";
import { haptics } from "@/lib/haptics";
import { queryKeys } from "@/lib/queries";
import { colors } from "@/theme";
import { AppText } from "@/ui/AppText";
import { authStyles as styles } from "@/ui/authStyles";
import { Button } from "@/ui/Button";
import { Header } from "@/ui/Header";
import { Notice } from "@/ui/Notice";
import { PressableScale } from "@/ui/PressableScale";
import { Screen } from "@/ui/Screen";
import { TextField, type TextFieldHandle } from "@/ui/TextField";

/** Connexion. `raison=commande` : le client voulait commander. */
export default function LoginScreen() {
  const { raison } = useLocalSearchParams<{ raison?: string }>();
  const client = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextFieldHandle>(null);

  const submit = async () => {
    const fields = Object.fromEntries(
      Object.entries({ email: checks.email(email), password: password ? null : "Entrez votre mot de passe." }).filter(([, v]) => v),
    ) as Record<string, string>;
    if (Object.keys(fields).length > 0) {
      haptics.error();
      return setErrors({ fields, general: null });
    }
    setBusy(true);
    setErrors(noErrors);
    try {
      const { user, token } = await api.login(email.trim(), password);
      await session.signIn(token, user);
      client.setQueryData(queryKeys.me, user);
      void client.invalidateQueries({ queryKey: queryKeys.myOrders });
      haptics.success();
      leaveAuth();
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
            <AppText variant="h1">Connexion</AppText>
            <AppText variant="body">Retrouvez vos achats et commandez en quelques secondes.</AppText>
          </View>

          {raison === "commande" ? (
            <Notice tone="info" icon="bag-handle-outline" title="Connectez-vous pour commander" message="Votre panier est conservé. Vous revenez à votre commande juste après." />
          ) : null}

          <TextField
            label="Adresse e-mail"
            icon="mail-outline"
            value={email}
            onChange={setEmail}
            error={errors.fields.email}
            placeholder="vous@exemple.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextField
            ref={passwordRef}
            label="Mot de passe"
            icon="lock-closed-outline"
            value={password}
            onChange={setPassword}
            error={errors.fields.password}
            secret
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />

          {errors.general ? <Notice tone="danger" title="Connexion impossible" message={errors.general} /> : null}

          <Button title="Se connecter" icon="log-in-outline" loading={busy} loadingLabel="Connexion…" onPress={() => void submit()} />

          <PressableScale
            onPress={() => router.replace({ pathname: "/auth/register", params: raison ? { raison } : {} })}
            accessibilityRole="link"
            style={styles.switch}
          >
            <AppText variant="body" center>
              Pas encore de compte ? <AppText variant="bodyStrong" color={colors.accent}>Créer un compte</AppText>
            </AppText>
          </PressableScale>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
