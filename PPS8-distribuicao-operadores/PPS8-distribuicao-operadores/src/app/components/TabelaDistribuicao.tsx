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
  onConfirmarEdicao?: (editedRows: OperationAllocationRow[]) => Promise<void>;
  isAjustando?: boolean;
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

const normalizePercentageValue = (value: number): number =>
  value <= 1 ? value * 100 : value;

const getOperatorPercentage = (
  row: OperationAllocationRow,
  column: OperatorColumn
): number | null => {
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
    const entries = Object.entries(map as Record<string, unknown>);
    const direct = parseNumberLike((map as Record<string, unknown>)[column.code]);
    if (direct != null) return normalizePercentageValue(direct);
    const normalized = entries.find(([candidate]) => normalizeKey(candidate) === column.key);
    if (!normalized) continue;
    const parsed = parseNumberLike(normalized[1]);
    if (parsed != null) return normalizePercentageValue(parsed);
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

  const totalTime = parseNumberLike(row.total_time_seconds) ?? 0;
  if (totalTime > 0) {
    const operatorTime = getOperatorTime(row, column);
    if (operatorTime != null) return (operatorTime / totalTime) * 100;
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
  onConfirmarEdicao,
  isAjustando = false,
}: {
  resultados: ResultadosBalanceamento;
  operadores: any[];
  operacoes: any[];
  viewMode?: "tempo" | "percentagem";
  onConfirmarEdicao?: (editedRows: OperationAllocationRow[]) => Promise<void>;
  isAjustando?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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
                <Button
                  type="button"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  disabled={isSaving || isAjustando}
                  onClick={async () => {
                    try {
                      setIsSaving(true);
                      await onConfirmarEdicao(draftRows);
                      setIsEditing(false);
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  {isSaving || isAjustando ? "A ajustar..." : "Confirmar alteracoes"}
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => {
                  setDraftRows(structuredClone(baseRows));
                  setIsEditing(true);
                }}
                disabled={viewMode !== "tempo" || isAjustando}
              >
                Editar
              </Button>
            )
          ) : null}
          {isEditing ? <span className="text-[10px] text-gray-400 shrink-0">Modo edicao (s)</span> : null}
        </div>
      </div>

      <div className="border border-gray-200 rounded-sm overflow-x-auto overflow-y-auto bg-white" style={{ maxHeight: "calc(100vh - 290px)", width: "100%" }}>
        <table
          style={{
            width: "max-content",
            tableLayout: "fixed",
            borderCollapse: "collapse",
            minWidth: `max(100%, ${530 + operatorColumns.length * 110}px)`,
          }}
        >
          <colgroup>
            <col style={{ width: 60 }} />
            <col style={{ width: 140 }} />
            <col style={{ width: 220 }} />
            <col style={{ width: 110 }} />
            {operatorColumns.map((column) => (
              <col key={column.key} style={{ width: 110 }} />
            ))}
          </colgroup>

          <thead style={{ position: "sticky", top: 0, zIndex: 30 }}>
            <tr style={{ height: 32 }}>
              <th style={thBase({ textAlign: "center" })}>SEQ</th>
              <th style={thBase()}>Operacao</th>
              <th style={thBase()}>Maquina</th>
              <th style={thBase({ textAlign: "center" })}>Total (s)</th>
              {operatorColumns.map((column) => (
                <th key={column.key} style={thBase({ textAlign: "center" })} title={column.label}>
                  <div className="flex flex-col items-center leading-tight">
                    <span className="max-w-[96px] truncate">{column.code}</span>
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
                          color: value == null ? "#d1d5db" : "#2563eb",
                        })}
                      >
                        {editable ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={value == null ? "" : value}
                            onChange={(e) => {
                              const next = parseNumberLike(e.currentTarget.value) ?? 0;
                              setDraftRows((prev) =>
                                prev.map((r, idx) => {
                                  if (idx !== index) return r;
                                  const nextRow = { ...r, operator_times: { ...(r.operator_times || {}) } };
                                  nextRow.operator_times![column.code] = Math.max(0, next);
                                  return nextRow;
                                })
                              );
                            }}
                            className="w-full h-5 text-[11px] px-1 border border-gray-300 rounded-sm text-center font-mono"
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
  onConfirmarEdicao,
  isAjustando = false,
}: TabelaDistribuicaoProps) {
  return (
    <TabelaAllocacoes
      resultados={resultados}
      operadores={operadores}
      operacoes={operacoes}
      viewMode={viewMode}
      onConfirmarEdicao={onConfirmarEdicao}
      isAjustando={isAjustando}
    />
  );
}
