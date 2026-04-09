/**
 * Utilitários de persistência local e exportação/importação JSON
 */

const ESTADO_KEY = "balanceamento_estado_v1";

export interface EstadoApp {
  grupoArtigoSelecionado: string;
  operacoesManual: any[];
  layoutConfig: any;
  dadosUnidades: any;
  versao: string;
  exportadoEm: string;
}

/** Guarda o estado da aplicação no localStorage */
export function guardarEstado(estado: Omit<EstadoApp, "versao" | "exportadoEm">): void {
  try {
    const payload: EstadoApp = {
      ...estado,
      versao: "1.0",
      exportadoEm: new Date().toISOString(),
    };
    localStorage.setItem(ESTADO_KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn("Erro ao guardar estado:", e);
  }
}

/** Carrega o estado da aplicação do localStorage */
export function carregarEstado(): Partial<EstadoApp> | null {
  try {
    const raw = localStorage.getItem(ESTADO_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn("Erro ao carregar estado:", e);
    return null;
  }
}

/** Limpa o estado guardado */
export function limparEstado(): void {
  localStorage.removeItem(ESTADO_KEY);
}

/** Exporta o estado completo (config + histórico) para um ficheiro JSON */
export function exportarJSON(
  estado: Omit<EstadoApp, "versao" | "exportadoEm">,
  incluirHistorico = true
): void {
  const historico = incluirHistorico
    ? (() => {
        try {
          const raw = localStorage.getItem("balanceamento_historico");
          return raw ? JSON.parse(raw) : [];
        } catch {
          return [];
        }
      })()
    : [];

  const payload = {
    versao: "1.0",
    exportadoEm: new Date().toISOString(),
    estado,
    historico,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const data = new Date();
  const stamp = `${data.getFullYear()}${String(data.getMonth() + 1).padStart(2, "0")}${String(data.getDate()).padStart(2, "0")}_${String(data.getHours()).padStart(2, "0")}${String(data.getMinutes()).padStart(2, "0")}`;
  a.download = `balanceamento_${stamp}.json`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Lê um ficheiro JSON importado e devolve o conteúdo */
export function importarJSON(file: File): Promise<{
  estado: Partial<EstadoApp>;
  historico: any[];
  versao: string;
  exportadoEm: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (!parsed.versao || !parsed.estado) {
          reject(new Error("Ficheiro inválido ou com formato desconhecido."));
          return;
        }
        resolve({
          estado: parsed.estado,
          historico: parsed.historico || [],
          versao: parsed.versao,
          exportadoEm: parsed.exportadoEm || "",
        });
      } catch {
        reject(new Error("Não foi possível interpretar o ficheiro JSON."));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler o ficheiro."));
    reader.readAsText(file);
  });
}

/** Exporta apenas os resultados de um balanceamento */
export function exportarResultados(dados: any): void {
  const payload = {
    versao: "1.0",
    tipo: "resultados",
    exportadoEm: new Date().toISOString(),
    ...dados,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const data = new Date();
  const stamp = `${data.getFullYear()}${String(data.getMonth() + 1).padStart(2, "0")}${String(data.getDate()).padStart(2, "0")}_${String(data.getHours()).padStart(2, "0")}${String(data.getMinutes()).padStart(2, "0")}`;
  a.download = `resultados_${stamp}.json`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
