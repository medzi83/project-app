type StoredResult = {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
  createdAgents: { name: string; email: string }[];
  createdAt: number;
};

const getStore = () => {
  const g = globalThis as unknown as { __import_results?: Map<string, StoredResult> };
  if (!g.__import_results) g.__import_results = new Map<string, StoredResult>();
  return g.__import_results!;
};

export function getImportResult(id: string | undefined) {
  if (!id) return undefined;
  return getStore().get(id);
}

export function saveImportResult(input: {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
  createdAgents: { name: string; email: string }[];
}) {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  getStore().set(id, { ...input, createdAt: Date.now() });
  // cleanup entries older than 1 hour
  const store = getStore();
  for (const [key, val] of store) {
    if (Date.now() - val.createdAt > 3600_000) store.delete(key);
  }
  return id;
}

