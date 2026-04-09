import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X, Check } from "lucide-react";

interface OperadorOption {
  id: string;
  ole: number;
  podeOperar: boolean;
}

interface OperadorSelectorProps {
  operadores: OperadorOption[];
  atribuidos: string[];
  onToggle: (operadorId: string) => void;
}

export function OperadorSelector({ operadores, atribuidos, onToggle }: OperadorSelectorProps) {
  const [aberto, setAberto] = useState(false);
  const [pesquisa, setPesquisa] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
        setPesquisa("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [aberto]);

  const aptos = operadores.filter((o) => o.podeOperar);
  const filtrados = aptos.filter((o) =>
    o.id.toLowerCase().includes(pesquisa.toLowerCase())
  );

  const getOleColor = (ole: number) => {
    if (ole >= 90) return "bg-green-100 text-green-700 border-green-300";
    if (ole >= 80) return "bg-yellow-100 text-yellow-700 border-yellow-300";
    if (ole >= 70) return "bg-orange-100 text-orange-700 border-orange-300";
    return "bg-gray-100 text-gray-600 border-gray-300";
  };

  const getOleDot = (ole: number) => {
    if (ole >= 90) return "bg-green-500";
    if (ole >= 80) return "bg-yellow-500";
    if (ole >= 70) return "bg-orange-500";
    return "bg-gray-400";
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={(e) => { e.stopPropagation(); setAberto(!aberto); }}
        className="flex items-center gap-2 w-full min-w-[140px] text-left"
      >
        {atribuidos.length > 0 ? (
          <div className="flex items-center gap-1 flex-wrap">
            {atribuidos.map((id) => {
              const op = aptos.find((o) => o.id === id);
              return (
                <span
                  key={id}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[11px] font-medium border ${
                    op ? getOleColor(op.ole) : "bg-gray-100 text-gray-600 border-gray-300"
                  }`}
                >
                  {id}
                  <span className="text-[9px] font-mono opacity-75">{op?.ole ?? "?"}%</span>
                  <X
                    className="w-2.5 h-2.5 opacity-50 hover:opacity-100 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onToggle(id); }}
                  />
                </span>
              );
            })}
            <ChevronDown className="w-3 h-3 text-gray-400 ml-1 flex-shrink-0" />
          </div>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-gray-400 italic">
            Selecionar operadores
            <ChevronDown className="w-3 h-3" />
          </span>
        )}
      </button>

      {/* Dropdown */}
      {aberto && (
        <div className="absolute z-50 mt-1 left-0 w-56 bg-white border border-gray-200 rounded-sm shadow-lg">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-sm px-2 py-1">
              <Search className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={pesquisa}
                onChange={(e) => setPesquisa(e.target.value)}
                placeholder="Pesquisar operador..."
                className="bg-transparent text-xs text-gray-700 outline-none w-full placeholder:text-gray-400"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filtrados.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400 italic text-center">
                Nenhum operador encontrado
              </div>
            ) : (
              filtrados.map((op) => {
                const isAtribuido = atribuidos.includes(op.id);
                return (
                  <button
                    key={op.id}
                    onClick={(e) => { e.stopPropagation(); onToggle(op.id); }}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors ${
                      isAtribuido
                        ? "bg-blue-50 hover:bg-blue-100"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                      isAtribuido ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white"
                    }`}>
                      {isAtribuido && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className={`font-medium ${isAtribuido ? "text-gray-900" : "text-gray-700"}`}>
                      {op.id}
                    </span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${getOleDot(op.ole)}`} />
                      <span className="font-mono text-[10px] text-gray-500">{op.ole}%</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {aptos.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-1.5 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">
                {atribuidos.length}/{aptos.length} selecionados
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
