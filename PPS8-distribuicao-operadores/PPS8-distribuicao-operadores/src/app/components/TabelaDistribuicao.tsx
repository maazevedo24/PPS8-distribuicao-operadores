import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ResultadosBalanceamento, DistribuicaoCarga, OperationAllocation } from "../types";
import { Button } from "./ui/button";

interface TabelaDistribuicaoProps {
  resultados: ResultadosBalanceamento;
  operadores: any[];
  operacoes: any[];
  onDistribuicaoChange?: (novaDistribuicao: DistribuicaoCarga[]) => void;
  unidadeTempo?: "min" | "s";
  viewMode?: "tempo" | "percentagem";
  onViewModeChange?: (mode: "tempo" | "percentagem") => void;
  onConfirmarEdicao?: (editedRows: OperationAllocationRow[]) => Promise<void>;
  onGuardarHistorico?: () => Promise<void>;
  isAjustando?: boolean;
  isGuardandoHistorico?: boolean;
}

type OperationAllocationRow = OperationAllocation & {
  operator_allocations?: Array<Record<string, unknown>>;
};

type OperatorColumn = {
  key: string;
  code: string;
  label: string;
  positionNumber?: number;
  positionLabel?: string;
  positionSide?: string;
};

const normalizeKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const resolveAllocationOperatorCode = (allocation: Record<string, unknown>): string =>
  String(
    allocation.operator_code ??
      allocation.operator_id ??
      allocation.operador_id ??
      allocation.operator ??
      allocation.operador ??
      allocation.code ??
      ""
  ).trim();

const resolveOperatorNameFromCode = (operatorCode: string, operadores: any[]): string | undefined => {
  const key = normalizeKey(operatorCode);
  const match = operadores.find((op: any) => {
    const id = normalizeKey(String(op?.id || ""));
    const nome = normalizeKey(String(op?.nome || ""));
    return key === id || key === nome;
  });
  const nome = String(match?.nome || "").trim();
  return nome || undefined;
};

const parseNumberLike = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim().replace(",", ".");
    const direct = Number(normalized);
    if (Number.isFinite(direct)) return direct;

    const matched = normalized.match(/-?\d+(?:\.\d+)?/);
    const parsed = matched ? Number(matched[0]) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const formatExact = (value: unknown): string => {
  if (value == null || value === "") return "-";
  if (typeof value === "number") return Number.isFinite(value) ? value.toFixed(2) : "-";
  if (typeof value === "string") {
    const parsed = parseNumberLike(value);
    if (parsed != null) return parsed.toFixed(2);
    return value.trim() || "-";
  }
  const numeric = parseNumberLike(value);
  return numeric != null ? numeric.toFixed(2) : String(value);
};

const resolveOperationLabel = (row: OperationAllocationRow, operacoes: any[]): string => {
  const candidates = [
    row.operation_name,
    row.operation_code,
    row.operation_id,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const key = normalizeKey(candidate);
    const match = operacoes.find((op: any) => {
      const id = normalizeKey(String(op?.id || ""));
      const nome = normalizeKey(String(op?.nome || ""));
      return key === id || key === nome;
    });
    if (match?.nome) return String(match.nome);
  }

  return row.operation_name || row.operation_code || row.operation_id || "-";
};

const resolveOperatorLabel = (code: string, position: { operator_name?: string } | undefined, operadores: any[]): string => {
  const name = position?.operator_name?.trim();
  if (name) return name;

  const match = operadores.find((op: any) => {
    const id = normalizeKey(String(op?.id || ""));
    const nome = normalizeKey(String(op?.nome || ""));
    const key = normalizeKey(code);
    return key === id || key === nome;
  });

  if (match?.nome) return String(match.nome);
  if (match?.id) return String(match.id);
  return code;
};

const buildOperatorColumns = (rows: OperationAllocationRow[], operadores: any[]): OperatorColumn[] => {
  const columns = new Map<string, OperatorColumn>();

  rows.forEach((row) => {
    const operatorTimes = row.operator_times || {};
    const operatorPositions = row.operator_positions || {};
    const keys = new Set([...Object.keys(operatorTimes), ...Object.keys(operatorPositions)]);

    keys.forEach((rawCode) => {
      const key = normalizeKey(rawCode);
      if (!key || columns.has(key)) return;

      const positionEntry = Object.entries(operatorPositions).find(([candidate]) => normalizeKey(candidate) === key);
      const position = positionEntry?.[1];
      const code = positionEntry?.[0] || rawCode;

      columns.set(key, {
        key,
        code,
        label: resolveOperatorLabel(code, position, operadores),
        positionNumber: parseNumberLike(position?.position_number) ?? undefined,
        positionLabel: position?.position_label,
        positionSide: position?.position_side,
      });
    });
  });

  return Array.from(columns.values()).sort((a, b) => {
    const aPos = a.positionNumber ?? Number.MAX_SAFE_INTEGER;
    const bPos = b.positionNumber ?? Number.MAX_SAFE_INTEGER;
    if (aPos !== bPos) return aPos - bPos;
    return a.code.localeCompare(b.code);
  });
};

const getOperatorTime = (row: OperationAllocationRow, column: OperatorColumn): number | null => {
  const directTime = parseNumberLike(row.operator_times?.[column.code]);
  if (directTime != null) return directTime;

  const normalizedMatch = Object.entries(row.operator_times || {}).find(([candidate]) => normalizeKey(candidate) === column.key);
  if (normalizedMatch) {
    const parsed = parseNumberLike(normalizedMatch[1]);
    if (parsed != null) return parsed;
  }

  const allocations = Array.isArray(row.operator_allocations) ? row.operator_allocations : [];
  for (const allocation of allocations) {
    const record = allocation as Record<string, unknown>;
    const operatorCode = String(
      record.operator_code ??
        record.operator_id ??
        record.operador_id ??
        record.operator ??
        record.operador ??
        record.code ??
        ""
    ).trim();

    if (!operatorCode || normalizeKey(operatorCode) !== column.key) continue;

    const timeValue =
      record.time_seconds ??
      record.tempo_segundos ??
      record.seconds ??
      record.time ??
      record.time_min ??
      record.time_minutes ??
      record.minutes;
    const parsed = parseNumberLike(timeValue);
    if (parsed != null) return parsed;
  }

  const positionEntry = Object.entries(row.operator_positions || {}).find(([candidate]) => normalizeKey(candidate) === column.key);
  const positionTime = parseNumberLike(positionEntry?.[1]?.time_seconds);
  if (positionTime != null) return positionTime;

  return null;
};

const resolveRowOperatorRef = (row: OperationAllocationRow, column: OperatorColumn): string => {
  const directInTimes = Object.keys(row.operator_times || {}).find(
    (candidate) => normalizeKey(candidate) === column.key
  );
  if (directInTimes) return directInTimes;

  const directInPositions = Object.keys(row.operator_positions || {}).find(
    (candidate) => normalizeKey(candidate) === column.key
  );
  if (directInPositions) return directInPositions;

  const allocations = Array.isArray(row.operator_allocations) ? row.operator_allocations : [];
  for (const allocation of allocations) {
    const record = allocation as Record<string, unknown>;
    const operatorCode = String(
      record.operator_code ??
        record.operator_id ??
        record.operador_id ??
        record.operator ??
        record.operador ??
        record.code ??
        ""
    ).trim();
    if (!operatorCode) continue;
    if (normalizeKey(operatorCode) === column.key) return operatorCode;
  }

  return column.code;
};

const normalizePercentageValue = (value: number): number =>
  value <= 1 ? value * 100 : value;

const getOperatorPercentage = (
  row: OperationAllocationRow,
  column: OperatorColumn
): number | null => {
  const candidateKeys = new Set<string>([
    column.code,
    column.key,
    normalizeKey(column.code),
    normalizeKey(column.label || ""),
  ]);

  const percentageMaps = [
    (row as Record<string, unknown>).occupancy_percentage,
    (row as Record<string, unknown>).occupancy_percentages,
    (row as Record<string, unknown>).operator_percentages,
    (row as Record<string, unknown>).operator_percentage,
    (row as Record<string, unknown>).operator_percents,
    (row as Record<string, unknown>).operator_occupancy,
  ];

  for (const map of percentageMaps) {
    if (!map || typeof map !== "object") continue;
    for (const [rawKey, rawValue] of Object.entries(map as Record<string, unknown>)) {
      const parsed = parseNumberLike(rawValue);
      if (parsed == null) continue;
      const normalizedRawKey = normalizeKey(rawKey);
      if (
        candidateKeys.has(rawKey) ||
        candidateKeys.has(normalizedRawKey) ||
        normalizedRawKey === column.key
      ) {
        return normalizePercentageValue(parsed);
      }
    }
  }

  const allocations = Array.isArray(row.operator_allocations) ? row.operator_allocations : [];
  for (const allocation of allocations) {
    const record = allocation as Record<string, unknown>;
    const operatorCode = String(
      record.operator_code ??
      record.operator_id ??
      record.operador_id ??
      record.operator ??
      record.operador ??
      record.code ??
      ""
    ).trim();
    if (!operatorCode) continue;
    const normalizedOperatorCode = normalizeKey(operatorCode);
    if (!candidateKeys.has(operatorCode) && !candidateKeys.has(normalizedOperatorCode) && normalizedOperatorCode !== column.key) {
      continue;
    }

    const percentageValue =
      record.occupancy_percentage ??
      record.percentage ??
      record.percent ??
      record.occupancy_percent ??
      record.operator_occupancy ??
      record.allocation_percentage ??
      record.share;
    const parsed = parseNumberLike(percentageValue);
    if (parsed != null) return normalizePercentageValue(parsed);
  }

  return null;
};

const thBase = (extra?: CSSProperties): CSSProperties => ({
  background: "#ffffff",
  color: "#374151",
  fontSize: 11,
  fontWeight: 600,
  textAlign: "left",
  padding: "0 10px",
  borderBottom: "2px solid #e5e7eb",
  borderRight: "1px solid #f3f4f6",
  whiteSpace: "nowrap",
  ...extra,
});

const tdBase = (bg: string, extra?: CSSProperties): CSSProperties => ({
  background: bg,
  fontSize: 11,
  color: "#111827",
  borderBottom: "1px solid #f3f4f6",
  borderRight: "1px solid #f3f4f6",
  padding: "0 10px",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  ...extra,
});

const sortOperationRows = (rows: OperationAllocationRow[]): OperationAllocationRow[] =>
  [...rows].sort((a, b) => {
    const aSeq = a.seq ?? Number.MAX_SAFE_INTEGER;
    const bSeq = b.seq ?? Number.MAX_SAFE_INTEGER;
    if (aSeq !== bSeq) return aSeq - bSeq;
    const aKey = String(a.operation_code || a.operation_id || a.operation_name || "");
    const bKey = String(b.operation_code || b.operation_id || b.operation_name || "");
    return aKey.localeCompare(bKey);
  });

const buildRowsFromDistribuicao = (
  distribuicao: DistribuicaoCarga[],
  operacoes: any[]
): OperationAllocationRow[] => {
  const operatorCodeById = new Map<string, string>();
  distribuicao.forEach((dist, index) => {
    const rawId = String(dist?.operadorId || "").trim();
    if (!rawId) return;
    if (!operatorCodeById.has(rawId)) {
      operatorCodeById.set(rawId, `OP${operatorCodeById.size + 1}`);
    }
  });

  const orderedOps = [...operacoes].sort(
    (a, b) => (parseNumberLike(a?.sequencia) ?? 0) - (parseNumberLike(b?.sequencia) ?? 0)
  );

  return orderedOps.map((op, index) => {
    const opId = String(op?.id || "");
    const totalTimeSeconds = Math.max(0, (parseNumberLike(op?.tempo) ?? 0) * 60);
    const assigned = distribuicao.filter(
      (dist) => Array.isArray(dist.operacoes) && dist.operacoes.includes(opId)
    );

    const operatorTimes: Record<string, number> = {};
    const fallbackPerOperatorSeconds =
      assigned.length > 0 ? totalTimeSeconds / assigned.length : 0;

    assigned.forEach((dist) => {
      const fromMapMinutes = dist.temposOperacoes?.[opId];
      const seconds =
        typeof fromMapMinutes === "number" && Number.isFinite(fromMapMinutes)
          ? fromMapMinutes * 60
          : fallbackPerOperatorSeconds;
      const rawOperatorId = String(dist?.operadorId || "").trim();
      const operatorCode = operatorCodeById.get(rawOperatorId) || rawOperatorId;
      if (seconds > 0 && operatorCode) operatorTimes[operatorCode] = seconds;
    });

    const allocatedTimeSeconds = Object.values(operatorTimes).reduce(
      (sum, value) => sum + value,
      0
    );
    const splitCount = Object.keys(operatorTimes).length;

    return {
      seq: parseNumberLike(op?.sequencia) ?? index + 1,
      operation_id: opId,
      operation_code: opId,
      operation_name: String(op?.nome || ""),
      machine_type: String(op?.tipoMaquina || ""),
      total_time_seconds: totalTimeSeconds,
      allocated_time_seconds: allocatedTimeSeconds,
      remaining_time_seconds: Math.max(0, totalTimeSeconds - allocatedTimeSeconds),
      split_count: splitCount,
      is_split: splitCount > 1,
      operator_times: operatorTimes,
      operator_positions: {},
    };
  });
};

function TabelaAllocacoes({
  resultados,
  operadores,
  operacoes,
  viewMode = "tempo",
  onViewModeChange,
  onConfirmarEdicao,
  onGuardarHistorico,
  isAjustando = false,
  isGuardandoHistorico = false,
}: {
  resultados: ResultadosBalanceamento;
  operadores: any[];
  operacoes: any[];
  viewMode?: "tempo" | "percentagem";
  onViewModeChange?: (mode: "tempo" | "percentagem") => void;
  onConfirmarEdicao?: (editedRows: OperationAllocationRow[]) => Promise<void>;
  onGuardarHistorico?: () => Promise<void>;
  isAjustando?: boolean;
  isGuardandoHistorico?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeCell, setActiveCell] = useState<{ rowIndex: number; columnKey: string } | null>(null);
  const [activeCellValue, setActiveCellValue] = useState<string>("");
  const baseRows = useMemo<OperationAllocationRow[]>(
    () => {
      const apiRows = (resultados.operation_allocations || []) as OperationAllocationRow[];
      const sourceRows =
        apiRows.length > 0
          ? apiRows
          : buildRowsFromDistribuicao(resultados.distribuicao || [], operacoes);
      return sortOperationRows(sourceRows);
    },
    [resultados.operation_allocations, resultados.distribuicao, operacoes]
  );
  const [draftRows, setDraftRows] = useState<OperationAllocationRow[]>([]);
  const rows = isEditing ? draftRows : baseRows;

  const operatorColumns = useMemo(
    () => buildOperatorColumns(rows, operadores),
    [rows, operadores]
  );

  const totalsByOperator = useMemo(() => {
    const totals: Record<string, number> = {};
    operatorColumns.forEach((column) => {
      totals[column.key] = 0;
    });

    rows.forEach((row) => {
      operatorColumns.forEach((column) => {
        const value = getOperatorTime(row, column);
        if (value != null) totals[column.key] += value;
      });
    });

    return totals;
  }, [rows, operatorColumns]);

  const totalTime = rows.reduce((sum, row) => sum + (parseNumberLike(row.total_time_seconds) ?? 0), 0);
  const operatorColumnWidth = useMemo(() => {
    const count = operatorColumns.length;
    if (count >= 24) return 64;
    if (count >= 18) return 72;
    if (count >= 14) return 84;
    if (count >= 10) return 96;
    return 110;
  }, [operatorColumns.length]);
  const totalsByOperatorPercent = useMemo(() => {
    const percentages: Record<string, number> = {};
    operatorColumns.forEach((column) => {
      percentages[column.key] = rows.reduce((sum, row) => {
        const value = getOperatorPercentage(row, column);
        return sum + (value ?? 0);
      }, 0);
    });
    return percentages;
  }, [operatorColumns, rows]);

  const formatMetric = (value: number | null | undefined): string => {
    if (value == null) return "-";
    if (viewMode === "percentagem") return `${formatExact(value)}%`;
    return formatExact(value);
  };

  const commitCellValue = (rowIndex: number, column: OperatorColumn, rawValue: string): OperationAllocationRow[] => {
    const parsed = parseNumberLike(rawValue);
    const nextSeconds = Math.max(0, parsed ?? 0);
    const nextRows = draftRows.map((r, idx) => {
        if (idx !== rowIndex) return r;
        const nextRow = { ...r, operator_times: { ...(r.operator_times || {}) } };
        const targetOperatorRef = resolveRowOperatorRef(r, column);
        if (!(nextRow as Record<string, unknown>).original_operator_times) {
          (nextRow as Record<string, unknown>).original_operator_times = {
            ...(r.operator_times || {}),
          };
        }
        if (nextSeconds > 0) {
          nextRow.operator_times![targetOperatorRef] = nextSeconds;
        } else {
          delete nextRow.operator_times![targetOperatorRef];
        }
        const recalculatedTotal = Object.values(nextRow.operator_times || {}).reduce(
          (sum: number, raw) => sum + Math.max(0, parseNumberLike(raw) ?? 0),
          0
        );
        nextRow.total_time_seconds = recalculatedTotal;
        nextRow.allocated_time_seconds = recalculatedTotal;
        nextRow.remaining_time_seconds = Math.max(
          0,
          (parseNumberLike(nextRow.total_time_seconds) ?? 0) - (parseNumberLike(nextRow.allocated_time_seconds) ?? 0)
        );
        const existingAllocations = Array.isArray(r.operator_allocations) ? r.operator_allocations : [];
        const existingAllocationByOperator = new Map<string, Record<string, unknown>>();
        existingAllocations.forEach((item) => {
          const allocation = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
          if (!allocation) return;
          const operatorRef = resolveAllocationOperatorCode(allocation);
          if (!operatorRef) return;
          existingAllocationByOperator.set(normalizeKey(operatorRef), allocation);
        });
        nextRow.operator_allocations = Object.entries(nextRow.operator_times || {}).map(([operatorCode, seconds]) => {
          const normalizedOperator = normalizeKey(operatorCode);
          const existingAllocation = existingAllocationByOperator.get(normalizedOperator);
          const normalizedSeconds = Math.max(0, parseNumberLike(seconds) ?? 0);
          const operatorName = resolveOperatorNameFromCode(operatorCode, operadores);
          if (existingAllocation) {
            return {
              ...existingAllocation,
              time_seconds: normalizedSeconds,
            };
          }
          return {
            operator_id: operatorCode,
            operator_name: operatorName,
            position_number: column.positionNumber,
            position_label: column.positionLabel,
            position_side: column.positionSide,
            time_seconds: normalizedSeconds,
          };
        });
        const existingPositions =
          nextRow.operator_positions && typeof nextRow.operator_positions === "object"
            ? nextRow.operator_positions
            : {};
        const nextPositions: Record<string, any> = { ...existingPositions };
        Object.entries(nextRow.operator_times || {}).forEach(([operatorCode, seconds]) => {
          const operatorName =
            nextPositions[operatorCode]?.operator_name ||
            resolveOperatorNameFromCode(operatorCode, operadores) ||
            column.label;
          nextPositions[operatorCode] = {
            ...(nextPositions[operatorCode] || {}),
            time_seconds: Math.max(0, parseNumberLike(seconds) ?? 0),
            operator_name: operatorName,
            position_number: nextPositions[operatorCode]?.position_number ?? column.positionNumber,
            position_label: nextPositions[operatorCode]?.position_label ?? column.positionLabel,
            position_side: nextPositions[operatorCode]?.position_side ?? column.positionSide,
          };
        });
        nextRow.operator_positions = nextPositions;
        return nextRow;
      });
    setDraftRows(nextRows);
    return nextRows;
  };

  const confirmarEdicao = async (rowsToConfirm: OperationAllocationRow[]) => {
    if (!onConfirmarEdicao || isSaving) return;
    setIsSaving(true);
    try {
      await onConfirmarEdicao(rowsToConfirm);
      setIsEditing(false);
    } catch {
      // Keep edit mode active if confirmation fails.
    } finally {
      setIsSaving(false);
    }
  };

  const startEditFromCell = (
    rowIndex: number,
    columnKey: string,
    value: number | null | undefined
  ) => {
    if (!onConfirmarEdicao || isEditing || isSaving || isAjustando || viewMode !== "tempo") return;
    setDraftRows(structuredClone(baseRows));
    setIsEditing(true);
    setActiveCell({ rowIndex, columnKey });
    setActiveCellValue(value == null ? "" : String(value));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5 flex-wrap">
          {[
            { label: "Operadores", value: String(operatorColumns.length) },
            { label: "Operacoes", value: String(rows.length) },
            { label: "Tempo total", value: formatExact(totalTime) },
          ].map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400">{item.label}</span>
              <span className="text-[11px] font-semibold text-gray-700 font-mono">{item.value}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {onGuardarHistorico ? (
            <Button
              type="button"
              size="sm"
              className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700"
              onClick={async () => {
                await onGuardarHistorico();
              }}
              disabled={isSaving || isAjustando || isGuardandoHistorico}
            >
              {isGuardandoHistorico ? "A guardar..." : "Guardar historico"}
            </Button>
          ) : null}
          {onViewModeChange ? (
            <div className="inline-flex items-center rounded-sm border border-gray-200 bg-white p-0.5">
              <Button
                type="button"
                size="sm"
                variant={viewMode === "tempo" ? "default" : "ghost"}
                onClick={() => onViewModeChange("tempo")}
                className="h-6 px-2 text-[10px]"
              >
                Tempo
              </Button>
              <Button
                type="button"
                size="sm"
                variant={viewMode === "percentagem" ? "default" : "ghost"}
                onClick={() => onViewModeChange("percentagem")}
                className="h-6 px-2 text-[10px]"
              >
                Percentagem
              </Button>
            </div>
          ) : null}
          {onConfirmarEdicao ? (
            isEditing ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => {
                    setDraftRows(baseRows);
                    setIsEditing(false);
                  }}
                  disabled={isSaving || isAjustando}
                >
                  Cancelar
                </Button>
                {(isSaving || isAjustando) && (
                  <span className="text-[10px] text-gray-400 shrink-0">A ajustar...</span>
                )}
              </>
            ) : null
          ) : null}
          {isEditing && !isSaving && !isAjustando ? (
            <span className="text-[10px] text-gray-400 shrink-0">Enter ou clicar fora para confirmar</span>
          ) : null}
        </div>
      </div>

      <div className="border border-gray-200 rounded-sm overflow-x-auto overflow-y-auto bg-white" style={{ maxHeight: "calc(100vh - 290px)", width: "100%" }}>
        <table
          style={{
            width: "max-content",
            tableLayout: "fixed",
            borderCollapse: "collapse",
            minWidth: `max(100%, ${530 + operatorColumns.length * operatorColumnWidth}px)`,
          }}
        >
          <colgroup>
            <col style={{ width: 60 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 220 }} />
            <col style={{ width: 110 }} />
            {operatorColumns.map((column) => (
              <col key={column.key} style={{ width: operatorColumnWidth }} />
            ))}
          </colgroup>

          <thead style={{ position: "sticky", top: 0, zIndex: 30 }}>
            <tr style={{ height: 32 }}>
              <th style={thBase({ textAlign: "center" })}>SEQ</th>
              <th style={thBase()}>Operação</th>
              <th style={thBase()}>Máquina</th>
              <th style={thBase({ textAlign: "center" })}>Total (s)</th>
              {operatorColumns.map((column) => (
                <th key={column.key} style={thBase({ textAlign: "center" })} title={column.label}>
                  <div className="flex flex-col items-center leading-tight">
                    <span className="truncate" style={{ maxWidth: Math.max(44, operatorColumnWidth - 14) }}>
                      {column.code}
                    </span>
                    {column.positionLabel || column.positionSide || column.positionNumber != null ? (
                      <span className="text-[9px] font-normal text-gray-400">
                        {[column.positionSide, column.positionLabel, column.positionNumber != null ? String(column.positionNumber) : ""]
                          .filter(Boolean)
                          .join(" ")}
                      </span>
                    ) : null}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const bg = index % 2 === 0 ? "#ffffff" : "#fafafa";
              const seq = row.seq ?? index + 1;
              const operationLabel = resolveOperationLabel(row, operacoes);
              const machineLabel = row.machine_type || "-";

              return (
                <tr key={`${row.operation_code || row.operation_id || seq}-${index}`} style={{ height: 26 }}>
                  <td style={tdBase(bg, { textAlign: "center", fontFamily: "monospace", fontWeight: 600 })}>{String(seq)}</td>
                  <td style={tdBase(bg, { fontWeight: 600 })} title={operationLabel}>
                    {operationLabel}
                  </td>
                  <td style={tdBase(bg, { color: "#6b7280" })} title={machineLabel}>
                    {machineLabel}
                  </td>
                  <td style={tdBase(bg, { textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: "#2563eb" })}>
                    {formatExact(row.total_time_seconds)}
                  </td>
                  {operatorColumns.map((column) => {
                    const value =
                      viewMode === "percentagem"
                        ? getOperatorPercentage(row, column)
                        : getOperatorTime(row, column);
                    const editable = isEditing && viewMode === "tempo";
                    return (
                      <td
                        key={column.key}
                        style={tdBase(bg, {
                          textAlign: "center",
                          fontFamily: "monospace",
                          fontWeight: 600,
                          color: editable ? "#2563eb" : value == null ? "#d1d5db" : "#2563eb",
                        })}
                        onDoubleClick={() => startEditFromCell(index, column.key, value)}
                      >
                        {editable ? (
                          <input
                            autoFocus={activeCell?.rowIndex === index && activeCell?.columnKey === column.key}
                            type="text"
                            inputMode="decimal"
                            value={
                              activeCell?.rowIndex === index && activeCell?.columnKey === column.key
                                ? activeCellValue
                                : value == null
                                  ? ""
                                  : String(value)
                            }
                            onFocus={() => {
                              setActiveCell({ rowIndex: index, columnKey: column.key });
                              setActiveCellValue(value == null ? "" : String(value));
                            }}
                            onChange={(e) => {
                              setActiveCellValue(e.currentTarget.value.replace(",", "."));
                            }}
                            onBlur={(e) => {
                              const newRows = commitCellValue(index, column, e.currentTarget.value);
                              setActiveCell(null);
                              void confirmarEdicao(newRows);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.currentTarget as HTMLInputElement).blur();
                              }
                            }}
                            className="w-full h-5 text-[11px] px-1 border border-gray-300 rounded-sm text-center font-mono text-gray-900 bg-white"
                          />
                        ) : (
                          formatMetric(value)
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          <tfoot style={{ position: "sticky", bottom: 0, zIndex: 20 }}>
            <tr style={{ height: 30, background: "#f9fafb", borderTop: "2px solid #e5e7eb" }}>
              <td style={tdBase("#f9fafb", { textAlign: "center", color: "#9ca3af", fontSize: 10, fontWeight: 700 })}>S</td>
              <td style={tdBase("#f9fafb", { color: "#6b7280", fontSize: 10, fontWeight: 600 })}>Total</td>
              <td style={tdBase("#f9fafb")} />
              <td style={tdBase("#f9fafb", { textAlign: "center", fontFamily: "monospace", fontWeight: 700, color: "#2563eb" })}>
                {formatExact(totalTime)}
              </td>
              {operatorColumns.map((column) => (
                <td
                  key={column.key}
                  style={tdBase("#f9fafb", {
                    textAlign: "center",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    color: "#2563eb",
                  })}
                >
                  {viewMode === "percentagem"
                    ? formatMetric(totalsByOperatorPercent[column.key] ?? 0)
                    : formatExact(totalsByOperator[column.key] ?? 0)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export function TabelaDistribuicao({
  resultados,
  operadores,
  operacoes,
  viewMode = "tempo",
  onViewModeChange,
  onConfirmarEdicao,
  onGuardarHistorico,
  isAjustando = false,
  isGuardandoHistorico = false,
}: TabelaDistribuicaoProps) {
  return (
    <TabelaAllocacoes
      resultados={resultados}
      operadores={operadores}
      operacoes={operacoes}
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      onConfirmarEdicao={onConfirmarEdicao}
      onGuardarHistorico={onGuardarHistorico}
      isAjustando={isAjustando}
      isGuardandoHistorico={isGuardandoHistorico}
    />
  );
}
