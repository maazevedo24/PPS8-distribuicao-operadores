import { ResultadosBalanceamento, DistribuicaoCarga } from "../types";
import { useState, useCallback, useMemo } from "react";
import { Undo2, RotateCcw, Lock, LockOpen, CheckCheck } from "lucide-react";

interface TabelaDistribuicaoProps {
  resultados: ResultadosBalanceamento;
  operadores: any[];
  operacoes: any[];
  onDistribuicaoChange?: (novaDistribuicao: DistribuicaoCarga[]) => void;
  unidadeTempo?: "min" | "s";
}

type CellMatrix = { [opId: string]: { [operadorId: string]: string } };

const W_GRP  = 38;
const W_SEQ  = 40;
const W_MAQ  = 116;
const W_NOM  = 220;
const W_OCUP = 68;
const FIXED  = W_GRP + W_SEQ + W_MAQ + W_NOM + W_OCUP;

const L_SEQ  = W_GRP;
const L_MAQ  = W_GRP + W_SEQ;
const L_NOM  = W_GRP + W_SEQ + W_MAQ;
const L_OCUP = W_GRP + W_SEQ + W_MAQ + W_NOM;

const ROW_H  = 26;
const HDR_H  = 32;

const normalizeKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getShortOperatorCode = (raw: string): string => {
  const text = String(raw || "").trim();
  if (!text) return "";
  const inParens = text.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (inParens) return inParens;
  const codeToken = text.match(/\b[A-Za-z]{1,}\d+\b/)?.[0];
  if (codeToken) return codeToken;
  return text;
};

// Estilo base de cÃ©lula do cabeÃ§alho
const thStyle = (left?: number, extra?: React.CSSProperties): React.CSSProperties => ({
  position: left !== undefined ? "sticky" : undefined,
  left,
  zIndex: left !== undefined ? 31 : undefined,
  background: "#ffffff",
  color: "#374151",
  fontSize: 11,
  fontWeight: 600,
  textAlign: "left" as const,
  paddingLeft: 10,
  borderBottom: "2px solid #e5e7eb",
  borderRight: "1px solid #f3f4f6",
  whiteSpace: "nowrap" as const,
  ...extra,
});

// Estilo base de cÃ©lula do corpo
const tdBase = (bg: string, left?: number): React.CSSProperties => ({
  position: left !== undefined ? "sticky" : undefined,
  left,
  zIndex: left !== undefined ? 10 : undefined,
  background: bg,
  fontSize: 11,
  color: "#111827",
  borderBottom: "1px solid #f3f4f6",
  borderRight: "1px solid #f3f4f6",
  padding: "0 10px",
  overflow: "hidden",
  whiteSpace: "nowrap" as const,
  textOverflow: "ellipsis",
});

export function TabelaDistribuicao({
  resultados,
  operadores,
  operacoes,
  onDistribuicaoChange,
  unidadeTempo = "min",
}: TabelaDistribuicaoProps) {

  const grupoMap = useMemo(() => {
    const tipos = Array.from(
      new Set(operacoes.map((op: any) => op.tipoMaquina || "Geral"))
    ).sort() as string[];
    const map: Record<string, string> = {};
    tipos.forEach((t, i) => { map[t] = String.fromCharCode(65 + i); });
    return map;
  }, [operacoes]);

  const opIds = useMemo(
    () => resultados.distribuicao.map((d) => d.operadorId),
    [resultados.distribuicao]
  );

  const opsOrdenadas = useMemo(
    () => [...operacoes].sort((a: any, b: any) => a.sequencia - b.sequencia),
    [operacoes]
  );

  const unidadeTempoLabel = unidadeTempo === "s" ? "s" : "min";
  const toDisplayTempo = useCallback(
    (tempoMinutos: number) => (unidadeTempo === "s" ? tempoMinutos * 60 : tempoMinutos),
    [unidadeTempo]
  );
  const toInternalTempo = useCallback(
    (tempoDisplay: number) => (unidadeTempo === "s" ? tempoDisplay / 60 : tempoDisplay),
    [unidadeTempo]
  );
  const formatTempo = useCallback(
    (tempoDisplay: number) => (unidadeTempo === "s" ? tempoDisplay.toFixed(0) : tempoDisplay.toFixed(2)),
    [unidadeTempo]
  );

  const buildCells = useCallback((): CellMatrix => {
    const m: CellMatrix = {};
    const operadoresPorOperacao: Record<string, number> = {};
    operacoes.forEach((op: any) => {
      operadoresPorOperacao[op.id] = opIds.reduce((count, oid) => {
        const d = resultados.distribuicao.find((dist) => dist.operadorId === oid);
        return d?.operacoes.includes(op.id) ? count + 1 : count;
      }, 0);
    });

    operacoes.forEach((op: any) => {
      m[op.id] = {};
      opIds.forEach((oid) => {
        const d = resultados.distribuicao.find((d) => d.operadorId === oid);
        const tempoDiretoMin = d?.temposOperacoes?.[op.id];
        if (typeof tempoDiretoMin === "number" && Number.isFinite(tempoDiretoMin) && tempoDiretoMin > 0) {
          m[op.id][oid] = String(toDisplayTempo(tempoDiretoMin));
          return;
        }

        if (!d?.operacoes.includes(op.id)) {
          m[op.id][oid] = "";
          return;
        }

        const qtdOperadores = Math.max(1, operadoresPorOperacao[op.id] || 1);
        const tempoDivididoMin = op.tempo / qtdOperadores;
        m[op.id][oid] = String(toDisplayTempo(tempoDivididoMin));
      });
    });
    return m;
  }, [operacoes, opIds, resultados.distribuicao, toDisplayTempo]);

  const [cells, setCells]     = useState<CellMatrix>(buildCells);
  const [hist, setHist]       = useState<CellMatrix[]>([]);
  const [editing, setEditing] = useState<{ opId: string; oid: string } | null>(null);
  const [activeRow, setActiveRow] = useState<string | null>(null);
  const [lockedRows, setLockedRows] = useState<Set<string>>(new Set());

  const toggleLock = (opId: string) => {
    setLockedRows(prev => {
      const next = new Set(prev);
      if (next.has(opId)) next.delete(opId);
      else next.add(opId);
      return next;
    });
  };

  const notify = useCallback((m: CellMatrix) => {
    const dist: DistribuicaoCarga[] = opIds.map((oid) => {
      const ops = operacoes
        .filter((op: any) => { const v = parseFloat(m[op.id]?.[oid] || ""); return !isNaN(v) && v > 0; })
        .map((op: any) => op.id);
      const carga = ops.reduce((s: number, opId: string) => {
        const op = operacoes.find((o: any) => o.id === opId);
        const valorDisplay = op ? (parseFloat(m[op.id]?.[oid] || "0") || 0) : 0;
        return s + toInternalTempo(valorDisplay);
      }, 0);
      const ex = resultados.distribuicao.find((d) => d.operadorId === oid);
      return { operadorId: oid, operacoes: ops, cargaHoraria: carga, ocupacao: ex?.ocupacao || 0, ciclosPorHora: carga > 0 ? 60 / carga : 0 };
    });
    onDistribuicaoChange?.(dist);
  }, [opIds, operacoes, resultados.distribuicao, onDistribuicaoChange, toInternalTempo]);

  const changeCell = (opId: string, oid: string, raw: string) => {
    const val = raw.replace(",", ".").replace(/[^0-9.]/g, "");
    setHist((h) => [...h.slice(-29), cells]);
    const next = { ...cells, [opId]: { ...cells[opId], [oid]: val } };
    setCells(next);
    notify(next);
  };

  const undo = () => {
    if (!hist.length) return;
    const prev = hist[hist.length - 1];
    setHist((h) => h.slice(0, -1));
    setCells(prev);
    notify(prev);
  };

  const reset = () => {
    const init = buildCells();
    setCells(init);
    setHist([]);
    notify(init);
  };

  const rowOk = (op: any) => {
    const sum = opIds.reduce((s, oid) => {
      const v = parseFloat(cells[op.id]?.[oid] || "");
      return s + (isNaN(v) ? 0 : v);
    }, 0);
    const opTempoDisplay = toDisplayTempo(op.tempo);
    const tolerancia = unidadeTempo === "s" ? 0.5 : 0.005;
    return Math.abs(sum - opTempoDisplay) < tolerancia;
  };

  const colTotals = useMemo(() => {
    const t: Record<string, number> = {};
    opIds.forEach((oid) => {
      t[oid] = opsOrdenadas.reduce((s: number, op: any) => {
        const v = parseFloat(cells[op.id]?.[oid] || "");
        return s + (isNaN(v) ? 0 : v);
      }, 0);
    });
    return t;
  }, [cells, opIds, opsOrdenadas]);

  const totalOcup = opsOrdenadas.reduce((s: number, op: any) => s + op.tempo, 0);
  const totalOcupDisplay =
    typeof resultados.ocupacaoTotal === "number" && Number.isFinite(resultados.ocupacaoTotal)
      ? (unidadeTempo === "s" ? resultados.ocupacaoTotal : resultados.ocupacaoTotal / 60)
      : toDisplayTempo(totalOcup);
  const balancedCnt = opsOrdenadas.filter(rowOk).length;

  const resolveDisplayOperatorCode = (id: string): string => {
    const idKey = normalizeKey(id);
    const idDigits = (id.match(/\d+/g) || []).join("");
    const byId = operadores.find((op: any) => normalizeKey(String(op?.id || "")) === idKey);
    if (byId?.id) return String(byId.id);

    const byNome = operadores.find((op: any) => normalizeKey(String(op?.nome || "")) === idKey);
    if (byNome?.id) return String(byNome.id);

    const byNomeParcial = operadores.find((op: any) => {
      const nomeKey = normalizeKey(String(op?.nome || ""));
      if (!nomeKey) return false;
      return nomeKey.includes(idKey) || idKey.includes(nomeKey);
    });
    if (byNomeParcial?.id) return String(byNomeParcial.id);

    const shortFromRaw = getShortOperatorCode(id);
    const shortKey = normalizeKey(shortFromRaw);
    const byShort = operadores.find((op: any) => normalizeKey(String(op?.id || "")) === shortKey);
    if (byShort?.id) return String(byShort.id);

    if (idDigits) {
      const byDigits = operadores.find((op: any) => {
        const opDigits = (String(op?.id || "").match(/\d+/g) || []).join("");
        return Boolean(opDigits) && (opDigits === idDigits || opDigits.endsWith(idDigits) || idDigits.endsWith(opDigits));
      });
      if (byDigits?.id) return String(byDigits.id);
    }

    return shortFromRaw || id;
  };

  return (
    <div className="flex flex-col gap-3">

      {/* â”€â”€ Toolbar â”€â”€ */}
      <div className="flex items-center justify-between gap-4">
        {/* MÃ©tricas */}
        <div className="flex items-center gap-5">
          {[
            { label: "Operadores",  value: String(resultados.numeroOperadores) },
            { label: "Operacoes",   value: String(opsOrdenadas.length) },
            { label: "Balanceadas", value: `${balancedCnt} / ${opsOrdenadas.length}` },
            { label: "OCUP total",  value: `${formatTempo(totalOcupDisplay)} ${unidadeTempoLabel}` },
            { label: "Takt",        value: `${formatTempo(toDisplayTempo(resultados.taktTime))} ${unidadeTempoLabel}` },
            { label: "Ciclo",       value: `${formatTempo(toDisplayTempo(resultados.tempoCiclo))} ${unidadeTempoLabel}` },
          ].map((k, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400">{k.label}</span>
              <span className="text-[11px] font-semibold text-gray-700 font-mono">{k.value}</span>
            </div>
          ))}
        </div>

        {/* AcÃ§Ãµes */}
        <div className="flex items-center gap-2 shrink-0">
          {hist.length > 0 && (
            <>
              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-sm">
                EDITADO
              </span>
              <button onClick={undo} className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-sm transition-colors">
                <Undo2 className="w-3 h-3" /> Desfazer
              </button>
              <button onClick={reset} className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-white border border-gray-300 hover:bg-gray-50 text-gray-600 rounded-sm transition-colors">
                <RotateCcw className="w-3 h-3" /> Repor
              </button>
            </>
          )}
        </div>
      </div>

      {/* â”€â”€ Tabela â”€â”€ */}
      <div
        className="border border-gray-200 rounded-sm overflow-x-auto overflow-y-auto bg-white"
        style={{ maxHeight: "calc(100vh - 290px)", width: "100%" }}
      >
        <table
          style={{
            width: "max-content",
            tableLayout: "fixed",
            borderCollapse: "collapse",
            minWidth: `max(100%, ${FIXED + opIds.length * 76}px)`,
          }}
        >
          <colgroup>
            <col style={{ width: W_GRP }} />
            <col style={{ width: W_SEQ }} />
            <col style={{ width: W_MAQ }} />
            <col style={{ width: W_NOM }} />
            <col style={{ width: W_OCUP }} />
            {opIds.map((id) => <col key={id} style={{ width: 76 }} />)}
          </colgroup>

          {/* â”€â”€ CabeÃ§alho â”€â”€ */}
          <thead style={{ position: "sticky", top: 0, zIndex: 30 }}>
            <tr style={{ height: HDR_H }}>
              {/* Grupo */}
              <th style={thStyle(0, { textAlign: "center", paddingLeft: 0, fontSize: 10, color: "#9ca3af" })}>Grupo</th>
              {/* SEQ */}
              <th style={thStyle(L_SEQ, { textAlign: "center", paddingLeft: 0 })}>SEQ</th>
              {/* Maquina */}
              <th style={thStyle(L_MAQ)}>Maquina</th>
              {/* Operacao */}
              <th style={thStyle(L_NOM)}>Operacao</th>
              {/* OCUP */}
              <th style={thStyle(L_OCUP, { textAlign: "center", paddingLeft: 0, color: "#2563eb", borderRight: "2px solid #e5e7eb" })}>
                OCUP ({unidadeTempoLabel})
              </th>
              {/* Operadores */}
              {opIds.map((oid) => {
                const displayCode = resolveDisplayOperatorCode(oid);
                return (
                <th
                  key={oid}
                  style={{
                    background: "#ffffff",
                    color: "#374151",
                    fontSize: 11,
                    fontWeight: 600,
                    textAlign: "center",
                    borderBottom: "2px solid #e5e7eb",
                    borderRight: "1px solid #f3f4f6",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span title={displayCode} className="cursor-help inline-block max-w-[72px] truncate align-middle">
                    {displayCode}
                  </span>
                </th>
                );
              })}
            </tr>

            {/* Subtotais */}
            <tr style={{ height: 24, background: "#f9fafb" }}>
              <td style={{ position: "sticky", left: 0, zIndex: 11, background: "#f9fafb", borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #f3f4f6" }} />
              <td style={{ position: "sticky", left: L_SEQ, zIndex: 11, background: "#f9fafb", borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #f3f4f6" }} />
              <td style={{ position: "sticky", left: L_MAQ, zIndex: 11, background: "#f9fafb", borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #f3f4f6" }} />
              <td style={{ position: "sticky", left: L_NOM, zIndex: 11, background: "#f9fafb", color: "#9ca3af", fontSize: 10, textAlign: "right", paddingRight: 10, borderBottom: "1px solid #e5e7eb", borderRight: "1px solid #f3f4f6" }}>
                subtotal {"->"}
              </td>
              <td style={{ position: "sticky", left: L_OCUP, zIndex: 11, background: "#eff6ff", color: "#2563eb", fontSize: 11, fontWeight: 700, fontFamily: "monospace", textAlign: "center", borderBottom: "1px solid #e5e7eb", borderRight: "2px solid #e5e7eb" }}>
                {formatTempo(totalOcupDisplay)}
              </td>
              {opIds.map((oid) => {
                const t = colTotals[oid];
                return (
                  <td
                    key={oid}
                    style={{
                      background: "#f9fafb",
                      color: t > 0 ? "#2563eb" : "#d1d5db",
                      fontSize: 11,
                      fontWeight: t > 0 ? 700 : 400,
                      fontFamily: "monospace",
                      textAlign: "center",
                      borderBottom: "1px solid #e5e7eb",
                      borderRight: "1px solid #f3f4f6",
                    }}
                  >
                    {t > 0 ? formatTempo(t) : "-"}
                  </td>
                );
              })}
            </tr>
          </thead>

          {/* â”€â”€ Corpo â”€â”€ */}
          <tbody>
            {opsOrdenadas.map((op: any, ri: number) => {
              const letra    = grupoMap[op.tipoMaquina || "Geral"] || "?";
              const ok       = rowOk(op);
              const isActive = activeRow === op.id;
              const isLocked = ok && !lockedRows.has(op.id) ? true : lockedRows.has(op.id) && ok;
              // Auto-lock when balanced; user can click lock to unlock manually
              const locked   = ok && !lockedRows.has(op.id);
              const rowBg    = isActive ? "#eff6ff" : ri % 2 === 0 ? "#ffffff" : "#fafafa";

              return (
                <tr
                  key={op.id}
                  style={{ height: ROW_H, cursor: "default" }}
                  onClick={() => !locked && setActiveRow(activeRow === op.id ? null : op.id)}
                >
                  {/* GRP */}
                  <td style={{ ...tdBase(isActive ? "#eff6ff" : "#fff", 0), textAlign: "center", padding: 0, overflow: "visible", textOverflow: "clip", color: "#9ca3af", fontWeight: 600 }}>
                    <span style={{ display: "inline-block", minWidth: 18, fontSize: 10, fontWeight: 700, color: "#94a3b8", background: "#f1f5f9", borderRadius: 2, textAlign: "center", padding: "1px 3px" }}>
                      {letra}
                    </span>
                  </td>

                  {/* SEQ */}
                  <td style={{ ...tdBase(rowBg, L_SEQ), textAlign: "center", color: "#9ca3af", fontSize: 11 }}>
                    {op.sequencia}
                  </td>

                  {/* Maquina */}
                  <td style={{ ...tdBase(rowBg, L_MAQ), color: "#6b7280" }} title={op.tipoMaquina}>
                    {op.tipoMaquina}
                  </td>

                  {/* Operacao */}
                  <td style={{ ...tdBase(rowBg, L_NOM), fontWeight: isActive ? 600 : 400 }} title={op.nome}>
                    {op.nome}
                  </td>

                  {/* OCUP - mostra check + botao de desbloqueio quando balanceado */}
                  <td
                    style={{
                      ...tdBase(ok ? "#f0fdf4" : "#eff6ff", L_OCUP),
                      textAlign: "center",
                      fontFamily: "monospace",
                      fontWeight: 700,
                      color: ok ? "#16a34a" : "#2563eb",
                      borderRight: "2px solid #e5e7eb",
                      padding: 0,
                    }}
                  >
                    {(() => {
                      // Soma dos tempos de todos os colaboradores nesta linha
                      const rowSum = opIds.reduce((s, oid) => {
                        const v = parseFloat(cells[op.id]?.[oid] || "");
                        return s + (isNaN(v) ? 0 : v);
                      }, 0);
                      const rowSumInternal = toInternalTempo(rowSum);
                      return ok ? (
                        <button
                          title={locked ? "Concluido - clique para editar" : "Bloquear linha"}
                          onClick={(e) => { e.stopPropagation(); toggleLock(op.id); }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            width: "100%",
                            height: ROW_H,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#16a34a",
                            fontSize: 11,
                            fontFamily: "monospace",
                            fontWeight: 700,
                          }}
                        >
                          <CheckCheck style={{ width: 11, height: 11, strokeWidth: 2.5 }} />
                          {formatTempo(rowSum)}
                          {locked
                            ? <Lock style={{ width: 9, height: 9, opacity: 0.6 }} />
                            : <LockOpen style={{ width: 9, height: 9, opacity: 0.4 }} />
                          }
                        </button>
                      ) : (
                        <span style={{ display: "block", lineHeight: `${ROW_H}px` }}>
                          {formatTempo(rowSum)}
                        </span>
                      );
                    })()}
                  </td>

                  {/* CÃ©lulas editÃ¡veis */}
                  {opIds.map((oid) => {
                    const val    = cells[op.id]?.[oid] ?? "";
                    const hasVal = val !== "" && parseFloat(val) > 0;
                    const isEd   = !locked && editing?.opId === op.id && editing?.oid === oid;
                    const cellBg = hasVal ? (ok ? "#f0fdf4" : "#eff6ff") : rowBg;

                    return (
                      <td
                        key={oid}
                        style={{
                          background: cellBg,
                          borderBottom: "1px solid #f3f4f6",
                          borderRight: "1px solid #f3f4f6",
                          textAlign: "center",
                          padding: 0,
                          cursor: locked ? "default" : "text",
                          opacity: locked ? 0.7 : 1,
                        }}
                        onClick={(e) => {
                          if (locked) return;
                          e.stopPropagation();
                          setEditing({ opId: op.id, oid });
                        }}
                      >
                        {isEd ? (
                          <input
                            autoFocus
                            style={{
                              width: "100%",
                              height: ROW_H,
                              display: "block",
                              border: "none",
                              outline: "2px solid #3b82f6",
                              outlineOffset: -2,
                              textAlign: "center",
                              fontSize: 11,
                              fontFamily: "monospace",
                              fontWeight: 600,
                              background: "#fff",
                              color: "#1e3a5f",
                            }}
                            value={val}
                            onChange={(e) => changeCell(op.id, oid, e.target.value)}
                            onBlur={() => setEditing(null)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Escape") setEditing(null);
                              if (e.key === "Tab") {
                                e.preventDefault();
                                const idx  = opIds.indexOf(oid);
                                const next = opIds[idx + 1];
                                setEditing(next ? { opId: op.id, oid: next } : null);
                              }
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              display: "block",
                              fontSize: 11,
                              fontFamily: "monospace",
                              fontWeight: hasVal ? 600 : 400,
                              color: ok && hasVal ? "#16a34a" : hasVal ? "#2563eb" : "transparent",
                              userSelect: "none",
                            }}
                          >
                            {hasVal ? formatTempo(parseFloat(val)) : "."}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {/* â”€â”€ RodapÃ© â”€â”€ */}
          <tfoot style={{ position: "sticky", bottom: 0, zIndex: 20 }}>
            <tr style={{ height: 30, background: "#f9fafb", borderTop: "2px solid #e5e7eb" }}>
              <td style={{ position: "sticky", left: 0, zIndex: 21, background: "#f9fafb", borderRight: "1px solid #e5e7eb", textAlign: "center", color: "#9ca3af", fontSize: 10, fontWeight: 700 }}>S</td>
              <td style={{ position: "sticky", left: L_SEQ, zIndex: 21, background: "#f9fafb", borderRight: "1px solid #e5e7eb" }} />
              <td style={{ position: "sticky", left: L_MAQ, zIndex: 21, background: "#f9fafb", borderRight: "1px solid #e5e7eb", color: "#6b7280", fontSize: 10, fontWeight: 600, paddingLeft: 10 }}>Total</td>
              <td style={{ position: "sticky", left: L_NOM, zIndex: 21, background: "#f9fafb", borderRight: "1px solid #e5e7eb" }} />
              <td style={{ position: "sticky", left: L_OCUP, zIndex: 21, background: "#eff6ff", color: "#2563eb", fontSize: 11, fontWeight: 700, fontFamily: "monospace", textAlign: "center", borderRight: "2px solid #e5e7eb" }}>
                {formatTempo(totalOcupDisplay)}
              </td>
              {opIds.map((oid) => {
                const t = colTotals[oid];
                return (
                  <td
                    key={oid}
                    style={{
                      background: "#f9fafb",
                      color: t > 0 ? "#111827" : "#d1d5db",
                      fontSize: 11,
                      fontWeight: t > 0 ? 700 : 400,
                      fontFamily: "monospace",
                      textAlign: "center",
                      borderRight: "1px solid #e5e7eb",
                    }}
                  >
                    {t > 0 ? formatTempo(t) : "-"}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* â”€â”€ RodapÃ© info â”€â”€ */}
      <div className="flex items-center justify-between gap-4">
        {/* Legenda grupos */}
        <div className="flex items-center gap-4 flex-wrap">
          {Object.entries(grupoMap).map(([tipo, letra]) => (
            <div key={tipo} className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-gray-100 text-gray-500 text-[8px] font-bold">
                {letra}
              </span>
              <span className="text-[10px] text-gray-500">{tipo}</span>
            </div>
          ))}
        </div>
        {/* Dica */}
        <span className="text-[10px] text-gray-400 shrink-0">
          Clique para selecionar linha - Clique numa celula para editar -{" "}
          <kbd className="px-1 border border-gray-200 rounded-sm text-[9px] bg-white text-gray-500">Tab</kbd> avanca -{" "}
          verde = balanceado
        </span>
      </div>
    </div>
  );
}

