import { Operacao, Operador } from "../types";
import { useState, useCallback, useMemo } from "react";
import { Plus, Trash2, UserCheck } from "lucide-react";
import { Button } from "./ui/button";

interface TabelaOperacoesManualProps {
  operacoes: Operacao[];
  onOperacoesChange: (operacoes: Operacao[]) => void;
  operadores?: Operador[];
  atribuicoes?: { [operacaoId: string]: string[] };
  onAtribuicaoChange?: (operacaoId: string, operadorIds: string[]) => void;
}

type EditingCell =
  | { rowIndex: number; field: keyof Operacao }
  | { rowIndex: number; field: "operador" }
  | null;

const COL_WIDTHS = {
  seq: 50,
  id: 80,
  nome: 240,
  tempo: 90,
  maquina: 130,
  maquina2: 130,
  largura: 75,
  ponto: 75,
  setup: 95,
  operador: 130,
  actions: 56,
};

const FIELDS: Array<keyof Operacao | "operador"> = [
  "sequencia",
  "id",
  "nome",
  "tempo",
  "tipoMaquina",
  "tipoMaquina2",
  "largura",
  "ponto",
  "setup",
  "operador",
];

export function TabelaOperacoesManual({
  operacoes,
  onOperacoesChange,
  atribuicoes = {},
  onAtribuicaoChange,
}: TabelaOperacoesManualProps) {
  const [editing, setEditing] = useState<EditingCell>(null);
  const [localOps, setLocalOps] = useState<Operacao[]>(operacoes);
  // Local free-text operador per operação id
  const [localOps_operador, setLocalOps_operador] = useState<{ [id: string]: string }>(() => {
    const init: { [id: string]: string } = {};
    operacoes.forEach((op) => {
      init[op.id] = (atribuicoes[op.id] || []).join(", ");
    });
    return init;
  });

  // Sincronizar quando props mudam
  useMemo(() => {
    setLocalOps(operacoes);
  }, [operacoes]);

  useMemo(() => {
    setLocalOps_operador((prev) => {
      const next = { ...prev };
      operacoes.forEach((op) => {
        if (!(op.id in next)) {
          next[op.id] = (atribuicoes[op.id] || []).join(", ");
        }
      });
      return next;
    });
  }, [operacoes, atribuicoes]);

  const handleCellChange = useCallback(
    (rowIndex: number, field: keyof Operacao, value: any) => {
      const newOps = [...localOps];
      const op = { ...newOps[rowIndex] };

      if (field === "tempo" || field === "largura") {
        op[field] = parseFloat(value) || 0;
      } else if (field === "sequencia") {
        op[field] = parseInt(value) || rowIndex + 1;
      } else {
        (op as any)[field] = value;
      }

      newOps[rowIndex] = op;
      setLocalOps(newOps);
    },
    [localOps]
  );

  const handleOperadorChange = useCallback(
    (rowIndex: number, value: string) => {
      const op = localOps[rowIndex];
      setLocalOps_operador((prev) => ({ ...prev, [op.id]: value }));
    },
    [localOps]
  );

  const commitOperador = useCallback(
    (rowIndex: number) => {
      const op = localOps[rowIndex];
      const raw = localOps_operador[op.id] || "";
      const ids = raw
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      onAtribuicaoChange && onAtribuicaoChange(op.id, ids);
    },
    [localOps, localOps_operador, onAtribuicaoChange]
  );

  const handleBlur = useCallback(
    (field: keyof Operacao | "operador", rowIndex: number) => {
      setEditing(null);
      if (field === "operador") {
        commitOperador(rowIndex);
      } else {
        onOperacoesChange(localOps);
      }
    },
    [localOps, onOperacoesChange, commitOperador]
  );

  const handleAddRow = useCallback(() => {
    const newOp: Operacao = {
      id: `OP${String(localOps.length + 1).padStart(3, "0")}`,
      nome: "",
      tempo: 0,
      tipoMaquina: "",
      largura: 190,
      ponto: "",
      setup: "Standard",
      permitirAgrupamento: true,
      sequencia: localOps.length + 1,
    };
    const newOps = [...localOps, newOp];
    setLocalOps(newOps);
    setLocalOps_operador((prev) => ({ ...prev, [newOp.id]: "" }));
    onOperacoesChange(newOps);
  }, [localOps, onOperacoesChange]);

  const handleDeleteRow = useCallback(
    (rowIndex: number) => {
      const newOps = localOps.filter((_, i) => i !== rowIndex);
      newOps.forEach((op, i) => {
        op.sequencia = i + 1;
      });
      setLocalOps(newOps);
      onOperacoesChange(newOps);
    },
    [localOps, onOperacoesChange]
  );

  const handleKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      rowIndex: number,
      field: keyof Operacao | "operador"
    ) => {
      if (e.key === "Enter") {
        e.preventDefault();
        setEditing(null);
        if (field === "operador") {
          commitOperador(rowIndex);
        } else {
          onOperacoesChange(localOps);
        }
        if (rowIndex < localOps.length - 1) {
          setTimeout(() => setEditing({ rowIndex: rowIndex + 1, field }), 50);
        } else {
          handleAddRow();
          setTimeout(() => setEditing({ rowIndex: localOps.length, field }), 50);
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        const currentFieldIndex = FIELDS.indexOf(field as any);
        const nextField = FIELDS[currentFieldIndex + 1];
        if (nextField && nextField !== "sequencia") {
          if (field === "operador") commitOperador(rowIndex);
          else onOperacoesChange(localOps);
          setEditing({ rowIndex, field: nextField as any });
        } else if (rowIndex < localOps.length - 1) {
          if (field === "operador") commitOperador(rowIndex);
          else onOperacoesChange(localOps);
          setEditing({ rowIndex: rowIndex + 1, field: "id" });
        }
      } else if (e.key === "Escape") {
        setEditing(null);
      }
    },
    [localOps, onOperacoesChange, handleAddRow, commitOperador]
  );

  const renderCell = useCallback(
    (op: Operacao, rowIndex: number, field: keyof Operacao | "operador") => {
      const isEditing =
        editing?.rowIndex === rowIndex && editing?.field === field;

      // ── Operador column (free text)
      if (field === "operador") {
        const val = localOps_operador[op.id] || "";
        if (isEditing) {
          return (
            <input
              autoFocus
              type="text"
              value={val}
              onChange={(e) => handleOperadorChange(rowIndex, e.target.value)}
              onBlur={() => handleBlur("operador", rowIndex)}
              onKeyDown={(e) => handleKeyDown(e, rowIndex, "operador")}
              className="w-full h-full px-2 py-1 text-xs border-2 border-blue-500 outline-none font-mono bg-white"
              placeholder="ID operador"
            />
          );
        }
        return (
          <span
            className={`block w-full h-full px-2 py-1 text-xs cursor-text font-mono ${
              !val ? "text-gray-300" : "text-gray-800"
            }`}
            onClick={() => setEditing({ rowIndex, field: "operador" })}
          >
            {val || "—"}
          </span>
        );
      }

      // ── Sequência (read-only label)
      if (field === "sequencia") {
        return (
          <span className="text-gray-500 font-mono text-xs px-2 py-1 block">
            {op.sequencia}
          </span>
        );
      }

      // ── All other fields
      const value = op[field as keyof Operacao];
      const displayValue =
        typeof value === "number"
          ? value.toFixed(field === "tempo" ? 2 : 0)
          : (value as string) || "";

      if (isEditing) {
        return (
          <input
            autoFocus
            type={
              field === "tempo" || field === "largura" ? "number" : "text"
            }
            step={field === "tempo" ? "0.01" : "1"}
            value={typeof value === "number" ? value : value || ""}
            onChange={(e) =>
              handleCellChange(rowIndex, field as keyof Operacao, e.target.value)
            }
            onBlur={() => handleBlur(field as keyof Operacao, rowIndex)}
            onKeyDown={(e) =>
              handleKeyDown(e, rowIndex, field as keyof Operacao)
            }
            className="w-full h-full px-2 py-1 text-xs border-2 border-blue-500 outline-none font-mono bg-white"
          />
        );
      }

      return (
        <span
          className={`block w-full h-full px-2 py-1 text-xs cursor-text ${
            field === "tempo" || field === "largura" ? "font-mono" : ""
          } ${!displayValue ? "text-gray-300" : ""}`}
          onClick={() =>
            setEditing({ rowIndex, field: field as keyof Operacao })
          }
        >
          {displayValue || "—"}
        </span>
      );
    },
    [
      editing,
      localOps_operador,
      handleCellChange,
      handleOperadorChange,
      handleBlur,
      handleKeyDown,
    ]
  );

  const totalTempo = localOps.reduce((sum, op) => sum + op.tempo, 0);
  const totalAlocadas = localOps.filter(
    (op) => (localOps_operador[op.id] || "").trim() !== ""
  ).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{localOps.length}</span>{" "}
            operações
          </span>
          <span className="text-xs text-gray-500">
            Tempo total:{" "}
            <span className="font-mono font-semibold text-gray-700">
              {totalTempo.toFixed(2)} min
            </span>
          </span>
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-semibold text-gray-700">{totalAlocadas}</span>
            /{localOps.length} alocadas
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAddRow}
          className="rounded-sm text-xs h-8"
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Adicionar Linha
        </Button>
      </div>

      {/* Tabela */}
      <div
        className="border border-gray-200 rounded-sm overflow-auto bg-white"
        style={{ maxHeight: "calc(100vh - 400px)" }}
      >
        <table
          className="w-full border-collapse"
          style={{
            tableLayout: "fixed",
            minWidth: Object.values(COL_WIDTHS).reduce((a, b) => a + b, 0) + "px",
          }}
        >
          <colgroup>
            <col style={{ width: COL_WIDTHS.seq }} />
            <col style={{ width: COL_WIDTHS.id }} />
            <col style={{ width: COL_WIDTHS.nome }} />
            <col style={{ width: COL_WIDTHS.tempo }} />
            <col style={{ width: COL_WIDTHS.maquina }} />
            <col style={{ width: COL_WIDTHS.maquina2 }} />
            <col style={{ width: COL_WIDTHS.largura }} />
            <col style={{ width: COL_WIDTHS.ponto }} />
            <col style={{ width: COL_WIDTHS.setup }} />
            <col style={{ width: COL_WIDTHS.operador }} />
            <col style={{ width: COL_WIDTHS.actions }} />
          </colgroup>

          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b-2 border-gray-200">
              {[
                "Seq",
                "ID",
                "Operação",
                "Tempo (min)",
                "Máquina",
                "Máquina 2",
                "Largura",
                "Ponto",
                "Setup",
              ].map((h) => (
                <th
                  key={h}
                  className="p-2 text-left text-xs font-semibold text-gray-600 uppercase border-r border-gray-200"
                >
                  {h}
                </th>
              ))}
              <th className="p-2 text-left text-xs font-semibold text-gray-600 uppercase border-r border-gray-200">
                <div className="flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                  Operador
                </div>
              </th>
              <th className="p-2 text-center text-xs font-semibold text-gray-600 uppercase">
                Ações
              </th>
            </tr>
          </thead>

          <tbody>
            {localOps.map((op, rowIndex) => (
              <tr
                key={`${op.id}-${rowIndex}`}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="border-r border-gray-100">
                  {renderCell(op, rowIndex, "sequencia")}
                </td>
                <td className="border-r border-gray-100">
                  {renderCell(op, rowIndex, "id")}
                </td>
                <td className="border-r border-gray-100">
                  {renderCell(op, rowIndex, "nome")}
                </td>
                <td className="border-r border-gray-100">
                  {renderCell(op, rowIndex, "tempo")}
                </td>
                <td className="border-r border-gray-100">
                  {renderCell(op, rowIndex, "tipoMaquina")}
                </td>
                <td className="border-r border-gray-100">
                  {renderCell(op, rowIndex, "tipoMaquina2")}
                </td>
                <td className="border-r border-gray-100">
                  {renderCell(op, rowIndex, "largura")}
                </td>
                <td className="border-r border-gray-100">
                  {renderCell(op, rowIndex, "ponto")}
                </td>
                <td className="border-r border-gray-100">
                  {renderCell(op, rowIndex, "setup")}
                </td>
                <td className="border-r border-gray-100">
                  {renderCell(op, rowIndex, "operador")}
                </td>
                <td className="text-center">
                  <button
                    onClick={() => handleDeleteRow(rowIndex)}
                    className="p-1 hover:bg-red-50 rounded-sm transition-colors group"
                    title="Eliminar linha"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-600" />
                  </button>
                </td>
              </tr>
            ))}

            {localOps.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="p-8 text-center text-sm text-gray-400"
                >
                  Nenhuma operação. Clique em "Adicionar Linha" para começar.
                </td>
              </tr>
            )}
          </tbody>

          {localOps.length > 0 && (
            <tfoot className="sticky bottom-0 bg-gray-50 border-t-2 border-gray-300">
              <tr>
                <td
                  colSpan={3}
                  className="p-2 text-xs font-semibold text-gray-700 uppercase"
                >
                  Total
                </td>
                <td className="p-2 border-l border-gray-200">
                  <span className="text-xs font-mono font-bold text-blue-700">
                    {totalTempo.toFixed(2)} min
                  </span>
                </td>
                <td colSpan={6} className="border-l border-gray-200 p-2">
                  <span className="text-xs text-gray-400">
                    {totalAlocadas} de {localOps.length} com operador
                  </span>
                </td>
                <td className="border-l border-gray-200" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Dica */}
      <div className="text-xs text-gray-400">
        Clique numa célula para editar ·{" "}
        <kbd className="px-1 border border-gray-200 rounded-sm text-[9px] bg-white text-gray-500">
          Enter
        </kbd>{" "}
        próxima linha ·{" "}
        <kbd className="px-1 border border-gray-200 rounded-sm text-[9px] bg-white text-gray-500">
          Tab
        </kbd>{" "}
        próxima coluna ·{" "}
        <kbd className="px-1 border border-gray-200 rounded-sm text-[9px] bg-white text-gray-500">
          Esc
        </kbd>{" "}
        cancelar
      </div>
    </div>
  );
}
