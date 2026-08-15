import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ROLES, type RoleId } from "./config";
import { WORKSPACES, type Row } from "./workspaces";

const ROLE_KEY = "vetos.role";
const ROWS_KEY = "vetos.rows";

type RowStore = Record<string, Row[]>;

interface ErpContextValue {
  roleId: RoleId;
  setRoleId: (r: RoleId) => void;
  role: (typeof ROLES)[RoleId];
  getRows: (moduleId: string) => Row[];
  addRow: (moduleId: string, row: Row) => void;
  deleteRow: (moduleId: string, index: number) => void;
  resetRows: (moduleId: string) => void;
}

const ErpContext = createContext<ErpContextValue | null>(null);

export function ErpProvider({ children }: { children: ReactNode }) {
  const [roleId, setRoleIdState] = useState<RoleId>("admin");
  const [store, setStore] = useState<RowStore>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const r = localStorage.getItem(ROLE_KEY) as RoleId | null;
      if (r && r in ROLES) setRoleIdState(r);
      const s = localStorage.getItem(ROWS_KEY);
      if (s) setStore(JSON.parse(s) as RowStore);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: RowStore) => {
    setStore(next);
    try {
      localStorage.setItem(ROWS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const setRoleId = useCallback((r: RoleId) => {
    setRoleIdState(r);
    try {
      localStorage.setItem(ROLE_KEY, r);
    } catch {
      /* ignore */
    }
  }, []);

  const getRows = useCallback(
    (moduleId: string): Row[] => {
      if (hydrated && store[moduleId]) return store[moduleId];
      return WORKSPACES[moduleId]?.rows ?? [];
    },
    [store, hydrated],
  );

  const addRow = useCallback(
    (moduleId: string, row: Row) => {
      const current = store[moduleId] ?? WORKSPACES[moduleId]?.rows ?? [];
      persist({ ...store, [moduleId]: [row, ...current] });
    },
    [store, persist],
  );

  const deleteRow = useCallback(
    (moduleId: string, index: number) => {
      const current = store[moduleId] ?? WORKSPACES[moduleId]?.rows ?? [];
      persist({ ...store, [moduleId]: current.filter((_, i) => i !== index) });
    },
    [store, persist],
  );

  const resetRows = useCallback(
    (moduleId: string) => {
      const next = { ...store };
      delete next[moduleId];
      persist(next);
    },
    [store, persist],
  );

  const value = useMemo<ErpContextValue>(
    () => ({ roleId, setRoleId, role: ROLES[roleId], getRows, addRow, deleteRow, resetRows }),
    [roleId, setRoleId, getRows, addRow, deleteRow, resetRows],
  );

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
}

export function useErp() {
  const ctx = useContext(ErpContext);
  if (!ctx) throw new Error("useErp must be used inside ErpProvider");
  return ctx;
}
