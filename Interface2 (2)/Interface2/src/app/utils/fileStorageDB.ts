/**
 * File System Access API + IndexedDB
 * Permite ler/escrever num ficheiro JSON real em disco.
 * O FileSystemFileHandle é guardado em IndexedDB para persistir entre sessões.
 */

const DB_NAME = "balanceamento_fsa_v1";
const DB_VERSION = 1;
const STORE_NAME = "handles";
const HANDLE_KEY = "session";

// ─── IndexedDB helpers ───────────────────────────────────────────────────────

function abrirIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function guardarHandleIDB(handle: FileSystemFileHandle): Promise<void> {
  const db = await abrirIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function carregarHandleIDB(): Promise<FileSystemFileHandle | null> {
  const db = await abrirIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(HANDLE_KEY);
    req.onsuccess = () => resolve((req.result as FileSystemFileHandle) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function limparHandleIDB(): Promise<void> {
  const db = await abrirIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(HANDLE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── File System Access API ──────────────────────────────────────────────────

export function suportaFSA(): boolean {
  return "showSaveFilePicker" in window;
}

export async function verificarPermissao(handle: FileSystemFileHandle): Promise<PermissionState> {
  // @ts-ignore - FileSystemPermissionMode
  return handle.queryPermission({ mode: "readwrite" });
}

export async function pedirPermissao(handle: FileSystemFileHandle): Promise<boolean> {
  try {
    // @ts-ignore
    const result = await handle.requestPermission({ mode: "readwrite" });
    return result === "granted";
  } catch {
    return false;
  }
}

export async function criarNovoFicheiro(): Promise<FileSystemFileHandle | null> {
  try {
    // @ts-ignore
    const handle: FileSystemFileHandle = await window.showSaveFilePicker({
      suggestedName: "balanceamento_sessao.json",
      types: [
        {
          description: "Ficheiro de Sessão JSON",
          accept: { "application/json": [".json"] },
        },
      ],
    });
    return handle;
  } catch (e: any) {
    if (e.name === "AbortError") return null;
    throw e;
  }
}

export async function abrirFicheiroExistente(): Promise<FileSystemFileHandle | null> {
  try {
    // @ts-ignore
    const [handle]: FileSystemFileHandle[] = await window.showOpenFilePicker({
      types: [
        {
          description: "Ficheiro de Sessão JSON",
          accept: { "application/json": [".json"] },
        },
      ],
      multiple: false,
    });
    return handle;
  } catch (e: any) {
    if (e.name === "AbortError") return null;
    throw e;
  }
}

export async function lerFicheiro(handle: FileSystemFileHandle): Promise<any> {
  const file = await handle.getFile();
  const text = await file.text();
  if (!text.trim()) return null;
  return JSON.parse(text);
}

export async function escreverFicheiro(handle: FileSystemFileHandle, dados: any): Promise<void> {
  // @ts-ignore
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(dados, null, 2));
  await writable.close();
}
