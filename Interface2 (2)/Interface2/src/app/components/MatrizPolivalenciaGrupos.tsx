import { Operador, GrupoArtigo } from "../types";
import { Grid3X3 } from "lucide-react";

interface MatrizPolivalenciaGruposProps {
  operadores: Operador[];
  grupos: GrupoArtigo[];
}

export function MatrizPolivalenciaGrupos({ operadores, grupos }: MatrizPolivalenciaGruposProps) {
  const getOleColor = (ole: number) => {
    if (ole >= 85) return "bg-green-100 text-green-800 border-green-200";
    if (ole >= 75) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <div className="bg-white rounded-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-blue-100 rounded-sm flex items-center justify-center">
          <Grid3X3 className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Matriz de Polivalência por Grupos de Artigos
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            OLE% médio de cada operador por grupo de artigo
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase border-r border-gray-200 sticky left-0 bg-gray-50 z-10">
                Operador
              </th>
              <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase border-r border-gray-200">
                OLE%<br/>Histórico
              </th>
              {grupos.map((grupo) => (
                <th
                  key={grupo.id}
                  className="p-3 text-center text-xs font-semibold text-gray-600 uppercase border-r border-gray-200 min-w-[120px]"
                >
                  <div className="truncate" title={grupo.nome}>{grupo.nome}</div>
                  <div className="text-[10px] text-gray-400 font-mono font-normal mt-0.5">
                    {grupo.referencia}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {operadores.map((operador, idx) => (
              <tr
                key={operador.id}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                }`}
              >
                <td className="p-3 font-mono font-semibold text-sm text-gray-900 border-r border-gray-200 sticky left-0 bg-inherit z-10">
                  {operador.id}
                </td>
                <td className="p-3 text-center border-r border-gray-200">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-sm text-xs font-semibold font-mono border ${getOleColor(
                      operador.oleHistorico
                    )}`}
                  >
                    {operador.oleHistorico}%
                  </span>
                </td>
                {grupos.map((grupo) => {
                  const oleGrupo = operador.competenciasPorGrupo?.[grupo.id];
                  return (
                    <td
                      key={grupo.id}
                      className="p-3 text-center border-r border-gray-200"
                    >
                      {oleGrupo !== undefined ? (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-sm text-xs font-semibold font-mono border ${getOleColor(
                            oleGrupo
                          )}`}
                        >
                          {oleGrupo}%
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div className="mt-4 flex items-center gap-6 text-xs">
        <span className="font-semibold text-gray-600">Legenda:</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-green-100 border border-green-200"></div>
          <span className="text-gray-600">≥ 85% (Excelente)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-yellow-100 border border-yellow-200"></div>
          <span className="text-gray-600">75-84% (Bom)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-sm bg-red-100 border border-red-200"></div>
          <span className="text-gray-600">&lt; 75% (A melhorar)</span>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
        <div className="bg-gray-50 p-3 rounded-sm">
          <div className="text-xs text-gray-500 uppercase mb-1">Total Operadores</div>
          <div className="text-lg font-bold text-gray-900">{operadores.length}</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-sm">
          <div className="text-xs text-gray-500 uppercase mb-1">Total Grupos</div>
          <div className="text-lg font-bold text-gray-900">{grupos.length}</div>
        </div>
        <div className="bg-gray-50 p-3 rounded-sm">
          <div className="text-xs text-gray-500 uppercase mb-1">OLE Médio Geral</div>
          <div className="text-lg font-bold text-gray-900">
            {(
              operadores.reduce((sum, op) => sum + op.oleHistorico, 0) /
              operadores.length
            ).toFixed(1)}
            %
          </div>
        </div>
      </div>
    </div>
  );
}
