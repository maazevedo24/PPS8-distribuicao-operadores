import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Factory, Layout, Grid3x3, Move, AlertTriangle, Plus, Trash2, Lightbulb, Shield } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

export interface LayoutConfig {
  tipoLayout: "linha" | "espinha";
  postosPorLado: number;
  distanciaMaxima: number;
  permitirRetrocesso: boolean;
  permitirCruzamento: boolean;
  restricoes: any[];
}

interface LayoutConfiguradorProps {
  operacoes: any[];
  onLayoutChange?: (config: LayoutConfig) => void;
}

export function LayoutConfigurador({ operacoes, onLayoutChange }: LayoutConfiguradorProps) {
  const [tipoLayout, setTipoLayout] = useState<"linha" | "espinha">("espinha");
  const [postosPorLado, setPostosPorLado] = useState(8);
  const [distanciaMaxima, setDistanciaMaxima] = useState(3);
  const [permitirRetrocesso, setPermitirRetrocesso] = useState(false);
  const [permitirCruzamento, setPermitirCruzamento] = useState(true);
  const [restricoes, setRestricoes] = useState<any[]>([]);
  const [dialogRestricaoAberto, setDialogRestricaoAberto] = useState(false);
  const [novaRestricao, setNovaRestricao] = useState<any>({
    tipoMaquina1: "",
    tipoMaquina2: "",
    distanciaMaxima: 2,
    obrigatoria: false,
    motivo: "",
  });

  const tiposMaquinas = Array.from(new Set(operacoes.map(op => op.tipoMaquina || "Geral")));

  // Propagar mudanças de layout para o componente pai
  useEffect(() => {
    onLayoutChange?.({
      tipoLayout,
      postosPorLado,
      distanciaMaxima,
      permitirRetrocesso,
      permitirCruzamento,
      restricoes,
    });
  }, [tipoLayout, postosPorLado, distanciaMaxima, permitirRetrocesso, permitirCruzamento, restricoes]);

  return (
    <div className="sticky top-[52px] z-30 bg-gray-50 pb-3 pt-3">
      <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
        <CardHeader className="border-b border-gray-200 py-2">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <div className="w-6 h-6 bg-purple-100 rounded-sm flex items-center justify-center">
              <Factory className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-semibold">Configuração de Layout</div>
              <p className="text-[10px] text-gray-500 font-normal mt-0.5">Disposição física e restrições da linha de produção</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-[auto_1fr_1fr] gap-3">
            {/* Tipo de Layout */}
            <div>
              <Label className="text-[10px] font-semibold text-gray-700 mb-1.5 block">
                <Layout className="w-3 h-3 inline mr-1" />
                Layout
              </Label>
              <div className="flex flex-col gap-1.5 w-[72px]">
                <button
                  onClick={() => setTipoLayout("linha")}
                  className={`p-1.5 border-2 rounded-sm transition-all ${
                    tipoLayout === "linha"
                      ? "border-blue-700 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Grid3x3 className={`w-3.5 h-3.5 ${tipoLayout === "linha" ? "text-blue-700" : "text-gray-400"}`} />
                    <span className={`text-[9px] font-medium ${tipoLayout === "linha" ? "text-blue-700" : "text-gray-600"}`}>
                      Linha
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => setTipoLayout("espinha")}
                  className={`p-1.5 border-2 rounded-sm transition-all ${
                    tipoLayout === "espinha"
                      ? "border-blue-700 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <Layout className={`w-3.5 h-3.5 ${tipoLayout === "espinha" ? "text-blue-700" : "text-gray-400"}`} />
                    <span className={`text-[9px] font-medium ${tipoLayout === "espinha" ? "text-blue-700" : "text-gray-600"}`}>
                      Espinha
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Mobilidade de Operadores */}
            <div className="p-2 bg-blue-50 rounded-sm border border-blue-200">
              <div className="flex items-center gap-1 mb-2">
                <Move className="w-3 h-3 text-blue-700" />
                <span className="text-[10px] font-semibold text-gray-900">Mobilidade</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <Label htmlFor="lc-postos" className="text-[9px] text-gray-700">Postos</Label>
                  <Input
                    id="lc-postos"
                    type="number"
                    min={4}
                    max={16}
                    value={postosPorLado}
                    onChange={(e) => setPostosPorLado(Number(e.target.value))}
                    className="rounded-sm mt-0.5 h-7 text-[10px]"
                  />
                </div>
                <div>
                  <Label htmlFor="lc-distancia" className="text-[9px] text-gray-700">Distância</Label>
                  <Input
                    id="lc-distancia"
                    type="number"
                    min={1}
                    max={8}
                    value={distanciaMaxima}
                    onChange={(e) => setDistanciaMaxima(Number(e.target.value))}
                    className="rounded-sm mt-0.5 h-7 text-[10px]"
                  />
                </div>
                <div>
                  <Label className="text-[9px] text-gray-700 mb-0.5 block">Retroceder</Label>
                  <div className="flex items-center gap-1 h-7">
                    <Switch checked={permitirRetrocesso} onCheckedChange={setPermitirRetrocesso} />
                  </div>
                </div>
              </div>
              {tipoLayout === "espinha" && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <div className="flex items-center justify-between">
                    <Label className="text-[9px] text-gray-700">Permitir Cruzamento (A ↔ B)</Label>
                    <Switch checked={permitirCruzamento} onCheckedChange={setPermitirCruzamento} />
                  </div>
                  <p className="text-[8px] text-gray-500 mt-1">Operadores podem mudar de lado do corredor</p>
                </div>
              )}
            </div>

            {/* Restrições de Proximidade */}
            <div className="p-2 bg-amber-50 rounded-sm border border-amber-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-700" />
                  <span className="text-[10px] font-semibold text-gray-900">Restrições</span>
                </div>
                <Dialog open={dialogRestricaoAberto} onOpenChange={setDialogRestricaoAberto}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-blue-700 hover:bg-blue-800 text-[9px] h-6 px-2">
                      <Plus className="w-3 h-3 mr-0.5" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-sm">
                    <DialogHeader>
                      <DialogTitle>Adicionar Restrição de Proximidade</DialogTitle>
                      <DialogDescription>Defina uma regra ou sugestão de proximidade entre tipos de máquinas</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Tipo de Máquina 1</Label>
                        <Select value={novaRestricao.tipoMaquina1} onValueChange={(value) => setNovaRestricao({ ...novaRestricao, tipoMaquina1: value })}>
                          <SelectTrigger className="rounded-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent className="rounded-sm">
                            {tiposMaquinas.map((tipo) => (<SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo de Máquina 2</Label>
                        <Select value={novaRestricao.tipoMaquina2} onValueChange={(value) => setNovaRestricao({ ...novaRestricao, tipoMaquina2: value })}>
                          <SelectTrigger className="rounded-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent className="rounded-sm">
                            {tiposMaquinas.map((tipo) => (<SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lc-distanciaRestricao">Distância Máxima (postos)</Label>
                        <Input id="lc-distanciaRestricao" type="number" min={1} max={8} value={novaRestricao.distanciaMaxima} onChange={(e) => setNovaRestricao({ ...novaRestricao, distanciaMaxima: Number(e.target.value) })} className="rounded-sm" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lc-motivo">Motivo/Razão</Label>
                        <Input id="lc-motivo" value={novaRestricao.motivo} onChange={(e) => setNovaRestricao({ ...novaRestricao, motivo: e.target.value })} placeholder="Ex: transferência de material pesado" className="rounded-sm" />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-sm border border-gray-200">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-gray-600" />
                          <span className="text-sm text-gray-700">Restrição Obrigatória</span>
                        </div>
                        <Switch checked={novaRestricao.obrigatoria} onCheckedChange={(checked) => setNovaRestricao({ ...novaRestricao, obrigatoria: checked })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogRestricaoAberto(false)} className="rounded-sm">Cancelar</Button>
                      <Button
                        onClick={() => {
                          if (!novaRestricao.tipoMaquina1 || !novaRestricao.tipoMaquina2) {
                            alert("Selecione ambos os tipos de máquina");
                            return;
                          }
                          const restricao = {
                            id: `REST${Date.now()}`,
                            tipoMaquina1: novaRestricao.tipoMaquina1,
                            tipoMaquina2: novaRestricao.tipoMaquina2,
                            distanciaMaxima: novaRestricao.distanciaMaxima || 2,
                            obrigatoria: novaRestricao.obrigatoria || false,
                            motivo: novaRestricao.motivo || "",
                          };
                          setRestricoes([...restricoes, restricao]);
                          setNovaRestricao({ tipoMaquina1: "", tipoMaquina2: "", distanciaMaxima: 2, obrigatoria: false, motivo: "" });
                          setDialogRestricaoAberto(false);
                        }}
                        className="bg-blue-700 hover:bg-blue-800 rounded-sm"
                      >
                        Adicionar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {restricoes.length === 0 ? (
                <div className="text-center py-2 text-gray-500">
                  <p className="text-[9px]">Nenhuma restrição configurada</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {restricoes.map((restricao) => (
                    <div key={restricao.id} className="flex items-center justify-between p-1.5 bg-white rounded-sm border border-gray-200">
                      <div className="flex-1">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Badge className={restricao.obrigatoria ? "bg-amber-100 text-amber-800 border border-amber-200 text-[9px] px-1 py-0" : "bg-blue-100 text-blue-800 border border-blue-200 text-[9px] px-1 py-0"}>
                            {restricao.obrigatoria ? (<><Shield className="w-2 h-2 mr-0.5" />Obrig.</>) : (<><Lightbulb className="w-2 h-2 mr-0.5" />Sugest.</>)}
                          </Badge>
                          <span className="text-[9px] font-semibold text-gray-900">{restricao.tipoMaquina1} ↔ {restricao.tipoMaquina2}</span>
                        </div>
                        <div className="text-[9px] text-gray-600">
                          {restricao.distanciaMaxima}p
                          {restricao.motivo && <span className="italic ml-1">"{restricao.motivo}"</span>}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setRestricoes(restricoes.filter(r => r.id !== restricao.id))} className="text-gray-600 hover:text-gray-700 hover:bg-gray-100 h-6 w-6 p-0">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}