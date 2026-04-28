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
import { API_BASE_URL } from "../config";
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
} from "../components/ui/dialog";

// â”€â”€â”€ Valores por defeito â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const configPadrao = {
  possibilidade: 1 as 1 | 2 | 3 | 4,
  agruparMaquinas: false,
  cargaMaximaOperador: 95,
  naoDividirMaiorQue: 1.1,
  naoDividirMenorQue: 0.9,
  horasTurno: 8,
  produtividadeEstimada: 85,
};

const layoutPadrao: LayoutConfig = {
  tipoLayout: "linha",
  postosPorLado: 8,
  distanciaMaxima: 3,
  permitirRetrocesso: false,
  permitirCruzamento: true,
  restricoes: [],
};

// â”€â”€â”€ Types and Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface FamilyOption {
  id: string;
  label: string;
}

type ApiRecord = Record<string, any>;

type DistItem = {
  operadorId: string;
  operacoes: string[];
  cargaHoraria: number;
  ocupacao: number;
  ciclosPorHora: number;
  temposOperacoes?: Record<string, number>;
};

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
      const normalized = value.trim().replace(",", ".");
      const direct = Number(normalized);
      if (Number.isFinite(direct)) return direct;

      const matched = normalized.match(/-?\d+(?:\.\d+)?/);
      const parsed = matched ? Number(matched[0]) : Number.NaN;
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
      if (["false", "0", "no", "nao"].includes(normalized)) return false;
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

const normalizeKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const extractDigits = (value: string): string => {
  const parts = value.match(/\d+/g);
  return parts ? parts.join("") : "";
};

const mapOperatorToCode = (rawOperator: string, operadoresPool: Operador[]): string => {
  const ref = rawOperator.trim();
  if (!ref) return rawOperator;

  const refKey = normalizeKey(ref);
  const refDigits = extractDigits(ref);
  const codeToken =
    ref.match(/\(([A-Za-z]{1,}\d+)\)/)?.[1] ||
    ref.match(/\b([A-Za-z]{1,}\d+)\b/)?.[1] ||
    "";
  const codeTokenKey = codeToken ? normalizeKey(codeToken) : "";

  const exactById = operadoresPool.find((op) => normalizeKey(op.id) === refKey);
  if (exactById) return exactById.id;

  if (codeTokenKey) {
    const byCodeToken = operadoresPool.find((op) => normalizeKey(op.id) === codeTokenKey);
    if (byCodeToken) return byCodeToken.id;
  }

  const exactByNome = operadoresPool.find((op) => normalizeKey(op.nome || "") === refKey);
  if (exactByNome) return exactByNome.id;

  const byNomeParcial = operadoresPool.find((op) => {
    const nomeKey = normalizeKey(op.nome || "");
    if (!nomeKey) return false;
    return nomeKey.includes(refKey) || refKey.includes(nomeKey);
  });
  if (byNomeParcial) return byNomeParcial.id;

  if (refDigits) {
    const byDigits = operadoresPool.find((op) => {
      const opDigits = extractDigits(op.id);
      return Boolean(opDigits) && (opDigits === refDigits || opDigits.endsWith(refDigits) || refDigits.endsWith(opDigits));
    });
    if (byDigits) return byDigits.id;
  }

  return ref;
};

const parseRawNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim().replace(",", ".");
    const direct = Number(normalized);
    if (Number.isFinite(direct)) return direct;
    const matched = normalized.match(/-?\d+(?:\.\d+)?/);
    const parsed = matched ? Number(matched[0]) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value === "object") {
    return pickNumber(value as ApiRecord, [
      "value",
      "time",
      "tempo",
      "seconds",
      "time_seconds",
      "time_min",
      "minutes",
    ]);
  }
  return null;
};

const findOperacaoIdByReferencia = (ref: string, operacoesBase: Operacao[]): string | null => {
  const refKey = normalizeKey(ref);
  if (!refKey) return null;

  const direct = operacoesBase.find((op) => {
    const idKey = normalizeKey(op.id);
    const nomeKey = normalizeKey(op.nome);
    return (
      idKey === refKey ||
      nomeKey === refKey ||
      refKey.includes(idKey) ||
      refKey.includes(nomeKey)
    );
  });
  if (direct) return direct.id;

  const token = ref
    .split(/[\s\-:/()]+/)
    .map((part) => normalizeKey(part))
    .find(Boolean);
  if (!token) return null;

  const byToken = operacoesBase.find((op) => normalizeKey(op.id) === token || normalizeKey(op.nome) === token);
  return byToken ? byToken.id : null;
};

const findRowOperationId = (row: ApiRecord, operacoesBase: Operacao[]): string | null => {
  const fromKnownKeys =
    pickString(row, [
      "operation_code",
      "operation_id",
      "operacao_id",
      "operation",
      "operacao",
      "operation_name",
      "operacao_nome",
      "name",
      "nome",
      "description",
      "descricao",
      "op",
    ]) || "";

  if (fromKnownKeys) {
    const mapped = findOperacaoIdByReferencia(fromKnownKeys, operacoesBase);
    if (mapped) return mapped;
  }

  for (const [key, value] of Object.entries(row)) {
    const keyNorm = normalizeKey(key);
    const looksOperationField =
      keyNorm.includes("operac") ||
      keyNorm.includes("operation") ||
      keyNorm === "op" ||
      keyNorm === "nome";
    if (!looksOperationField) continue;
    if (typeof value !== "string" && typeof value !== "number") continue;
    const mapped = findOperacaoIdByReferencia(String(value), operacoesBase);
    if (mapped) return mapped;
  }

  const seq = pickNumber(row, ["sequence", "sequencia", "seq", "order", "ordem"]);
  if (seq != null) {
    const bySeq = operacoesBase.find((op) => Number(op.sequencia) === Number(seq));
    if (bySeq) return bySeq.id;
  }

  return null;
};

const extrairDistribuicaoDeOperationAllocations = (
  rows: ApiRecord[],
  operacoesBase: Operacao[],
  operadoresPool: Operador[],
  tempoCiclo: number
): DistItem[] => {
  const mapa: Record<string, { operacoes: Set<string>; tempoTotal: number; temposOperacoes: Record<string, number> }> = {};

  const ensureOperador = (operadorId: string) => {
    if (!mapa[operadorId]) {
      mapa[operadorId] = { operacoes: new Set(), tempoTotal: 0, temposOperacoes: {} };
    }
  };

  const processarTempo = (operadorRef: string, operacaoId: string, tempoSegundos: number) => {
    const operadorId = mapOperatorToCode(operadorRef, operadoresPool);
    if (!operadorId) return;
    ensureOperador(operadorId);
    if (operacaoId) mapa[operadorId].operacoes.add(operacaoId);
    const tempoMinutos = tempoSegundos / 60;
    mapa[operadorId].tempoTotal += tempoMinutos;
    if (operacaoId) {
      mapa[operadorId].temposOperacoes[operacaoId] =
        (mapa[operadorId].temposOperacoes[operacaoId] || 0) + tempoMinutos;
    }
  };

  for (const row of rows) {
    const operacaoRef =
      pickString(row, [
        "operation_code",
        "operation_id",
        "operacao_id",
        "operation",
        "operacao",
        "operation_name",
        "operacao_nome",
        "name",
        "nome",
      ]) || "";
    const operacaoId = operacaoRef ? findOperacaoIdByReferencia(operacaoRef, operacoesBase) || operacaoRef : (findRowOperationId(row, operacoesBase) || "");

    const operatorTimes = row.operator_times && typeof row.operator_times === "object" ? row.operator_times : {};
    if (Object.keys(operatorTimes).length > 0) {
      Object.entries(operatorTimes).forEach(([operatorRef, timeValue]) => {
        const tempoSegundos = parseRawNumber(timeValue);
        if (tempoSegundos == null || !Number.isFinite(tempoSegundos) || tempoSegundos <= 0) return;
        processarTempo(operatorRef, operacaoId, tempoSegundos);
      });
      continue;
    }

    const operatorPositions = row.operator_positions && typeof row.operator_positions === "object" ? row.operator_positions : {};
    if (Object.keys(operatorPositions).length > 0) {
      Object.entries(operatorPositions).forEach(([operatorRef, position]) => {
        const tempoSegundos = parseRawNumber((position as ApiRecord).time_seconds ?? (position as ApiRecord).seconds);
        if (tempoSegundos == null || !Number.isFinite(tempoSegundos) || tempoSegundos <= 0) return;
        processarTempo(operatorRef, operacaoId, tempoSegundos);
      });
      continue;
    }

    if (Array.isArray(row.operator_allocations)) {
      for (const allocation of row.operator_allocations) {
        const record = allocation as ApiRecord;
        const operatorRef = pickString(record, ["operator_code", "operator_id", "operador_id", "operator", "operador", "code"]);
        if (!operatorRef) continue;
        const tempoSegundos = parseRawNumber(
          record.time_seconds ??
          record.tempo_segundos ??
          record.seconds ??
          record.time
        );
        if (tempoSegundos == null || !Number.isFinite(tempoSegundos) || tempoSegundos <= 0) continue;
        processarTempo(operatorRef, operacaoId, tempoSegundos);
      }
    }
  }

  return Object.entries(mapa).map(([operadorId, dados]) => {
    const ocupacao = tempoCiclo > 0 ? (dados.tempoTotal / tempoCiclo) * 100 : 0;
    return {
      operadorId,
      operacoes: Array.from(dados.operacoes),
      cargaHoraria: dados.tempoTotal,
      ocupacao,
      ciclosPorHora: dados.tempoTotal > 0 ? 60 / dados.tempoTotal : 0,
      temposOperacoes: dados.temposOperacoes,
    };
  });
};

const extrairOperacoesPorReferencia = (raw: unknown, operacoesBase: Operacao[]): string[] => {
  const refs: string[] = [];

  const appendRef = (value: unknown) => {
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (!text) return;
      if (typeof value === "string" && /[;,|]/.test(text)) {
        text
          .split(/[;,|]/)
          .map((part) => part.trim())
          .filter(Boolean)
          .forEach((part) => refs.push(part));
        return;
      }
      refs.push(text);
      return;
    }

    if (value && typeof value === "object") {
      const record = value as ApiRecord;
      const opId = pickString(record, ["operation_code", "operation_id", "operacao_id", "id", "code", "operation", "operacao"]);
      const opName = pickString(record, ["operation_name", "operacao_nome", "name", "nome", "description", "descricao"]);
      if (opId) refs.push(opId);
      if (opName) refs.push(opName);
    }
  };

  if (Array.isArray(raw)) raw.forEach(appendRef);
  else appendRef(raw);

  const mapped = new Set<string>();
  refs.forEach((ref) => {
    const opId = findOperacaoIdByReferencia(ref, operacoesBase);
    if (opId) mapped.add(opId);
  });
  return Array.from(mapped);
};

const extrairOperacoesETemposDoRow = (
  row: ApiRecord,
  operacoesBase: Operacao[]
): { operacoes: string[]; temposOperacoes: Record<string, number> } => {
  const opsRaw = row.operations ?? row.operacoes ?? row.assigned_operations ?? row.assignedOperations;
  const operacoes = new Set<string>();
  const temposOperacoes: Record<string, number> = {};

  const addOperacao = (ref: string, tempoMin?: number | null) => {
    const opId = findOperacaoIdByReferencia(ref, operacoesBase);
    if (!opId) return;
    operacoes.add(opId);
    if (typeof tempoMin === "number" && Number.isFinite(tempoMin) && tempoMin > 0) {
      temposOperacoes[opId] = (temposOperacoes[opId] || 0) + tempoMin;
    }
  };

  const parseTempoMin = (obj: ApiRecord): number | null => {
    const tempoSegundos = pickNumber(obj, ["time_seconds", "tempo_segundos", "seconds", "duration_seconds"]);
    const tempoMinDireto = pickNumber(obj, ["time_min", "time_minutes", "tempo_minutos", "minutes", "duration_min"]);
    if (tempoMinDireto != null) return tempoMinDireto;
    if (tempoSegundos != null) return tempoSegundos / 60;

    const tempoLivre = obj.time ?? obj.tempo ?? obj.duration ?? obj.duracao;
    const unidade = pickString(obj, ["time_unit", "unit", "unidade", "duration_unit"]).toLowerCase();

    if (tempoLivre == null) return null;
    const valor = parseRawNumber(tempoLivre);
    if (valor == null || !Number.isFinite(valor) || valor <= 0) return null;

    if (typeof tempoLivre === "string") {
      const raw = tempoLivre.trim().toLowerCase();
      if (/(min|mins|minuto|minutos)\b/.test(raw)) return valor;
      if (/(sec|secs|seg|segs)\b/.test(raw) || /\d\s*s\b/.test(raw) || /s$/.test(raw)) return valor / 60;
    }

    if (unidade) {
      if (/(min|mins|minuto|minutos)\b/.test(unidade)) return valor;
      if (/(sec|secs|seg|segs|s)\b/.test(unidade)) return valor / 60;
    }

    // Fallback: "time" vindo da API costuma estar em segundos.
    return valor > 10 ? valor / 60 : valor;
  };

  const processEntry = (entry: unknown) => {
    if (typeof entry === "string" || typeof entry === "number") {
      addOperacao(String(entry));
      return;
    }

    if (!entry || typeof entry !== "object") return;

    const obj = entry as ApiRecord;
    const ref =
      pickString(obj, ["operation_code", "operation_id", "operacao_id", "id", "code", "operation", "operacao", "op"]) ||
      pickString(obj, ["operation_name", "operacao_nome", "name", "nome", "description", "descricao"]);

    if (ref) {
      addOperacao(ref, parseTempoMin(obj));
      return;
    }

    // Some payloads can send an object keyed by operation code/name.
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === "number") {
        addOperacao(key, value);
        return;
      }
      if (typeof value === "string") {
        const parsed = Number(value.replace(",", ".").match(/-?\d+(?:\.\d+)?/)?.[0] ?? "");
        addOperacao(key, Number.isFinite(parsed) ? parsed : undefined);
      }
    });
  };

  if (Array.isArray(opsRaw)) opsRaw.forEach(processEntry);
  else if (opsRaw != null) processEntry(opsRaw);

  if (operacoes.size === 0) {
    const operacaoDireta =
      pickString(row, ["operation_code", "operation_id", "operacao_id", "operation", "operacao", "id", "code"]) ||
      pickString(row, ["operation_name", "operacao_nome", "name", "nome", "description", "descricao"]);
    if (operacaoDireta) {
      const opId = findOperacaoIdByReferencia(operacaoDireta, operacoesBase);
      if (opId) operacoes.add(opId);
    }
  }

  if (operacoes.size === 0) {
    extrairOperacoesPorReferencia(opsRaw, operacoesBase).forEach((opId) => operacoes.add(opId));
  }

  return { operacoes: Array.from(operacoes), temposOperacoes };
};

const extrairDistribuicaoDeTableData = (
  raw: ApiRecord,
  operacoesBase: Operacao[],
  tempoCiclo: number,
  operadoresPool: Operador[]
): DistItem[] => {
  const tableDataRaw =
    raw.table_data ??
    raw.tableData ??
    raw.operator_table ??
    raw.operatorTable ??
    raw.results_table;

  let tableData = ensureArray(tableDataRaw);
  if (
    tableData.length === 0 &&
    tableDataRaw &&
    typeof tableDataRaw === "object" &&
    !Array.isArray(tableDataRaw)
  ) {
    tableData = Object.entries(tableDataRaw as Record<string, unknown>).map(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return { operator: key, ...(value as ApiRecord) };
      }
      return { operator: key, occupancy: value };
    });
  }

  if (tableData.length === 0) return [];

  const reservedRowKeys = new Set(
    [
      "grupo",
      "group",
      "seq",
      "sequencia",
      "sequencia_op",
      "sequence",
      "maquina",
      "machine",
      "machine_name",
      "tipo_maquina",
      "operacao",
      "operation",
      "operation_code",
      "operation_id",
      "operation_name",
      "operacao_id",
      "operacao_nome",
      "ocup",
      "ocupacao",
      "occupancy",
      "occupancy_percent",
      "operator_occupancy",
      "worker_occupancy",
      "tempo",
      "tempo_segundos",
      "time_seconds",
      "time_min",
      "time_minutes",
      "minutes",
      "seconds",
      "subtotal",
      "total",
      "linha",
      "line",
      "line_type",
      "balanced",
      "is_balanced",
      "status",
      "ok",
      "critical",
      "critical_op",
      "critical_operation",
    ].map((key) => normalizeKey(key))
  );

  const agrupado: Record<
    string,
    { operacoes: Set<string>; cargaHoraria: number; ocupacao?: number; temposOperacoes: Record<string, number> }
  > = {};

  const ensureOperador = (operadorId: string, ocupacao?: number) => {
    if (!agrupado[operadorId]) {
      agrupado[operadorId] = {
        operacoes: new Set<string>(),
        cargaHoraria: 0,
        ocupacao,
        temposOperacoes: {},
      };
    }
  };

  const operadorExisteNoPool = (id: string): boolean =>
    operadoresPool.some((operador) => normalizeKey(operador.id) === normalizeKey(id));

  const fallbackOperatorByColumn = new Map<string, string>();
  const fallbackOperatorsUsed = new Set<string>();

  const resolveMatrixColumnOperatorId = (colKey: string): string | null => {
    const colNorm = normalizeKey(colKey);
    if (!colNorm) return null;

    const mapped = mapOperatorToCode(String(colKey), operadoresPool);
    if (operadorExisteNoPool(mapped)) return mapped;
    if (operadorExisteNoPool(String(colKey))) return mapOperatorToCode(String(colKey), operadoresPool);

    const memo = fallbackOperatorByColumn.get(colNorm);
    if (memo && operadorExisteNoPool(memo)) return memo;

    const nextFallback = operadoresPool.find((operador) => !fallbackOperatorsUsed.has(operador.id));
    if (nextFallback) {
      fallbackOperatorByColumn.set(colNorm, nextFallback.id);
      fallbackOperatorsUsed.add(nextFallback.id);
      return nextFallback.id;
    }

    return null;
  };

  tableData.forEach((row) => {
    // Tenta primeiro extrair operator direto (estrutura por linha)
    const operadorOriginal = pickString(row, ["operator", "operator_id", "operador", "operador_id"]);
    
    if (operadorOriginal) {
      // Estrutura por linha: cada linha tem um operador e suas operações
      const operadorId = mapOperatorToCode(operadorOriginal, operadoresPool);
      
      const extracted = extrairOperacoesETemposDoRow(row, operacoesBase);
      const operacaoDaLinha = findRowOperationId(row, operacoesBase);
      const operacoes = new Set<string>(extracted.operacoes);
      if (operacaoDaLinha) operacoes.add(operacaoDaLinha);
      const temposOperacoes: Record<string, number> = { ...extracted.temposOperacoes };

      const ocupacaoRaw = pickNumber(row, [
        "occupancy",
        "occupancy_percent",
        "operator_occupancy",
        "worker_occupancy",
        "ocupacao",
        "utilization",
        "load",
      ]);
      const ocupacao = ocupacaoRaw == null ? undefined : ocupacaoRaw <= 1 ? ocupacaoRaw * 100 : ocupacaoRaw;

      const tempoSegundos = pickNumber(row, ["time_seconds", "tempo_segundos", "seconds"]);
      const tempoMinutosDireto = pickNumber(row, [
        "time_min",
        "time_minutes",
        "tempo_minutos",
        "minutes",
        "workload_minutes",
        "workload_min",
        "carga_horaria",
      ]);
      const tempoSomaOperacoes = Object.values(temposOperacoes).reduce((sum, value) => sum + value, 0);
      const tempoMinutos =
        tempoMinutosDireto ??
        (tempoSegundos != null ? tempoSegundos / 60 : null) ??
        (tempoSomaOperacoes > 0 ? tempoSomaOperacoes : null) ??
        (ocupacao != null && tempoCiclo > 0 ? (tempoCiclo * ocupacao) / 100 : 0);

      ensureOperador(operadorId, ocupacao);

      operacoes.forEach((opId) => agrupado[operadorId].operacoes.add(opId));
      Object.entries(temposOperacoes).forEach(([opId, tempoMin]) => {
        agrupado[operadorId].temposOperacoes[opId] = (agrupado[operadorId].temposOperacoes[opId] || 0) + tempoMin;
      });

      agrupado[operadorId].cargaHoraria += Math.max(0, tempoMinutos || 0);
      if (ocupacao != null) agrupado[operadorId].ocupacao = ocupacao;
    } else {
      // Estrutura por coluna: cada chave é um operador, dentro tem operações e tempos
      Object.entries(row).forEach(([colKey, colValue]) => {
        const colKeyNorm = normalizeKey(colKey);
        if (!colKeyNorm || reservedRowKeys.has(colKeyNorm)) return;

        const mappedOperator = mapOperatorToCode(String(colKey), operadoresPool);
        if (!operadorExisteNoPool(mappedOperator)) return;

        // colValue pode ser um objeto com operações como chaves, ou um número direto
        if (!colValue || typeof colValue !== "object") return;

        const operadorData = colValue as ApiRecord;
        let tempoTotalOperador = 0;
        
        // Iterar pelas operações dentro do operador
        Object.entries(operadorData).forEach(([opKey, opTime]) => {
          const opKeyNorm = normalizeKey(opKey);
          if (!opKeyNorm || reservedRowKeys.has(opKeyNorm)) return;

          // Tentar mapear a chave para uma operação
          const operacaoId = findOperacaoIdByReferencia(String(opKey), operacoesBase);
          if (!operacaoId) return;

          const tempoRaw = parseRawNumber(opTime);
          if (tempoRaw == null || !Number.isFinite(tempoRaw) || tempoRaw <= 0) return;

          // Detectar se está em segundos ou minutos
          const tempoOperacaoBase = operacoesBase.find((op) => op.id === operacaoId)?.tempo ?? 0;
          const ehSegundos = tempoRaw > tempoOperacaoBase * 2.5;
          const tempoMin = ehSegundos ? tempoRaw / 60 : tempoRaw;

          ensureOperador(mappedOperator);
          agrupado[mappedOperator].operacoes.add(operacaoId);
          agrupado[mappedOperador].temposOperacoes[operacaoId] = 
            (agrupado[mappedOperador].temposOperacoes[operacaoId] || 0) + tempoMin;
          agrupado[mappedOperador].cargaHoraria += tempoMin;
          tempoTotalOperador += tempoMin;
        });
      });
    }
  });

  return Object.entries(agrupado).map(([operadorId, dados]) => {
    const ocupacaoCalculada =
      dados.ocupacao != null
        ? dados.ocupacao
        : tempoCiclo > 0
          ? (dados.cargaHoraria / tempoCiclo) * 100
          : 0;

    return {
      operadorId,
      operacoes: Array.from(dados.operacoes),
      cargaHoraria: dados.cargaHoraria,
      ocupacao: ocupacaoCalculada,
      ciclosPorHora: dados.cargaHoraria > 0 ? 60 / dados.cargaHoraria : 0,
      temposOperacoes: dados.temposOperacoes,
    };
  });
};

const extrairMensagemErro = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: unknown; message?: string; error?: string }
      | undefined;

    if (Array.isArray(data?.detail)) {
      const linhas = data.detail
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const detail = item as { loc?: unknown; msg?: unknown; input?: unknown };
          const loc = Array.isArray(detail.loc)
            ? detail.loc
                .map((part) => (typeof part === "string" || typeof part === "number" ? String(part) : ""))
                .filter(Boolean)
                .join(".")
            : "";
          const msg = typeof detail.msg === "string" ? detail.msg : "Erro de validacao";
          const input = detail.input != null ? ` (input: ${String(detail.input)})` : "";
          return loc ? `${loc}: ${msg}${input}` : `${msg}${input}`;
        })
        .filter((line): line is string => Boolean(line));
      if (linhas.length > 0) return linhas.join("\n");
    }

    if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
    if (data?.detail && typeof data.detail === "object") {
      const detail = data.detail as { message?: unknown };
      if (typeof detail.message === "string" && detail.message.trim()) return detail.message;
    }
    if (typeof data?.message === "string" && data.message.trim()) return data.message;
    if (typeof data?.error === "string" && data.error.trim()) return data.error;
    if (typeof error.message === "string" && error.message.trim()) return error.message;
  }

  if (error instanceof Error && error.message.trim()) return error.message;
  return "Ocorreu um erro inesperado.";
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

// â”€â”€â”€ Componente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function Home() {
  const navigate = useNavigate();
  const { dados, salvar } = useStorage();

  // â”€â”€ Operadores vem SEMPRE do contexto (fonte de verdade unica) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Nunca importar operadoresMock directamente aqui
  const operadoresMaster = dados.operadores;

  // Ler configuracao guardada
  const confGuardada = dados.configuracao;

  // â”€â”€â”€ Estado local (inicializado a partir do contexto) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Sincronizar com o contexto quando os dados carregam do ficheiro â”€â”€â”€â”€â”€â”€â”€

  const [sincronizado, setSincronizado] = useState(false);

  // â”€â”€ API: Familias e Fichas Tecnicas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [familias, setFamilias] = useState<FamilyOption[]>([]);
  const [loadingFamilias, setLoadingFamilias] = useState(false);
  const [produtosApi, setProdutosApi] = useState<Produto[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<string | null>(null);
  const [loadingFichas, setLoadingFichas] = useState(false);
  const [loadingFichaPorCodigo, setLoadingFichaPorCodigo] = useState(false);
  const [quantidadeObjetivoInput, setQuantidadeObjetivoInput] = useState("");
  const [numeroOperadoresInput, setNumeroOperadoresInput] = useState("");
  const [erroApi, setErroApi] = useState<string | null>(null);
  const [erroCalculoModal, setErroCalculoModal] = useState<string | null>(null);

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

  // Quando a lista de operadores no contexto muda (ex: apagar em Configuracao),
  // actualizar as unidades para reflectir a mudanca
  useEffect(() => {
    const ops = dados.operadores;
    setDadosUnidades((prev) => ({
      1: { ...prev[1], operadores: ops, operadoresSelecionados: prev[1].operadoresSelecionados.filter((id) => ops.some((o) => o.id === id)) },
      2: { ...prev[2], operadores: ops, operadoresSelecionados: prev[2].operadoresSelecionados.filter((id) => ops.some((o) => o.id === id)) },
      3: { ...prev[3], operadores: ops, operadoresSelecionados: prev[3].operadoresSelecionados.filter((id) => ops.some((o) => o.id === id)) },
    }));
  }, [dados.operadores]);

  // â”€â”€â”€ Auto-save em cada mudanca de estado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // â”€â”€ Load families from API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Load technical sheets for selected family â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Load detailed sheet by code â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ Atalhos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const operadores = dadosUnidades[unidadeAtiva].operadores;
  const operadoresSelecionados = dadosUnidades[unidadeAtiva].operadoresSelecionados;
  const atribuicoesManual = dadosUnidades[unidadeAtiva].atribuicoesManual;
  const config = dadosUnidades[unidadeAtiva].config;

  const produto = produtosApi.find((p) => p.id === produtoSelecionado);
  const operacoes = config.possibilidade === 4
    ? operacoesManual
    : (produto ? produto.operacoes : []);
  const usarAllocateModo1Api = config.possibilidade === 1;
  const usarAllocateObjetivoApi = config.possibilidade === 2;
  const usarAllocateNumeroOperadoresApi = config.possibilidade === 3;
  const taskCodeSelecionado = (produto?.referencia || produto?.id || grupoArtigoSelecionado || "").trim();

  useEffect(() => {
    setQuantidadeObjetivoInput(
      config.quantidadeObjetivo != null && Number.isFinite(config.quantidadeObjetivo)
        ? String(config.quantidadeObjetivo)
        : ""
    );
  }, [config.quantidadeObjetivo]);

  useEffect(() => {
    setNumeroOperadoresInput(
      config.numeroOperadores != null && Number.isFinite(config.numeroOperadores)
        ? String(config.numeroOperadores)
        : ""
    );
  }, [config.numeroOperadores]);

  useEffect(() => {
    if (config.possibilidade !== 3) return;
    if (config.numeroOperadores != null && Number.isFinite(config.numeroOperadores) && config.numeroOperadores >= 1) return;
    const disponiveis = Math.max(1, operadores.length || 1);
    const sugerido = Math.max(1, Math.min(operadoresSelecionados.length || disponiveis, disponiveis));
    setDadosUnidades((prev) => ({
      ...prev,
      [unidadeAtiva]: {
        ...prev[unidadeAtiva],
        config: {
          ...prev[unidadeAtiva].config,
          numeroOperadores: sugerido,
        },
      },
    }));
  }, [config.possibilidade, config.numeroOperadores, operadores.length, operadoresSelecionados.length, unidadeAtiva]);

  // Sincroniza operadores com a ficha tecnica activa (quando muda de ficha/operacoes)
  useEffect(() => {
    if (config.possibilidade === 4 || !produto || operacoes.length === 0 || operadores.length === 0) return;

    const nomesOperacoes = new Set(
      operacoes
        .map((op) => op.nome?.trim())
        .filter((nome): nome is string => Boolean(nome))
    );
    if (nomesOperacoes.size === 0) return;

    const operadoresCapazes = operadores
      .filter((operador) =>
        Object.values(operador.competencias || {}).some(
          (comp) => comp && comp.operacao && nomesOperacoes.has(comp.operacao)
        )
      )
      .map((operador) => operador.id);

    const novosSelecionados = operadoresCapazes.length > 0
      ? operadoresCapazes
      : operadores.map((operador) => operador.id);

    setDadosUnidades((prev) => {
      const unidadeAtual = prev[unidadeAtiva];
      const atuais = new Set(unidadeAtual.operadoresSelecionados);
      const novos = new Set(novosSelecionados);
      const iguais = atuais.size === novos.size && [...novos].every((id) => atuais.has(id));
      if (iguais) return prev;

      return {
        ...prev,
        [unidadeAtiva]: {
          ...unidadeAtual,
          operadoresSelecionados: novosSelecionados,
          config:
            unidadeAtual.config.possibilidade === 3
              ? {
                  ...unidadeAtual.config,
                  numeroOperadores: Math.min(
                    unidadeAtual.config.numeroOperadores || novosSelecionados.length,
                    novosSelecionados.length
                  ),
                }
              : unidadeAtual.config,
        },
      };
    });
  }, [config.possibilidade, operacoes, operadores, produto, unidadeAtiva]);

  // â”€â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      const getMaxPostsPayload = () => {
        const postosInputEl = document.getElementById("lc-postos") as HTMLInputElement | null;
        const postosInputRaw = postosInputEl?.value?.trim() || "";
        const postosInputNum = postosInputRaw ? Number(postosInputRaw.replace(",", ".")) : Number.NaN;
        const postosBase = Number.isFinite(postosInputNum)
          ? postosInputNum
          : Number(layoutConfig.postosPorLado);
        const postosPorLado = Math.max(1, Math.round(postosBase || 0));
        return layoutConfig.tipoLayout === "espinha" ? postosPorLado * 2 : postosPorLado;
      };

      const operadoresDisponiveis = operadores.filter((op) =>
        operadoresSelecionados.includes(op.id)
      );

      if (!usarAllocateModo1Api && !usarAllocateObjetivoApi && !usarAllocateNumeroOperadoresApi && config.possibilidade !== 4 && operadoresDisponiveis.length === 0) {
        alert("Por favor, selecione pelo menos um operador.");
        return;
      }

      if (operacoes.length === 0) {
        alert("Por favor, selecione um produto com operacoes.");
        return;
      }
      const identificadorFicha = produto?.referencia || produto?.id || taskCodeSelecionado || "ficha selecionada";
      const confirmou = window.confirm(`Confirmar balanceamento para ${identificadorFicha}?`);
      if (!confirmou) return;
      // Modo 1: usar endpoint automatico (sequencial ou agrupado por maquina)
      if (usarAllocateModo1Api) {
        if (!taskCodeSelecionado) {
          alert("Nao foi possivel identificar o codigo da ficha tecnica para calcular.");
          return;
        }

        const normalizarRatio = (valor: number) => {
          if (!Number.isFinite(valor)) return 0;
          return valor > 1 ? valor / 100 : valor;
        };
        const limitNotDivideUpper = Math.max(1.01, Number(config.naoDividirMaiorQue) || 1.1);
        const limitNotDivideLower = Math.min(0.99, Math.max(0, Number(config.naoDividirMenorQue) || 0.9));
        const maxPosts = getMaxPostsPayload();

        const payloadBase = {
          efficiency: normalizarRatio(config.produtividadeEstimada),
          work_hours: config.horasTurno,
          limit_not_assign: normalizarRatio(config.cargaMaximaOperador),
          limit_not_divide_upper: limitNotDivideUpper,
          limit_not_divide_lower: limitNotDivideLower,
          line_type: layoutConfig.tipoLayout,
          max_posts: maxPosts,
        };
        const payload = config.agruparMaquinas
          ? {
              ...payloadBase,
              max_position_deviation: Math.max(1, Number(layoutConfig.distanciaMaxima) || 1),
              position_deviation_mode: layoutConfig.permitirRetrocesso ? "both" : "forward",
            }
          : payloadBase;
        const endpointModo1 = config.agruparMaquinas ? "allocate-grouped" : "allocate";

        const resposta = await axios.post(
          `${API_BASE_URL}/tasks/${encodeURIComponent(taskCodeSelecionado)}/${endpointModo1}`,
          payload
        );
        const r = ensureRecord(resposta.data) ?? {};

        const taktTime = (pickNumber(r, ["takt_time_seconds", "takt_time", "taktTime"]) ?? 0) / 60;
        const tempoCicloApi = pickNumber(r, ["real_cycle_time_seconds", "cycle_time_seconds", "cycle_time", "tempo_ciclo_segundos"]);
        const tempoCiclo = tempoCicloApi != null
          ? (tempoCicloApi > 10 ? tempoCicloApi / 60 : tempoCicloApi)
          : 0;
        const numeroCiclosPorHora = pickNumber(r, ["production_per_hour", "numero_ciclos_por_hora"]) ?? (tempoCiclo > 0 ? 60 / tempoCiclo : 0);
        const produtividadeRaw = pickNumber(r, ["estimated_productivity", "productivity", "produtividade_estimada"]) ?? 0;
        const produtividade = produtividadeRaw <= 1 ? produtividadeRaw * 100 : produtividadeRaw;
        const perdas = Math.max(0, 100 - produtividade);

        const assignments = ensureArray(
          r.assignments ??
          r.allocations ??
          r.operator_allocations ??
          r.operator_assignments ??
          r.distribution ??
          r.distribuicao
        );
        const operationAllocations = ensureArray(
          r.operation_allocations ??
          r.operationAllocations
        );

        let distribuicao = extrairDistribuicaoDeTableData(r, operacoes, tempoCiclo, operadoresDisponiveis);
        if (distribuicao.length === 0 && operationAllocations.length > 0) {
          distribuicao = extrairDistribuicaoDeOperationAllocations(operationAllocations, operacoes, operadoresDisponiveis, tempoCiclo);
        }
        const mapa: Record<string, { operacoes: Set<string>; tempoTotal: number; temposOperacoes: Record<string, number> }> = {};

        if (distribuicao.length === 0) {
          for (const item of assignments) {
            const operadorRef = pickString(item, ["operator_id", "operador_id", "operator", "operador"]);
            if (!operadorRef) continue;
            const operadorId = mapOperatorToCode(operadorRef, operadoresDisponiveis);

            const operacaoRef =
              pickString(item, ["operation_code", "operation_id", "operacao_id", "operation", "operacao"]) ||
              pickString(item, ["operation_name", "operacao_nome", "name", "nome"]);
            const operacaoId = operacaoRef ? findOperacaoIdByReferencia(operacaoRef, operacoes) || operacaoRef : "";

            const tempoSegundos = pickNumber(item, ["time_seconds", "tempo_segundos", "seconds"]);
            const tempoMinutos = tempoSegundos != null
              ? tempoSegundos / 60
              : (pickNumber(item, ["time_min", "time_minutes", "tempo_minutos", "minutes"]) ?? 0);

            if (!mapa[operadorId]) mapa[operadorId] = { operacoes: new Set(), tempoTotal: 0, temposOperacoes: {} };
            if (operacaoId) mapa[operadorId].operacoes.add(operacaoId);
            mapa[operadorId].tempoTotal += tempoMinutos;
            if (operacaoId) {
              mapa[operadorId].temposOperacoes[operacaoId] = (mapa[operadorId].temposOperacoes[operacaoId] || 0) + tempoMinutos;
            }
          }
        } else {
          for (const dist of distribuicao) {
            mapa[dist.operadorId] = {
              operacoes: new Set(dist.operacoes),
              tempoTotal: dist.cargaHoraria,
              temposOperacoes: { ...(dist.temposOperacoes || {}) },
            };
          }
        }

        let numeroOperadores =
          pickNumber(r, ["num_operators", "numero_operadores", "numeroOperadores"]) ??
          Object.keys(mapa).length;

        if (Object.keys(mapa).length === 0 && numeroOperadores > 0) {
          for (let i = 1; i <= numeroOperadores; i++) {
            const operadorId = `OP${String(i).padStart(2, "0")}`;
            mapa[operadorId] = { operacoes: new Set(), tempoTotal: 0, temposOperacoes: {} };
          }
        }

        if (distribuicao.length === 0) {
          distribuicao = Object.entries(mapa).map(([operadorId, dados]) => ({
            operadorId,
            operacoes: Array.from(dados.operacoes),
            cargaHoraria: dados.tempoTotal,
            ocupacao: tempoCiclo > 0 ? (dados.tempoTotal / tempoCiclo) * 100 : 0,
            ciclosPorHora: dados.tempoTotal > 0 ? 60 / dados.tempoTotal : 0,
            temposOperacoes: dados.temposOperacoes,
          }));
        }

        if (!numeroOperadores) numeroOperadores = distribuicao.length;
        const ocupacaoTotal =
          pickNumber(r, ["occupancy_total", "ocupacao_total", "total_occupancy", "total_load"]) ??
          distribuicao.reduce((sum, dist) => sum + dist.cargaHoraria * 60, 0);

        const resultadosApi = {
          distribuicao,
          operation_allocations: operationAllocations,
          taktTime,
          tempoCiclo,
          numeroCiclosPorHora,
          produtividade,
          perdas,
          numeroOperadores,
          ocupacaoTotal,
        };

        const dataToPass = {
          resultados: resultadosApi,
          operadores: operadoresDisponiveis,
          operacoes,
          config,
          layoutConfig,
        };

        sessionStorage.setItem("balanceamentoData", JSON.stringify(dataToPass));
        navigate("/resultados", { state: dataToPass });
        return;
      }
      // Modo 2: usar endpoint por quantidade objetivo
      if (usarAllocateObjetivoApi) {
        if (!taskCodeSelecionado) {
          alert("Nao foi possivel identificar o codigo da ficha tecnica para calcular.");
          return;
        }

        const quantidadeObjetivo = Number(quantidadeObjetivoInput || config.quantidadeObjetivo || 0);
        if (!Number.isFinite(quantidadeObjetivo) || quantidadeObjetivo <= 0) {
          alert("Defina uma quantidade objetivo valida.");
          return;
        }

        const normalizarRatio = (valor: number) => {
          if (!Number.isFinite(valor)) return 0;
          return valor > 1 ? valor / 100 : valor;
        };
        const limitNotDivideUpper = Math.max(1.01, Number(config.naoDividirMaiorQue) || 1.1);
        const limitNotDivideLower = Math.min(0.99, Math.max(0, Number(config.naoDividirMenorQue) || 0.9));
        const maxPosts = getMaxPostsPayload();

        const payloadBase = {
          efficiency: normalizarRatio(config.produtividadeEstimada),
          work_hours: config.horasTurno,
          limit_not_assign: normalizarRatio(config.cargaMaximaOperador),
          limit_not_divide_upper: limitNotDivideUpper,
          limit_not_divide_lower: limitNotDivideLower,
          line_type: layoutConfig.tipoLayout,
          max_posts: maxPosts,
          objective_pieces: quantidadeObjetivo,
        };
        const payload = config.agruparMaquinas
          ? {
              ...payloadBase,
              max_position_deviation: Math.max(1, Number(layoutConfig.distanciaMaxima) || 1),
              position_deviation_mode: layoutConfig.permitirRetrocesso ? "both" : "forward",
            }
          : payloadBase;
        const endpointModo2 = config.agruparMaquinas
          ? "allocate-grouped-objective"
          : "allocate-objective";

        const resposta = await axios.post(
          `${API_BASE_URL}/tasks/${encodeURIComponent(taskCodeSelecionado)}/${endpointModo2}`,
          payload
        );
        const r = ensureRecord(resposta.data) ?? {};

        const taktTime = (pickNumber(r, ["takt_time_seconds", "takt_time", "taktTime"]) ?? 0) / 60;
        const tempoCicloApi = pickNumber(r, ["real_cycle_time_seconds", "cycle_time_seconds", "cycle_time", "tempo_ciclo_segundos"]);
        const tempoCiclo = tempoCicloApi != null
          ? (tempoCicloApi > 10 ? tempoCicloApi / 60 : tempoCicloApi)
          : 0;
        const numeroCiclosPorHora = pickNumber(r, ["production_per_hour", "numero_ciclos_por_hora"]) ?? (tempoCiclo > 0 ? 60 / tempoCiclo : 0);
        const produtividadeRaw = pickNumber(r, ["estimated_productivity", "productivity", "produtividade_estimada"]) ?? 0;
        const produtividade = produtividadeRaw <= 1 ? produtividadeRaw * 100 : produtividadeRaw;
        const perdas = Math.max(0, 100 - produtividade);

        const assignments = ensureArray(
          r.assignments ??
          r.allocations ??
          r.operator_allocations ??
          r.operator_assignments ??
          r.distribution ??
          r.distribuicao
        );
        const operationAllocations = ensureArray(
          r.operation_allocations ??
          r.operationAllocations
        );

        let distribuicao = extrairDistribuicaoDeTableData(r, operacoes, tempoCiclo, operadores);
        if (distribuicao.length === 0 && operationAllocations.length > 0) {
          distribuicao = extrairDistribuicaoDeOperationAllocations(operationAllocations, operacoes, operadores, tempoCiclo);
        }
        const mapa: Record<string, { operacoes: Set<string>; tempoTotal: number; temposOperacoes: Record<string, number> }> = {};

        if (distribuicao.length === 0) {
          for (const item of assignments) {
            const operadorRef = pickString(item, ["operator_id", "operador_id", "operator", "operador"]);
            if (!operadorRef) continue;
            const operadorId = mapOperatorToCode(operadorRef, operadores);

            const operacaoRef =
              pickString(item, ["operation_code", "operation_id", "operacao_id", "operation", "operacao"]) ||
              pickString(item, ["operation_name", "operacao_nome", "name", "nome"]);
            const operacaoId = operacaoRef ? findOperacaoIdByReferencia(operacaoRef, operacoes) || operacaoRef : "";

            const tempoSegundos = pickNumber(item, ["time_seconds", "tempo_segundos", "seconds"]);
            const tempoMinutos = tempoSegundos != null
              ? tempoSegundos / 60
              : (pickNumber(item, ["time_min", "time_minutes", "tempo_minutos", "minutes"]) ?? 0);

            if (!mapa[operadorId]) mapa[operadorId] = { operacoes: new Set(), tempoTotal: 0, temposOperacoes: {} };
            if (operacaoId) mapa[operadorId].operacoes.add(operacaoId);
            mapa[operadorId].tempoTotal += tempoMinutos;
            if (operacaoId) {
              mapa[operadorId].temposOperacoes[operacaoId] = (mapa[operadorId].temposOperacoes[operacaoId] || 0) + tempoMinutos;
            }
          }
        } else {
          for (const dist of distribuicao) {
            mapa[dist.operadorId] = {
              operacoes: new Set(dist.operacoes),
              tempoTotal: dist.cargaHoraria,
              temposOperacoes: { ...(dist.temposOperacoes || {}) },
            };
          }
        }

        let numeroOperadores =
          pickNumber(r, ["num_operators", "numero_operadores", "numeroOperadores"]) ??
          Object.keys(mapa).length;

        if (Object.keys(mapa).length === 0 && numeroOperadores > 0) {
          for (let i = 1; i <= numeroOperadores; i++) {
            const operadorId = `OP${String(i).padStart(2, "0")}`;
            mapa[operadorId] = { operacoes: new Set(), tempoTotal: 0, temposOperacoes: {} };
          }
        }

        if (distribuicao.length === 0) {
          distribuicao = Object.entries(mapa).map(([operadorId, dados]) => ({
            operadorId,
            operacoes: Array.from(dados.operacoes),
            cargaHoraria: dados.tempoTotal,
            ocupacao: tempoCiclo > 0 ? (dados.tempoTotal / tempoCiclo) * 100 : 0,
            ciclosPorHora: dados.tempoTotal > 0 ? 60 / dados.tempoTotal : 0,
            temposOperacoes: dados.temposOperacoes,
          }));
        }

        if (!numeroOperadores) numeroOperadores = distribuicao.length;
        const ocupacaoTotal =
          pickNumber(r, ["occupancy_total", "ocupacao_total", "total_occupancy", "total_load"]) ??
          distribuicao.reduce((sum, dist) => sum + dist.cargaHoraria * 60, 0);

        const resultadosApi = {
          distribuicao,
          operation_allocations: operationAllocations,
          taktTime,
          tempoCiclo,
          numeroCiclosPorHora,
          produtividade,
          perdas,
          numeroOperadores,
          ocupacaoTotal,
        };

        const dataToPass = {
          resultados: resultadosApi,
          operadores,
          operacoes,
          config,
          layoutConfig,
        };

        sessionStorage.setItem("balanceamentoData", JSON.stringify(dataToPass));
        navigate("/resultados", { state: dataToPass });
        return;
      }
      // Modo 3: usar endpoint por numero de operadores
      if (usarAllocateNumeroOperadoresApi) {
        if (!taskCodeSelecionado) {
          alert("Nao foi possivel identificar o codigo da ficha tecnica para calcular.");
          return;
        }

        const numeroOperadoresEfetivo = Number(numeroOperadoresInput || config.numeroOperadores || operadoresSelecionados.length || 0);
        const numeroOperadoresPedido = Math.max(1, Math.trunc(numeroOperadoresEfetivo));
        if (!Number.isFinite(numeroOperadoresPedido) || numeroOperadoresPedido <= 0) {
          alert("Defina um numero de operadores valido.");
          return;
        }

        const normalizarRatio = (valor: number) => {
          if (!Number.isFinite(valor)) return 0;
          return valor > 1 ? valor / 100 : valor;
        };
        const limitNotDivideUpper = Math.max(1.01, Number(config.naoDividirMaiorQue) || 1.1);
        const limitNotDivideLower = Math.min(0.99, Math.max(0, Number(config.naoDividirMenorQue) || 0.9));
        const maxPosts = getMaxPostsPayload();

        const payloadBase = {
          efficiency: normalizarRatio(config.produtividadeEstimada),
          work_hours: config.horasTurno,
          limit_not_assign: normalizarRatio(config.cargaMaximaOperador),
          limit_not_divide_upper: limitNotDivideUpper,
          limit_not_divide_lower: limitNotDivideLower,
          line_type: layoutConfig.tipoLayout,
          max_posts: maxPosts,
          num_operators: numeroOperadoresPedido,
        };
        const payload = config.agruparMaquinas
          ? {
              ...payloadBase,
              max_position_deviation: Math.max(1, Number(layoutConfig.distanciaMaxima) || 1),
              position_deviation_mode: layoutConfig.permitirRetrocesso ? "both" : "forward",
            }
          : payloadBase;
        const endpointModo3 = config.agruparMaquinas
          ? "allocate-grouped-manual"
          : "allocate-manual";

        const resposta = await axios.post(
          `${API_BASE_URL}/tasks/${encodeURIComponent(taskCodeSelecionado)}/${endpointModo3}`,
          payload
        );
        const r = ensureRecord(resposta.data) ?? {};

        const taktTime = (pickNumber(r, ["takt_time_seconds", "takt_time", "taktTime"]) ?? 0) / 60;
        const tempoCicloApi = pickNumber(r, ["real_cycle_time_seconds", "cycle_time_seconds", "cycle_time", "tempo_ciclo_segundos"]);
        const tempoCiclo = tempoCicloApi != null
          ? (tempoCicloApi > 10 ? tempoCicloApi / 60 : tempoCicloApi)
          : 0;
        const numeroCiclosPorHora = pickNumber(r, ["production_per_hour", "numero_ciclos_por_hora"]) ?? (tempoCiclo > 0 ? 60 / tempoCiclo : 0);
        const produtividadeRaw = pickNumber(r, ["estimated_productivity", "productivity", "produtividade_estimada"]) ?? 0;
        const produtividade = produtividadeRaw <= 1 ? produtividadeRaw * 100 : produtividadeRaw;
        const perdas = Math.max(0, 100 - produtividade);

        const assignments = ensureArray(
          r.assignments ??
          r.allocations ??
          r.operator_allocations ??
          r.operator_assignments ??
          r.distribution ??
          r.distribuicao
        );
        const operationAllocations = ensureArray(
          r.operation_allocations ??
          r.operationAllocations
        );

        let distribuicao = extrairDistribuicaoDeTableData(r, operacoes, tempoCiclo, operadores);
        if (distribuicao.length === 0 && operationAllocations.length > 0) {
          distribuicao = extrairDistribuicaoDeOperationAllocations(operationAllocations, operacoes, operadores, tempoCiclo);
        }
        const mapa: Record<string, { operacoes: Set<string>; tempoTotal: number; temposOperacoes: Record<string, number> }> = {};

        if (distribuicao.length === 0) {
          for (const item of assignments) {
            const operadorRef = pickString(item, ["operator_id", "operador_id", "operator", "operador"]);
            if (!operadorRef) continue;
            const operadorId = mapOperatorToCode(operadorRef, operadores);

            const operacaoRef =
              pickString(item, ["operation_code", "operation_id", "operacao_id", "operation", "operacao"]) ||
              pickString(item, ["operation_name", "operacao_nome", "name", "nome"]);
            const operacaoId = operacaoRef ? findOperacaoIdByReferencia(operacaoRef, operacoes) || operacaoRef : "";

            const tempoSegundos = pickNumber(item, ["time_seconds", "tempo_segundos", "seconds"]);
            const tempoMinutos = tempoSegundos != null
              ? tempoSegundos / 60
              : (pickNumber(item, ["time_min", "time_minutes", "tempo_minutos", "minutes"]) ?? 0);

            if (!mapa[operadorId]) mapa[operadorId] = { operacoes: new Set(), tempoTotal: 0, temposOperacoes: {} };
            if (operacaoId) mapa[operadorId].operacoes.add(operacaoId);
            mapa[operadorId].tempoTotal += tempoMinutos;
            if (operacaoId) {
              mapa[operadorId].temposOperacoes[operacaoId] = (mapa[operadorId].temposOperacoes[operacaoId] || 0) + tempoMinutos;
            }
          }
        } else {
          for (const dist of distribuicao) {
            mapa[dist.operadorId] = {
              operacoes: new Set(dist.operacoes),
              tempoTotal: dist.cargaHoraria,
              temposOperacoes: { ...(dist.temposOperacoes || {}) },
            };
          }
        }

        let numeroOperadores =
          pickNumber(r, ["num_operators", "numero_operadores", "numeroOperadores"]) ??
          Object.keys(mapa).length;

        if (Object.keys(mapa).length === 0 && numeroOperadores > 0) {
          for (let i = 1; i <= numeroOperadores; i++) {
            const operadorId = `OP${String(i).padStart(2, "0")}`;
            mapa[operadorId] = { operacoes: new Set(), tempoTotal: 0, temposOperacoes: {} };
          }
        }

        if (distribuicao.length === 0) {
          distribuicao = Object.entries(mapa).map(([operadorId, dados]) => ({
            operadorId,
            operacoes: Array.from(dados.operacoes),
            cargaHoraria: dados.tempoTotal,
            ocupacao: tempoCiclo > 0 ? (dados.tempoTotal / tempoCiclo) * 100 : 0,
            ciclosPorHora: dados.tempoTotal > 0 ? 60 / dados.tempoTotal : 0,
            temposOperacoes: dados.temposOperacoes,
          }));
        }

        if (!numeroOperadores) numeroOperadores = distribuicao.length;
        const ocupacaoTotal =
          pickNumber(r, ["occupancy_total", "ocupacao_total", "total_occupancy", "total_load"]) ??
          distribuicao.reduce((sum, dist) => sum + dist.cargaHoraria * 60, 0);

        const resultadosApi = {
          distribuicao,
          operation_allocations: operationAllocations,
          taktTime,
          tempoCiclo,
          numeroCiclosPorHora,
          produtividade,
          perdas,
          numeroOperadores,
          ocupacaoTotal,
        };

        const dataToPass = {
          resultados: resultadosApi,
          operadores,
          operacoes,
          config,
          layoutConfig,
        };

        sessionStorage.setItem("balanceamentoData", JSON.stringify(dataToPass));
        navigate("/resultados", { state: dataToPass });
        return;
      }
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

        const taskCode = taskCodeSelecionado || grupoArtigoSelecionado || "custom";
        const resposta = await axios.post(
          `${API_BASE_URL}/tasks/${encodeURIComponent(taskCode)}/allocate-custom`,
          { assignments }
        );
        const r = ensureRecord(resposta.data) ?? {};

        // Mapear resposta da API para ResultadosBalanceamento
        const taktTime = (pickNumber(r, ["takt_time_seconds", "takt_time", "taktTime"]) ?? 0) / 60;
        const tempoCicloApi = pickNumber(r, ["real_cycle_time_seconds", "cycle_time_seconds", "cycle_time", "tempo_ciclo_segundos"]);
        const tempoCiclo = tempoCicloApi != null
          ? (tempoCicloApi > 10 ? tempoCicloApi / 60 : tempoCicloApi)
          : 0;
        const numeroCiclosPorHora = pickNumber(r, ["production_per_hour", "numero_ciclos_por_hora"]) ?? (tempoCiclo > 0 ? 60 / tempoCiclo : 0);
        const produtividadeRaw = pickNumber(r, ["estimated_productivity", "productivity", "produtividade_estimada"]) ?? 0;
        const produtividade = produtividadeRaw <= 1 ? produtividadeRaw * 100 : produtividadeRaw;
        const perdas = Math.max(0, 100 - produtividade);
        const numeroOperadores = r.num_operators ?? r.numero_operadores ?? r.numeroOperadores ?? new Set(assignments.map((a) => a.operator_id).filter(Boolean)).size;
        const operationAllocations = ensureArray(
          r.operation_allocations ??
          r.operationAllocations
        );

        // Construir distribuicao por operador a partir dos assignments enviados (por operacao)
        const mapa: Record<string, { operacoes: Set<string>; tempoTotal: number; temposOperacoes: Record<string, number> }> = {};
        for (const a of assignments) {
          if (!a.operator_id) continue;
          const operadorId = mapOperatorToCode(a.operator_id, operadoresDisponiveis);
          if (!mapa[operadorId]) mapa[operadorId] = { operacoes: new Set(), tempoTotal: 0, temposOperacoes: {} };
          mapa[operadorId].operacoes.add(a.operation_code);
          mapa[operadorId].tempoTotal += a.time_seconds / 60;
          mapa[operadorId].temposOperacoes[a.operation_code] =
            (mapa[operadorId].temposOperacoes[a.operation_code] || 0) + a.time_seconds / 60;
        }
        const distribuicao: DistItem[] = Object.entries(mapa).map(([operadorId, dados]) => ({
          operadorId,
          operacoes: Array.from(dados.operacoes),
          cargaHoraria: dados.tempoTotal,
          ocupacao: tempoCiclo > 0 ? (dados.tempoTotal / tempoCiclo) * 100 : 0,
          ciclosPorHora: dados.tempoTotal > 0 ? 60 / dados.tempoTotal : 0,
          temposOperacoes: dados.temposOperacoes,
        }));
        const ocupacaoTotal =
          pickNumber(r, ["occupancy_total", "ocupacao_total", "total_occupancy", "total_load"]) ??
          distribuicao.reduce((sum, dist) => sum + dist.cargaHoraria * 60, 0);

        const resultadosCustom = {
          distribuicao,
          operation_allocations: operationAllocations,
          taktTime,
          tempoCiclo,
          numeroCiclosPorHora,
          produtividade,
          perdas,
          numeroOperadores,
          ocupacaoTotal,
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

      // Guardar no ficheiro - inclui configuracao actual + historico actualizado
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
      if (axios.isAxiosError(error) && error.response?.status === 422) {
        const data = error.response?.data as { detail?: unknown } | undefined;
        let mensagem422 = "";
        if (data?.detail && typeof data.detail === "object") {
          const detail = data.detail as { message?: unknown };
          if (typeof detail.message === "string" && detail.message.trim()) {
            mensagem422 = detail.message;
          }
        }
        setErroCalculoModal(mensagem422 || extrairMensagemErro(error));
        return;
      }
      alert(`Erro ao calcular balanceamento:\n${extrairMensagemErro(error)}`);
    }
  };

  const tempoTotal = operacoes.reduce((sum, op) => sum + op.tempo, 0);
  const [gamaExpandida, setGamaExpandida] = useState(false);

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

      {/* Cards de mÃ©tricas */}
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
              <div className="text-xs text-gray-500 uppercase">Operacoes</div>
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
              <div className="text-xs text-gray-500 uppercase">Maquinas</div>
              <div className="text-2xl font-bold text-gray-900">
                {operacoes.length > 0
                  ? new Set(operacoes.map((op) => op.tipoMaquina)).size
                  : 0}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Selecao de Grupo de Artigo */}
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
                Ficha Tecnica
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
                      "Selecione uma ficha tecnica"
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
              <span className="mx-2"> - </span>
              <span>{operacoes.length} operacoes</span>
            </div>
          )}
        </div>
      )}

      {/* Configuracao de Distribuicao */}
      <ConfiguracaoDistribuicaoComponent
        config={config}
        onChange={handleConfigChange}
        numeroOperadoresDisponiveis={operadoresSelecionados.length}
        operacoes={operacoes}
        onCalcularOperadoresNecessarios={handleCalcularOperadoresNecessarios}
      />

      {/* Tabela de Operacoes Manual */}
      {config.possibilidade === 4 && (
        <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-sm flex items-center justify-center">
              <Edit3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Entrada Manual de Operacoes</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Preencha os dados das operacoes directamente na tabela
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

      {/* Parametros de Balanceamento */}
      {config.possibilidade !== 4 && (
        <div className="shadow-sm border border-gray-200 rounded-sm bg-white">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-gray-700" />
              <div>
                <h3 className="text-base font-semibold text-gray-900">Parametros de Balanceamento</h3>
                <p className="text-xs text-gray-500 font-normal mt-0.5">
                  Parametros de entrada conforme o metodo selecionado
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
                        onChange={(e) => {
                          const next = e.currentTarget.valueAsNumber;
                          if (!Number.isFinite(next)) return;
                          handleConfigChange({ ...config, horasTurno: next });
                        }}
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
                        onChange={(e) => {
                          const next = e.currentTarget.valueAsNumber;
                          if (!Number.isFinite(next)) return;
                          handleConfigChange({ ...config, produtividadeEstimada: next });
                        }}
                        className="bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 font-semibold rounded-r-sm w-32 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                    {!usarAllocateModo1Api && (
                      <div className="flex items-stretch">
                        <div className="bg-gray-100 border border-gray-200 px-4 py-3 flex items-center rounded-l-sm flex-1">
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Numero de Operadores</span>
                        </div>
                        <div className="bg-gray-50 border border-gray-300 px-4 py-3 text-sm text-gray-900 font-semibold rounded-r-sm w-32 text-right font-mono flex items-center justify-end">
                          {operadoresSelecionados.length}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {config.possibilidade === 2 && (
                  <>
                    <div className="flex items-stretch">
                      <div className="bg-gray-100 border border-gray-200 px-4 py-3 flex items-center rounded-l-sm flex-1">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Objetivo (pecas/dia)</span>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={quantidadeObjetivoInput}
                        onChange={(e) => {
                          const raw = e.currentTarget.value.replace(/[^\d]/g, "");
                          setQuantidadeObjetivoInput(raw);
                          if (!raw) {
                            handleConfigChange({ ...config, quantidadeObjetivo: undefined });
                            return;
                          }
                          const quantidade = Number(raw);
                          if (!Number.isFinite(quantidade)) return;
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
                        onChange={(e) => {
                          const next = e.currentTarget.valueAsNumber;
                          if (!Number.isFinite(next)) return;
                          handleConfigChange({ ...config, horasTurno: next });
                        }}
                        className="bg-white border border-gray-300 px-4 py-3 text-sm text-gray-900 font-semibold rounded-r-sm w-32 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </>
                )}

                {config.possibilidade === 3 && (
                  <>
                    <div className="flex items-stretch">
                      <div className="bg-gray-100 border border-gray-200 px-4 py-3 flex items-center rounded-l-sm flex-1">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Numero de Operadores</span>
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={numeroOperadoresInput}
                        onChange={(e) => {
                          const raw = e.currentTarget.value.replace(/[^\d]/g, "");
                          setNumeroOperadoresInput(raw);
                          if (!raw) return;
                          const typed = Number(raw);
                          if (!Number.isFinite(typed)) return;
                          const num = Math.max(1, Math.min(typed, operadores.length));
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
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Disponiveis na Linha</span>
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
                        onChange={(e) => {
                          const next = e.currentTarget.valueAsNumber;
                          if (!Number.isFinite(next)) return;
                          handleConfigChange({ ...config, horasTurno: next });
                        }}
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

      {/* Gama Operatoria */}
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
                    Gama Operatoria - {produto?.nome || "Sem produto"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Operacoes carregadas da ficha tecnica do produto selecionado
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 font-mono">
                  {operacoes.length} ops  -  {tempoTotal.toFixed(2)} min
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
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Descricao</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-28">Tempo (min)</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Maquina</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase min-w-[200px]">Operadores Disponiveis</th>
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
                              CRITICA
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-sm text-gray-700">{operacao.tempo.toFixed(2)}</td>
                        <td className="p-3 text-sm text-gray-600">{operacao.tipoMaquina || "-"}</td>
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

      {/* Configuracao de Layout */}
      <LayoutConfigurador
        operacoes={operacoes}
        onLayoutChange={setLayoutConfig}
        agruparPorMaquina={config.agruparMaquinas}
      />

      {/* BotÃ£o Calcular */}
      <div className="flex justify-center pt-4">
        <Button
          type="button"
          size="lg"
          onClick={handleCalcular}
          disabled={(!usarAllocateModo1Api && operadoresSelecionados.length === 0) || operacoes.length === 0}
          className="px-12 py-6 text-sm font-semibold bg-blue-500 hover:bg-blue-600 rounded-sm uppercase tracking-wide"
        >
          <Calculator className="w-5 h-5 mr-2" />
          Calcular Balanceamento
        </Button>
      </div>

      <Dialog
        open={Boolean(erroCalculoModal)}
        onOpenChange={(open) => {
          if (!open) setErroCalculoModal(null);
        }}
      >
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Erro ao calcular balanceamento</DialogTitle>
            <DialogDescription className="text-xs">
              {erroCalculoModal || "Ocorreu um erro inesperado."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              className="bg-orange-600 hover:bg-orange-700 rounded-sm text-xs"
              onClick={() => setErroCalculoModal(null)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
