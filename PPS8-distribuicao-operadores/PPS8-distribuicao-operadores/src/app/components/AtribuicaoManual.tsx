import { useState } from "react";
import { Operador, Operacao } from "../types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { UserCheck, AlertTriangle, Trash2, RotateCcw, CheckCircle2, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import axios from "axios";

const API_BASE_URL =
  ((import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL as
    | string
    | undefined) || "http://192.168.54.202:7860/api";

type ApiRecord = Record<string, unknown>;

const normalizeToken = (value: string): string => value.trim().toUpperCase();

const extractCollaboratorsArray = (value: unknown): ApiRecord[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is ApiRecord => Boolean(entry) && typeof entry === "object");
  }

  if (value && typeof value === "object") {
    const record = value as ApiRecord;
    const directCandidate =
      record.collaborators ??
      record.colaboradores ??
      record.operators ??
      record.operadores ??
      record.data;

    if (Array.isArray(directCandidate)) {
      return directCandidate.filter(
        (entry): entry is ApiRecord => Boolean(entry) && typeof entry === "object"
      );
    }

    const nestedArray = Object.values(record).find((entry) => Array.isArray(entry));
    if (Array.isArray(nestedArray)) {
      return nestedArray.filter((entry): entry is ApiRecord => Boolean(entry) && typeof entry === "object");
    }
  }

  return [];
};

const mapCollaboratorToOperador = (raw: ApiRecord, operadoresBase: Operador[]): Operador | null => {
  const idCandidateKeys = [
    "collaborator_id",
    "collaborator_code",
    "operator_id",
    "operator_code",
    "operador_id",
    "operador_code",
    "id",
    "code",
  ];

  let apiId = "";
  for (const key of idCandidateKeys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) {
      apiId = value.trim();
      break;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      apiId = String(value);
      break;
    }
  }
  if (!apiId) return null;

  const nameCandidateKeys = [
    "collaborator_name",
    "operator_name",
    "operador_nome",
    "name",
    "nome",
    "full_name",
  ];
  let apiNome = "";
  for (const key of nameCandidateKeys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) {
      apiNome = value.trim();
      break;
    }
  }

  const matchedBase =
    operadoresBase.find((operador) => normalizeToken(operador.id) === normalizeToken(apiId)) || null;
  if (matchedBase) {
    return {
      ...matchedBase,
      nome: apiNome || matchedBase.nome,
    };
  }

  const oleCandidateKeys = ["ole", "ole_percent", "ole_percentage", "ole_value", "score"];
  let oleHistorico = 0;
  for (const key of oleCandidateKeys) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      oleHistorico = value;
      break;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed)) {
        oleHistorico = parsed;
        break;
      }
    }
  }

  return {
    id: apiId,
    nome: apiNome || undefined,
    oleHistorico,
    competencias: {},
  };
};

interface AtribuicaoManualProps {
  operadores: Operador[];
  operacoes: Operacao[];
  atribuicoesManual: { [operacaoId: string]: string[] };
  onAtribuirManualmente: (operacaoId: string, operadorIds: string[]) => Promise<void>;
  familyId?: string;
}

export function AtribuicaoManual({
  operadores,
  operacoes,
  atribuicoesManual,
  onAtribuirManualmente,
  familyId,
}: AtribuicaoManualProps) {
  const [operacaoEmEdicao, setOperacaoEmEdicao] = useState<string | null>(null);
  const [operadoresSelecionados, setOperadoresSelecionados] = useState<string[]>([]);
  const [operadoresCapazesPorOperacao, setOperadoresCapazesPorOperacao] = useState<
    Record<string, Operador[]>
  >({});
  const [loadingOperadoresCapazes, setLoadingOperadoresCapazes] = useState<Record<string, boolean>>({});
  const [erroOperadoresCapazes, setErroOperadoresCapazes] = useState<Record<string, string | null>>({});
  const [savingAtribuicao, setSavingAtribuicao] = useState(false);
  const [erroAtribuicao, setErroAtribuicao] = useState<string | null>(null);

  const carregarOperadoresCapazes = async (operacao: Operacao) => {
    const operationIds = Array.from(
      new Set([operacao.id?.trim(), String(operacao.sequencia)].filter(Boolean) as string[])
    );
    if (operationIds.length === 0) return;

    setLoadingOperadoresCapazes((prev) => ({ ...prev, [operacao.id]: true }));
    setErroOperadoresCapazes((prev) => ({ ...prev, [operacao.id]: null }));

    let colaboradoresApi: Operador[] | null = null;
    let teveResposta = false;
    let ultimaFalha: unknown = null;

    for (const operationId of operationIds) {
      try {
        const params: Record<string, string | number> = { min_ole: 0 };
        if (familyId) params.family_id = familyId;
        const resposta = await axios.get(
          `${API_BASE_URL}/operations/${encodeURIComponent(operationId)}/collaborators`,
          { params }
        );
        teveResposta = true;

        const colaboradoresRaw = extractCollaboratorsArray(resposta.data);
        const colaboradoresMap = new Map<string, Operador>();

        colaboradoresRaw.forEach((entry) => {
          const mapped = mapCollaboratorToOperador(entry, operadores);
          if (!mapped) return;
          if (!colaboradoresMap.has(mapped.id)) {
            colaboradoresMap.set(mapped.id, mapped);
          }
        });

        colaboradoresApi = Array.from(colaboradoresMap.values());
        break;
      } catch (error) {
        ultimaFalha = error;
      }
    }

    if (teveResposta) {
      setOperadoresCapazesPorOperacao((prev) => ({ ...prev, [operacao.id]: colaboradoresApi || [] }));
      setErroOperadoresCapazes((prev) => ({ ...prev, [operacao.id]: null }));
    } else {
      if (ultimaFalha) {
        setErroOperadoresCapazes((prev) => ({
          ...prev,
          [operacao.id]: "Nao foi possivel carregar operadores capazes da API. A mostrar lista local.",
        }));
      }
      setOperadoresCapazesPorOperacao((prev) => ({ ...prev, [operacao.id]: operadores }));
    }

    setLoadingOperadoresCapazes((prev) => ({ ...prev, [operacao.id]: false }));
  };

  const handleAbrirSelecao = (operacao: Operacao) => {
    setOperacaoEmEdicao(operacao.id);
    setOperadoresSelecionados(atribuicoesManual[operacao.id] || []);
    setErroAtribuicao(null);
    void carregarOperadoresCapazes(operacao);
  };

  const handleToggleOperador = (operadorId: string) => {
    if (savingAtribuicao) return;
    setOperadoresSelecionados((prev) =>
      prev.includes(operadorId)
        ? prev.filter((id) => id !== operadorId)
        : [...prev, operadorId]
    );
  };

  const handleConfirmarSelecao = async () => {
    if (operacaoEmEdicao) {
      setSavingAtribuicao(true);
      setErroAtribuicao(null);
      try {
        await onAtribuirManualmente(operacaoEmEdicao, operadoresSelecionados);
        const operacaoAtual = operacoes.find((item) => item.id === operacaoEmEdicao);
        if (operacaoAtual) {
          await carregarOperadoresCapazes(operacaoAtual);
        }
        setOperacaoEmEdicao(null);
        setOperadoresSelecionados([]);
      } catch (error) {
        console.error("Erro ao confirmar atribuicao manual:", error);
        setErroAtribuicao("Nao foi possivel guardar atribuicoes na API.");
      } finally {
        setSavingAtribuicao(false);
      }
    }
  };

  const handleRemoverAtribuicao = (operacaoId: string) => {
    void onAtribuirManualmente(operacaoId, []);
  };

  const handleLimparTodas = () => {
    void Promise.all(operacoes.map((op) => onAtribuirManualmente(op.id, []))).catch((error) => {
      console.error("Erro ao limpar atribuicoes manuais:", error);
    });
  };

  const handleFecharDialog = () => {
    if (savingAtribuicao) return;
    setOperacaoEmEdicao(null);
    setOperadoresSelecionados([]);
    setErroAtribuicao(null);
  };

  const calcularOcupacaoSimulada = (
    operadorId: string,
    operadoresSelecionadosTemp: string[],
    operacaoAtual: Operacao
  ) => {
    let ocupacaoBase = 0;
    Object.entries(atribuicoesManual).forEach(([opId, operadorIds]) => {
      if (opId !== operacaoAtual.id) {
        const operacao = operacoes.find((o) => o.id === opId);
        if (operacao && operadorIds && operadorIds.length > 0 && operadorIds.includes(operadorId)) {
          ocupacaoBase += operacao.tempo / operadorIds.length;
        }
      }
    });

    if (operadoresSelecionadosTemp.includes(operadorId) && operadoresSelecionadosTemp.length > 0) {
      ocupacaoBase += operacaoAtual.tempo / operadoresSelecionadosTemp.length;
    }

    return (ocupacaoBase / 60) * 100;
  };

  const totalAtribuidas = Object.values(atribuicoesManual).filter((v) => v.length > 0).length;
  const totalOperacoes = operacoes.length;
  const percentagemConcluida = totalOperacoes > 0 ? (totalAtribuidas / totalOperacoes) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-semibold text-gray-900">Progresso de Atribuicao</div>
              <div className="text-xs text-gray-500 mt-1">
                {totalAtribuidas} de {totalOperacoes} operacoes atribuidas
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

          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${percentagemConcluida}%` }}
            ></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-4">
          <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
            <CardHeader className="border-b border-gray-200">
              <CardTitle className="flex items-center gap-3 text-gray-900">
                <div className="w-8 h-8 bg-purple-100 rounded-sm flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-base font-semibold">Atribuicao Manual de Operacoes</div>
                  <CardDescription className="text-gray-500 mt-0.5 text-xs">
                    Selecione um ou mais operadores para cada operacao
                  </CardDescription>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {operacoes.map((operacao) => {
                  const operadoresAtribuidos = atribuicoesManual[operacao.id] || [];
                  const tempoPorOperador =
                    operadoresAtribuidos.length > 0
                      ? operacao.tempo / operadoresAtribuidos.length
                      : operacao.tempo;
                  const operadoresDisponiveis = operadoresCapazesPorOperacao[operacao.id] || operadores;

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
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="font-bold text-sm text-gray-900">{operacao.nome}</div>
                            {operacao.critica && (
                              <Badge variant="destructive" className="text-xs rounded-sm">
                                Critica
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            <div>
                              Maquina: <span className="font-medium">{operacao.tipoMaquina}</span>
                            </div>
                            <div>
                              Tempo Total: <span className="font-mono font-medium">{operacao.tempo} min</span>
                            </div>
                            {operadoresAtribuidos.length > 1 && (
                              <div className="text-blue-600 font-medium">
                                Tempo/Operador: <span className="font-mono">{tempoPorOperador.toFixed(1)} min</span>
                              </div>
                            )}
                            <div>
                              Sequencia: <span className="font-medium">#{operacao.sequencia}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Dialog
                            open={operacaoEmEdicao === operacao.id}
                            onOpenChange={(open) => {
                              if (!open) handleFecharDialog();
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleAbrirSelecao(operacao)}
                                className="gap-2 rounded-sm"
                              >
                                <Users className="w-4 h-4" />
                                {operadoresAtribuidos.length > 0
                                  ? `${operadoresAtribuidos.length} operador${operadoresAtribuidos.length > 1 ? "es" : ""}`
                                  : "Atribuir"}
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl rounded-sm">
                              <DialogHeader>
                                <DialogTitle className="text-gray-900">
                                  Atribuir Operadores - {operacao.nome}
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                  Lista de operadores capazes carregada pela API para esta operacao.
                                </DialogDescription>
                              </DialogHeader>

                              <div className="space-y-4 mt-4">
                                <div className="p-3 bg-gray-50 rounded-sm border border-gray-200">
                                  <div className="text-xs text-gray-600">
                                    <div>
                                      Tempo Total: <span className="font-mono font-bold text-gray-900">{operacao.tempo} min</span>
                                    </div>
                                    {operadoresSelecionados.length > 0 && (
                                      <div className="mt-1 text-blue-600 font-medium">
                                        Tempo por Operador: <span className="font-mono">{(operacao.tempo / operadoresSelecionados.length).toFixed(1)} min</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {loadingOperadoresCapazes[operacao.id] && (
                                  <div className="text-xs text-gray-500">A carregar operadores capazes...</div>
                                )}

                                {erroOperadoresCapazes[operacao.id] && (
                                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-sm text-xs text-amber-700">
                                    {erroOperadoresCapazes[operacao.id]}
                                  </div>
                                )}
                                {erroAtribuicao && (
                                  <div className="p-2 bg-red-50 border border-red-200 rounded-sm text-xs text-red-700">
                                    {erroAtribuicao}
                                  </div>
                                )}

                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                  {operadoresDisponiveis.map((op) => {
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
                                            {op.nome && (
                                              <div className="text-xs text-gray-600">{op.nome}</div>
                                            )}
                                            <div className="text-xs text-gray-500">OLE Historico: {op.oleHistorico}%</div>
                                          </div>

                                          <div className="text-right">
                                            <div
                                              className={`text-xs font-mono font-bold ${
                                                ultrapassaLimite && selecionado
                                                  ? "text-orange-600"
                                                  : ocupacaoSimulada >= 85
                                                  ? "text-amber-600"
                                                  : "text-gray-600"
                                              }`}
                                            >
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

                                {!loadingOperadoresCapazes[operacao.id] && operadoresDisponiveis.length === 0 && (
                                  <div className="text-xs text-gray-500">Sem operadores capazes para esta operacao.</div>
                                )}

                                {operadoresSelecionados.some(
                                  (opId) => calcularOcupacaoSimulada(opId, operadoresSelecionados, operacao) > 100
                                ) && (
                                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-sm flex items-start gap-2">
                                    <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-xs text-orange-700">
                                      <div className="font-bold mb-1">Atencao: Sobrecarga Detetada</div>
                                      <div>Um ou mais operadores ultrapassam 100% de ocupacao com esta atribuicao.</div>
                                    </div>
                                  </div>
                                )}

                                <div className="flex justify-end gap-2 pt-4 border-t">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleFecharDialog}
                                    className="rounded-sm"
                                    disabled={savingAtribuicao}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => void handleConfirmarSelecao()}
                                    disabled={operadoresSelecionados.length === 0 || savingAtribuicao}
                                    className="rounded-sm"
                                  >
                                    {savingAtribuicao ? "A atribuir..." : "Confirmar Atribuicao"}
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

                      {operadoresAtribuidos.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                            <span className="text-xs text-blue-700">Atribuido a:</span>
                            {operadoresAtribuidos.map((opId) => {
                              const operador =
                                operadores.find((o) => o.id === opId) ||
                                (operadoresCapazesPorOperacao[operacao.id] || []).find((o) => o.id === opId);
                              return (
                                <Badge key={opId} variant="secondary" className="rounded-sm text-xs">
                                  {opId}
                                  {operador?.nome ? (
                                    <span className="ml-1 text-gray-600">- {operador.nome}</span>
                                  ) : null}
                                  {operador?.oleHistorico ? (
                                    <span className="ml-1 text-gray-500">(OLE {operador.oleHistorico}%)</span>
                                  ) : null}
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
      </div>
    </div>
  );
}
