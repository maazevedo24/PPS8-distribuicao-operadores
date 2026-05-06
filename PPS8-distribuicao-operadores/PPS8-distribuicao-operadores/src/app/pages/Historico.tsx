import { useState, useMemo, useEffect, useCallback } from "react";
import { HistoricoBalanceamento, ResultadosBalanceamento, ConfiguracaoDistribuicao } from "../types";
import { obterHistorico, gerarHistoricoDemo } from "../utils/historico";
import { useStorage } from "../contexts/StorageContext";
import { Calendar, TrendingDown, TrendingUp, BarChart3, Trash2, Filter, X, Database, Eye } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ResumoResultados } from "../components/ResumoResultados";
import { DashboardResultados } from "../components/DashboardResultados";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import axios from "axios";
import { API_BASE_URL } from "../config";

type ApiRecord = Record<string, any>;

const ensureArray = (value: unknown): ApiRecord[] => {
  if (Array.isArray(value)) return value as ApiRecord[];
  if (value && typeof value === "object") {
    const nestedArray = Object.values(value as Record<string, unknown>).find((entry) => Array.isArray(entry));
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
      const parsed = Number(value.trim().replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const parseMetodo = (row: ApiRecord): 1 | 2 | 3 => {
  const n = pickNumber(row, ["mode", "method", "possibility", "metodo"]);
  if (n === 2) return 2;
  if (n === 3) return 3;
  const modeText = pickString(row, ["mode", "mode_label", "method_label", "metodo_label"]);
  if (modeText.startsWith("2")) return 2;
  if (modeText.startsWith("3")) return 3;
  return 1;
};

const mapApiHistoryToLocal = (row: ApiRecord, index: number): HistoricoBalanceamento => {
  const id = pickString(row, ["id", "_id", "sim_id"]) || `HIST-${index + 1}`;
  const familyId = pickString(row, ["family_id", "family", "family_code"]) || "SEM_FAMILIA";
  const taskName = pickString(row, ["task_name", "name", "nome", "family_name"]) || familyId;
  const createdAt = pickString(row, ["created_at", "timestamp", "created", "date"]);
  const metodo = parseMetodo(row);

  const numOperadores = pickNumber(row, ["num_operators", "numero_operadores", "operators"]) ?? 0;
  const oleMedio = pickNumber(row, ["avg_ole_pct", "average_ole", "ole_media"]) ?? 0;
  const perdas = pickNumber(row, ["balance_loss_pct", "perdas", "loss_pct"]) ?? 0;
  const produtividade = pickNumber(row, ["productivity_pct", "produtividade", "efficiency"]) ?? 0;
  const taktSec = pickNumber(row, ["takt_time_seconds", "takt_seconds", "takt_time"]) ?? 0;
  const ciclosHora = pickNumber(row, ["cycles_per_hour", "numero_ciclos_hora", "cyclesHour"]) ?? 0;
  const operationAllocations = ensureArray(row.operation_allocations);

  return {
    id,
    timestamp: createdAt ? new Date(createdAt) : new Date(),
    unidade: 1,
    produtoId: familyId,
    produtoNome: taskName,
    produtoReferencia: familyId,
    metodo,
    resultados: {
      distribuicao: [],
      operation_allocations: operationAllocations,
      numeroCiclosPorHora: ciclosHora,
      taktTime: taktSec / 60,
      tempoCiclo: 0,
      produtividade,
      perdas,
      numeroOperadores: numOperadores,
    },
    configuracao: {
      possibilidade: metodo,
      horasTurno: 8,
      produtividadeEstimada: 85,
      agruparMaquinas: true,
      cargaMaximaOperador: 95,
      naoDividirMaiorQue: 5,
      naoDividirMenorQue: 0.3,
    },
    oleMedia: oleMedio,
    numeroOperacoes: operationAllocations.length,
  };
};

const extractHistoryDetailRecord = (payload: unknown): ApiRecord => {
  if (!payload) return {};

  if (typeof payload === "string") {
    const text = payload.trim();
    if (!text) return {};
    try {
      return extractHistoryDetailRecord(JSON.parse(text));
    } catch {
      return {};
    }
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) return {};
    return extractHistoryDetailRecord(payload[0]);
  }

  if (typeof payload !== "object") return {};

  const record = payload as ApiRecord;
  if (Array.isArray(record.operation_allocations)) return record;
  if (Array.isArray(record.operationAllocations)) return record;

  const directStringCandidates = ["body", "response", "payload", "result", "data"];
  for (const key of directStringCandidates) {
    const value = record[key];
    if (typeof value === "string" && value.trim().startsWith("{")) {
      try {
        return extractHistoryDetailRecord(JSON.parse(value));
      } catch {
        // ignore parse error and continue
      }
    }
  }

  const candidates = ["data", "result", "detail", "item", "simulation", "history"];
  for (const key of candidates) {
    const nested = record[key];
    const extracted = extractHistoryDetailRecord(nested);
    if (Object.keys(extracted).length > 0) return extracted;
  }

  // Deep fallback: scan nested objects recursively and return first with allocations
  for (const value of Object.values(record)) {
    if (value && typeof value === "object") {
      const extracted = extractHistoryDetailRecord(value);
      if (Array.isArray(extracted.operation_allocations) || Array.isArray(extracted.operationAllocations)) {
        return extracted;
      }
    }
  }

  return record;
};

const buildResultadosFromDetail = (raw: ApiRecord): ResultadosBalanceamento => {
  const operationAllocations = ensureArray(
    raw.operation_allocations ??
    raw.operationAllocations ??
    raw.allocations ??
    raw.operations_allocations
  );
  const taktSeconds = pickNumber(raw, ["takt_time_seconds", "takt_time", "taktTime"]) ?? 0;
  const realCycleSeconds = pickNumber(raw, ["real_cycle_time_seconds", "cycle_time_seconds", "cycle_time"]) ?? 0;
  const numeroOperadores = pickNumber(raw, ["num_operators", "numero_operadores"]) ?? 0;
  const produtividadeRaw = pickNumber(raw, ["productivity_pct", "productivity", "produtividade"]) ?? 0;
  const perdas = pickNumber(raw, ["balance_loss_pct", "perdas"]) ?? Math.max(0, 100 - produtividadeRaw);
  const ciclosHora = pickNumber(raw, ["cycles_per_hour", "numero_ciclos_hora"]) ?? 0;

  const tempoCiclo = realCycleSeconds > 10 ? realCycleSeconds / 60 : realCycleSeconds;
  const produtividade = produtividadeRaw <= 1 ? produtividadeRaw * 100 : produtividadeRaw;

  return {
    distribuicao: [],
    operation_allocations: operationAllocations,
    numeroCiclosPorHora: ciclosHora,
    taktTime: taktSeconds / 60,
    tempoCiclo,
    produtividade,
    perdas,
    numeroOperadores,
  };
};

const buildDistribuicaoFromAllocations = (operationAllocations: ApiRecord[], taktSeconds: number) => {
  const byOperator: Record<string, { operacoes: Set<string>; segundos: number; temposOperacoes: Record<string, number> }> = {};

  operationAllocations.forEach((row) => {
    const opCode = String(row?.operation_code || row?.operation_id || "").trim();
    const addTime = (operatorRef: string, secondsRaw: unknown) => {
      const seconds = typeof secondsRaw === "number" ? secondsRaw : Number(String(secondsRaw || "").replace(",", "."));
      if (!operatorRef || !Number.isFinite(seconds) || seconds <= 0) return;
      if (!byOperator[operatorRef]) {
        byOperator[operatorRef] = { operacoes: new Set<string>(), segundos: 0, temposOperacoes: {} };
      }
      if (opCode) byOperator[operatorRef].operacoes.add(opCode);
      byOperator[operatorRef].segundos += seconds;
      if (opCode) byOperator[operatorRef].temposOperacoes[opCode] = (byOperator[operatorRef].temposOperacoes[opCode] || 0) + (seconds / 60);
    };

    const operatorTimes = row?.operator_times && typeof row.operator_times === "object" ? row.operator_times : {};
    Object.entries(operatorTimes).forEach(([operatorRef, secondsRaw]) => {
      addTime(operatorRef, secondsRaw);
    });

    const operatorAllocations = Array.isArray(row?.operator_allocations) ? row.operator_allocations : [];
    operatorAllocations.forEach((alloc: ApiRecord) => {
      const operatorRef = String(
        alloc?.operator_id ??
        alloc?.operator_code ??
        alloc?.operator ??
        alloc?.code ??
        ""
      ).trim();
      const secondsRaw = alloc?.time_seconds ?? alloc?.seconds ?? alloc?.time;
      addTime(operatorRef, secondsRaw);
    });
  });

  return Object.entries(byOperator).map(([operadorId, dados]) => {
    const cargaHoraria = dados.segundos / 60;
    const ocupacao = taktSeconds > 0 ? (dados.segundos / taktSeconds) * 100 : 0;
    return {
      operadorId,
      operacoes: Array.from(dados.operacoes),
      cargaHoraria,
      ocupacao,
      ciclosPorHora: cargaHoraria > 0 ? 60 / cargaHoraria : 0,
      temposOperacoes: dados.temposOperacoes,
    };
  });
};

const buildOperadoresFromAllocations = (operationAllocations: ApiRecord[]) => {
  const byId = new Map<string, { id: string; nome?: string }>();
  operationAllocations.forEach((row) => {
    const operatorAllocations = Array.isArray(row?.operator_allocations) ? row.operator_allocations : [];
    operatorAllocations.forEach((alloc: ApiRecord) => {
      const id = String(alloc?.operator_id ?? alloc?.operator_code ?? alloc?.operator ?? alloc?.code ?? "").trim();
      if (!id) return;
      const nome = String(alloc?.operator_name ?? "").trim() || undefined;
      if (!byId.has(id)) byId.set(id, { id, nome });
    });
    const operatorTimes = row?.operator_times && typeof row.operator_times === "object" ? row.operator_times : {};
    Object.keys(operatorTimes).forEach((id) => {
      const key = String(id || "").trim();
      if (key && !byId.has(key)) byId.set(key, { id: key });
    });
  });
  return Array.from(byId.values());
};

const buildOperacoesFromAllocations = (operationAllocations: ApiRecord[]) => {
  return operationAllocations.map((row, idx) => ({
    id: String(row?.operation_code || row?.operation_id || `OP${idx + 1}`),
    nome: String(row?.operation_name || row?.operation_code || row?.operation_id || `Operacao ${idx + 1}`),
    sequencia: Number(row?.seq ?? idx + 1),
    tipoMaquina: String(row?.machine_type || ""),
    tempo: (Number(row?.total_time_seconds ?? 0) || 0) / 60,
  }));
};

export default function Historico() {
  const { salvar } = useStorage();

  const [historico, setHistorico] = useState<HistoricoBalanceamento[]>(() => obterHistorico());
  const [filtroMetodo, setFiltroMetodo] = useState<string>("all");
  const [filtroOperador, setFiltroOperador] = useState<string>("all");
  const [pesquisaFichaTecnica, setPesquisaFichaTecnica] = useState<string>("");
  const [comparar, setComparar] = useState<string[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [loadingDetalheId, setLoadingDetalheId] = useState<string | null>(null);
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [detalheSelecionado, setDetalheSelecionado] = useState<{
    id: string;
    raw: ApiRecord;
    resultados: ResultadosBalanceamento;
    config: ConfiguracaoDistribuicao;
    operadores: any[];
    operacoes: any[];
  } | null>(null);
  const [detalheViewMode, setDetalheViewMode] = useState<"tempo" | "percentagem">("tempo");

  const carregarHistoricoApi = useCallback(async () => {
    setLoadingHistorico(true);
    try {
      const resposta = await axios.get(`${API_BASE_URL}/history/`);
      const dados = ensureArray(resposta.data);
      const mapeado = dados.map(mapApiHistoryToLocal);
      setHistorico(mapeado);
      salvar({ historico: mapeado });
      setErroApi(null);
    } catch (error) {
      console.error("Erro ao carregar historico da API:", error);
      setErroApi("Nao foi possivel carregar historico da API. A mostrar dados locais.");
      setHistorico(obterHistorico());
    } finally {
      setLoadingHistorico(false);
    }
  }, [salvar]);

  useEffect(() => {
    void carregarHistoricoApi();
  }, [carregarHistoricoApi]);

  const estatisticas = useMemo(() => {
    if (historico.length === 0) return { totalCalculos: 0, oleMedio: 0, perdasMedia: 0, taktTimeMedio: 0 };
    const total = historico.length;
    return {
      totalCalculos: total,
      oleMedio: historico.reduce((s, h) => s + (h.oleMedia || 0), 0) / total,
      perdasMedia: historico.reduce((s, h) => s + (h.resultados.perdas || 0), 0) / total,
      taktTimeMedio: historico.reduce((s, h) => s + (h.resultados.taktTime || 0), 0) / total,
    };
  }, [historico]);

  const operadoresUnicos = useMemo(() => {
    const ops = new Set<number>();
    historico.forEach((item) => ops.add(item.resultados.numeroOperadores));
    return Array.from(ops).sort((a, b) => a - b);
  }, [historico]);

  const historicoFiltrado = useMemo(() => {
    const pesquisa = pesquisaFichaTecnica.trim().toLowerCase();
    return historico.filter((item) => {
      const matchMetodo = filtroMetodo === "all" || item.metodo.toString() === filtroMetodo;
      const matchOperador = filtroOperador === "all" || item.resultados.numeroOperadores.toString() === filtroOperador;
      const nome = String(item.produtoNome || "").toLowerCase();
      const referencia = String(item.produtoReferencia || "").toLowerCase();
      const produtoId = String(item.produtoId || "").toLowerCase();
      const matchPesquisaFicha =
        pesquisa === "" ||
        nome.includes(pesquisa) ||
        referencia.includes(pesquisa) ||
        produtoId.includes(pesquisa);
      return matchMetodo && matchOperador && matchPesquisaFicha;
    });
  }, [historico, filtroMetodo, filtroOperador, pesquisaFichaTecnica]);

  const handleRemoverItem = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja remover este registro?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/history/${encodeURIComponent(id)}`);
      const novo = historico.filter((h) => h.id !== id);
      setHistorico(novo);
      setComparar((prev) => prev.filter((c) => c !== id));
      if (detalheSelecionado?.id === id) setDetalheSelecionado(null);
      salvar({ historico: novo });
    } catch (error) {
      console.error("Erro ao remover historico na API:", error);
      alert("Nao foi possivel remover na API.");
    }
  };

  const handleLimparHistorico = async () => {
    if (!window.confirm("Tem certeza que deseja limpar todo o historico? Esta acao nao pode ser desfeita.")) return;
    try {
      await Promise.all(historico.map((item) => axios.delete(`${API_BASE_URL}/history/${encodeURIComponent(item.id)}`)));
      setHistorico([]);
      setComparar([]);
      setDetalheSelecionado(null);
      salvar({ historico: [] });
    } catch (error) {
      console.error("Erro ao limpar historico na API:", error);
      alert("Nao foi possivel limpar todo o historico na API.");
    }
  };

  const handleVerDetalhes = async (id: string) => {
    try {
      setLoadingDetalheId(id);
      const resposta = await axios.get(`${API_BASE_URL}/history/${encodeURIComponent(id)}`);
      const detalhe = extractHistoryDetailRecord(resposta.data);
      const resultados = buildResultadosFromDetail(detalhe);
      const operationAllocations = ensureArray(
        detalhe.operation_allocations ??
        detalhe.operationAllocations ??
        detalhe.allocations ??
        detalhe.operations_allocations
      );
      const taktSeconds = pickNumber(detalhe, ["takt_time_seconds", "takt_time", "taktTime"]) ?? 0;
      const distribuicao = buildDistribuicaoFromAllocations(operationAllocations, taktSeconds);
      resultados.distribuicao = distribuicao as any;
      const config: ConfiguracaoDistribuicao = {
        possibilidade: parseMetodo(detalhe),
        horasTurno: 8,
        produtividadeEstimada: 85,
        agruparMaquinas: true,
        cargaMaximaOperador: 95,
        naoDividirMaiorQue: 5,
        naoDividirMenorQue: 0.3,
      };
      setDetalheSelecionado({
        id,
        raw: detalhe,
        resultados,
        config,
        operadores: ensureArray(detalhe.operators).length > 0
          ? ensureArray(detalhe.operators)
          : buildOperadoresFromAllocations(operationAllocations),
        operacoes: ensureArray(detalhe.operations).length > 0
          ? ensureArray(detalhe.operations)
          : buildOperacoesFromAllocations(operationAllocations),
      });
    } catch (error) {
      console.error("Erro ao carregar detalhes da simulacao:", error);
      alert("Nao foi possivel carregar os detalhes desta simulacao.");
    } finally {
      setLoadingDetalheId(null);
    }
  };

  const handleToggleComparar = (id: string) => {
    if (comparar.includes(id)) {
      setComparar(comparar.filter((c) => c !== id));
    } else if (comparar.length < 3) {
      setComparar([...comparar, id]);
    } else {
      alert("Pode comparar no maximo 3 registros de cada vez.");
    }
  };

  const registrosComparados = useMemo(() => {
    return comparar.map((id) => historico.find((h) => h.id === id)).filter(Boolean) as HistoricoBalanceamento[];
  }, [comparar, historico]);

  const dadosGrafico = useMemo(() => {
    return historicoFiltrado
      .slice()
      .reverse()
      .map((item, index) => ({
        data: new Date(item.timestamp).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
        dataKey: `${new Date(item.timestamp).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })}_${index}`,
        perdas: item.resultados.perdas,
        ole: item.oleMedia,
      }));
  }, [historicoFiltrado]);

  const getMetodoNome = (metodo: 1 | 2 | 3): string => {
    if (metodo === 2) return "Por Quantidade";
    if (metodo === 3) return "N Fixo Operadores";
    return "Distribuição Ideal";
  };

  return (
    <main className="w-full px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Histórico de Balanceamentos</h1>
          <p className="text-gray-500 mt-1 text-sm">Análise e comparação de cálculos anteriores</p>
        </div>
        {historico.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleLimparHistorico} className="text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="w-4 h-4 mr-2" />
            Limpar Histórico
          </Button>
        )}
      </div>

      {erroApi && <div className="p-3 bg-amber-50 border border-amber-200 rounded-sm text-amber-700 text-sm">{erroApi}</div>}
      {loadingHistorico && <div className="text-sm text-gray-500">A carregar histórico da API...</div>}

      {historico.length === 0 ? (
        <div className="bg-white rounded-sm border border-gray-200 p-12 text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sem histórico disponível</h3>
          <p className="text-gray-500 text-sm mb-6">Realize cálculos de balanceamento para começar a construir histórico.</p>
          <Button
            onClick={() => {
              gerarHistoricoDemo();
              const novoHistorico = obterHistorico();
              setHistorico(novoHistorico);
              salvar({ historico: novoHistorico });
            }}
            className="bg-blue-500 hover:bg-blue-600 rounded-sm text-sm"
          >
            <Database className="w-4 h-4 mr-2" />
            Gerar Dados de Demonstração
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-sm border border-gray-200"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-blue-100 rounded-sm flex items-center justify-center"><BarChart3 className="w-5 h-5 text-blue-600" /></div><div><div className="text-xs text-gray-500 uppercase">Total Cálculos</div><div className="text-2xl font-bold text-gray-900">{estatisticas.totalCalculos}</div></div></div></div>
            <div className="bg-white p-6 rounded-sm border border-gray-200"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-green-100 rounded-sm flex items-center justify-center"><TrendingUp className="w-5 h-5 text-green-600" /></div><div><div className="text-xs text-gray-500 uppercase">OLE Médio</div><div className="text-2xl font-bold text-gray-900">{estatisticas.oleMedio.toFixed(1)}%</div></div></div></div>
            <div className="bg-white p-6 rounded-sm border border-gray-200"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-orange-100 rounded-sm flex items-center justify-center"><TrendingDown className="w-5 h-5 text-orange-600" /></div><div><div className="text-xs text-gray-500 uppercase">Perdas Médias</div><div className="text-2xl font-bold text-gray-900">{estatisticas.perdasMedia.toFixed(1)}%</div></div></div></div>
            <div className="bg-white p-6 rounded-sm border border-gray-200"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 bg-purple-100 rounded-sm flex items-center justify-center"><Calendar className="w-5 h-5 text-purple-600" /></div><div><div className="text-xs text-gray-500 uppercase">Takt Time Médio</div><div className="text-2xl font-bold text-gray-900">{(estatisticas.taktTimeMedio * 60).toFixed(1)}s</div></div></div></div>
          </div>

          <div className="bg-white p-5 rounded-sm border border-gray-200">
            <div className="flex items-center gap-4 flex-wrap">
              <Filter className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-semibold text-gray-900">Filtros:</span>
              <Select value={filtroMetodo} onValueChange={setFiltroMetodo}><SelectTrigger className="w-[210px] rounded-sm text-sm"><SelectValue placeholder="Todos os métodos" /></SelectTrigger><SelectContent className="rounded-sm"><SelectItem value="all">Todos os métodos</SelectItem><SelectItem value="1">Distribuição Ideal</SelectItem><SelectItem value="2">Por Quantidade</SelectItem><SelectItem value="3">N Fixo Operadores</SelectItem></SelectContent></Select>
              <Select value={filtroOperador} onValueChange={setFiltroOperador}><SelectTrigger className="w-[210px] rounded-sm text-sm"><SelectValue placeholder="Todos os operadores" /></SelectTrigger><SelectContent className="rounded-sm"><SelectItem value="all">Todos os operadores</SelectItem>{operadoresUnicos.map((op) => <SelectItem key={op} value={op.toString()}>{op} Operador(es)</SelectItem>)}</SelectContent></Select>
              <Input value={pesquisaFichaTecnica} onChange={(e) => setPesquisaFichaTecnica(e.target.value)} placeholder="Pesquisar por ficha técnica (nome ou referência)" className="w-[320px] rounded-sm text-sm" />
              {(filtroMetodo !== "all" || filtroOperador !== "all" || pesquisaFichaTecnica.trim() !== "") && (
                <Button variant="ghost" size="sm" onClick={() => { setFiltroMetodo("all"); setFiltroOperador("all"); setPesquisaFichaTecnica(""); }} className="text-xs"><X className="w-3 h-3 mr-1" />Limpar filtros</Button>
              )}
            </div>
          </div>

          {comparar.length > 0 && (
            <div className="bg-blue-50 p-6 rounded-sm border-2 border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-blue-900">Comparação ({comparar.length}/3)</h3>
                <Button variant="ghost" size="sm" onClick={() => setComparar([])} className="text-blue-700 hover:text-blue-800 hover:bg-blue-100">
                  <X className="w-4 h-4 mr-1" />Limpar seleção
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {registrosComparados.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-sm border border-blue-200">
                    <div className="text-xs font-mono text-blue-600 mb-1">{new Date(item.timestamp).toLocaleString("pt-PT")}</div>
                    <div className="text-sm font-semibold text-gray-900 mb-3">{item.produtoNome}</div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-gray-600">Método:</span><span className="font-semibold text-gray-900">{getMetodoNome(item.metodo)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Operadores:</span><span className="font-semibold text-gray-900">{item.resultados.numeroOperadores}</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Perdas:</span><span className="font-semibold text-orange-600">{(item.resultados.perdas || 0).toFixed(1)}%</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">OLE Médio:</span><span className="font-semibold text-green-600">{item.oleMedia.toFixed(1)}%</span></div>
                      <div className="flex justify-between"><span className="text-gray-600">Takt Time:</span><span className="font-semibold text-gray-900">{((item.resultados.taktTime || 0) * 60).toFixed(1)}s</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detalheSelecionado && (
            <div className="bg-white p-6 rounded-sm border border-gray-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-900">Detalhe da Simulação</h3>
                <Button variant="ghost" size="sm" onClick={() => setDetalheSelecionado(null)} className="text-xs"><X className="w-3 h-3 mr-1" />Fechar detalhe</Button>
              </div>
              <div className="text-xs text-gray-500">
                Ficha técnica: <span className="font-mono text-gray-900">{pickString(detalheSelecionado.raw, ["family_id", "family", "family_code"]) || "-"}</span>
              </div>
              <ResumoResultados resultados={detalheSelecionado.resultados} config={detalheSelecionado.config} />
              <div className="flex items-center justify-end">
                <div className="inline-flex items-center rounded-sm border border-gray-200 bg-white p-0.5">
                  <Button type="button" size="sm" variant={detalheViewMode === "tempo" ? "default" : "ghost"} onClick={() => setDetalheViewMode("tempo")} className="h-7 px-2.5 text-[10px]">Tempo</Button>
                  <Button type="button" size="sm" variant={detalheViewMode === "percentagem" ? "default" : "ghost"} onClick={() => setDetalheViewMode("percentagem")} className="h-7 px-2.5 text-[10px]">Percentagem</Button>
                </div>
              </div>
              <DashboardResultados
                resultados={detalheSelecionado.resultados}
                operadores={detalheSelecionado.operadores}
                operacoes={detalheSelecionado.operacoes}
                config={detalheSelecionado.config}
                onRecalcular={() => {}}
                viewMode={detalheViewMode}
              />
            </div>
          )}

          <div className="bg-white rounded-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 w-10">Comparar</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">Data/Hora</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">Ficha técnica</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">Método</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">Operadores</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">OLE médio</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">Perdas</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">Takt Time</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600">Ciclos/Hora</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 w-20">Detalhes</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 w-10">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoFiltrado.map((item) => (
                    <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${comparar.includes(item.id) ? "bg-blue-50" : ""}`}>
                      <td className="p-3"><input type="checkbox" checked={comparar.includes(item.id)} onChange={() => handleToggleComparar(item.id)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" /></td>
                      <td className="p-3 font-mono text-xs text-gray-700">{new Date(item.timestamp).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="p-3 text-sm text-gray-900"><div className="font-medium">{item.produtoNome}</div><div className="text-xs text-gray-500 font-mono">{item.produtoReferencia}</div></td>
                      <td className="p-3 text-xs text-gray-700">{getMetodoNome(item.metodo)}</td>
                      <td className="p-3 font-mono text-sm text-gray-700 text-center">{item.resultados.numeroOperadores}</td>
                      <td className="p-3"><span className={`inline-flex items-center px-2 py-1 rounded-sm text-xs font-semibold font-mono ${item.oleMedia >= 85 ? "bg-green-100 text-green-800 border border-green-200" : item.oleMedia >= 75 ? "bg-yellow-100 text-yellow-800 border border-yellow-200" : "bg-red-100 text-red-800 border border-red-200"}`}>{item.oleMedia.toFixed(1)}%</span></td>
                      <td className="p-3"><span className={`inline-flex items-center px-2 py-1 rounded-sm text-xs font-semibold font-mono ${(item.resultados.perdas || 0) <= 10 ? "bg-green-100 text-green-800 border border-green-200" : (item.resultados.perdas || 0) <= 20 ? "bg-yellow-100 text-yellow-800 border border-yellow-200" : "bg-red-100 text-red-800 border border-red-200"}`}>{(item.resultados.perdas || 0).toFixed(1)}%</span></td>
                      <td className="p-3 font-mono text-sm text-gray-700">{((item.resultados.taktTime || 0) * 60).toFixed(1)}s</td>
                      <td className="p-3 font-mono text-sm text-gray-700">{((item.resultados.numeroCiclosPorHora ?? (item.resultados as any).numeroPecasHora ?? 0)).toFixed(0)}</td>
                      <td className="p-3"><Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void handleVerDetalhes(item.id)} disabled={loadingDetalheId === item.id}><Eye className="w-3 h-3 mr-1" />{loadingDetalheId === item.id ? "..." : "Ver"}</Button></td>
                      <td className="p-3"><button onClick={() => void handleRemoverItem(item.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors" title="Remover"><Trash2 className="w-4 h-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {dadosGrafico.length > 1 && (
            <div className="bg-white p-6 rounded-sm border border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Tendência do OLE</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dadosGrafico} id="ole-trend-chart">
                  <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis key="xaxis" dataKey="dataKey" stroke="#6b7280" style={{ fontSize: "12px" }} tickFormatter={(v) => v.split("_")[0]} />
                  <YAxis key="yaxis" stroke="#6b7280" style={{ fontSize: "12px" }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip key="tooltip" contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "4px", fontSize: "12px" }} formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "OLE Médio"]} />
                  <Legend key="legend" wrapperStyle={{ fontSize: "12px" }} />
                  <ReferenceLine key="ref-85" y={85} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} />
                  <Line key="line-ole" type="monotone" dataKey="ole" stroke="#10b981" name="OLE Médio (%)" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 6, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </main>
  );
}
