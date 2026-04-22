import { useState, useEffect, useCallback } from "react";
import { Operador, Operacao, ConfiguracaoDistribuicao, Produto } from "../types";
import { useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Calculator, Users, Package, Factory, ChevronDown, Edit3, AlertTriangle } from "lucide-react";
import { ConfiguracaoDistribuicaoComponent } from "../components/ConfiguracaoDistribuicao";
import { LayoutConfigurador, LayoutConfig } from "../components/LayoutConfigurador";
import { OperadorSelector } from "../components/OperadorSelector";
import { TabelaOperacoesManual } from "../components/TabelaOperacoesManual";
import { calcularBalanceamento } from "../utils/balanceamento";
import { salvarHistorico, obterHistorico } from "../utils/historico";
import { useStorage } from "../contexts/StorageContext";
import axios from "axios";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

// ─── Valores por defeito ──────────────────────────────────────────────────────

const configPadrao = {
  possibilidade: 1 as 1 | 2 | 3 | 4,
  agruparMaquinas: false,
  cargaMaximaOperador: 95,
  naoDividirMaiorQue: 0.9,
  naoDividirMenorQue: 1.1,
  horasTurno: 8,
  produtividadeEstimada: 85,
};

const layoutPadrao: LayoutConfig = {
  tipoLayout: "espinha",
  postosPorLado: 8,
  distanciaMaxima: 3,
  permitirRetrocesso: false,
  permitirCruzamento: true,
  restricoes: [],
};

// ─── API Configuration ────────────────────────────────────────────────────────

const API_BASE_URL =
  ((import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL as string | undefined) ||
  "http://192.168.54.202:7860/api";

// ─── Types and Helpers ────────────────────────────────────────────────────────

interface FamilyOption {
  id: string;
  label: string;
}

type ApiRecord = Record<string, any>;

const ensureArray = (value: unknown): ApiRecord[] => {
  if (Array.isArray(value)) return value as ApiRecord[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nestedArray = Object.values(record).find((entry) => Array.isArray(entry));
    if (Array.isArray(nestedArray)) return nestedArray as ApiRecord[];
  }
  return [];
};

const pickString = (obj: ApiRecord, keys: string[]): string => {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

const pickNumber = (obj: ApiRecord, keys: string[]): number | null => {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const pickBoolean = (obj: ApiRecord, keys: string[]): boolean | undefined => {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value !== 0;
    if (typeof value === "string" && value.trim()) {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "sim"].includes(normalized)) return true;
      if (["false", "0", "no", "nao", "não"].includes(normalized)) return false;
    }
  }
  return undefined;
};

const ensureRecord = (value: unknown): ApiRecord | null => {
  if (Array.isArray(value)) {
    return (value.find((entry) => entry && typeof entry === "object") as ApiRecord | undefined) || null;
  }
  if (value && typeof value === "object") {
    const record = value as ApiRecord;
    const hasDirectKeys = ["code","id","name","description","operations","operacoes","task_id","task_code","family_id"].some((key) => key in record);
    if (hasDirectKeys) return record;
    const nestedRecord = Object.values(record).find((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
    if (nestedRecord && typeof nestedRecord === "object") return nestedRecord as ApiRecord;
  }
  return null;
};

const mapApiOperation = (raw: ApiRecord, index: number): Operacao =>
  (() => {
    const timeMinutes = pickNumber(raw, ["time_min","time_minutes","tempo_minutos","tempo","minutes"]);
    const timeCmin = pickNumber(raw, ["time_cmin","tempo_cmin","cmin"]);
    return {
      id: pickString(raw, ["operation_code","operation_id","id","code"]) || `OP${String(index + 1).padStart(3, "0")}`,
      nome: pickString(raw, ["operation_name","name","nome","designation","description","descricao"]) || `Operacao ${index + 1}`,
      tempo: timeMinutes ?? (timeCmin != null ? timeCmin / 100 : null) ?? ((pickNumber(raw, ["time_seconds","tempo_segundos","seconds"]) || 0) / 60),
      tipoMaquina: pickString(raw, ["machine_name","machine_type","tipo_maquina","tipoMaquina"]),
      sequencia: pickNumber(raw, ["sequence_order","sequence","sequencia","seq","order"]) ?? index + 1,
      critica: pickBoolean(raw, ["is_critical","critica"]),
    } as Operacao;
  })();

const mapApiTaskToProduto = (raw: ApiRecord, index: number, familyId: string): Produto => {
  const taskId = pickString(raw, ["task_id","task_code","id","code"]) || `${familyId}-TASK-${String(index + 1).padStart(3, "0")}`;
  const taskName = pickString(raw, ["task_name","name","nome","description","descricao"]) || `Ficha ${index + 1}`;
  const operationsRaw = ensureArray(raw.operations ?? raw.operacoes ?? raw.steps ?? raw.sequence ?? raw.gama_operatoria).map((op, i) => mapApiOperation(op, i));
  const operations = operationsRaw
    .sort((a, b) => a.sequencia - b.sequencia)
    .map((operation, operationIndex) => ({
      ...operation,
      sequencia: operationIndex + 1,
    }));
  const numOperations = pickNumber(raw, ["num_operations", "numero_operacoes", "operations_count"]) ?? operations.length;
  const numCapableOperators = pickNumber(raw, ["num_capable_operators", "numero_operadores_disponiveis"]);
  const numDistinctMachines = pickNumber(raw, ["num_distinct_machines", "numero_maquinas_distintas"]);
  const indicators = [
    numOperations != null ? `${numOperations} ops` : null,
    numCapableOperators != null ? `${numCapableOperators} op disponiveis` : null,
    numDistinctMachines != null ? `${numDistinctMachines} maquinas` : null,
  ].filter(Boolean);
  const today = new Date().toISOString().split("T")[0];
  return {
    id: taskId,
    nome: taskName,
    referencia: pickString(raw, ["reference","referencia","task_reference","task_code"]) || taskId,
    cliente: pickString(raw, ["client","cliente"]),
    descricao: pickString(raw, ["notes","observacoes","description","descricao"]) || (indicators.length ? indicators.join(" | ") : `Ficha tecnica da familia ${familyId}`),
    operacoes: operations,
    dataCriacao: pickString(raw, ["created_at","creation_date","data_criacao"]) || today,
    dataModificacao: pickString(raw, ["updated_at","modified_at","data_modificacao"]) || today,
  };
};

function criarUnidadePadrao(operadores: Operador[]) {
  return {
    operadores: operadores,
    operadoresSelecionados: operadores.map((op) => op.id),
    atribuicoesManual: {} as { [operacaoId: string]: string[] },
    config: { ...configPadrao },
  };
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const { dados, salvar } = useStorage();

  // ── Operadores vêm SEMPRE do contexto (fonte de verdade única) ────────────
  // Nunca importar operadoresMock directamente aqui
  const operadoresMaster = dados.operadores;

  // Ler configuração guardada
  const confGuardada = dados.configuracao;

  // ─── Estado local (inicializado a partir do contexto) ─────────────────────

  const [unidadeAtiva, setUnidadeAtiva] = useState<1 | 2 | 3>(1);

  const [grupoArtigoSelecionado, setGrupoArtigoSelecionado] = useState<string>(
    confGuardada.grupoArtigoSelecionado || ""
  );

  const [operacoesManual, setOperacoesManual] = useState<Operacao[]>(
    confGuardada.operacoesManual || []
  );

  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(
    confGuardada.layoutConfig || layoutPadrao
  );

  const [dadosUnidades, setDadosUnidades] = useState(() => {
    const u1 = criarUnidadePadrao(operadoresMaster);
    const u2 = criarUnidadePadrao(operadoresMaster);
    const u3 = criarUnidadePadrao(operadoresMaster);
    const g = confGuardada.dadosUnidades;
    if (g) {
      if (g["1"]) {
        u1.config = { ...configPadrao, ...g["1"].config };
        u1.operadoresSelecionados = g["1"].operadoresSelecionados || u1.operadoresSelecionados;
        u1.atribuicoesManual = g["1"].atribuicoesManual || {};
      }
      if (g["2"]) {
        u2.config = { ...configPadrao, ...g["2"].config };
        u2.operadoresSelecionados = g["2"].operadoresSelecionados || u2.operadoresSelecionados;
        u2.atribuicoesManual = g["2"].atribuicoesManual || {};
      }
      if (g["3"]) {
        u3.config = { ...configPadrao, ...g["3"].config };
        u3.operadoresSelecionados = g["3"].operadoresSelecionados || u3.operadoresSelecionados;
        u3.atribuicoesManual = g["3"].atribuicoesManual || {};
      }
    }
    return { 1: u1, 2: u2, 3: u3 };
  });

  // ── Sincronizar com o contexto quando os dados carregam do ficheiro ───────

  const [sincronizado, setSincronizado] = useState(false);

  // ── API: Famílias e Fichas Técnicas ──────────────────────────────────────────
  const [familias, setFamilias] = useState<FamilyOption[]>([]);
  const [loadingFamilias, setLoadingFamilias] = useState(false);
  const [produtosApi, setProdutosApi] = useState<Produto[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string | null>(null);
  const [loadingFichas, setLoadingFichas] = useState(false);
  const [loadingFichaPorCodigo, setLoadingFichaPorCodigo] = useState(false);
  const [erroApi, setErroApi] = useState<string | null>(null);

  useEffect(() => {
    if (sincronizado) return;
    const conf = dados.configuracao;
    const ops = dados.operadores;
    if (!conf.grupoArtigoSelecionado && !conf.dadosUnidades && ops.length === 0) return;
    setSincronizado(true);

    if (conf.grupoArtigoSelecionado) setGrupoArtigoSelecionado(conf.grupoArtigoSelecionado);
    if (conf.operacoesManual?.length) setOperacoesManual(conf.operacoesManual);
    if (conf.layoutConfig) setLayoutConfig(conf.layoutConfig);

    const g = conf.dadosUnidades;
    // Actualizar operadores master nas unidades quando o contexto carrega
    setDadosUnidades((prev) => ({
      1: {
        ...prev[1],
        operadores: ops,
        config: g?.["1"]?.config ? { ...configPadrao, ...g["1"].config } : prev[1].config,
        operadoresSelecionados: g?.["1"]?.operadoresSelecionados ?? ops.map((o) => o.id),
        atribuicoesManual: g?.["1"]?.atribuicoesManual || {},
      },
      2: {
        ...prev[2],
        operadores: ops,
        config: g?.["2"]?.config ? { ...configPadrao, ...g["2"].config } : prev[2].config,
        operadoresSelecionados: g?.["2"]?.operadoresSelecionados ?? ops.map((o) => o.id),
        atribuicoesManual: g?.["2"]?.atribuicoesManual || {},
      },
      3: {
        ...prev[3],
        operadores: ops,
        config: g?.["3"]?.config ? { ...configPadrao, ...g["3"].config } : prev[3].config,
        operadoresSelecionados: g?.["3"]?.operadoresSelecionados ?? ops.map((o) => o.id),
        atribuicoesManual: g?.["3"]?.atribuicoesManual || {},
      },
    }));
  }, [dados, sincronizado]);

  // Quando a lista de operadores no contexto muda (ex: apagar em Configuração),
  // actualizar as unidades para reflectir a mudança
  useEffect(() => {
    const ops = dados.operadores;
    setDadosUnidades((prev) => ({
      1: { ...prev[1], operadores: ops, operadoresSelecionados: prev[1].operadoresSelecionados.filter((id) => ops.some((o) => o.id === id)) },
      2: { ...prev[2], operadores: ops, operadoresSelecionados: prev[2].operadoresSelecionados.filter((id) => ops.some((o) => o.id === id)) },
      3: { ...prev[3], operadores: ops, operadoresSelecionados: prev[3].operadoresSelecionados.filter((id) => ops.some((o) => o.id === id)) },
    }));
  }, [dados.operadores]);

  // ─── Auto-save em cada mudança de estado ─────────────────────────────────

  const guardarConfiguracaoAtual = useCallback(() => {
    salvar({
      configuracao: {
        grupoArtigoSelecionado,
        operacoesManual,
        layoutConfig,
        dadosUnidades: {
          "1": {
            config: dadosUnidades[1].config,
            operadoresSelecionados: dadosUnidades[1].operadoresSelecionados,
            atribuicoesManual: dadosUnidades[1].atribuicoesManual,
          },
          "2": {
            config: dadosUnidades[2].config,
            operadoresSelecionados: dadosUnidades[2].operadoresSelecionados,
            atribuicoesManual: dadosUnidades[2].atribuicoesManual,
          },
          "3": {
            config: dadosUnidades[3].config,
            operadoresSelecionados: dadosUnidades[3].operadoresSelecionados,
            atribuicoesManual: dadosUnidades[3].atribuicoesManual,
          },
        },
      },
    });
  }, [grupoArtigoSelecionado, operacoesManual, layoutConfig, dadosUnidades, salvar]);

  useEffect(() => {
    guardarConfiguracaoAtual();
  }, [guardarConfiguracaoAtual]);

  // ── Load families from API ───────────────────────────────────────────────────
  useEffect(() => {
    const carregarFamilias = async () => {
      setLoadingFamilias(true);
      setErroApi(null);
      try {
        const resposta = await axios.get(`${API_BASE_URL}/families/`);
        const families = ensureArray(resposta.data).map((family, index) => {
          const id = pickString(family, ["family_id","id","code","reference"]) || `FAM${String(index + 1).padStart(3, "0")}`;
          const name = pickString(family, ["family_name","name","nome"]) || id;
          const reference = pickString(family, ["reference","referencia"]);
          return { id, label: reference ? `${name} (${reference})` : name };
        });
        if (families.length === 0) throw new Error("Sem familias");
        setFamilias(families);
        setGrupoArtigoSelecionado((current) =>
          current && families.some((family) => family.id === current)
            ? current
            : families[0].id
        );
      } catch (error) {
        console.error("Erro ao carregar familias:", error);
        setErroApi("Nao foi possivel carregar familias da API.");
        setFamilias([]);
        setGrupoArtigoSelecionado("");
        setProdutosApi([]);
        setProdutoSelecionado(null);
      } finally {
        setLoadingFamilias(false);
      }
    };
    carregarFamilias();
  }, []);

  // ── Load technical sheets for selected family ────────────────────────────────
  useEffect(() => {
    if (!grupoArtigoSelecionado) {
      setProdutosApi([]);
      setProdutoSelecionado(null);
      return;
    }
    const carregarFichas = async () => {
      setLoadingFichas(true);
      setErroApi(null);
      try {
        const resposta = await axios.get(`${API_BASE_URL}/technical-sheets/family/${encodeURIComponent(grupoArtigoSelecionado)}`);
        const technicalSheets = ensureArray(resposta.data);
        const fichas = technicalSheets.map((sheet, index) => mapApiTaskToProduto(sheet, index, grupoArtigoSelecionado));
        setProdutosApi(fichas);
        let proximoSelecionado: string | null = null;
        setProdutoSelecionado((prev) => {
          proximoSelecionado = fichas.some((f) => f.id === prev) ? prev : fichas[0]?.id || null;
          return proximoSelecionado;
        });
        if (proximoSelecionado) {
          void handleCarregarFichaPorCodigo(proximoSelecionado, fichas);
        }
      } catch (error) {
        console.error("Erro ao carregar fichas da familia:", error);
        setErroApi("Nao foi possivel carregar fichas tecnicas da familia selecionada.");
        setProdutosApi([]);
        setProdutoSelecionado(null);
      } finally {
        setLoadingFichas(false);
      }
    };
    carregarFichas();
  }, [grupoArtigoSelecionado]);

  // ── Load detailed sheet by code ──────────────────────────────────────────────
  const handleCarregarFichaPorCodigo = async (
    produtoId: string,
    sourceProdutos: Produto[] = produtosApi
  ) => {
    const produtoBase = sourceProdutos.find((p) => p.id === produtoId);
    if (!produtoBase) return;
    const codigos = Array.from(new Set([produtoBase.id, produtoBase.referencia].map((v) => v?.trim()).filter(Boolean))) as string[];
    if (codigos.length === 0) return;
    setLoadingFichaPorCodigo(true);
    setErroApi(null);
    try {
      let sheet: ApiRecord | null = null;
      let codigoResolvido = codigos[0];
      let ultimaFalha: unknown = null;
      for (const codigo of codigos) {
        try {
          const resposta = await axios.get(`${API_BASE_URL}/technical-sheets/code/${encodeURIComponent(codigo)}`);
          const candidate = ensureRecord(resposta.data);
          if (candidate) {
            sheet = candidate;
            codigoResolvido = codigo;
            break;
          }
        } catch (error) {
          ultimaFalha = error;
        }
      }
      if (!sheet) {
        throw ultimaFalha || new Error("Resposta invalida para ficha tecnica por codigo");
      }
      const familyId = pickString(sheet, ["family_id","family","group_id"]) || grupoArtigoSelecionado;
      const ficha = mapApiTaskToProduto(sheet, 0, familyId);
      const referenciaCodigo =
        pickString(sheet, ["code","task_code","reference","referencia"]) ||
        ficha.referencia ||
        codigoResolvido;
      const normalizada: Produto = {
        ...produtoBase,
        ...ficha,
        id: produtoBase.id,
        referencia: referenciaCodigo,
      };
      setProdutosApi((current) => {
        const exists = current.some((p) => p.id === produtoId);
        if (!exists) return [...current, normalizada];
        return current.map((p) => (p.id === produtoId ? normalizada : p));
      });
    } catch (error) {
      console.error("Erro ao carregar ficha por codigo:", error);
      setErroApi("Nao foi possivel carregar detalhes da ficha tecnica pelo codigo.");
    } finally {
      setLoadingFichaPorCodigo(false);
    }
  };

  const handleSelecionarFicha = (produtoId: string) => {
    setProdutoSelecionado(produtoId);
    void handleCarregarFichaPorCodigo(produtoId);
  };

  // ─── Atalhos ──────────────────────────────────────────────────────────────

  const operadores = dadosUnidades[unidadeAtiva].operadores;
  const operadoresSelecionados = dadosUnidades[unidadeAtiva].operadoresSelecionados;
  const atribuicoesManual = dadosUnidades[unidadeAtiva].atribuicoesManual;
  const config = dadosUnidades[unidadeAtiva].config;

  const produto = produtosApi.find((p) => p.id === produtoSelecionado);
  const operacoes = config.possibilidade === 4
    ? operacoesManual
    : (produto ? produto.operacoes : []);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleToggleOperador = (id: string) => {
    setDadosUnidades((prev) => ({
      ...prev,
      [unidadeAtiva]: {
        ...prev[unidadeAtiva],
        operadoresSelecionados: prev[unidadeAtiva].operadoresSelecionados.includes(id)
          ? prev[unidadeAtiva].operadoresSelecionados.filter((opId) => opId !== id)
          : [...prev[unidadeAtiva].operadoresSelecionados, id],
      },
    }));
  };

  const handleConfigChange = (newConfig: ConfiguracaoDistribuicao) => {
    setDadosUnidades((prev) => ({
      ...prev,
      [unidadeAtiva]: {
        ...prev[unidadeAtiva],
        config: newConfig,
      },
    }));
  };

  const handleCalcularOperadoresNecessarios = (quantidadeObjetivo: number) => {
    const tempoTotalCiclo = operacoes.reduce((sum, op) => sum + op.tempo, 0);
    const minutosDisponiveis = 480;
    const tempoNecessarioTotal = tempoTotalCiclo * quantidadeObjetivo;
    const operadoresNecessarios = Math.ceil(tempoNecessarioTotal / minutosDisponiveis);
    const operadoresAUtilizar = Math.min(operadoresNecessarios, operadores.length);

    const novosOperadoresSelecionados = operadores
      .slice(0, operadoresAUtilizar)
      .map((op) => op.id);

    setDadosUnidades((prev) => ({
      ...prev,
      [unidadeAtiva]: {
        ...prev[unidadeAtiva],
        operadoresSelecionados: novosOperadoresSelecionados,
      },
    }));
  };

  const handleAtribuirManualmente = (operacaoId: string, operadorIds: string[]) => {
    setDadosUnidades((prev) => ({
      ...prev,
      [unidadeAtiva]: {
        ...prev[unidadeAtiva],
        atribuicoesManual: {
          ...prev[unidadeAtiva].atribuicoesManual,
          [operacaoId]: operadorIds,
        },
      },
    }));
  };

  const handleToggleOperadorOperacao = (operacaoNome: string, operadorId: string) => {
    const atribuidos = atribuicoesManual[operacaoNome] || [];
    const novaAtribuicao = atribuidos.includes(operadorId)
      ? atribuidos.filter((id) => id !== operadorId)
      : [...atribuidos, operadorId];
    handleAtribuirManualmente(operacaoNome, novaAtribuicao);
  };

  const operadorPodeFazerOperacao = (operador: Operador, operacaoNome: string): boolean => {
    return Object.values(operador.competencias).some(
      (comp) => comp && comp.operacao === operacaoNome
    );
  };

  const getOleOperadorOperacao = (operador: Operador, operacaoNome: string): number => {
    const competencia = Object.values(operador.competencias).find(
      (comp) => comp && comp.operacao === operacaoNome
    );
    return competencia ? competencia.ole : operador.oleHistorico;
  };

  const handleCalcular = async () => {
    try {
      const operadoresDisponiveis = operadores.filter((op) =>
        operadoresSelecionados.includes(op.id)
      );

      if (config.possibilidade !== 4 && operadoresDisponiveis.length === 0) {
        alert("Por favor, selecione pelo menos um operador.");
        return;
      }

      if (operacoes.length === 0) {
        alert("Por favor, selecione um produto com operações.");
        return;
      }

      // ── Modo Custom (possibilidade 4): usar API allocate-custom ─────────────
      if (config.possibilidade === 4) {
        const assignments: {
          machine_name: string;
          operation_code: string;
          operation_name: string;
          operator_id: string;
          time_seconds: number;
        }[] = [];

        for (const op of operacoesManual) {
          const operadoresAtribuidos = atribuicoesManual[op.id] || [];
          const tempoTotalSegundos = op.tempo * 60;
          if (operadoresAtribuidos.length > 0) {
            const tempoPorOperadorSegundos = tempoTotalSegundos / operadoresAtribuidos.length;
            for (const operadorId of operadoresAtribuidos) {
              assignments.push({
                machine_name: op.tipoMaquina || "",
                operation_code: op.id,
                operation_name: op.nome,
                operator_id: operadorId,
                time_seconds: tempoPorOperadorSegundos,
              });
            }
          } else {
            assignments.push({
              machine_name: op.tipoMaquina || "",
              operation_code: op.id,
              operation_name: op.nome,
              operator_id: "",
              time_seconds: tempoTotalSegundos,
            });
          }
        }

        const taskCode = grupoArtigoSelecionado || "custom";
        const resposta = await axios.post(
          `http://192.168.54.202:7860/api/tasks/${taskCode}/allocate-custom`,
          { assignments }
        );
        const r = resposta.data;

        // Mapear resposta da API para ResultadosBalanceamento
        const taktTime = (r.takt_time != null ? r.takt_time / 60 : (r.taktTime ?? 0));
        const tempoCiclo = r.real_cycle_time_seconds != null ? r.real_cycle_time_seconds / 60 : (r.cycle_time ?? r.tempoCiclo ?? 0);
        const numeroCiclosPorHora = r.production_per_hour ?? (tempoCiclo > 0 ? 60 / tempoCiclo : 0);
        const produtividade = r.estimated_productivity ?? 0;
        const perdas = NaN; // não disponível neste modo
        const numeroOperadores = r.num_operators ?? r.numero_operadores ?? r.numeroOperadores ?? new Set(assignments.map((a) => a.operator_id).filter(Boolean)).size;

        // Construir distribuicao por operador a partir dos assignments enviados (por operação)
        type DistItem = {
          operadorId: string;
          operacoes: string[];
          cargaHoraria: number;
          ocupacao: number;
          ciclosPorHora: number;
        };
        const mapa: Record<string, { operacoes: Set<string>; tempoTotal: number }> = {};
        for (const a of assignments) {
          if (!a.operator_id) continue;
          if (!mapa[a.operator_id]) mapa[a.operator_id] = { operacoes: new Set(), tempoTotal: 0 };
          mapa[a.operator_id].operacoes.add(a.operation_code);
          mapa[a.operator_id].tempoTotal += a.time_seconds / 60;
        }
        const distribuicao: DistItem[] = Object.entries(mapa).map(([operadorId, dados]) => ({
          operadorId,
          operacoes: Array.from(dados.operacoes),
          cargaHoraria: dados.tempoTotal,
          ocupacao: tempoCiclo > 0 ? (dados.tempoTotal / tempoCiclo) * 100 : 0,
          ciclosPorHora: dados.tempoTotal > 0 ? 60 / dados.tempoTotal : 0,
        }));

        const resultadosCustom = {
          distribuicao,
          taktTime,
          tempoCiclo,
          numeroCiclosPorHora,
          produtividade,
          perdas,
          numeroOperadores,
        };

        const dataToPass = {
          resultados: resultadosCustom,
          operadores: operadoresDisponiveis,
          operacoes: operacoesManual,
          config,
          layoutConfig,
        };

        sessionStorage.setItem("balanceamentoData", JSON.stringify(dataToPass));
        navigate("/resultados", { state: dataToPass });
        return;
      }

      const resultados = calcularBalanceamento(operadoresDisponiveis, operacoes, config);

      const dataToPass = {
        resultados,
        operadores: operadoresDisponiveis,
        operacoes,
        config,
        layoutConfig,
      };

      sessionStorage.setItem("balanceamentoData", JSON.stringify(dataToPass));

      const oleMedia =
        operadoresDisponiveis.reduce((sum, op) => sum + op.oleHistorico, 0) /
        operadoresDisponiveis.length;

      const novoRegisto = {
        id: `${Date.now()}-${unidadeAtiva}-${grupoArtigoSelecionado}`,
        timestamp: new Date(),
        unidade: unidadeAtiva,
        produtoId: grupoArtigoSelecionado,
        produtoNome: produto?.nome || "Sem produto",
        produtoReferencia: produto?.referencia || "",
        metodo: config.possibilidade,
        resultados,
        configuracao: config,
        oleMedia,
        numeroOperacoes: operacoes.length,
      };

      // Guardar no localStorage (via historico.ts)
      salvarHistorico(novoRegisto);

      // Guardar no ficheiro — inclui configuração actual + histórico actualizado
      await salvar({
        configuracao: {
          grupoArtigoSelecionado,
          operacoesManual,
          layoutConfig,
          dadosUnidades: {
            "1": {
              config: dadosUnidades[1].config,
              operadoresSelecionados: dadosUnidades[1].operadoresSelecionados,
              atribuicoesManual: dadosUnidades[1].atribuicoesManual,
            },
            "2": {
              config: dadosUnidades[2].config,
              operadoresSelecionados: dadosUnidades[2].operadoresSelecionados,
              atribuicoesManual: dadosUnidades[2].atribuicoesManual,
            },
            "3": {
              config: dadosUnidades[3].config,
              operadoresSelecionados: dadosUnidades[3].operadoresSelecionados,
              atribuicoesManual: dadosUnidades[3].atribuicoesManual,
            },
          },
        },
        historico: obterHistorico(),
      });

      navigate("/resultados", { state: dataToPass });
    } catch (error) {
      console.error("Erro ao calcular balanceamento:", error);
      alert("Erro ao calcular balanceamento.");
    }
  };

  const tempoTotal = operacoes.reduce((sum, op) => sum + op.tempo, 0);
  const [gamaExpandida, setGamaExpandida] = useState(false);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="w-full px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Balanceamento de Linha</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Configure operadores e processos operacionais
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setUnidadeAtiva(1)}
            className={`px-4 py-2 rounded-sm text-xs font-medium transition-colors ${
              unidadeAtiva === 1
                ? "bg-blue-500 text-white border border-blue-600"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            LINHA 1
          </button>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-teal-100 rounded-sm flex items-center justify-center">
              <Users className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Operadores</div>
              <div className="text-2xl font-bold text-gray-900">{operadoresSelecionados.length}</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-sm flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Operações</div>
              <div className="text-2xl font-bold text-gray-900">{operacoes.length}</div>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-sm flex items-center justify-center">
              <Factory className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase">Máquinas</div>
              <div className="text-2xl font-bold text-gray-900">
                {operacoes.length > 0
                  ? new Set(operacoes.map((op) => op.tipoMaquina)).size
                  : 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seleção de Grupo de Artigo */}
      {config.possibilidade !== 4 && erroApi && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-sm flex items-center gap-2 text-amber-700 text-sm">
          <AlertTriangle className="w-4 h-4" />
          {erroApi}
        </div>
      )}

      {config.possibilidade !== 4 && (
        <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-gray-600">
                Grupo de Artigo
              </Label>
              <Select
                value={grupoArtigoSelecionado || undefined}
                onValueChange={setGrupoArtigoSelecionado}
                disabled={loadingFamilias || familias.length === 0}
              >
                <SelectTrigger className="rounded-sm text-sm">
                  <SelectValue placeholder={loadingFamilias ? "A carregar grupos..." : "Selecione um grupo"} />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  {familias.map((familia) => (
                    <SelectItem key={familia.id} value={familia.id} className="text-sm">
                      {familia.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-gray-600">
                Ficha Técnica
              </Label>
              <Select
                value={produtoSelecionado || undefined}
                onValueChange={handleSelecionarFicha}
                disabled={loadingFichas || loadingFichaPorCodigo || produtosApi.length === 0}
              >
                <SelectTrigger className="rounded-sm text-sm">
                  <SelectValue
                    placeholder={
                      loadingFichas ? "A carregar fichas..." :
                      loadingFichaPorCodigo ? "A carregar detalhes..." :
                      "Selecione uma ficha técnica"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  {produtosApi.map((prod) => (
                    <SelectItem key={prod.id} value={prod.id} className="text-sm">
                      <span className="font-mono text-xs text-gray-500 mr-2">{prod.referencia}</span>
                      {prod.nome}
                      <span className="text-gray-400 ml-2">({prod.operacoes.length} ops)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {produto && (
            <div className="text-xs text-gray-500 mt-3">
              Tempo total: <span className="font-mono">{operacoes.reduce((s, op) => s + op.tempo, 0).toFixed(2)} min</span>
              <span className="mx-2">·</span>
              <span>{operacoes.length} operações</span>
            </div>
          )}
        </div>
      )}

      {/* Configuração de Distribuição */}
      <ConfiguracaoDistribuicaoComponent
        config={config}
        onChange={handleConfigChange}
        numeroOperadoresDisponiveis={operadoresSelecionados.length}
        operacoes={operacoes}
        onCalcularOperadoresNecessarios={handleCalcularOperadoresNecessarios}
      />

      {/* Tabela de Operações Manual */}
      {config.possibilidade === 4 && (
        <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-sm flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Entrada Manual de Operações</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Preencha os dados das operações directamente na tabela
              </p>
            </div>
          </div>
          <TabelaOperacoesManual
            operacoes={operacoesManual}
            onOperacoesChange={(ops) => {
              const lista = ops.length === 0
                ? [{
                    id: "OP001",
                    nome: "",
                    tempo: 0,
                    tipoMaquina: "",
                    largura: 190,
                    ponto: "",
                    setup: "Standard",
                    permitirAgrupamento: true,
                    sequencia: 1,
                  }]
                : ops;
              setOperacoesManual(lista);
            }}
            operadores={operadores.filter((op) => operadoresSelecionados.includes(op.id))}
            atribuicoes={atribuicoesManual}
            onAtribuicaoChange={handleAtribuirManualmente}
          />
        </div>
      )}

      {/* Parâmetros de Balanceamento */}
      {config.possibilidade !== 4 && (
        <div className="shadow-sm border border-gray-200 rounded-sm bg-white">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-gray-700" />
              <div>
                <h3 className="text-base font-semibold text-gray-900">Parâmetros de Balanceamento</h3>
                <p className="text-xs text-gray-500 font-normal mt-0.5">
                  Parâmetros de entrada conforme o método selecionado
                </p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Entradas</div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {config.possibilidade === 1 && (
                  <>
                    <div className="flex items-stretch">
                      <div className="bg-gray-100 border border-gray-200 px-4 py-3 flex items-center rounded-l-sm flex-1">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Horas do Turno</span>
                      </div>
                      <input
                        type="number" step="0.5" min={1} max={24}
                        value={config.horasTurno}
                        onChange={(e) => handleConfigChange({ ...config, horasTurno: Number(e.target.value) })}
                        className="bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 font-semibold rounded-r-sm w-32 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                    <div className="flex items-stretch">
                      <div className="bg-gray-100 border border-gray-200 px-4 py-3 flex items-center rounded-l-sm flex-1">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Produtividade Estimada (%)</span>
                      </div>
                      <input
                        type="number" step="1" min={0} max={100}
                        value={config.produtividadeEstimada}
                        onChange={(e) => handleConfigChange({ ...config, produtividadeEstimada: Number(e.target.value) })}
                        className="bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 font-semibold rounded-r-sm w-32 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                    <div className="flex items-stretch">
                      <div className="bg-gray-100 border border-gray-200 px-4 py-3 flex items-center rounded-l-sm flex-1">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Nº de Operadores</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-300 px-4 py-3 text-sm text-gray-900 font-semibold rounded-r-sm w-32 text-right font-mono flex items-center justify-end">
                        {operadoresSelecionados.length}
                      </div>
                    </div>
                  </>
                )}

                {config.possibilidade === 2 && (
                  <>
                    <div className="flex items-stretch">
                      <div className="bg-gray-100 border border-gray-200 px-4 py-3 flex items-center rounded-l-sm flex-1">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Objetivo (peças/dia)</span>
                      </div>
                      <input
                        type="number" min={1}
                        value={config.quantidadeObjetivo || ""}
                        onChange={(e) => {
                          const quantidade = Number(e.target.value);
                          handleConfigChange({ ...config, quantidadeObjetivo: quantidade });
                          if (quantidade > 0) handleCalcularOperadoresNecessarios(quantidade);
                        }}
                        placeholder="Ex: 500"
                        className="bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 font-semibold rounded-r-sm w-32 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                    <div className="flex items-stretch">
                      <div className="bg-gray-100 border border-gray-200 px-4 py-3 flex items-center rounded-l-sm flex-1">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Horas do Turno</span>
                      </div>
                      <input
                        type="number" step="0.5" min={1} max={24}
                        value={config.horasTurno}
                        onChange={(e) => handleConfigChange({ ...config, horasTurno: Number(e.target.value) })}
                        className="bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 font-semibold rounded-r-sm w-32 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </>
                )}

                {config.possibilidade === 3 && (
                  <>
                    <div className="flex items-stretch">
                      <div className="bg-gray-100 border border-gray-200 px-4 py-3 flex items-center rounded-l-sm flex-1">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Nº de Operadores</span>
                      </div>
                      <input
                        type="number" min={1} max={operadores.length}
                        value={config.numeroOperadores || operadoresSelecionados.length}
                        onChange={(e) => {
                          const num = Math.min(Number(e.target.value), operadores.length);
                          handleConfigChange({ ...config, numeroOperadores: num });
                          const novos = operadores.slice(0, num).map((op) => op.id);
                          setDadosUnidades((prev) => ({
                            ...prev,
                            [unidadeAtiva]: { ...prev[unidadeAtiva], operadoresSelecionados: novos },
                          }));
                        }}
                        className="bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 font-semibold rounded-r-sm w-32 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                    <div className="flex items-stretch">
                      <div className="bg-gray-100 border border-gray-200 px-4 py-3 flex items-center rounded-l-sm flex-1">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Disponíveis na Linha</span>
                      </div>
                      <div className="bg-gray-50 border border-gray-300 px-4 py-3 text-sm text-gray-900 font-semibold rounded-r-sm w-32 text-right font-mono flex items-center justify-end">
                        {operadores.length}
                      </div>
                    </div>
                    <div className="flex items-stretch">
                      <div className="bg-gray-100 border border-gray-200 px-4 py-3 flex items-center rounded-l-sm flex-1">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Horas do Turno</span>
                      </div>
                      <input
                        type="number" step="0.5" min={1} max={24}
                        value={config.horasTurno}
                        onChange={(e) => handleConfigChange({ ...config, horasTurno: Number(e.target.value) })}
                        className="bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 font-semibold rounded-r-sm w-32 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gama Operatória */}
      {config.possibilidade !== 4 && (
        <div className="bg-white rounded-sm border border-gray-200 shadow-sm">
          <div
            className="p-5 border-b border-gray-200 cursor-pointer select-none hover:bg-gray-50 transition-colors"
            onClick={() => setGamaExpandida(!gamaExpandida)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-sm flex items-center justify-center">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Gama Operatória — {produto?.nome || "Sem produto"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Operações carregadas da ficha técnica do produto selecionado
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 font-mono">
                  {operacoes.length} ops · {tempoTotal.toFixed(2)} min
                </span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${gamaExpandida ? "rotate-180" : ""}`}
                />
              </div>
            </div>
          </div>

          {gamaExpandida && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-16">Seq.</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-20">ID</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Descrição</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-28">Tempo (min)</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Máquina</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase min-w-[200px]">Operadores Disponíveis</th>
                  </tr>
                </thead>
                <tbody>
                  {operacoes.map((operacao) => {
                    const operadoresAtribuidos = atribuicoesManual[operacao.nome] || [];
                    return (
                      <tr
                        key={operacao.id}
                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${operacao.critica ? "bg-orange-50" : ""}`}
                      >
                        <td className="p-3 font-mono text-sm text-gray-700">{operacao.sequencia}</td>
                        <td className="p-3">
                          <span className="font-mono font-semibold text-sm text-blue-700 bg-blue-50 px-2 py-1 rounded-sm border border-blue-200">
                            {operacao.id}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-gray-700">
                          {operacao.nome}
                          {operacao.critica && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-medium bg-orange-200 text-orange-800 border border-orange-300">
                              CRÍTICA
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-sm text-gray-700">{operacao.tempo.toFixed(2)}</td>
                        <td className="p-3 text-sm text-gray-600">{operacao.tipoMaquina || "—"}</td>
                        <td className="p-3">
                          <OperadorSelector
                            operadores={operadoresSelecionados.map((opId) => {
                              const op = operadores.find((o) => o.id === opId);
                              if (!op) return { id: opId, ole: 0, podeOperar: false };
                              return {
                                id: op.id,
                                ole: getOleOperadorOperacao(op, operacao.nome),
                                podeOperar: operadorPodeFazerOperacao(op, operacao.nome),
                              };
                            })}
                            atribuidos={operadoresAtribuidos}
                            onToggle={(operadorId) => handleToggleOperadorOperacao(operacao.nome, operadorId)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-300">
                    <td colSpan={3} className="p-3 text-xs font-semibold text-gray-700 uppercase">Total</td>
                    <td className="p-3 font-mono font-bold text-sm text-gray-900">{tempoTotal.toFixed(2)} min</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Configuração de Layout */}
      <LayoutConfigurador operacoes={operacoes} onLayoutChange={setLayoutConfig} />

      {/* Botão Calcular */}
      <div className="flex justify-center pt-4">
        <Button
          type="button"
          size="lg"
          onClick={handleCalcular}
          disabled={operadoresSelecionados.length === 0 || operacoes.length === 0}
          className="px-12 py-6 text-sm font-semibold bg-blue-500 hover:bg-blue-600 rounded-sm uppercase tracking-wide"
        >
          <Calculator className="w-5 h-5 mr-2" />
          Calcular Balanceamento
        </Button>
      </div>
    </main>
  );
}
