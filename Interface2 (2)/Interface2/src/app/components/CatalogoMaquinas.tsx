import { useState } from "react";
import { Maquina } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Switch } from "./ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Plus, Trash2, Pencil, Cog, Check, X, Factory } from "lucide-react";
import { Textarea } from "./ui/textarea";

interface CatalogoMaquinasProps {
  maquinas: Maquina[];
  onAddMaquina: (maquina: Maquina) => void;
  onEditMaquina: (id: string, maquina: Partial<Maquina>) => void;
  onRemoveMaquina: (id: string) => void;
}

export function CatalogoMaquinas({
  maquinas,
  onAddMaquina,
  onEditMaquina,
  onRemoveMaquina,
}: CatalogoMaquinasProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [maquinaEditando, setMaquinaEditando] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Maquina>>({
    tipo: "",
    fabricante: "",
    modelo: "",
    largura: 190,
    ponto: "301",
    setup: "Standard",
    permitirAgrupamento: true,
    quantidade: 1,
    ativa: true,
    operacoesCompativeis: [],
    observacoes: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.tipo || !formData.largura || !formData.setup) {
      return;
    }

    if (maquinaEditando) {
      // Editar máquina existente
      onEditMaquina(maquinaEditando, formData);
      setMaquinaEditando(null);
    } else {
      // Adicionar nova máquina
      const novaMaquina: Maquina = {
        id: `MAQ${String(maquinas.length + 1).padStart(3, "0")}`,
        tipo: formData.tipo!,
        fabricante: formData.fabricante,
        modelo: formData.modelo,
        largura: formData.largura!,
        ponto: formData.ponto,
        setup: formData.setup!,
        permitirAgrupamento: formData.permitirAgrupamento ?? true,
        quantidade: formData.quantidade ?? 1,
        operacoesCompativeis: formData.operacoesCompativeis ?? [],
        ativa: formData.ativa ?? true,
        observacoes: formData.observacoes,
      };
      onAddMaquina(novaMaquina);
    }

    setShowDialog(false);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      tipo: "",
      fabricante: "",
      modelo: "",
      largura: 190,
      ponto: "301",
      setup: "Standard",
      permitirAgrupamento: true,
      quantidade: 1,
      ativa: true,
      operacoesCompativeis: [],
      observacoes: "",
    });
  };

  const handleEdit = (maquina: Maquina) => {
    setFormData(maquina);
    setMaquinaEditando(maquina.id);
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setMaquinaEditando(null);
    resetForm();
  };

  const totalMaquinas = maquinas.reduce((sum, m) => sum + m.quantidade, 0);
  const maquinasAtivas = maquinas.filter((m) => m.ativa).length;

  // Gerar ID único baseado em especificações completas
  const getConfigKey = (m: Maquina) =>
    `${m.tipo}_${m.largura}mm_${m.ponto || "n/a"}_${m.setup}`;

  return (
    <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="flex items-center justify-between text-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-sm flex items-center justify-center">
              <Factory className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-base font-semibold">Catálogo de Máquinas</div>
              <CardDescription className="text-gray-500 mt-0.5 text-xs">
                Configuração completa de máquinas disponíveis
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-sm text-xs">
              {totalMaquinas} máquinas ({maquinasAtivas} configurações ativas)
            </Badge>
            <Dialog open={showDialog} onOpenChange={handleCloseDialog}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 rounded-sm text-xs font-medium"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Máquina
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-sm max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-base font-semibold">
                    {maquinaEditando ? "Editar Máquina" : "Adicionar Nova Máquina"}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Preencha todas as especificações da máquina
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="tipo" className="text-xs font-medium">
                        Tipo de Máquina <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="tipo"
                        value={formData.tipo}
                        onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                        placeholder="ex: P/P1, P/C N flat lock"
                        required
                        className="rounded-sm text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="largura" className="text-xs font-medium">
                        Largura (mm) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="largura"
                        type="number"
                        value={formData.largura}
                        onChange={(e) =>
                          setFormData({ ...formData, largura: Number(e.target.value) })
                        }
                        placeholder="ex: 190"
                        required
                        className="rounded-sm text-sm mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="ponto" className="text-xs font-medium">
                        Tipo de Ponto
                      </Label>
                      <Input
                        id="ponto"
                        value={formData.ponto}
                        onChange={(e) => setFormData({ ...formData, ponto: e.target.value })}
                        placeholder="ex: 301, 401, 605"
                        className="rounded-sm text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="setup" className="text-xs font-medium">
                        Setup <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="setup"
                        value={formData.setup}
                        onChange={(e) => setFormData({ ...formData, setup: e.target.value })}
                        placeholder="ex: Standard, Presilhas"
                        required
                        className="rounded-sm text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quantidade" className="text-xs font-medium">
                        Quantidade
                      </Label>
                      <Input
                        id="quantidade"
                        type="number"
                        min={0}
                        value={formData.quantidade}
                        onChange={(e) =>
                          setFormData({ ...formData, quantidade: Number(e.target.value) })
                        }
                        className="rounded-sm text-sm mt-1"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="fabricante" className="text-xs font-medium">
                        Fabricante
                      </Label>
                      <Input
                        id="fabricante"
                        value={formData.fabricante}
                        onChange={(e) =>
                          setFormData({ ...formData, fabricante: e.target.value })
                        }
                        placeholder="ex: Juki, Pegasus"
                        className="rounded-sm text-sm mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="modelo" className="text-xs font-medium">
                        Modelo
                      </Label>
                      <Input
                        id="modelo"
                        value={formData.modelo}
                        onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
                        placeholder="ex: DDL-8700"
                        className="rounded-sm text-sm mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="observacoes" className="text-xs font-medium">
                      Observações
                    </Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) =>
                        setFormData({ ...formData, observacoes: e.target.value })
                      }
                      placeholder="Notas adicionais sobre a máquina..."
                      className="rounded-sm text-sm mt-1 min-h-[60px]"
                    />
                  </div>

                  <div className="flex items-center space-x-8 pt-2 border-t border-gray-200">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="permitirAgrupamento"
                        checked={formData.permitirAgrupamento}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, permitirAgrupamento: checked })
                        }
                      />
                      <Label htmlFor="permitirAgrupamento" className="text-xs font-medium cursor-pointer">
                        Permitir agrupamento com máquinas idênticas
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="ativa"
                        checked={formData.ativa}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, ativa: checked })
                        }
                      />
                      <Label htmlFor="ativa" className="text-xs font-medium cursor-pointer">
                        Máquina ativa
                      </Label>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCloseDialog}
                      className="rounded-sm text-xs"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      className="bg-blue-500 hover:bg-blue-600 rounded-sm text-xs"
                    >
                      {maquinaEditando ? "Guardar Alterações" : "Adicionar Máquina"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Tipo</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Fabricante/Modelo</th>
                <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase">Largura</th>
                <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase">Ponto</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">Setup</th>
                <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase">Agrupar</th>
                <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase">Qtd.</th>
                <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase">Estado</th>
                <th className="p-3 text-center text-xs font-semibold text-gray-600 uppercase w-32">Ações</th>
              </tr>
            </thead>
            <tbody>
              {maquinas.map((maquina) => (
                <tr
                  key={maquina.id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    !maquina.ativa ? "opacity-50 bg-gray-50" : ""
                  }`}
                >
                  <td className="p-3 font-mono text-xs text-gray-700">{maquina.id}</td>
                  <td className="p-3">
                    <div className="text-sm font-medium text-gray-900">{maquina.tipo}</div>
                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                      {getConfigKey(maquina)}
                    </div>
                  </td>
                  <td className="p-3">
                    {maquina.fabricante || maquina.modelo ? (
                      <div className="text-xs">
                        <div className="font-medium text-gray-700">{maquina.fabricante || "—"}</div>
                        <div className="text-gray-500">{maquina.modelo || "—"}</div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant="secondary" className="rounded-sm text-[10px] font-mono">
                      {maquina.largura}mm
                    </Badge>
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant="outline" className="rounded-sm text-[10px] font-mono">
                      {maquina.ponto || "—"}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={maquina.setup === "Standard" ? "secondary" : "default"}
                      className={`rounded-sm text-[10px] ${
                        maquina.setup === "Standard"
                          ? "bg-gray-100 text-gray-700"
                          : "bg-blue-100 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {maquina.setup}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">
                    {maquina.permitirAgrupamento ? (
                      <Check className="w-4 h-4 text-green-600 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-gray-400 mx-auto" />
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <span className="font-mono text-sm font-semibold text-gray-900">
                      {maquina.quantidade}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <Badge
                      variant={maquina.ativa ? "default" : "secondary"}
                      className={`rounded-sm text-[10px] ${
                        maquina.ativa
                          ? "bg-green-100 text-green-700 border border-green-200"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {maquina.ativa ? "Ativa" : "Inativa"}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(maquina)}
                        className="h-7 w-7 p-0 rounded-sm hover:bg-blue-50 hover:text-blue-600"
                        title="Editar máquina"
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveMaquina(maquina.id)}
                        className="h-7 w-7 p-0 rounded-sm hover:bg-red-50 hover:text-red-600"
                        title="Remover máquina"
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

        {maquinas.length === 0 && (
          <div className="p-12 text-center">
            <Cog className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              Nenhuma máquina cadastrada. Adicione a primeira máquina.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
