import { useState } from "react";
import { Operador, Operacao } from "../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { UserCheck, AlertTriangle, Trash2, RotateCcw, CheckCircle2, Users, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

interface AtribuicaoManualProps {
  operadores: Operador[];
  operacoes: Operacao[];
  atribuicoesManual: { [operacaoId: string]: string[] }; // Array de operadores
  onAtribuirManualmente: (operacaoId: string, operadorIds: string[]) => void;
}

export function AtribuicaoManual({
  operadores,
  operacoes,
  atribuicoesManual,
  onAtribuirManualmente,
}: AtribuicaoManualProps) {
  const [operacaoEmEdicao, setOperacaoEmEdicao] = useState<string | null>(null);
  const [operadoresSelecionados, setOperadoresSelecionados] = useState<string[]>([]);

  // Calcular ocupação de cada operador em tempo real
  const calcularOcupacaoOperadores = () => {
    const ocupacoes: { [operadorId: string]: number } = {};
    
    operadores.forEach((op) => {
      ocupacoes[op.id] = 0;
    });

    Object.entries(atribuicoesManual).forEach(([opId, operadorIds]) => {
      const operacao = operacoes.find((o) => o.id === opId);
      if (operacao && operadorIds && operadorIds.length > 0) {
        // Dividir tempo da operação pelo número de operadores
        const tempoPorOperador = operacao.tempo / operadorIds.length;
        operadorIds.forEach((operadorId) => {
          ocupacoes[operadorId] = (ocupacoes[operadorId] || 0) + tempoPorOperador;
        });
      }
    });

    // Converter para percentagem (assumindo 60 min = 100%)
    const ocupacoesPercentagem: { [operadorId: string]: number } = {};
    Object.entries(ocupacoes).forEach(([opId, tempo]) => {
      ocupacoesPercentagem[opId] = (tempo / 60) * 100;
    });

    return ocupacoesPercentagem;
  };

  const ocupacoesOperadores = calcularOcupacaoOperadores();

  const handleAbrirSelecao = (operacaoId: string) => {
    setOperacaoEmEdicao(operacaoId);
    setOperadoresSelecionados(atribuicoesManual[operacaoId] || []);
  };

  const handleToggleOperador = (operadorId: string) => {
    setOperadoresSelecionados((prev) =>
      prev.includes(operadorId)
        ? prev.filter((id) => id !== operadorId)
        : [...prev, operadorId]
    );
  };

  const handleConfirmarSelecao = () => {
    if (operacaoEmEdicao) {
      onAtribuirManualmente(operacaoEmEdicao, operadoresSelecionados);
      setOperacaoEmEdicao(null);
      setOperadoresSelecionados([]);
    }
  };

  const handleRemoverAtribuicao = (operacaoId: string) => {
    onAtribuirManualmente(operacaoId, []);
  };

  const handleLimparTodas = () => {
    operacoes.forEach((op) => {
      onAtribuirManualmente(op.id, []);
    });
  };

  const calcularOcupacaoSimulada = (operadorId: string, operadoresSelecionadosTemp: string[], operacaoAtual: Operacao) => {
    // Ocupação atual sem a operação em edição
    let ocupacaoBase = 0;
    Object.entries(atribuicoesManual).forEach(([opId, operadorIds]) => {
      if (opId !== operacaoAtual.id) {
        const operacao = operacoes.find((o) => o.id === opId);
        if (operacao && operadorIds && operadorIds.length > 0 && operadorIds.includes(operadorId)) {
          ocupacaoBase += operacao.tempo / operadorIds.length;
        }
      }
    });

    // Adicionar operação atual se selecionado
    if (operadoresSelecionadosTemp.includes(operadorId) && operadoresSelecionadosTemp.length > 0) {
      ocupacaoBase += operacaoAtual.tempo / operadoresSelecionadosTemp.length;
    }

    return (ocupacaoBase / 60) * 100;
  };

  const totalAtribuidas = Object.values(atribuicoesManual).filter((v) => v.length > 0).length;
  const totalOperacoes = operacoes.length;
  const percentagemConcluida = totalOperacoes > 0 ? (totalAtribuidas / totalOperacoes) * 100 : 0;

  const getOcupacaoColor = (ocupacao: number) => {
    if (ocupacao >= 100) return "text-orange-600 bg-orange-50 border-orange-200";
    if (ocupacao >= 85) return "text-amber-600 bg-amber-50 border-amber-200";
    if (ocupacao >= 70) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-green-600 bg-green-50 border-green-200";
  };

  const getOcupacaoBadgeVariant = (ocupacao: number): "default" | "secondary" | "destructive" => {
    if (ocupacao >= 100) return "destructive";
    if (ocupacao >= 85) return "default";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      {/* Barra de Progresso e Ações */}
      <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-gray-900">Progresso de Atribuição</div>
              <div className="text-xs text-gray-500 mt-1">
                {totalAtribuidas} de {totalOperacoes} operações atribuídas
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLimparTodas}
              className="gap-2 text-xs rounded-sm"
              disabled={totalAtribuidas === 0}
            >
              <RotateCcw className="w-4 h-4" />
              Limpar Todas
            </Button>
          </div>
          
          {/* Barra de Progresso */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${percentagemConcluida}%` }}
            ></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Lista de Operações */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
            <CardHeader className="border-b border-gray-200">
              <CardTitle className="flex items-center gap-3 text-gray-900">
                <div className="w-8 h-8 bg-purple-100 rounded-sm flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-base font-semibold">Atribuição Manual de Operações</div>
                  <CardDescription className="text-gray-500 mt-0.5 text-xs">
                    Selecione um ou mais operadores para cada operação
                  </CardDescription>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {operacoes.map((operacao) => {
                  const operadoresAtribuidos = atribuicoesManual[operacao.id] || [];
                  const tempoPorOperador = operadoresAtribuidos.length > 0 
                    ? operacao.tempo / operadoresAtribuidos.length 
                    : operacao.tempo;

                  return (
                    <div
                      key={operacao.id}
                      className={`p-4 rounded-sm border-2 transition-all ${
                        operadoresAtribuidos.length > 0
                          ? "bg-blue-50/50 border-blue-200"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Info da Operação */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="font-bold text-sm text-gray-900">{operacao.nome}</div>
                            {operacao.critica && (
                              <Badge variant="destructive" className="text-xs rounded-sm">
                                Crítica
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>Máquina: <span className="font-medium">{operacao.tipoMaquina}</span></div>
                            <div>Tempo Total: <span className="font-mono font-medium">{operacao.tempo} min</span></div>
                            {operadoresAtribuidos.length > 1 && (
                              <div className="text-blue-600 font-medium">
                                Tempo/Operador: <span className="font-mono">{tempoPorOperador.toFixed(1)} min</span>
                              </div>
                            )}
                            <div>Sequência: <span className="font-medium">#{operacao.sequencia}</span></div>
                          </div>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex items-center gap-2">
                          <Dialog
                            open={operacaoEmEdicao === operacao.id}
                            onOpenChange={(open) => {
                              if (!open) {
                                setOperacaoEmEdicao(null);
                                setOperadoresSelecionados([]);
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAbrirSelecao(operacao.id)}
                                className="gap-2 rounded-sm"
                              >
                                <Users className="w-4 h-4" />
                                {operadoresAtribuidos.length > 0 
                                  ? `${operadoresAtribuidos.length} operador${operadoresAtribuidos.length > 1 ? 'es' : ''}`
                                  : 'Atribuir'}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl rounded-sm">
                              <DialogHeader>
                                <DialogTitle className="text-gray-900">
                                  Atribuir Operadores - {operacao.nome}
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                  Selecione um ou mais operadores. O tempo será dividido proporcionalmente.
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4 mt-4">
                                {/* Info da Operação */}
                                <div className="p-3 bg-gray-50 rounded-sm border border-gray-200">
                                  <div className="text-xs text-gray-600">
                                    <div>Tempo Total: <span className="font-mono font-bold text-gray-900">{operacao.tempo} min</span></div>
                                    {operadoresSelecionados.length > 0 && (
                                      <div className="mt-1 text-blue-600 font-medium">
                                        Tempo por Operador: <span className="font-mono">{(operacao.tempo / operadoresSelecionados.length).toFixed(1)} min</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Lista de Operadores */}
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                  {operadores.map((op) => {
                                    const ocupacaoSimulada = calcularOcupacaoSimulada(op.id, operadoresSelecionados, operacao);
                                    const selecionado = operadoresSelecionados.includes(op.id);
                                    const ultrapassaLimite = ocupacaoSimulada > 100;

                                    return (
                                      <div
                                        key={op.id}
                                        className={`p-3 rounded-sm border-2 transition-all cursor-pointer ${
                                          selecionado
                                            ? ultrapassaLimite
                                              ? "bg-orange-50 border-orange-300"
                                              : "bg-blue-50 border-blue-300"
                                            : "bg-white border-gray-200 hover:border-gray-300"
                                        }`}
                                        onClick={() => handleToggleOperador(op.id)}
                                      >
                                        <div className="flex items-center gap-3">
                                          <Checkbox
                                            checked={selecionado}
                                            onCheckedChange={() => handleToggleOperador(op.id)}
                                            className="rounded-sm"
                                          />
                                          
                                          <div className="flex-1">
                                            <div className="font-bold text-sm text-gray-900">{op.id}</div>
                                            <div className="text-xs text-gray-500">
                                              OLE Histórico: {op.oleHistorico}%
                                            </div>
                                          </div>

                                          <div className="text-right">
                                            <div className={`text-xs font-mono font-bold ${
                                              ultrapassaLimite && selecionado
                                                ? "text-orange-600"
                                                : ocupacaoSimulada >= 85
                                                ? "text-amber-600"
                                                : "text-gray-600"
                                            }`}>
                                              {ocupacaoSimulada.toFixed(0)}%
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              {(ocupacaoSimulada * 60 / 100).toFixed(0)} min
                                            </div>
                                          </div>

                                          {ultrapassaLimite && selecionado && (
                                            <AlertTriangle className="w-4 h-4 text-orange-600" />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Aviso de sobrecarga */}
                                {operadoresSelecionados.some(opId => calcularOcupacaoSimulada(opId, operadoresSelecionados, operacao) > 100) && (
                                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-sm flex items-start gap-2">
                                    <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-xs text-orange-700">
                                      <div className="font-bold mb-1">Atenção: Sobrecarga Detectada</div>
                                      <div>Um ou mais operadores ultrapassarão 100% de ocupação com esta atribuição.</div>
                                    </div>
                                  </div>
                                )}

                                {/* Botões */}
                                <div className="flex justify-end gap-2 pt-4 border-t">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setOperacaoEmEdicao(null);
                                      setOperadoresSelecionados([]);
                                    }}
                                    className="rounded-sm"
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={handleConfirmarSelecao}
                                    disabled={operadoresSelecionados.length === 0}
                                    className="rounded-sm"
                                  >
                                    Confirmar Atribuição
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>

                          {operadoresAtribuidos.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoverAtribuicao(operacao.id)}
                              className="text-gray-500 hover:text-orange-600 rounded-sm"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Mostrar operadores atribuídos */}
                      {operadoresAtribuidos.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                            <span className="text-xs text-blue-700">Atribuído a:</span>
                            {operadoresAtribuidos.map((opId) => {
                              const operador = operadores.find((o) => o.id === opId);
                              return (
                                <Badge key={opId} variant="secondary" className="rounded-sm text-xs">
                                  {opId}
                                  {operador?.oleHistorico && (
                                    <span className="ml-1 text-gray-500">(OLE {operador.oleHistorico}%)</span>
                                  )}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita: Painel de Ocupação dos Operadores */}
        <div className="space-y-4">
          <Card className="shadow-sm border border-gray-200 rounded-sm bg-white sticky top-4">
            <CardHeader className="border-b border-gray-200">
              <CardTitle className="text-sm font-semibold text-gray-900">
                Ocupação dos Operadores
              </CardTitle>
              <CardDescription className="text-xs">
                Carga de trabalho em tempo real
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {operadores.map((operador) => {
                  const ocupacao = ocupacoesOperadores[operador.id] || 0;
                  const operacoesAtribuidas = Object.entries(atribuicoesManual).filter(
                    ([_, opIds]) => opIds.includes(operador.id)
                  ).length;

                  return (
                    <div
                      key={operador.id}
                      className={`p-3 rounded-sm border-2 ${getOcupacaoColor(ocupacao)}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-sm">{operador.id}</div>
                        <Badge
                          variant={getOcupacaoBadgeVariant(ocupacao)}
                          className="font-mono text-xs rounded-sm"
                        >
                          {ocupacao.toFixed(0)}%
                        </Badge>
                      </div>

                      {/* Barra de Ocupação */}
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-2">
                        <div
                          className={`h-full transition-all duration-300 ${
                            ocupacao >= 100
                              ? "bg-orange-500"
                              : ocupacao >= 85
                              ? "bg-amber-500"
                              : ocupacao >= 70
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${Math.min(ocupacao, 100)}%` }}
                        ></div>
                      </div>

                      <div className="text-xs text-gray-600">
                        <div>{operacoesAtribuidas} operações atribuídas</div>
                        <div className="font-mono">Tempo: {(ocupacao * 60 / 100).toFixed(1)} min</div>
                        <div className="font-mono">OLE Histórico: {operador.oleHistorico}%</div>
                      </div>

                      {ocupacao >= 100 && (
                        <div className="mt-2 pt-2 border-t border-orange-300 flex items-center gap-1 text-orange-700 text-xs">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="font-medium">Sobrecarregado</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
