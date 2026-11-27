import { QueryClient, useQuery, useQueryClient, type QueryClient as QC } from "@tanstack/react-query";
import { useEffect } from "react";
import { ApiError, api } from "@/api/client";
import type { Order, Product } from "@/api/types";
import { session, useSession } from "./auth/session";
import { cart } from "./cart/useCart";
import { orderHistory } from "./orderHistory";

/**
 * Synchronisation des données : le serveur (PostgreSQL via l'API) est la
 * source de vérité. TanStack Query met les réponses en cache, les partage
 * entre les écrans et les recharge quand elles deviennent obsolètes.
 */
export const queryKeys = {
  products: ["products"] as const,
  product: (id: string) => ["product", id] as const,
  order: (id: string) => ["order", id] as const,
  myOrders: ["my-orders"] as const,
  me: ["me"] as const,
  tryOn: ["try-on-config"] as const,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Un réessai automatique pour la lecture ; jamais pour une commande introuvable.
      retry: (failureCount, error) => failureCount < 1 && !(error instanceof ApiError && error.status === 404),
      refetchOnWindowFocus: false,
    },
    // Les écritures (commande, paiement) ne sont JAMAIS rejouées automatiquement.
    mutations: { retry: 0 },
  },
});

export function useProducts() {
  return useQuery({ queryKey: queryKeys.products, queryFn: api.listProducts });
}

/** Un produit : affiché tout de suite depuis la liste, puis rafraîchi (stock à jour). */
export function useProduct(id: string) {
  const client = useQueryClient();
  return useQuery({
    queryKey: queryKeys.product(id),
    queryFn: () => api.getProduct(id),
    initialData: () => client.getQueryData<Product[]>(queryKeys.products)?.find((product) => product.id === id),
    initialDataUpdatedAt: () => client.getQueryState(queryKeys.products)?.dataUpdatedAt,
  });
}

export function useOrder(id: string) {
  return useQuery({ queryKey: queryKeys.order(id), queryFn: () => api.getOrder(id) });
}

export function useTryOnConfig() {
  return useQuery({ queryKey: queryKeys.tryOn, queryFn: api.getTryOnConfig, staleTime: 5 * 60_000, retry: 0 });
}

/** L'historique d'achats du client connecté, tel que le serveur le connaît. */
export function useMyOrders() {
  const { status } = useSession();
  return useQuery({ queryKey: queryKeys.myOrders, queryFn: api.myOrders, enabled: status === "signedIn", staleTime: 0 });
}

/**
 * Le profil du client connecté, rafraîchi auprès du serveur (au lancement et
 * à chaque retour sur le profil). Une session expirée déconnecte le téléphone.
 */
export function useMe() {
  const { status, user } = useSession();
  const query = useQuery({ queryKey: queryKeys.me, queryFn: api.me, enabled: status === "signedIn", initialData: user ?? undefined, staleTime: 60_000 });
  useEffect(() => {
    if (query.data && status === "signedIn") void session.setUser(query.data);
  }, [query.data, status]);
  return query;
}

/** Déconnexion : le serveur détruit la session, le téléphone oublie tout ce qui est privé. */
export async function signOut(client: QC) {
  await api.logout().catch(() => undefined); // hors ligne : on déconnecte quand même ce téléphone
  await forgetPrivateData(client);
}

/** Efface du cache les données liées au compte (commandes, profil). */
export async function forgetPrivateData(client: QC) {
  await session.signOut();
  client.removeQueries({ queryKey: queryKeys.myOrders });
  client.removeQueries({ queryKey: queryKeys.me });
  client.removeQueries({ queryKey: ["order"] });
}

/** Une commande vient d'être créée : on la mémorise et on la met en cache. */
export async function rememberOrder(client: QC, order: Order) {
  client.setQueryData(queryKeys.order(order.id), order);
  await orderHistory.add(order.id);
  await client.invalidateQueries({ queryKey: queryKeys.myOrders });
}

/**
 * Paiement confirmé : la commande change de statut, le stock de chaque article
 * a baissé côté serveur, et le panier se vide si c'était sa commande.
 */
export async function applyPaidOrder(client: QC, order: Order) {
  client.setQueryData(queryKeys.order(order.id), order);
  cart.orderPaid(order.id);
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.myOrders }),
    client.invalidateQueries({ queryKey: queryKeys.products }),
    ...order.items.map((item) => client.invalidateQueries({ queryKey: queryKeys.product(item.productId) })),
  ]);
}
