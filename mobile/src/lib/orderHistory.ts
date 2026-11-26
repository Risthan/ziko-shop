import { readJson, writeJson } from "./storage";

const KEY = "ziko:orders:v1";

export interface LocalOrderEntry {
  id: string;
  createdAt: string;
}

/**
 * Les commandes passées depuis ce téléphone. On ne garde que leurs
 * identifiants : le détail et le statut viennent toujours du serveur.
 */
export const orderHistory = {
  list: () => readJson<LocalOrderEntry[]>(KEY, []),

  async add(id: string): Promise<void> {
    const entries = await orderHistory.list();
    if (entries.some((entry) => entry.id === id)) return;
    await writeJson(KEY, [{ id, createdAt: new Date().toISOString() }, ...entries].slice(0, 50));
  },
};
