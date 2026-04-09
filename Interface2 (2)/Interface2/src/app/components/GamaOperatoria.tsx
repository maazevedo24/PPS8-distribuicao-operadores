import { Operacao } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Plus, Trash2, ArrowUp, ArrowDown, Package, AlertTriangle } from "lucide-react";
import { Input } from "./ui/input";
import { useState } from "react";
import * as DialogParts from "./ui/dialog";
import { Label } from "./ui/label";
import * as CheckboxParts from "./ui/checkbox";

interface GamaOperatoriaProps {
  operacoes: Operacao[];
  onAddOperacao: (operacao: Operacao) => void;
  onRemoveOperacao: (id: string) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  onToggleCritica?: (id: string) => void;
}

export function GamaOperatoria({
  operacoes,
  onAddOperacao,
  onRemoveOperacao,
  onReorder,
  onToggleCritica,
}: GamaOperatoriaProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [novaOperacao, setNovaOperacao] = useState<Partial<Operacao>>({
    id: "",
    nome: "",
    tempo: 0,
    tipoMaquina: "",
    largura: 190,
    ponto: "",
    setup: "Standard",
    permitirAgrupamento: true,
    sequencia: operacoes.length + 1,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaOperacao.id || !novaOperacao.nome || !novaOperacao.tempo) {
      return;
    }

    onAddOperacao(novaOperacao as Operacao);
    setShowDialog(false);
    setNovaOperacao({
      id: "",
      nome: "",
      tempo: 0,
      tipoMaquina: "",
      largura: 190,
      ponto: "",
      setup: "Standard",
      permitirAgrupamento: true,
      sequencia: operacoes.length + 2,
    });
  };

  return (
    <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="flex items-center justify-between text-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-sm flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-base font-semibold">Gama Operatória</div>
              <CardDescription className="text-gray-500 mt-0.5 text-xs">
                Sequência de operações do processo produtivo
              </CardDescription>
            </div>
          </div>
          <DialogParts.Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogParts.DialogTrigger asChild>
              <Button size="sm" className="bg-blue-500 hover:bg-blue-600 rounded-sm text-xs font-medium">
                <Plus className="w-4 h-4 mr-2" />
                Nova Operação
              </Button>
            </DialogParts.DialogTrigger>
            <DialogParts.DialogContent className="rounded-sm">
              <DialogParts.DialogHeader>
                <DialogParts.DialogTitle className="text-base font-semibold">Adicionar Nova Operação</DialogParts.DialogTitle>
                <DialogParts.DialogDescription className="text-xs">
                  Preencha os dados da nova operação
                </DialogParts.DialogDescription>
              </DialogParts.DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="id" className="text-xs font-medium">ID da Operação</Label>
                  <Input
                    id="id"
                    value={novaOperacao.id}
                    onChange={(e) => setNovaOperacao({ ...novaOperacao, id: e.target.value })}
                    placeholder="ex: OP010"
                    required
                    className="rounded-sm text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="nome" className="text-xs font-medium">Nome</Label>
                  <Input
                    id="nome"
                    value={novaOperacao.nome}
                    onChange={(e) =>
                      setNovaOperacao({ ...novaOperacao, nome: e.target.value })
                    }
                    placeholder="ex: Corte de chapa"
                    required
                    className="rounded-sm text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="tempo" className="text-xs font-medium">Tempo de Execução (min)</Label>
                  <Input
                    id="tempo"
                    type="number"
                    step="0.01"
                    value={novaOperacao.tempo || ""}
                    onChange={(e) =>
                      setNovaOperacao({
                        ...novaOperacao,
                        tempo: Number(e.target.value),
                      })
                    }
                    required
                    className="rounded-sm text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="tipoMaquina" className="text-xs font-medium">Máquina (opcional)</Label>
                  <Input
                    id="tipoMaquina"
                    value={novaOperacao.tipoMaquina}
                    onChange={(e) => setNovaOperacao({ ...novaOperacao, tipoMaquina: e.target.value })}
                    placeholder="ex: Torno CNC"
                    className="rounded-sm text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="largura" className="text-xs font-medium">Largura (mm)</Label>
                    <Input
                      id="largura"
                      type="number"
                      value={novaOperacao.largura || ""}
                      onChange={(e) => setNovaOperacao({ ...novaOperacao, largura: Number(e.target.value) })}
                      placeholder="ex: 190"
                      required
                      className="rounded-sm text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ponto" className="text-xs font-medium">Tipo de Ponto</Label>
                    <Input
                      id="ponto"
                      value={novaOperacao.ponto || ""}
                      onChange={(e) => setNovaOperacao({ ...novaOperacao, ponto: e.target.value })}
                      placeholder="ex: 301"
                      className="rounded-sm text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="setup" className="text-xs font-medium">Setup</Label>
                  <Input
                    id="setup"
                    value={novaOperacao.setup || ""}
                    onChange={(e) => setNovaOperacao({ ...novaOperacao, setup: e.target.value })}
                    placeholder="ex: Standard"
                    className="rounded-sm text-sm"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <CheckboxParts.Checkbox
                    id="permitirAgrupamento"
                    checked={novaOperacao.permitirAgrupamento}
                    onCheckedChange={(checked) => setNovaOperacao({ ...novaOperacao, permitirAgrupamento: !!checked })}
                  />
                  <Label htmlFor="permitirAgrupamento" className="text-xs font-medium cursor-pointer">
                    Permitir agrupamento com máquinas idênticas
                  </Label>
                </div>
                <DialogParts.DialogFooter>
                  <Button type="submit" className="bg-blue-500 hover:bg-blue-600 rounded-sm text-xs">
                    Adicionar
                  </Button>
                </DialogParts.DialogFooter>
              </form>
            </DialogParts.DialogContent>
          </DialogParts.Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-20">Seq.</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-24">Crítica</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Descrição</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Tempo (min)</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Máquina</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Largura</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Ponto</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Setup</th>
                <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase">Agrupar</th>
                <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase w-32">Ações</th>
              </tr>
            </thead>
            <tbody>
              {operacoes.map((operacao, index) => (
                <tr
                  key={operacao.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    operacao.critica ? 'bg-orange-50' : ''
                  }`}
                >
                  <td className="p-3 font-mono text-sm text-gray-700">{operacao.sequencia}</td>
                  <td className="p-3">
                    <button
                      onClick={() => onToggleCritica?.(operacao.id)}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-medium transition-colors ${
                        operacao.critica
                          ? 'bg-orange-200 text-orange-800 border border-orange-300'
                          : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                      }`}
                      title={operacao.critica ? 'Remover marcação crítica' : 'Marcar como crítica'}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {operacao.critica ? 'Sim' : 'Não'}
                    </button>
                  </td>
                  <td className="p-3 font-medium text-sm text-gray-900">{operacao.id}</td>
                  <td className="p-3 text-sm text-gray-700">
                    <div className="flex items-center gap-2">
                      {operacao.nome}
                      {operacao.critica && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-xs font-medium bg-orange-200 text-orange-800 border border-orange-300">
                          CRÍTICA
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-mono text-sm text-gray-700">{operacao.tempo ? operacao.tempo.toFixed(2) : '0.00'}</td>
                  <td className="p-3 text-sm text-gray-600">{operacao.tipoMaquina || "—"}</td>
                  <td className="p-3 text-sm text-gray-600">{operacao.largura ? operacao.largura.toFixed(0) : '0'}</td>
                  <td className="p-3 text-sm text-gray-600">{operacao.ponto || "—"}</td>
                  <td className="p-3 text-sm text-gray-600">{operacao.setup || "—"}</td>
                  <td className="p-3 text-center">
                    <CheckboxParts.Checkbox
                      id={`agrupar-${operacao.id}`}
                      checked={operacao.permitirAgrupamento}
                      onCheckedChange={(checked) => onToggleCritica?.(operacao.id)}
                      className="text-xs"
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReorder(operacao.id, "up")}
                        disabled={index === 0}
                        className="h-7 w-7 p-0 rounded-sm hover:bg-gray-100"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReorder(operacao.id, "down")}
                        disabled={index === operacoes.length - 1}
                        className="h-7 w-7 p-0 rounded-sm hover:bg-gray-100"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveOperacao(operacao.id)}
                        className="h-7 w-7 p-0 rounded-sm hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}