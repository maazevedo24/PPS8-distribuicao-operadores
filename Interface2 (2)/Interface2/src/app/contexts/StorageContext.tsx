/**
 * StorageContext — fonte de verdade única para todos os dados da aplicação.
 *
 * Fluxo:
 *  1. Ao arrancar, tenta ler do ficheiro JSON em disco (File System Access API).
 *  2. Fallback para localStorage se o browser não suportar FSA ou o utilizador
 *     ainda não tiver ligado nenhum ficheiro.
 *  3. Qualquer componente chama `salvar(parcial)` para persistir alterações.
 *     A escrita acontece no ficheiro EM DISCO (se ligado) E no localStorage.
 *
 * Dados geridos aqui:
 *   - operadores    (lista completa, editável em Configuração)
 *   - maquinas      (catálogo de máquinas)
 *   - configuracao  (parâmetros por unidade, layout, grupo artigo, etc.)
 *   - historico     (registos de balanceamentos calculados)
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Operador, Maquina, LogOperacao } from "../types";
import { operadoresMock, maquinasMock } from "../data/mock";
import {
  suportaFSA,
  criarNovoFicheiro,
  abrirFicheiroExistente,
  guardarHandleIDB,
  carregarHandleIDB,
  limparHandleIDB,
  verificarPermissao,
  pedirPermissao,
  lerFicheiro,
  escreverFicheiro,
} from "../utils/fileStorageDB";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type EstadoConexao =
  | "a-carregar"
  | "sem-suporte"
  | "desconectado"
  | "pede-permissao"
  | "conectado"
  | "a-guardar"
  | "erro";

export interface DadosSessao {
  versao: string;
  ultimaModificacao: string;
  /** Lista de operadores — editável na página Configuração */
  operadores: Operador[];
  /** Catálogo de máquinas */
  maquinas: Maquina[];
  configuracao: {
    grupoArtigoSelecionado: string;
    operacoesManual: any[];
    layoutConfig: any;
    dadosUnidades: {
      [key: string]: {
        config: any;
        operadoresSelecionados: string[];
        atribuicoesManual: { [key: string]: string[] };
      };
    };
  };
  historico: any[];
  logOperacoes: LogOperacao[];
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const dadosPadrao: DadosSessao = {
  versao: "1.0",
  ultimaModificacao: new Date().toISOString(),
  operadores: operadoresMock,
  maquinas: maquinasMock,
  configuracao: {
    grupoArtigoSelecionado: "",
    operacoesManual: [],
    layoutConfig: {
      tipoLayout: "espinha",
      postosPorLado: 8,
      distanciaMaxima: 3,
      permitirRetrocesso: false,
      permitirCruzamento: true,
      restricoes: [],
    },
    dadosUnidades: {},
  },
  historico: [],
  logOperacoes: [],
};

// ─── Contexto ─────────────────────────────────────────────────────────────────

interface StorageContextType {
  estadoConexao: EstadoConexao;
  nomeFicheiro: string | null;
  dados: DadosSessao;
  ultimaGravacao: Date | null;
  pronto: boolean; // true depois da carga inicial (evita flickers com dados mock)
  criarFicheiro: () => Promise<void>;
  abrirFicheiro: () => Promise<void>;
  reconectar: () => Promise<void>;
  desconectar: () => Promise<void>;
  salvar: (parcial: DeepPartial<DadosSessao>) => Promise<void>;
  logOperacao: (log: Omit<LogOperacao, 'id' | 'timestamp'>) => Promise<void>;
  // Helpers para operadores (usam dadosRef para evitar race conditions)
  adicionarOperador: (operador: Operador) => Promise<void>;
  removerOperador: (id: string) => Promise<void>;
  actualizarOperador: (id: string, updates: Partial<Operador>) => Promise<void>;
  // Helpers para máquinas
  adicionarMaquina: (maquina: Maquina) => Promise<void>;
  removerMaquina: (id: string) => Promise<void>;
  actualizarMaquina: (id: string, updates: Partial<Maquina>) => Promise<void>;
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const StorageContext = createContext<StorageContextType | null>(null);

export function useStorage(): StorageContextType {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error("useStorage deve ser usado dentro de StorageProvider");
  return ctx;
}

// ─── LocalStorage helpers ─────────────────────────────────────────────────────

const LS_KEY = "balanceamento_sessao_v2";

function lerLocalStorage(): DadosSessao | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      // Tentar migrar do formato antigo
      const estadoAntigo = localStorage.getItem("balanceamento_estado_v1");
      const historicoAntigo = localStorage.getItem("balanceamento_historico");
      if (estadoAntigo) {
        const parsed = JSON.parse(estadoAntigo);
        const hist = historicoAntigo ? JSON.parse(historicoAntigo) : [];
        return { ...dadosPadrao, ...parsed, historico: hist };
      }
      return null;
    }
    const parsed = JSON.parse(raw);
    // Garantir que operadores existem (pode ser um ficheiro antigo sem este campo)
    if (!parsed.operadores || parsed.operadores.length === 0) {
      parsed.operadores = operadoresMock;
    }
    if (!parsed.maquinas || parsed.maquinas.length === 0) {
      parsed.maquinas = maquinasMock;
    }
    return parsed;
  } catch {
    return null;
  }
}

function escreverLocalStorage(dados: DadosSessao): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(dados));
  } catch (e) {
    console.warn("localStorage cheio ou erro:", e);
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StorageProvider({ children }: { children: React.ReactNode }) {
  const [estadoConexao, setEstadoConexao] = useState<EstadoConexao>("a-carregar");
  const [nomeFicheiro, setNomeFicheiro] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosSessao>(dadosPadrao);
  const [ultimaGravacao, setUltimaGravacao] = useState<Date | null>(null);
  const [pronto, setPronto] = useState(false);

  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const dadosRef = useRef<DadosSessao>(dadosPadrao);

  useEffect(() => { dadosRef.current = dados; }, [dados]);

  // ── Inicialização ────────────────────────────────────────────────────────

  useEffect(() => {
    async function init() {
      // 1. Carregar do localStorage primeiro (resposta imediata)
      const ls = lerLocalStorage();
      if (ls) {
        const merged = { ...dadosPadrao, ...ls };
        setDados(merged);
        dadosRef.current = merged;
      }

      // 2. Browser sem suporte FSA → fica com localStorage
      if (!suportaFSA()) {
        setEstadoConexao("sem-suporte");
        setPronto(true);
        return;
      }

      // 3. Tentar reconectar ao ficheiro guardado no IndexedDB
      try {
        const handle = await carregarHandleIDB();
        if (!handle) {
          setEstadoConexao("desconectado");
          setPronto(true);
          return;
        }

        const permissao = await verificarPermissao(handle);
        if (permissao === "granted") {
          await conectarComHandle(handle);
        } else {
          handleRef.current = handle;
          setNomeFicheiro(handle.name);
          setEstadoConexao("pede-permissao");
          setPronto(true);
        }
      } catch (e) {
        console.warn("Erro ao reconectar:", e);
        setEstadoConexao("desconectado");
        setPronto(true);
      }
    }
    init();
  }, []); // eslint-disable-line

  // ── Conectar a um handle ──────────────────────────────────────────────────

  async function conectarComHandle(handle: FileSystemFileHandle) {
    handleRef.current = handle;
    setNomeFicheiro(handle.name);
    setEstadoConexao("a-carregar");

    try {
      const conteudo = await lerFicheiro(handle);
      if (conteudo) {
        // Garantir retrocompatibilidade
        const merged: DadosSessao = {
          ...dadosPadrao,
          ...conteudo,
          operadores: conteudo.operadores?.length ? conteudo.operadores : operadoresMock,
          maquinas: conteudo.maquinas?.length ? conteudo.maquinas : maquinasMock,
        };
        setDados(merged);
        dadosRef.current = merged;
        escreverLocalStorage(merged);
        setUltimaGravacao(conteudo.ultimaModificacao ? new Date(conteudo.ultimaModificacao) : null);
      }
      setEstadoConexao("conectado");
    } catch (e) {
      console.error("Erro ao ler ficheiro:", e);
      setEstadoConexao("erro");
    } finally {
      setPronto(true);
    }
  }

  // ── Ações públicas ────────────────────────────────────────────────────────

  const criarFicheiro = useCallback(async () => {
    try {
      const handle = await criarNovoFicheiro();
      if (!handle) return;
      const novosDados: DadosSessao = {
        ...dadosRef.current,
        ultimaModificacao: new Date().toISOString(),
      };
      await escreverFicheiro(handle, novosDados);
      await guardarHandleIDB(handle);
      handleRef.current = handle;
      setNomeFicheiro(handle.name);
      setDados(novosDados);
      dadosRef.current = novosDados;
      escreverLocalStorage(novosDados);
      setUltimaGravacao(new Date());
      setEstadoConexao("conectado");
    } catch (e) {
      console.error("Erro ao criar ficheiro:", e);
    }
  }, []);

  const abrirFicheiro = useCallback(async () => {
    try {
      const handle = await abrirFicheiroExistente();
      if (!handle) return;
      await guardarHandleIDB(handle);
      await conectarComHandle(handle);
    } catch (e) {
      console.error("Erro ao abrir ficheiro:", e);
    }
  }, []); // eslint-disable-line

  const reconectar = useCallback(async () => {
    if (!handleRef.current) return;
    try {
      const ok = await pedirPermissao(handleRef.current);
      if (ok) {
        await conectarComHandle(handleRef.current);
      } else {
        setEstadoConexao("pede-permissao");
      }
    } catch (e) {
      console.error("Erro ao reconectar:", e);
    }
  }, []); // eslint-disable-line

  const desconectar = useCallback(async () => {
    handleRef.current = null;
    await limparHandleIDB();
    setNomeFicheiro(null);
    setEstadoConexao("desconectado");
  }, []);

  // ── Fila de gravação (evita escritas simultâneas) ─────────────────────────

  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const salvar = useCallback(async (parcial: DeepPartial<DadosSessao>) => {
    // Merge profundo apenas para configuracao e campos simples
    const novosDados: DadosSessao = {
      ...dadosRef.current,
      // Campos de topo: substituição directa se fornecidos
      ...(parcial.operadores !== undefined ? { operadores: parcial.operadores as Operador[] } : {}),
      ...(parcial.maquinas !== undefined ? { maquinas: parcial.maquinas as Maquina[] } : {}),
      ...(parcial.historico !== undefined ? { historico: parcial.historico } : {}),
      ...(parcial.logOperacoes !== undefined ? { logOperacoes: parcial.logOperacoes } : {}),
      // configuracao: merge profundo
      configuracao: parcial.configuracao
        ? {
            ...dadosRef.current.configuracao,
            ...parcial.configuracao,
            dadosUnidades: parcial.configuracao.dadosUnidades
              ? { ...dadosRef.current.configuracao.dadosUnidades, ...parcial.configuracao.dadosUnidades }
              : dadosRef.current.configuracao.dadosUnidades,
          }
        : dadosRef.current.configuracao,
      ultimaModificacao: new Date().toISOString(),
    };

    setDados(novosDados);
    dadosRef.current = novosDados;

    // Sempre escrever no localStorage (backup síncrono)
    escreverLocalStorage(novosDados);

    // Escrever no ficheiro em disco (assíncrono, em fila)
    if (handleRef.current) {
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          setEstadoConexao("a-guardar");
          await escreverFicheiro(handleRef.current!, dadosRef.current);
          setUltimaGravacao(new Date());
          setEstadoConexao("conectado");
        } catch (e) {
          console.error("Erro ao escrever ficheiro:", e);
          setEstadoConexao("conectado");
        }
      });
      await saveQueueRef.current;
    }
  }, []); // eslint-disable-line

  // ── Log de operações ──────────────────────────────────────────────────────

  const logOperacao = useCallback(async (log: Omit<LogOperacao, 'id' | 'timestamp'>) => {
    const novoLog: LogOperacao = {
      ...log,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    const logsActual = dadosRef.current.logOperacoes;
    const novosLogs = [novoLog, ...logsActual].slice(0, 100); // Manter apenas os últimos 100 logs
    await salvar({ logOperacoes: novosLogs });
  }, [salvar]);

  // ── Helpers para operadores (evitam race conditions usando dadosRef) ──────

  const adicionarOperador = useCallback(async (operador: Operador) => {
    const listaActual = dadosRef.current.operadores;
    // Verificar se já existe
    if (listaActual.some((op) => op.id === operador.id)) {
      console.warn(`Operador ${operador.id} já existe`);
      return;
    }
    console.log(`[StorageContext] Adicionando operador ${operador.id}. Lista actual:`, listaActual.length);
    await salvar({ operadores: [...listaActual, operador] });
    console.log(`[StorageContext] Operador ${operador.id} adicionado. Nova lista:`, dadosRef.current.operadores.length);
  }, [salvar]);

  const removerOperador = useCallback(async (id: string) => {
    const listaActual = dadosRef.current.operadores;
    await salvar({ operadores: listaActual.filter((op) => op.id !== id) });
  }, [salvar]);

  const actualizarOperador = useCallback(async (id: string, updates: Partial<Operador>) => {
    const listaActual = dadosRef.current.operadores;
    await salvar({
      operadores: listaActual.map((op) =>
        op.id === id ? { ...op, ...updates } : op
      ),
    });
  }, [salvar]);

  // ── Helpers para máquinas ─────────────────────────────────────────────────

  const adicionarMaquina = useCallback(async (maquina: Maquina) => {
    const listaActual = dadosRef.current.maquinas;
    if (listaActual.some((m) => m.id === maquina.id)) {
      console.warn(`Máquina ${maquina.id} já existe`);
      return;
    }
    await salvar({ maquinas: [...listaActual, maquina] });
  }, [salvar]);

  const removerMaquina = useCallback(async (id: string) => {
    const listaActual = dadosRef.current.maquinas;
    await salvar({ maquinas: listaActual.filter((m) => m.id !== id) });
  }, [salvar]);

  const actualizarMaquina = useCallback(async (id: string, updates: Partial<Maquina>) => {
    const listaActual = dadosRef.current.maquinas;
    await salvar({
      maquinas: listaActual.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    });
  }, [salvar]);

  return (
    <StorageContext.Provider
      value={{
        estadoConexao,
        nomeFicheiro,
        dados,
        ultimaGravacao,
        pronto,
        criarFicheiro,
        abrirFicheiro,
        reconectar,
        desconectar,
        salvar,
        adicionarOperador,
        removerOperador,
        actualizarOperador,
        adicionarMaquina,
        removerMaquina,
        actualizarMaquina,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}
