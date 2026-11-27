import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { api } from "@/api/client";
import { checks, formErrorsFrom, noErrors, type FormErrors } from "@/lib/auth/formErrors";
import { session } from "@/lib/auth/session";
import { haptics } from "@/lib/haptics";
import { queryKeys } from "@/lib/queries";
import { colors } from "@/theme";
import { AppText } from "@/ui/AppText";
import { Button } from "@/ui/Button";
import { Header } from "@/ui/Header";
import { Notice } from "@/ui/Notice";
import { PressableScale } from "@/ui/PressableScale";
import { Screen } from "@/ui/Screen";
import { TextField, type TextFieldHandle } from "@/ui/TextField";
import { leaveAuth } from "@/lib/auth/leaveAuth";
import { authStyles as styles } from "@/ui/authStyles";

/** Inscription : nom, e-mail, téléphone (facultatif), mot de passe. */
export default function RegisterScreen() {
  const { raison } = useLocalSearchParams<{ raison?: string }>();
  const client = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>(noErrors);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<TextFieldHandle>(null);
  const phoneRef = useRef<TextFieldHandle>(null);
  const passwordRef = useRef<TextFieldHandle>(null);

  const submit = async () => {
    const found = {
      fullName: checks.fullName(fullName),
      email: checks.email(email),
      phone: checks.phone(phone),
      password: checks.password(password),
    };
    const fields = Object.fromEntries(Object.entries(found).filter(([, v]) => v)) as Record<string, string>;
    if (Object.keys(fields).length > 0) {
      haptics.error();
      return setErrors({ fields, general: null });
    }
    setBusy(true);
    setErrors(noErrors);
    try {
      const { user, token } = await api.register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      await session.signIn(token, user);
      client.setQueryData(queryKeys.me, user);
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
            <AppText variant="h1">Créer mon compte</AppText>
            <AppText variant="body">Commandez en quelques secondes et suivez tous vos achats.</AppText>
          </View>

          {raison === "commande" ? (
            <Notice tone="info" icon="bag-handle-outline" title="Un compte pour commander" message="Votre panier est conservé. Vous revenez à votre commande juste après." />
          ) : null}

          <TextField
            label="Nom complet"
            icon="person-outline"
            value={fullName}
            onChange={setFullName}
            error={errors.fields.fullName}
            placeholder="Prénom et nom"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
          <TextField
            ref={emailRef}
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
            onSubmitEditing={() => phoneRef.current?.focus()}
          />
          <TextField
            ref={phoneRef}
            label="Téléphone (facultatif)"
            icon="call-outline"
            value={phone}
            onChange={setPhone}
            error={errors.fields.phone}
            hint="Pour vous joindre lors de la livraison à Kinshasa."
            placeholder="+243 81 234 5678"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
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
            hint="8 caractères minimum."
            secret
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
          />

          {errors.general ? <Notice tone="danger" title="Inscription impossible" message={errors.general} /> : null}

          <Button title="Créer mon compte" icon="person-add-outline" loading={busy} loadingLabel="Création du compte…" onPress={() => void submit()} />

          <AppText variant="caption" center>
            Vos informations servent uniquement à vos commandes. Vous pouvez supprimer votre compte à tout moment depuis votre profil.
          </AppText>

          <PressableScale
            onPress={() => router.replace({ pathname: "/auth/login", params: raison ? { raison } : {} })}
            accessibilityRole="link"
            style={styles.switch}
          >
            <AppText variant="body" center>
              Déjà un compte ? <AppText variant="bodyStrong" color={colors.accent}>Se connecter</AppText>
            </AppText>
          </PressableScale>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
