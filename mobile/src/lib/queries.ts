import { QueryClient, useQueries, useQuery, useQueryClient, type QueryClient as QC } from "@tanstack/react-query";
import { ApiError, api } from "@/api/client";
import type { Order, Product } from "@/api/types";
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

/** Les commandes passées depuis ce téléphone, avec leur statut réel demandé au serveur. */
export function useMyOrders() {
  const history = useQuery({ queryKey: queryKeys.myOrders, queryFn: orderHistory.list, staleTime: 0 });
  const orders = useQueries({
    queries: (history.data ?? []).map((entry) => ({ queryKey: queryKeys.order(entry.id), queryFn: () => api.getOrder(entry.id) })),
  });
  return { history, orders };
}

/** Une commande vient d'être créée : on la mémorise et on la met en cache. */
export async function rememberOrder(client: QC, order: Order) {
  client.setQueryData(queryKeys.order(order.id), order);
  await orderHistory.add(order.id);
  await client.invalidateQueries({ queryKey: queryKeys.myOrders });
}

/** Paiement confirmé : la commande change de statut et le stock a baissé côté serveur. */
export async function applyPaidOrder(client: QC, order: Order) {
  client.setQueryData(queryKeys.order(order.id), order);
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.products }),
    client.invalidateQueries({ queryKey: queryKeys.product(order.productId) }),
  ]);
}
