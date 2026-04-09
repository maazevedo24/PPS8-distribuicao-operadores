import { Operador } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import { Info, Users } from "lucide-react";
import { Button } from "./ui/button";

interface MatrizPolivalenciaProps {
  operadores: Operador[];
  operacoes: string[];
  operadoresSelecionados: string[];
  onToggleOperador: (id: string) => void;
}

export function MatrizPolivalencia({
  operadores,
  operacoes,
  operadoresSelecionados,
  onToggleOperador,
}: MatrizPolivalenciaProps) {
  // Determinar as colunas de polivalência baseadas nos operadores
  const posicoesPolivalencia = ["POL_1", "POL_2", "POL_3", "POL_4", "POL_5", "POL_6", "POL_7", "POL_8"];
  
  return (
    <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="flex items-center justify-between text-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-teal-100 rounded-sm flex items-center justify-center">
              <Users className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <div className="text-base font-semibold">Matriz de Polivalência</div>
              <CardDescription className="text-gray-500 mt-0.5 text-xs">
                Competências técnicas de cada operador
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" className="text-xs rounded-sm">
            Download Report
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase sticky left-0 bg-gray-50 z-10">
                  Operador
                </th>
                <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                  OLE %
                </th>
                {posicoesPolivalencia.map((pol) => (
                  <th key={pol} className="p-3 text-center text-xs font-semibold text-gray-600 uppercase whitespace-nowrap">
                    {pol}
                  </th>
                ))}
                <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase">Ativo</th>
              </tr>
            </thead>
            <tbody>
              {operadores.map((operador) => {
                const isSelected = operadoresSelecionados.includes(operador.id);
                return (
                  <tr
                    key={operador.id}
                    className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                      isSelected ? "bg-blue-50/30" : "bg-white"
                    }`}
                  >
                    <td className="p-3 font-medium text-gray-900 text-sm sticky left-0 bg-inherit z-10">
                      {operador.id}
                    </td>
                    <td className="p-3 text-center">
                      <Badge 
                        variant={operador.oleHistorico >= 90 ? "default" : "secondary"} 
                        className="font-mono font-semibold text-xs rounded-sm"
                      >
                        {operador.oleHistorico}%
                      </Badge>
                    </td>
                    {posicoesPolivalencia.map((pol) => {
                      const operacao = operador.competencias[pol];
                      return (
                        <td key={pol} className="p-3 text-center">
                          {operacao ? (
                            <div className="inline-flex items-center justify-center px-3 py-2 min-w-[120px] font-medium text-xs rounded-sm bg-teal-500 text-white">
                              {operacao}
                            </div>
                          ) : (
                            <div className="inline-flex items-center justify-center w-10 h-10 rounded-sm bg-gray-100 text-gray-400">
                              —
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-3 text-center">
                      <Switch
                        checked={isSelected}
                        onCheckedChange={() => onToggleOperador(operador.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="m-6 p-5 bg-gray-50 rounded-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Info className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-gray-900 text-xs uppercase tracking-wide">Informação</span>
          </div>
          <div className="text-xs text-gray-600 space-y-1">
            <p>• Cada posição (POL_1, POL_2, etc.) representa uma competência operacional específica</p>
            <p>• O OLE% indica a eficiência histórica do operador</p>
            <p>• Use o switch "Ativo" para incluir/excluir operadores do balanceamento</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}