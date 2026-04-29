import { useState, useRef, useEffect } from "react";
import { Produto, Operacao, Operador } from "../types";
import { produtosMock, operadoresMock } from "../data/mock";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  FileText,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
  Package,
  AlertTriangle,
  Pencil,
  ChevronRight,
  Clock,
  Cpu,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { AtribuicaoManual } from "../components/AtribuicaoManual";
import * as XLSX from "xlsx";
import axios from "axios";
import { API_BASE_URL } from "../config";

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
    const hasDirectKeys = [
      "code",
      "id",
      "name",
      "description",
      "operations",
      "operacoes",
      "task_id",
      "task_code",
      "family_id",
    ].some((key) => key in record);

    if (hasDirectKeys) return record;

    const nestedRecord = Object.values(record).find(
      (entry) => entry && typeof entry === "object" && !Array.isArray(entry)
    );
    if (nestedRecord && typeof nestedRecord === "object") {
      return nestedRecord as ApiRecord;
    }
  }

  return null;
};

const mapApiOperation = (raw: ApiRecord, index: number): Operacao =>
  (() => {
    const timeMinutes = pickNumber(raw, [
      "time_min",
      "time_minutes",
      "tempo_minutos",
      "tempo",
      "minutes",
    ]);
    const timeCmin = pickNumber(raw, ["time_cmin", "tempo_cmin", "cmin"]);

    return {
    id:
      pickString(raw, ["operation_code", "operation_id", "id", "code"]) ||
      `OP${String(index + 1).padStart(3, "0")}`,
    nome:
      pickString(raw, ["operation_name", "name", "nome", "designation", "description", "descricao"]) ||
      `Operacao ${index + 1}`,
    tempo:
      timeMinutes ??
      (timeCmin != null ? timeCmin / 100 : null) ??
      ((pickNumber(raw, ["time_seconds", "tempo_segundos", "seconds"]) || 0) / 60),
    tipoMaquina: pickString(raw, ["machine_name", "machine_type", "tipo_maquina", "tipoMaquina"]),
    sequencia:
      pickNumber(raw, ["sequence_order", "sequence", "sequencia", "seq", "order"]) ?? index + 1,
    critica: pickBoolean(raw, ["is_critical", "critica"]),
  } as Operacao;
  })();

const mapApiTaskToProduto = (raw: ApiRecord, index: number, familyId: string): Produto => {
  const taskId =
    pickString(raw, ["task_id", "task_code", "id", "code"]) ||
    `${familyId}-TASK-${String(index + 1).padStart(3, "0")}`;
  const taskName =
    pickString(raw, ["task_name", "name", "nome", "description", "descricao"]) ||
    `Ficha ${index + 1}`;

  const operationsRaw = ensureArray(
    raw.operations ??
      raw.operacoes ??
      raw.steps ??
      raw.sequence ??
      raw.gama_operatoria
  ).map((operation, operationIndex) => mapApiOperation(operation, operationIndex));
  const operations = operationsRaw
    .sort((a, b) => a.sequencia - b.sequencia)
    .map((operation, operationIndex) => ({
      ...operation,
      sequencia: operationIndex + 1,
    }));

  const numOperations =
    pickNumber(raw, ["num_operations", "numero_operacoes", "operations_count"]) ??
    operations.length;
  const numCapableOperators = pickNumber(raw, [
    "num_capable_operators",
    "numero_operadores_disponiveis",
  ]);
  const numDistinctMachines = pickNumber(raw, [
    "num_distinct_machines",
    "numero_maquinas_distintas",
  ]);

  const indicators = [
    numOperations != null ? `${numOperations} ops` : null,
    numCapableOperators != null ? `${numCapableOperators} op disponiveis` : null,
    numDistinctMachines != null ? `${numDistinctMachines} maquinas` : null,
  ].filter(Boolean);

  const today = new Date().toISOString().split("T")[0];

  return {
    id: taskId,
    nome: taskName,
    referencia:
      pickString(raw, ["reference", "referencia", "task_reference", "task_code"]) || taskId,
    cliente: pickString(raw, ["client", "cliente"]),
    descricao:
      pickString(raw, ["notes", "observacoes", "description", "descricao"]) ||
      (indicators.length ? indicators.join(" | ") : `Ficha tecnica da familia ${familyId}`),
    operacoes: operations,
    dataCriacao: pickString(raw, ["created_at", "creation_date", "data_criacao"]) || today,
    dataModificacao:
      pickString(raw, ["updated_at", "modified_at", "data_modificacao"]) || today,
  };
};

const normalizeToken = (value: string): string => value.trim().toUpperCase();

const normalizeNumericToken = (value: string): string => {
  const sanitized = value.trim().replace(/[^\d-]/g, "");
  if (!sanitized) return "";
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? String(parsed) : "";
};

const parseAssignedOperatorIds = (value: unknown): string[] => {
  const asArray = (input: unknown[]): string[] =>
    input
      .map((entry) => (typeof entry === "string" || typeof entry === "number" ? String(entry).trim() : ""))
      .filter(Boolean);

  if (Array.isArray(value)) return asArray(value);
  if (typeof value === "number" && Number.isFinite(value)) return [String(value)];
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return asArray(parsed);
      } catch {
        // fallback para parsing simples abaixo
      }
    }

    if (trimmed.includes(",") || trimmed.includes(";")) {
      return trimmed
        .split(/[;,]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    return [trimmed];
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nestedCandidates = [
      record.collaborator_ids,
      record.collaborators,
      record.colaboradores,
      record.operator_ids,
      record.operators,
      record.operadores,
      record.collaborator_id,
      record.operator_id,
      record.operator,
      record.operador,
      record.id,
      record.code,
    ];
    for (const candidate of nestedCandidates) {
      const parsed = parseAssignedOperatorIds(candidate);
      if (parsed.length > 0) return parsed;
    }
  }

  return [];
};

const resolveOperationIdFromKey = (operationKey: string, operacoes: Operacao[]): string | null => {
  const keyToken = normalizeToken(operationKey);
  const keyNumeric = normalizeNumericToken(operationKey);
  const keyAsNumber = Number(operationKey);

  const byId = operacoes.find((operacao) => normalizeToken(operacao.id) === keyToken);
  if (byId) return byId.id;

  if (keyNumeric) {
    const byIdNumeric = operacoes.find(
      (operacao) => normalizeNumericToken(operacao.id) === keyNumeric
    );
    if (byIdNumeric) return byIdNumeric.id;
  }

  if (Number.isFinite(keyAsNumber)) {
    const bySequence = operacoes.find((operacao) => operacao.sequencia === keyAsNumber);
    if (bySequence) return bySequence.id;
  }

  return null;
};

const mapOperationCandidatesToManual = (
  operationCandidates: Record<string, unknown>,
  operacoes: Operacao[]
): { [operacaoId: string]: string[] } => {
  const mapped: { [operacaoId: string]: string[] } = {};

  Object.entries(operationCandidates).forEach(([operationKey, operationValue]) => {
    const operacaoId = resolveOperationIdFromKey(operationKey, operacoes);
    if (!operacaoId) return;

    const operadoresIds = Array.from(new Set(parseAssignedOperatorIds(operationValue)));
    if (operadoresIds.length === 0) return;
    mapped[operacaoId] = operadoresIds;
  });

  return mapped;
};

const candidatePoolsArrayToObject = (
  rows: unknown[],
  operacoes: Operacao[]
): Record<string, unknown> | null => {
  const mapped: Record<string, unknown> = {};

  rows.forEach((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return;
    const record = row as ApiRecord;
    const operationKey =
      pickString(record, [
        "operation_code",
        "operation_id",
        "op_code",
        "op_id",
        "operation",
        "op",
        "code",
        "id",
      ]) || "";
    if (!operationKey) return;

    const operacaoId = resolveOperationIdFromKey(operationKey, operacoes);
    if (!operacaoId) return;

    const operatorIds = parseAssignedOperatorIds(
      record.collaborator_ids ??
        record.collaborators ??
        record.colaboradores ??
        record.operator_ids ??
        record.operators ??
        record.operadores ??
        record.collaborator_id ??
        record.operator_id ??
        record.operator ??
        record.operador
    );
    if (operatorIds.length === 0) return;

    mapped[operacaoId] = Array.from(new Set(operatorIds));
  });

  return Object.keys(mapped).length > 0 ? mapped : null;
};

const coerceCandidatePoolsObject = (
  value: unknown,
  operacoes: Operacao[]
): Record<string, unknown> | null => {
  if (!value) return null;
  if (Array.isArray(value)) return candidatePoolsArrayToObject(value, operacoes);
  if (typeof value === "object") return value as Record<string, unknown>;
  return null;
};

const getOperationCandidatesCoverage = (
  operationCandidates: Record<string, unknown>,
  operacoes: Operacao[]
): number => Object.keys(mapOperationCandidatesToManual(operationCandidates, operacoes)).length;

const extractCandidatePoolsForProduto = (
  responseRecord: Record<string, unknown>,
  produtoAlvo: Produto
): Record<string, unknown> | null => {
  const pickedTaskIds = Array.from(
    new Set([produtoAlvo.id, produtoAlvo.referencia].map((value) => value?.trim()).filter(Boolean))
  ) as string[];
  const normalizedTaskIds = new Set(pickedTaskIds.map((value) => normalizeToken(value)));

  const seen = new Set<object>();
  const queue: Record<string, unknown>[] = [responseRecord];
  let bestCandidate: Record<string, unknown> | null = null;
  let bestCoverage = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);

    const nestedPools =
      current.candidate_pools ??
      current.candidatePools ??
      current.pools ??
      current.operation_candidates ??
      current.operationCandidates ??
      null;

    const coercedNestedPools = coerceCandidatePoolsObject(nestedPools, produtoAlvo.operacoes);
    if (coercedNestedPools) {
      queue.push(coercedNestedPools);
    }

    const currentTaskId = pickString(current, ["task_id", "taskId", "task_code", "taskCode", "reference"]);
    const currentCoverage = getOperationCandidatesCoverage(current, produtoAlvo.operacoes);
    if (
      currentCoverage > 0 &&
      (bestCandidate === null ||
        currentCoverage > bestCoverage ||
        (currentTaskId && normalizedTaskIds.has(normalizeToken(currentTaskId))))
    ) {
      bestCandidate = current;
      bestCoverage = currentCoverage;
    }

    Object.entries(current).forEach(([key, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return;

      const nested = value as Record<string, unknown>;
      const nestedTaskId = pickString(nested, ["task_id", "taskId", "task_code", "taskCode", "reference"]);
      if (nestedTaskId && normalizedTaskIds.has(normalizeToken(nestedTaskId))) {
        queue.push(nested);
        return;
      }

      if (normalizedTaskIds.has(normalizeToken(key))) {
        queue.push(nested);
        return;
      }

      if (nested.candidate_pools || nested.candidatePools || nested.pools) {
        queue.push(nested);
        return;
      }

      const nestedCoverage = getOperationCandidatesCoverage(nested, produtoAlvo.operacoes);
      if (nestedCoverage > 0) {
        queue.push(nested);
      }
    });
  }

  if (bestCandidate && bestCoverage > 0) return bestCandidate;
  return null;
};

const canonicalizeOperatorIds = (operatorIds: string[], operadoresCatalogo: Operador[]): string[] => {
  if (operadoresCatalogo.length === 0) return operatorIds;
  const byNormalized = new Map(
    operadoresCatalogo.map((operador) => [normalizeToken(operador.id), operador.id])
  );

  return operatorIds.map((operatorId) => byNormalized.get(normalizeToken(operatorId)) || operatorId);
};

interface FamilyOption {
  id: string;
  label: string;
}

interface ExcelImportMetadata {
  fileName: string;
  fichaCode: string;
  fichaName: string;
  descricao: string;
}

const buildImportMetadataFromFileName = (fileName: string): ExcelImportMetadata => {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim();
  const rawCode = baseName.split(/[\s_-]+/).find(Boolean) || baseName || "IMPORTED";
  const fichaCode = rawCode
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "IMPORTED";

  return {
    fileName,
    fichaCode,
    fichaName: baseName || fichaCode,
    descricao: `Importado automaticamente de ${fileName}`,
  };
};

export default function FichaTecnica() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string | null>(null);
  const [showNovoProduto, setShowNovoProduto] = useState(false);
  const [showNovaOperacao, setShowNovaOperacao] = useState(false);
  const [editandoOperacao, setEditandoOperacao] = useState<string | null>(null);
  const [mensagemGuardado, setMensagemGuardado] = useState<string | null>(null);
  const [atribuicoesManual, setAtribuicoesManual] = useState<{ [operacaoId: string]: string[] }>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<Operacao[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMetadata, setImportMetadata] = useState<ExcelImportMetadata | null>(null);
  const [importingGamas, setImportingGamas] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [familias, setFamilias] = useState<FamilyOption[]>([]);
  const [grupoArtigoSelecionado, setGrupoArtigoSelecionado] = useState<string>("");
  const [loadingFamilias, setLoadingFamilias] = useState(false);
  const [loadingFichas, setLoadingFichas] = useState(false);
  const [loadingFichaPorCodigo, setLoadingFichaPorCodigo] = useState(false);
  const [creatingProduto, setCreatingProduto] = useState(false);
  const [deletingProdutoId, setDeletingProdutoId] = useState<string | null>(null);
  const [addingOperacao, setAddingOperacao] = useState(false);
  const [savingOperacoes, setSavingOperacoes] = useState(false);
  const [removingOperacaoId, setRemovingOperacaoId] = useState<string | null>(null);
  const [produtoParaRemover, setProdutoParaRemover] = useState<Produto | null>(null);
  const [operacaoParaRemover, setOperacaoParaRemover] = useState<Operacao | null>(null);
  const [erroApi, setErroApi] = useState<string | null>(null);
  const operacaoPendenteSyncIndexRef = useRef<number | null>(null);
  const operacaoPendenteSyncCodeRef = useRef<string | null>(null);
  const produtosRef = useRef<Produto[]>([]);
  const produtoSelecionadoRef = useRef<string | null>(null);

  const setOperacaoPendenteSync = (index: number | null, code: string | null) => {
    operacaoPendenteSyncIndexRef.current = index;
    operacaoPendenteSyncCodeRef.current = code;
  };

  const operadores = operadoresMock;

  const [novoProduto, setNovoProduto] = useState({
    nome: "",
    referencia: "",
    cliente: "",
    descricao: "",
  });

  const [novaOperacao, setNovaOperacao] = useState<Partial<Operacao>>({
    id: "",
    nome: "",
    tempo: 0,
    tipoMaquina: "",
    sequencia: 1,
  });

  const produto = produtos.find((p) => p.id === produtoSelecionado);

  useEffect(() => {
    produtosRef.current = produtos;
  }, [produtos]);

  useEffect(() => {
    produtoSelecionadoRef.current = produtoSelecionado;
  }, [produtoSelecionado]);

  useEffect(() => {
    const carregarFamilias = async () => {
      setLoadingFamilias(true);
      setErroApi(null);
      try {
        const resposta = await axios.get(`${API_BASE_URL}/families/`);
        const families = ensureArray(resposta.data).map((family, index) => {
          const id =
            pickString(family, ["family_id", "id", "code", "reference"]) ||
            `FAM${String(index + 1).padStart(3, "0")}`;
          const name = pickString(family, ["family_name", "name", "nome"]) || id;
          const reference = pickString(family, ["reference", "referencia"]);
          return {
            id,
            label: reference ? `${name} (${reference})` : name,
          };
        });

        if (families.length === 0) {
          throw new Error("Sem familias devolvidas pela API");
        }

        setFamilias(families);
        setGrupoArtigoSelecionado((current) => current || families[0].id);
      } catch (error) {
        console.error("Erro ao carregar familias:", error);
        setErroApi("Nao foi possivel carregar familias da API. A usar dados locais.");
        const fallbackFamilies = produtosMock.map((family) => ({
          id: family.id,
          label: family.nome,
        }));
        setFamilias(fallbackFamilies);
        setGrupoArtigoSelecionado((current) => current || fallbackFamilies[0]?.id || "");
      } finally {
        setLoadingFamilias(false);
      }
    };

    carregarFamilias();
  }, []);

  useEffect(() => {
    if (!grupoArtigoSelecionado) {
      setAtribuicoesManual({});
      return;
    }

    const carregarFichasDaFamilia = async () => {
      setLoadingFichas(true);
      setErroApi(null);
      setAtribuicoesManual({});
      try {
        const resposta = await axios.get(
          `${API_BASE_URL}/technical-sheets/family/${encodeURIComponent(grupoArtigoSelecionado)}`
        );
        const technicalSheets = ensureArray(resposta.data);
        const fichas = technicalSheets.map((technicalSheet, index) =>
          mapApiTaskToProduto(technicalSheet, index, grupoArtigoSelecionado)
        );

        setProdutos(fichas);
        const selecionadoAnterior = produtoSelecionadoRef.current;
        const proximoSelecionado = fichas.some((ficha) => ficha.id === selecionadoAnterior)
          ? selecionadoAnterior
          : fichas[0]?.id || null;
        setProdutoSelecionado(proximoSelecionado);

        if (proximoSelecionado) {
          produtoSelecionadoRef.current = proximoSelecionado;
          void handleCarregarFichaPorCodigo(proximoSelecionado, fichas);
        }
      } catch (error) {
        console.error("Erro ao carregar fichas da familia:", error);
        setErroApi("Nao foi possivel carregar fichas tecnicas da familia selecionada.");
        const fallback = produtosMock.filter((p) => p.id === grupoArtigoSelecionado);
        setProdutos(fallback);
        setProdutoSelecionado(fallback[0]?.id || null);
        setAtribuicoesManual({});
      } finally {
        setLoadingFichas(false);
      }
    };

    carregarFichasDaFamilia();
  }, [grupoArtigoSelecionado]);

  const handleCarregarCandidatePools = async (produtoAlvo: Produto) => {
    const taskIds = Array.from(
      new Set([produtoAlvo.id, produtoAlvo.referencia].map((value) => value?.trim()).filter(Boolean))
    ) as string[];

    if (taskIds.length === 0) {
      const selecionadoAtual = produtoSelecionadoRef.current;
      if (!selecionadoAtual || selecionadoAtual === produtoAlvo.id) {
        setAtribuicoesManual({});
      }
      return;
    }

    let candidatePools: Record<string, unknown> | null = null;
    for (const taskId of taskIds) {
      try {
        const resposta = await axios.get(
          `${API_BASE_URL}/technical-sheets/${encodeURIComponent(taskId)}/candidate-pools`
        );
        const responseData = resposta.data;
        if (!responseData || typeof responseData !== "object") {
          continue;
        }

        const responseRecord = coerceCandidatePoolsObject(responseData, produtoAlvo.operacoes);
        if (!responseRecord) continue;

        const candidate = extractCandidatePoolsForProduto(responseRecord, produtoAlvo);
        if (candidate) {
          candidatePools = candidate;
          break;
        }
      } catch {
        // tenta próximo task id
      }
    }

    const selecionadoAtual = produtoSelecionadoRef.current;
    if (selecionadoAtual && selecionadoAtual !== produtoAlvo.id) return;

    if (!candidatePools) {
      setAtribuicoesManual({});
      return;
    }

    const mapped = mapOperationCandidatesToManual(candidatePools, produtoAlvo.operacoes);
    Object.keys(mapped).forEach((operacaoId) => {
      mapped[operacaoId] = canonicalizeOperatorIds(mapped[operacaoId], operadores);
    });
    setAtribuicoesManual(mapped);
  };

  const handleCarregarFichaPorCodigo = async (
    produtoId: string,
    sourceProdutos: Produto[] = produtos
  ) => {
    const produtoBase = sourceProdutos.find((item) => item.id === produtoId);
    if (!produtoBase) return;

    setLoadingFichaPorCodigo(true);
    setAtribuicoesManual({});

    try {
      await handleCarregarCandidatePools(produtoBase);
    } finally {
      setLoadingFichaPorCodigo(false);
    }
  };

  const handleSelecionarFicha = (produtoId: string) => {
    produtoSelecionadoRef.current = produtoId;
    setProdutoSelecionado(produtoId);
    setOperacaoPendenteSync(null, null);
    setAtribuicoesManual({});
    void handleCarregarFichaPorCodigo(produtoId);
  };

  const buildLocalProduto = (): Produto => {
    return {
      id: `${grupoArtigoSelecionado || "LOCAL"}-FT${String(produtos.length + 1).padStart(3, "0")}`,
      nome: novoProduto.nome,
      referencia: novoProduto.referencia,
      cliente: novoProduto.cliente,
      descricao: novoProduto.descricao,
      operacoes: [],
      dataCriacao: new Date().toISOString().split("T")[0],
      dataModificacao: new Date().toISOString().split("T")[0],
    };
  };

  const handleCriarProduto = async () => {
    const nome = novoProduto.nome.trim();
    const referencia = novoProduto.referencia.trim();
    if (!nome || !referencia) return;

    const familyId = grupoArtigoSelecionado || familias[0]?.id || "SEM_FAMILIA";
    const fallbackProduto = buildLocalProduto();

    setCreatingProduto(true);
    setErroApi(null);

    try {
      const payload = {
        code: referencia,
        name: nome,
        family_id: familyId,
        description: novoProduto.descricao.trim(),
        operations: [] as ApiRecord[],
      };

      const resposta = await axios.post(`${API_BASE_URL}/technical-sheets/`, payload);
      const createdRecord = ensureRecord(resposta.data);

      const createdProduto: Produto = createdRecord
        ? (() => {
            const mapped = mapApiTaskToProduto(createdRecord, produtos.length, familyId);
            return {
              ...mapped,
              nome: pickString(createdRecord, ["name", "task_name", "nome"]) || nome,
              referencia:
                pickString(createdRecord, ["code", "reference", "referencia"]) || referencia,
              cliente: novoProduto.cliente.trim() || mapped.cliente,
            };
          })()
        : fallbackProduto;

      setProdutos((current) => {
        const existingIndex = current.findIndex((item) => item.id === createdProduto.id);
        if (existingIndex === -1) return [...current, createdProduto];
        const next = [...current];
        next[existingIndex] = createdProduto;
        return next;
      });
      produtoSelecionadoRef.current = createdProduto.id;
      setProdutoSelecionado(createdProduto.id);
      setMensagemGuardado("Ficha tecnica criada com sucesso");
      setTimeout(() => setMensagemGuardado(null), 3000);
      void handleCarregarFichaPorCodigo(createdProduto.id, [createdProduto]);
    } catch (error) {
      console.error("Erro ao criar ficha tecnica:", error);
      setErroApi("Nao foi possivel criar ficha tecnica na API. Criado localmente.");
      setProdutos((current) => [...current, fallbackProduto]);
      setProdutoSelecionado(fallbackProduto.id);
    } finally {
      setShowNovoProduto(false);
      setNovoProduto({ nome: "", referencia: "", cliente: "", descricao: "" });
      setCreatingProduto(false);
    }
  };

  const handleDuplicarProduto = (prodId: string) => {
    const original = produtos.find((p) => p.id === prodId);
    if (!original) return;
    const newProd: Produto = {
      ...original,
      id: `PROD${String(produtos.length + 1).padStart(3, "0")}`,
      nome: `${original.nome} (Copia)`,
      referencia: `${original.referencia}-COPY`,
      operacoes: original.operacoes.map((op) => ({ ...op })),
      dataCriacao: new Date().toISOString().split("T")[0],
      dataModificacao: new Date().toISOString().split("T")[0],
    };
    setProdutos([...produtos, newProd]);
    produtoSelecionadoRef.current = newProd.id;
    setProdutoSelecionado(newProd.id);
  };

  const handleRemoverProduto = async (prodId: string) => {
    const produtoAlvo = produtos.find((p) => p.id === prodId);
    if (!produtoAlvo) return;

    const removerLocalmente = () => {
      setProdutos((current) => current.filter((p) => p.id !== prodId));
      setProdutoSelecionado((current) => (current === prodId ? null : current));
    };

    const isLocalOnly = /^PROD\d+$/i.test(prodId) || /-FT\d{3}$/i.test(prodId);
    if (isLocalOnly) {
      removerLocalmente();
      return;
    }

    setDeletingProdutoId(prodId);
    setErroApi(null);

    try {
      const taskIds = Array.from(
        new Set([produtoAlvo.id, produtoAlvo.referencia].map((value) => value?.trim()).filter(Boolean))
      ) as string[];

      let deleted = false;
      let ultimaFalha: unknown = null;
      for (const taskId of taskIds) {
        try {
          await axios.delete(`${API_BASE_URL}/technical-sheets/${encodeURIComponent(taskId)}`);
          deleted = true;
          break;
        } catch (error) {
          ultimaFalha = error;
        }
      }

      if (!deleted) {
        throw ultimaFalha || new Error("Falha ao eliminar ficha tecnica");
      }

      removerLocalmente();
      setMensagemGuardado("Ficha tecnica eliminada com sucesso");
      setTimeout(() => setMensagemGuardado(null), 3000);
    } catch (error) {
      console.error("Erro ao eliminar ficha tecnica:", error);
      setErroApi("Nao foi possivel eliminar ficha tecnica na API.");
    } finally {
      setDeletingProdutoId((current) => (current === prodId ? null : current));
    }
  };

  const solicitarRemocaoProduto = (prod: Produto) => {
    setProdutoParaRemover(prod);
  };

  const handleConfirmarRemocaoProduto = async () => {
    if (!produtoParaRemover) return;
    const productId = produtoParaRemover.id;
    await handleRemoverProduto(productId);
    setProdutoParaRemover((current) => (current?.id === productId ? null : current));
  };

  const handleAddOperacao = async () => {
    if (!produto || !novaOperacao.id || !novaOperacao.nome || !novaOperacao.tempo) return;

    const newOp: Operacao = {
      id: String(novaOperacao.id).trim(),
      nome: String(novaOperacao.nome).trim(),
      tempo: Number(novaOperacao.tempo),
      tipoMaquina: String(novaOperacao.tipoMaquina || "").trim(),
      sequencia: produto.operacoes.length + 1,
      critica: Boolean(novaOperacao.critica),
    };
    setOperacaoPendenteSync(produto.operacoes.length, newOp.id);

    const aplicarOperacaoLocal = (targetProdutoId: string, operacao: Operacao) => {
      setProdutos((current) =>
        current.map((p) =>
          p.id === targetProdutoId
            ? {
                ...p,
                operacoes: [...p.operacoes, operacao],
                dataModificacao: new Date().toISOString().split("T")[0],
              }
            : p
        )
      );
    };

    const concluirPopup = () => {
      setShowNovaOperacao(false);
      setNovaOperacao({ id: "", nome: "", tempo: 0, tipoMaquina: "", sequencia: 1 });
    };

    const isLocalOnly = /^PROD\d+$/i.test(produto.id) || /-FT\d{3}$/i.test(produto.id);
    if (isLocalOnly) {
      aplicarOperacaoLocal(produto.id, newOp);
      concluirPopup();
      return;
    }

    setAddingOperacao(true);
    setErroApi(null);

    try {
      const payload = {
        code: newOp.id,
        designation: newOp.nome,
        is_critical: Boolean(newOp.critica),
        machine_type: newOp.tipoMaquina || "",
        sequence_order: newOp.sequencia,
        time_cmin: Math.round(newOp.tempo * 100),
      };

      const taskIds = Array.from(
        new Set([produto.id, produto.referencia].map((value) => value?.trim()).filter(Boolean))
      ) as string[];

      let resposta: { data: unknown } | null = null;
      let ultimaFalha: unknown = null;
      for (const taskId of taskIds) {
        try {
          resposta = await axios.post(
            `${API_BASE_URL}/technical-sheets/${encodeURIComponent(taskId)}/add-operation`,
            payload
          );
          break;
        } catch (error) {
          ultimaFalha = error;
        }
      }

      if (!resposta) {
        throw ultimaFalha || new Error("Falha ao adicionar operacao na API");
      }

      const updatedSheet = ensureRecord(resposta.data);
      if (updatedSheet) {
        const familyId =
          pickString(updatedSheet, ["family_id", "family", "group_id"]) || grupoArtigoSelecionado;
        const mapped = mapApiTaskToProduto(updatedSheet, 0, familyId);
        const produtoAtualizado: Produto = {
          ...produto,
          ...mapped,
          id: produto.id,
          referencia:
            pickString(updatedSheet, ["code", "task_code", "reference", "referencia"]) ||
            produto.referencia,
        };

        setProdutos((current) =>
          current.map((item) => (item.id === produto.id ? produtoAtualizado : item))
        );
      } else {
        aplicarOperacaoLocal(produto.id, newOp);
      }

      concluirPopup();
    } catch (error) {
      console.error("Erro ao adicionar operacao:", error);
      setErroApi("Nao foi possivel adicionar operacao na API. Adicionada localmente.");
      aplicarOperacaoLocal(produto.id, newOp);
      concluirPopup();
    } finally {
      setAddingOperacao(false);
    }
  };

  const solicitarRemocaoOperacao = (operacao: Operacao) => {
    setOperacaoParaRemover(operacao);
  };

  const concluirRemocaoOperacao = () => {
    if (!produto || !operacaoParaRemover) return;
    const operationId = operacaoParaRemover.id;
    const operacoesRestantes = produto.operacoes.filter((op) => op.id !== operationId);
    setProdutos((current) =>
      current.map((p) => {
        if (p.id !== produto.id) return p;
        const newOps = p.operacoes
          .filter((op) => op.id !== operationId)
          .map((op, idx) => ({ ...op, sequencia: idx + 1 }));
        return {
          ...p,
          operacoes: newOps,
          dataModificacao: new Date().toISOString().split("T")[0],
        };
      })
    );
    setOperacaoPendenteSync(operacoesRestantes.length > 0 ? 0 : null, operacoesRestantes[0]?.id ?? null);
    setOperacaoParaRemover(null);
  };

  const handleConfirmarRemocaoOperacao = async () => {
    if (!produto || !operacaoParaRemover) return;

    const operationCode = operacaoParaRemover.id;
    const isLocalOnly = /^PROD\d+$/i.test(produto.id) || /-FT\d{3}$/i.test(produto.id);
    if (isLocalOnly) {
      concluirRemocaoOperacao();
      return;
    }

    setRemovingOperacaoId(operationCode);
    setErroApi(null);

    try {
      const taskIds = Array.from(
        new Set([produto.id, produto.referencia].map((value) => value?.trim()).filter(Boolean))
      ) as string[];

      let resposta: { data: unknown } | null = null;
      let ultimaFalha: unknown = null;
      for (const taskId of taskIds) {
        try {
          resposta = await axios.delete(
            `${API_BASE_URL}/technical-sheets/${encodeURIComponent(taskId)}/remove-operation/${encodeURIComponent(operationCode)}`
          );
          break;
        } catch (error) {
          ultimaFalha = error;
        }
      }

      if (!resposta) {
        throw ultimaFalha || new Error("Falha ao remover operacao na API");
      }

      const updatedSheet = ensureRecord(resposta.data);
      if (updatedSheet) {
        const familyId =
          pickString(updatedSheet, ["family_id", "family", "group_id"]) || grupoArtigoSelecionado;
        const mapped = mapApiTaskToProduto(updatedSheet, 0, familyId);
        const produtoAtualizado: Produto = {
          ...produto,
          ...mapped,
          id: produto.id,
          referencia:
            pickString(updatedSheet, ["code", "task_code", "reference", "referencia"]) ||
            produto.referencia,
        };

        setProdutos((current) =>
          current.map((item) => (item.id === produto.id ? produtoAtualizado : item))
        );
        setOperacaoParaRemover(null);
      } else {
        concluirRemocaoOperacao();
      }

      setMensagemGuardado("Operacao eliminada com sucesso");
      setTimeout(() => setMensagemGuardado(null), 3000);
    } catch (error) {
      console.error("Erro ao remover operacao:", error);
      setErroApi("Nao foi possivel eliminar operacao da ficha tecnica.");
    } finally {
      setRemovingOperacaoId(null);
    }
  };

  const handleReorder = (currentIndex: number, direction: "up" | "down") => {
    if (!produto) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const operacoesOrdenadasAtuais = [...produto.operacoes].sort((a, b) => a.sequencia - b.sequencia);
    if (targetIndex < 0 || targetIndex >= operacoesOrdenadasAtuais.length) return;
    const movedOperationCode = operacoesOrdenadasAtuais[currentIndex]?.id ?? null;
    const baseProdutos = produtosRef.current.length > 0 ? produtosRef.current : produtos;
    const nextProdutos = baseProdutos.map((p) => {
      if (p.id !== produto.id) return p;
      const ops = [...p.operacoes].sort((a, b) => a.sequencia - b.sequencia);
      [ops[currentIndex], ops[targetIndex]] = [ops[targetIndex], ops[currentIndex]];
      const normalizedOps = ops.map((op, index) => ({ ...op, sequencia: index + 1 }));
      return {
        ...p,
        operacoes: normalizedOps,
        dataModificacao: new Date().toISOString().split("T")[0],
      };
    });
    produtosRef.current = nextProdutos;
    setProdutos(nextProdutos);
    setOperacaoPendenteSync(targetIndex, movedOperationCode);
  };

  const handleToggleCritica = (opId: string, opIndex: number) => {
    if (!produto) return;
    const updated = produtos.map((p) => {
      if (p.id !== produto.id) return p;
      return {
        ...p,
        operacoes: p.operacoes.map((op) =>
          op.id === opId ? { ...op, critica: !op.critica } : op
        ),
        dataModificacao: new Date().toISOString().split("T")[0],
      };
    });
    setProdutos(updated);
    setOperacaoPendenteSync(opIndex, opId);
  };

  const handleEditOperacao = (
    opId: string,
    field: string,
    value: string | number,
    opIndex: number
  ) => {
    if (!produto) return;
    const updated = produtos.map((p) => {
      if (p.id !== produto.id) return p;
      return {
        ...p,
        operacoes: p.operacoes.map((op) =>
          op.id === opId ? { ...op, [field]: value } : op
        ),
        dataModificacao: new Date().toISOString().split("T")[0],
      };
    });
    setProdutos(updated);
    setOperacaoPendenteSync(opIndex, opId);
  };

  const handleGuardarOperacoes = async () => {
    if (!produto) return;
    const produtoAtual = produtosRef.current.find((item) => item.id === produto.id) || produto;

    const operacoesNormalizadas = [...produtoAtual.operacoes]
      .sort((a, b) => a.sequencia - b.sequencia)
      .map((operacao, index) => ({
      ...operacao,
      sequencia: index + 1,
      }));

    setProdutos((current) =>
      current.map((item) =>
        item.id === produto.id
          ? {
              ...item,
              operacoes: operacoesNormalizadas,
              dataModificacao: new Date().toISOString().split("T")[0],
            }
          : item
      )
    );

    if (operacoesNormalizadas.length === 0) {
      setMensagemGuardado("Sem operacoes para guardar");
      setTimeout(() => setMensagemGuardado(null), 3000);
      return;
    }

    const isLocalOnly = /^PROD\d+$/i.test(produtoAtual.id) || /-FT\d{3}$/i.test(produtoAtual.id);
    if (isLocalOnly) {
      setMensagemGuardado("Operacoes guardadas localmente");
      setTimeout(() => setMensagemGuardado(null), 3000);
      return;
    }

    setSavingOperacoes(true);
    setErroApi(null);

    try {
      const taskId = (produtoAtual.id || "").trim();
      if (!taskId) {
        throw new Error("Task ID invalido para guardar operacoes");
      }

      let updatedSheet: ApiRecord | null = null;
      for (const operacao of operacoesNormalizadas) {
        const payload = {
          code: operacao.id,
          designation: operacao.nome,
          is_critical: Boolean(operacao.critica),
          machine_type: operacao.tipoMaquina || "",
          sequence_order: operacao.sequencia,
          time_cmin: Math.round(operacao.tempo * 100),
        };

        const resposta = await axios.put(
          `${API_BASE_URL}/technical-sheets/${encodeURIComponent(taskId)}/update-operation`,
          payload
        );

        const candidate = ensureRecord(resposta.data);
        if (candidate) updatedSheet = candidate;
      }

      if (updatedSheet) {
        const familyId =
          pickString(updatedSheet, ["family_id", "family", "group_id"]) || grupoArtigoSelecionado;
        const mapped = mapApiTaskToProduto(updatedSheet, 0, familyId);
        const produtoAtualizado: Produto = {
          ...produtoAtual,
          ...mapped,
          id: produtoAtual.id,
          referencia:
            pickString(updatedSheet, ["code", "task_code", "reference", "referencia"]) ||
            produtoAtual.referencia,
        };

        setProdutos((current) =>
          current.map((item) => (item.id === produtoAtual.id ? produtoAtualizado : item))
        );
      }

      setMensagemGuardado("Operacoes guardadas com sucesso");
      setTimeout(() => setMensagemGuardado(null), 3000);
      setOperacaoPendenteSync(null, null);
    } catch (error) {
      console.error("Erro ao guardar operacoes:", error);
      setErroApi("Nao foi possivel guardar operacoes na API.");
    } finally {
      setSavingOperacoes(false);
    }
  };

  const handleGuardar = () => {
    setMensagemGuardado("Ficha técnica guardada com sucesso");
    setTimeout(() => setMensagemGuardado(null), 3000);
  };

  const handleAtribuirManualmente = async (operacaoId: string, operadorIds: string[]) => {
    const produtoAtualId = produtoSelecionadoRef.current;
    const produtoAtual = produtosRef.current.find((item) => item.id === produtoAtualId);
    if (!produtoAtual) return;

    const operadoresCanonicalizados = canonicalizeOperatorIds(operadorIds, operadores);

    setAtribuicoesManual((prev) => ({
      ...prev,
      [operacaoId]: operadoresCanonicalizados,
    }));

    const operacaoAtual =
      produtoAtual.operacoes.find((item) => item.id === operacaoId) ||
      produtoAtual.operacoes.find((item) => String(item.sequencia) === operacaoId) ||
      null;

    const operationCodeCandidates = Array.from(
      new Set(
        [operacaoAtual?.id, operacaoId, operacaoAtual ? String(operacaoAtual.sequencia) : ""]
          .map((value) => value?.trim())
          .filter(Boolean)
      )
    ) as string[];
    const taskIds = Array.from(
      new Set([produtoAtual.id, produtoAtual.referencia].map((value) => value?.trim()).filter(Boolean))
    ) as string[];

    if (taskIds.length === 0 || operationCodeCandidates.length === 0) {
      throw new Error("Sem task_id ou op_code valido para guardar candidatos.");
    }

    try {
      let atribuicaoGuardada = false;
      let ultimaFalha: unknown = null;

      for (const taskId of taskIds) {
        for (const operationCode of operationCodeCandidates) {
          try {
            if (operadoresCanonicalizados.length > 0) {
              await axios.put(
                `${API_BASE_URL}/technical-sheets/${encodeURIComponent(taskId)}/candidate-pools/${encodeURIComponent(operationCode)}`,
                {
                  collaborator_ids: operadoresCanonicalizados,
                }
              );
            } else {
              await axios.delete(
                `${API_BASE_URL}/technical-sheets/${encodeURIComponent(taskId)}/candidate-pools/${encodeURIComponent(operationCode)}`
              );
            }
            atribuicaoGuardada = true;
            break;
          } catch (error) {
            if (
              operadoresCanonicalizados.length === 0 &&
              axios.isAxiosError(error) &&
              error.response?.status === 404
            ) {
              // Se já não existir pool para a operação, consideramos limpo.
              atribuicaoGuardada = true;
              break;
            }
            ultimaFalha = error;
          }
        }
        if (atribuicaoGuardada) break;
      }

      if (!atribuicaoGuardada) {
        throw ultimaFalha || new Error("Falha ao guardar candidatos para a operação.");
      }

      const produtoAtualizado =
        produtosRef.current.find((item) => item.id === produtoAtual.id) || produtoAtual;
      await handleCarregarCandidatePools(produtoAtualizado);
    } catch (error) {
      console.error("Erro ao guardar candidatos da operacao:", error);
      setErroApi("Nao foi possivel guardar candidatos da operacao na API.");
      const produtoAtualizado =
        produtosRef.current.find((item) => item.id === produtoAtual.id) || produtoAtual;
      await handleCarregarCandidatePools(produtoAtualizado);
      throw error;
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportMetadata(buildImportMetadataFromFileName(file.name));

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb   = XLSX.read(data, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

        // Tentar detectar colunas flexivelmente
        const parsed: Operacao[] = rows
          .filter((r) => {
            const keys = Object.keys(r).map(k => k.toLowerCase().trim());
            return keys.some(
              (k) =>
                k.includes("operac") ||
                k.includes("nome") ||
                k.includes("descric") ||
                k.includes("designa") ||
                k.includes("cód") ||
                k.includes("cod")
            );
          })
          .map((r, idx) => {
            const get = (patterns: string[]) => {
              const key = Object.keys(r).find(k =>
                patterns.some(p => k.toLowerCase().trim().includes(p))
              );
              return key ? String(r[key]).trim() : "";
            };
            const tempoRaw = get(["tempo", "time", "min", "durac"]);
            const tempo = parseFloat(tempoRaw.replace(",", ".")) || 0;
            const seqRaw = get(["seq", "ordem", "order", "nº", "no", "num"]);
            const seq = parseInt(seqRaw) || (idx + 1);
            const finalRaw = get(["final", "crit"]);
            const finalNormalized = finalRaw.toLowerCase();
            return {
              id: get(["id", "cod", "ref", "código"]) || `OP${String(idx + 1).padStart(3, "0")}`,
              nome: get(["operac", "nome", "descric", "operação", "descrição", "name", "designa"]),
              tempo,
              tipoMaquina: get(["maquin", "máquin", "machine", "tipo", "grupo"]),
              sequencia: seq,
              critica: ["sim", "yes", "true", "1", "x"].includes(finalNormalized),
            } as Operacao;
          })
          .filter(op => op.nome);

        if (parsed.length === 0) {
          setImportError("Nenhuma operação válida encontrada. Verifique as colunas (Operação/Nome, Tempo, Máquina, Seq).");
          return;
        }
        // Renumerar sequências
        parsed.forEach((op, i) => { op.sequencia = i + 1; });
        setImportPreview(parsed);
        setShowImportDialog(true);
      } catch (err) {
        setImportPreview(null);
        setImportMetadata(null);
        setImportError("Erro ao ler o ficheiro. Certifique-se que é um ficheiro Excel (.xlsx ou .xls).");
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleConfirmImport = async () => {
    if (!importPreview?.length || !importMetadata) return;

    const familyId = grupoArtigoSelecionado || familias[0]?.id;
    if (!familyId) {
      setImportError("Selecione um grupo de artigo antes de importar.");
      return;
    }

    setImportingGamas(true);
    setErroApi(null);
    setImportError(null);

    try {
      const existingCodes = new Set(
        produtos.map((item) => normalizeToken(item.referencia || item.id || ""))
      );
      let fichaCode = importMetadata.fichaCode;
      if (existingCodes.has(normalizeToken(fichaCode))) {
        fichaCode = `${fichaCode}-IMP-${Date.now().toString().slice(-4)}`;
      }

      const createPayload = {
        code: fichaCode,
        name: importMetadata.fichaName,
        family_id: familyId,
        description: importMetadata.descricao,
        operations: [] as ApiRecord[],
      };

      const createResponse = await axios.post(`${API_BASE_URL}/technical-sheets/`, createPayload);
      const createdRecord = ensureRecord(createResponse.data);
      if (!createdRecord) {
        throw new Error("Resposta inválida ao criar ficha técnica por importação.");
      }

      const mappedCreated = mapApiTaskToProduto(createdRecord, produtos.length, familyId);
      const createdProduto: Produto = {
        ...mappedCreated,
        nome: pickString(createdRecord, ["name", "task_name", "nome"]) || importMetadata.fichaName,
        referencia: pickString(createdRecord, ["code", "reference", "referencia"]) || fichaCode,
        descricao: importMetadata.descricao,
      };

      const taskIds = Array.from(
        new Set([createdProduto.id, createdProduto.referencia].map((value) => value?.trim()).filter(Boolean))
      ) as string[];
      if (taskIds.length === 0) {
        throw new Error("Task ID inválido para importar operações.");
      }

      const opsSorted = [...importPreview].sort((a, b) => a.sequencia - b.sequencia);
      const failedOps: string[] = [];
      const savedOps: Operacao[] = [];

      for (const operacao of opsSorted) {
        const opPayload = {
          code: String(operacao.id).trim(),
          designation: String(operacao.nome).trim(),
          is_critical: Boolean(operacao.critica),
          machine_type: String(operacao.tipoMaquina || "").trim(),
          sequence_order: operacao.sequencia,
          time_cmin: Math.round(Number(operacao.tempo) * 100),
        };

        let opSaved = false;
        for (const taskId of taskIds) {
          try {
            await axios.post(
              `${API_BASE_URL}/technical-sheets/${encodeURIComponent(taskId)}/add-operation`,
              opPayload
            );
            opSaved = true;
            break;
          } catch {
            // tenta próximo identificador da ficha
          }
        }

        if (!opSaved) {
          failedOps.push(opPayload.code);
        } else {
          savedOps.push(operacao);
        }
      }

      const createdProdutoComOperacoes: Produto = {
        ...createdProduto,
        operacoes: savedOps.map((op, idx) => ({ ...op, sequencia: idx + 1 })),
        dataModificacao: new Date().toISOString().split("T")[0],
      };

      setProdutos((current) => {
        const existingIndex = current.findIndex((item) => item.id === createdProdutoComOperacoes.id);
        if (existingIndex === -1) return [...current, createdProdutoComOperacoes];
        const next = [...current];
        next[existingIndex] = createdProdutoComOperacoes;
        return next;
      });

      produtoSelecionadoRef.current = createdProdutoComOperacoes.id;
      setProdutoSelecionado(createdProdutoComOperacoes.id);
      setImportPreview(null);
      setImportMetadata(null);
      setShowImportDialog(false);

      if (failedOps.length > 0) {
        setErroApi(
          `Ficha criada, mas ${failedOps.length} operações não foram importadas (${failedOps.join(", ")}).`
        );
      } else {
        setMensagemGuardado(
          `Ficha técnica ${createdProdutoComOperacoes.referencia} criada com ${opsSorted.length} operações importadas.`
        );
        setTimeout(() => setMensagemGuardado(null), 4000);
      }

      void handleCarregarCandidatePools(createdProdutoComOperacoes);
    } catch (error) {
      console.error("Erro ao importar gamas operatórias:", error);
      setImportError("Não foi possível criar a ficha técnica e importar as operações pela API.");
    } finally {
      setImportingGamas(false);
    }
  };

  const tempoTotal = produto
    ? produto.operacoes.reduce((sum, op) => sum + op.tempo, 0)
    : 0;
  const numMaquinas = produto
    ? new Set(produto.operacoes.map((op) => op.tipoMaquina).filter(Boolean)).size
    : 0;
  const operacoesTabela = produto
    ? [...produto.operacoes].sort((a, b) => a.sequencia - b.sequencia)
    : [];

  return (
    <main className="w-full px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ficha Técnica</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Gama operatória por produto — edite e guarde cada ficha técnica
          </p>
        </div>
        <div className="flex items-center gap-3">
          {produto && (
            <Button
              onClick={handleGuardar}
              className="bg-blue-500 hover:bg-blue-600 rounded-sm text-xs gap-2"
            >
              <Save className="w-4 h-4" />
              Guardar Ficha
            </Button>
          )}
          <Dialog open={showNovoProduto} onOpenChange={setShowNovoProduto}>
            <DialogTrigger asChild>
              <Button className="bg-[#2d2d2d] hover:bg-[#3d3d3d] rounded-sm text-xs gap-2">
                <Plus className="w-4 h-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-sm">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">
                  Criar Novo Produto
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Preencha os dados do novo produto
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-medium">Nome do Produto</Label>
                  <Input
                    value={novoProduto.nome}
                    onChange={(e) => setNovoProduto({ ...novoProduto, nome: e.target.value })}
                    placeholder="ex: Calca Ganga Classic"
                    className="rounded-sm text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Referência</Label>
                  <Input
                    value={novoProduto.referencia}
                    onChange={(e) =>
                      setNovoProduto({ ...novoProduto, referencia: e.target.value })
                    }
                    placeholder="ex: REF-2026-001"
                    className="rounded-sm text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Cliente (opcional)</Label>
                  <Input
                    value={novoProduto.cliente}
                    onChange={(e) =>
                      setNovoProduto({ ...novoProduto, cliente: e.target.value })
                    }
                    placeholder="ex: Fashion Corp"
                    className="rounded-sm text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Descrição (opcional)</Label>
                  <Input
                    value={novoProduto.descricao}
                    onChange={(e) =>
                      setNovoProduto({ ...novoProduto, descricao: e.target.value })
                    }
                    className="rounded-sm text-sm mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCriarProduto}
                  className="bg-blue-500 hover:bg-blue-600 rounded-sm text-xs"
                  disabled={!novoProduto.nome || !novoProduto.referencia || creatingProduto}
                >
                  {creatingProduto ? "A criar..." : "Criar Produto"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Mensagem de guardado */}
      {mensagemGuardado && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-sm flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          {mensagemGuardado}
        </div>
      )}

      {erroApi && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-sm flex items-center gap-2 text-amber-700 text-sm">
          <AlertTriangle className="w-4 h-4" />
          {erroApi}
        </div>
      )}

      <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
        <CardContent className="p-4">
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
                  <SelectValue
                    placeholder={loadingFamilias ? "A carregar grupos..." : "Selecione um grupo"}
                  />
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
                Ficha Tecnica
              </Label>
              <Select
                value={produtoSelecionado || undefined}
                onValueChange={handleSelecionarFicha}
                disabled={loadingFichas || loadingFichaPorCodigo || produtos.length === 0}
              >
                <SelectTrigger className="rounded-sm text-sm">
                  <SelectValue
                    placeholder={
                      loadingFichas
                        ? "A carregar fichas..."
                        : loadingFichaPorCodigo
                          ? "A carregar detalhes..."
                        : "Selecione uma ficha tecnica"
                    }
                  />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  {produtos.map((prod) => (
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
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lista de Produtos (sidebar) */}
        <div className="lg:col-span-1 space-y-3">
          <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
            <CardHeader className="border-b border-gray-200 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Package className="w-4 h-4 text-blue-600" />
                Fichas Tecnicas ({produtos.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
              {produtos.map((prod) => (
                <div
                  key={prod.id}
                  className={`p-3 rounded-sm border-2 cursor-pointer transition-all ${
                    produtoSelecionado === prod.id
                      ? "border-blue-300 bg-blue-50/50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                  onClick={() => handleSelecionarFicha(prod.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">
                        {prod.nome}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">{prod.referencia}</div>
                      {prod.cliente && (
                        <div className="text-xs text-gray-400 mt-0.5">{prod.cliente}</div>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="secondary" className="text-xs rounded-sm">
                          {prod.operacoes.length} ops
                        </Badge>
                        <span className="text-xs text-gray-400 font-mono">
                          {prod.operacoes.reduce((s, o) => s + o.tempo, 0).toFixed(1)} min
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 flex-shrink-0 transition-colors ${
                        produtoSelecionado === prod.id ? "text-blue-500" : "text-gray-300"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Ficha Tecnica do Produto */}
        <div className="lg:col-span-3 space-y-6">
          {!produto ? (
            <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
              <CardContent className="p-16 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <div className="text-gray-500 text-sm">
                  Selecione um produto para ver a ficha técnica
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  Ou crie um novo produto para começar
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Info do Produto */}
              <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-xl font-bold text-gray-900">{produto.nome}</h2>
                        <Badge variant="secondary" className="rounded-sm text-xs font-mono">
                          {produto.id}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>
                          Referência:{" "}
                          <span className="font-medium">{produto.referencia}</span>
                        </div>
                        {produto.cliente && (
                          <div>
                            Cliente:{" "}
                            <span className="font-medium">{produto.cliente}</span>
                          </div>
                        )}
                        {produto.descricao && (
                          <div className="text-gray-500">{produto.descricao}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-sm text-xs gap-1"
                        onClick={() => handleDuplicarProduto(produto.id)}
                      >
                        <Copy className="w-3 h-3" />
                        Duplicar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-sm text-xs gap-1 text-gray-500 hover:text-orange-600 hover:border-orange-300"
                        onClick={() => solicitarRemocaoProduto(produto)}
                        disabled={deletingProdutoId === produto.id}
                      >
                        <Trash2 className="w-3 h-3" />
                        {deletingProdutoId === produto.id ? "A eliminar..." : "Eliminar"}
                      </Button>
                    </div>
                  </div>

                  {/* Metricas Resumo */}
                  <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-200">
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-sm">
                      <div className="text-xs text-gray-500 uppercase">Operações</div>
                      <div className="text-xl font-bold text-gray-900 mt-1">
                        {produto.operacoes.length}
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-sm">
                      <div className="text-xs text-gray-500 uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Tempo Total
                      </div>
                      <div className="text-xl font-bold text-gray-900 mt-1 font-mono">
                        {tempoTotal.toFixed(2)} min
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-sm">
                      <div className="text-xs text-gray-500 uppercase flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> Máquinas
                      </div>
                      <div className="text-xl font-bold text-gray-900 mt-1">{numMaquinas}</div>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-sm">
                      <div className="text-xs text-gray-500 uppercase">Modificado</div>
                      <div className="text-sm font-medium text-gray-900 mt-1">
                        {produto.dataModificacao}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Gama Operatoria */}
              <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
                <CardHeader className="border-b border-gray-200">
                  <CardTitle className="flex items-center justify-between text-gray-900">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-sm flex items-center justify-center">
                        <Package className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-base font-semibold">Gama Operatória</div>
                        <CardDescription className="text-gray-500 mt-0.5 text-xs">
                          Sequência de operações do processo produtivo
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                    <Dialog open={showNovaOperacao} onOpenChange={setShowNovaOperacao}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          className="bg-blue-500 hover:bg-blue-600 rounded-sm text-xs font-medium"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Nova Operação
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-sm">
                        <DialogHeader>
                          <DialogTitle className="text-base font-semibold">
                            Adicionar Nova Operação
                          </DialogTitle>
                          <DialogDescription className="text-xs">
                            Preencha os dados da nova operação
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label className="text-xs font-medium">ID da Operação</Label>
                            <Input
                              value={novaOperacao.id}
                              onChange={(e) =>
                                setNovaOperacao({ ...novaOperacao, id: e.target.value })
                              }
                              placeholder={`ex: OP${produto.operacoes.length + 1}`}
                              required
                              className="rounded-sm text-sm mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Nome</Label>
                            <Input
                              value={novaOperacao.nome}
                              onChange={(e) =>
                                setNovaOperacao({ ...novaOperacao, nome: e.target.value })
                              }
                              placeholder="ex: Fechar vista"
                              required
                              className="rounded-sm text-sm mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">
                              Tempo de Execução (min)
                            </Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={novaOperacao.tempo || ""}
                              onChange={(e) =>
                                setNovaOperacao({
                                  ...novaOperacao,
                                  tempo: Number(e.target.value),
                                })
                              }
                              required
                              className="rounded-sm text-sm mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium">Máquina (opcional)</Label>
                            <Input
                              value={novaOperacao.tipoMaquina}
                              onChange={(e) =>
                                setNovaOperacao({
                                  ...novaOperacao,
                                  tipoMaquina: e.target.value,
                                })
                              }
                              placeholder="ex: P/P1"
                              className="rounded-sm text-sm mt-1"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => void handleAddOperacao()}
                            className="bg-blue-500 hover:bg-blue-600 rounded-sm text-xs"
                            disabled={
                              !novaOperacao.id ||
                              !novaOperacao.nome ||
                              !novaOperacao.tempo ||
                              addingOperacao
                            }
                          >
                            {addingOperacao ? "A adicionar..." : "Adicionar"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 rounded-sm text-xs font-medium"
                      onClick={() => void handleGuardarOperacoes()}
                      disabled={savingOperacoes || addingOperacao || Boolean(removingOperacaoId)}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {savingOperacoes ? "A guardar..." : "Guardar Operações"}
                    </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="flex items-center justify-end gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50/50">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleImportExcel}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-sm text-xs gap-1.5"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importingGamas || loadingFichas || loadingFichaPorCodigo}
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      {importingGamas ? "A importar..." : "Importar Gamas Operatórias"}
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-16">
                            Seq.
                          </th>
                          <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-20">
                            Crítica
                          </th>
                          <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-20">
                            ID
                          </th>
                          <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">
                            Descrição
                          </th>
                          <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-28">
                            Tempo (min)
                          </th>
                          <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">
                            Máquina
                          </th>
                          <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase w-32">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {operacoesTabela.map((operacao, index) => (
                          <tr
                            key={operacao.id}
                            className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                              operacao.critica ? "bg-orange-50" : ""
                            }`}
                          >
                            <td className="p-3 font-mono text-sm text-gray-700">
                              {operacao.sequencia}
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => handleToggleCritica(operacao.id, index)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-medium transition-colors ${
                                  operacao.critica
                                    ? "bg-orange-200 text-orange-800 border border-orange-300"
                                    : "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200"
                                }`}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                {operacao.critica ? "Sim" : "Não"}
                              </button>
                            </td>
                            <td className="p-3">
                              <span className="font-mono font-semibold text-sm text-blue-700 bg-blue-50 px-2 py-1 rounded-sm border border-blue-200">
                                {operacao.id}
                              </span>
                            </td>
                            <td className="p-3">
                              {editandoOperacao === operacao.id ? (
                                <Input
                                  value={operacao.nome}
                                  onChange={(e) =>
                                    handleEditOperacao(operacao.id, "nome", e.target.value, index)
                                  }
                                  onBlur={() => setEditandoOperacao(null)}
                                  onKeyDown={(e) =>
                                    e.key === "Enter" && setEditandoOperacao(null)
                                  }
                                  autoFocus
                                  className="h-8 text-sm rounded-sm"
                                />
                              ) : (
                                <div
                                  className="flex items-center gap-2 cursor-pointer group"
                                  onClick={() => setEditandoOperacao(operacao.id)}
                                >
                                  <span className="text-sm text-gray-700">
                                    {operacao.nome}
                                  </span>
                                  <Pencil className="w-3 h-3 text-gray-300 group-hover:text-gray-500" />
                                  {operacao.critica && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs rounded-sm bg-orange-200 text-orange-800 border border-orange-300"
                                    >
                                      CRÍTICA
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                step="0.01"
                                value={operacao.tempo}
                                onChange={(e) =>
                                  handleEditOperacao(
                                    operacao.id,
                                    "tempo",
                                    Number(e.target.value),
                                    index
                                  )
                                }
                                className="h-8 w-24 text-sm font-mono rounded-sm text-right"
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                value={operacao.tipoMaquina || ""}
                                onChange={(e) =>
                                  handleEditOperacao(
                                    operacao.id,
                                    "tipoMaquina",
                                    e.target.value,
                                    index
                                  )
                                }
                                className="h-8 text-sm rounded-sm"
                                placeholder="—"
                              />
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReorder(index, "up")}
                                  disabled={index === 0}
                                  className="h-7 w-7 p-0 rounded-sm hover:bg-gray-100"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReorder(index, "down")}
                                  disabled={index === operacoesTabela.length - 1}
                                  className="h-7 w-7 p-0 rounded-sm hover:bg-gray-100"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => solicitarRemocaoOperacao(operacao)}
                                  disabled={Boolean(removingOperacaoId)}
                                  className="h-7 w-7 p-0 rounded-sm hover:bg-orange-50 hover:text-orange-600"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t-2 border-gray-300">
                          <td colSpan={4} className="p-3 text-xs font-semibold text-gray-700 uppercase">
                            Total
                          </td>
                          <td className="p-3 font-mono font-bold text-sm text-gray-900">
                            {tempoTotal.toFixed(2)} min
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {produto.operacoes.length === 0 && (
                    <div className="p-12 text-center text-gray-400 text-sm">
                      Nenhuma operação adicionada. Clique em "Nova Operação" para começar.
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Atribuição Manual de Operações */}
      {produto && produto.operacoes.length > 0 && (
        <AtribuicaoManual
          operadores={operadores}
          operacoes={produto.operacoes}
          atribuicoesManual={atribuicoesManual}
          onAtribuirManualmente={handleAtribuirManualmente}
          familyId={grupoArtigoSelecionado}
        />
      )}

      <Dialog
        open={Boolean(produtoParaRemover)}
        onOpenChange={(open) => {
          if (!open && !deletingProdutoId) {
            setProdutoParaRemover(null);
          }
        }}
      >
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Confirmar remoção de ficha técnica</DialogTitle>
            <DialogDescription className="text-xs">
              {produtoParaRemover
                ? `Deseja remover a ficha técnica ${produtoParaRemover.referencia} - ${produtoParaRemover.nome}?`
                : "Deseja remover esta ficha técnica?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-sm text-xs"
              disabled={Boolean(deletingProdutoId)}
              onClick={() => setProdutoParaRemover(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-orange-600 hover:bg-orange-700 rounded-sm text-xs"
              disabled={!produtoParaRemover || Boolean(deletingProdutoId)}
              onClick={() => void handleConfirmarRemocaoProduto()}
            >
              {deletingProdutoId ? "A eliminar..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(operacaoParaRemover)}
        onOpenChange={(open) => {
          if (!open && !removingOperacaoId) {
            setOperacaoParaRemover(null);
          }
        }}
      >
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Confirmar remoção de operação</DialogTitle>
            <DialogDescription className="text-xs">
              {operacaoParaRemover
                ? `Deseja remover a operação ${operacaoParaRemover.id} - ${operacaoParaRemover.nome}?`
                : "Deseja remover esta operação?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-sm text-xs"
              disabled={Boolean(removingOperacaoId)}
              onClick={() => setOperacaoParaRemover(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="bg-orange-600 hover:bg-orange-700 rounded-sm text-xs"
              disabled={!operacaoParaRemover || Boolean(removingOperacaoId)}
              onClick={() => void handleConfirmarRemocaoOperacao()}
            >
              {removingOperacaoId ? "A eliminar..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Importação */}
      <Dialog
        open={showImportDialog}
        onOpenChange={(open) => {
          setShowImportDialog(open);
          if (!open && !importingGamas) {
            setImportError(null);
          }
        }}
      >
        <DialogContent className="rounded-sm max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              Pré-visualização da Importação
            </DialogTitle>
            <DialogDescription className="text-xs">
              {importPreview?.length} operações detectadas — será criada uma nova ficha técnica e as
              gamas operatórias serão importadas para essa ficha.
            </DialogDescription>
            {importMetadata && (
              <div className="text-xs text-gray-600 mt-2">
                Ficheiro: <span className="font-medium">{importMetadata.fileName}</span>
                {" • "}
                Nova ficha: <span className="font-mono">{importMetadata.fichaCode}</span>
              </div>
            )}
          </DialogHeader>
          {importError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-sm flex items-center gap-2 text-amber-700 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {importError}
            </div>
          )}
          <div className="overflow-x-auto border border-gray-200 rounded-sm">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase w-10">Seq</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase w-24">ID</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase">Descrição</th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-600 uppercase w-24">Tempo (min)</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase w-28">Máquina</th>
                </tr>
              </thead>
              <tbody>
                {importPreview?.map((op) => (
                  <tr key={op.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-gray-500 font-mono">{op.sequencia}</td>
                    <td className="px-3 py-1.5">
                      <span className="font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-sm border border-blue-200 text-[10px]">
                        {op.id}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-gray-800">{op.nome}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-gray-700">{op.tempo.toFixed(2)}</td>
                    <td className="px-3 py-1.5 text-gray-500">{op.tipoMaquina || "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300">
                  <td colSpan={3} className="px-3 py-2 text-xs font-semibold text-gray-700 uppercase">Total</td>
                  <td className="px-3 py-2 font-mono font-bold text-right text-gray-900">
                    {importPreview?.reduce((s, o) => s + o.tempo, 0).toFixed(2)} min
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowImportDialog(false)}
              className="rounded-sm text-xs"
              disabled={importingGamas}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleConfirmImport()}
              className="bg-blue-500 hover:bg-blue-600 rounded-sm text-xs"
              disabled={!importPreview?.length || importingGamas}
            >
              <CheckCircle2 className="w-3 h-3 mr-1.5" />
              {importingGamas
                ? "A criar ficha e importar..."
                : `Criar Nova Ficha (${importPreview?.length} ops)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
