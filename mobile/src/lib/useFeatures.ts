import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { Features } from "@/api/types";

let cached: Features | null = null;

/** Fonctionnalités facultatives activées côté serveur (ex. essayage en direct). */
export function useFeatures(): Features {
  const [features, setFeatures] = useState<Features>(cached ?? { liveTryOn: false });

  useEffect(() => {
    if (cached) return;
    api
      .getFeatures()
      .then((result) => {
        cached = result;
        setFeatures(result);
      })
      .catch(() => undefined); // Facultatif : en cas d'échec, on n'affiche simplement pas le bouton.
  }, []);

  return features;
}
