import { useState } from "react";
import { ConfiguracaoLayout, TipoLayout, RestricaoProximidade } from "../types";
import { layoutPadraoEspinha, layoutPadraoLinha } from "../data/mock";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
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
import { 
  Layout, 
  Grid3x3, 
  Move, 
  AlertTriangle, 
  Plus, 
  Trash2,
  Lightbulb,
  Shield,
  Info,
} from "lucide-react";

interface Props {
  layout: ConfiguracaoLayout;
  onLayoutChange: (layout: ConfiguracaoLayout) => void;
}

export function ConfiguracaoLayoutComponent({ layout, onLayoutChange }: Props) {
  const [novaRestricao, setNovaRestricao] = useState<Partial<RestricaoProximidade>>({
    tipoMaquina1: "",
    tipoMaquina2: "",
    distanciaMaxima: 2,
    obrigatoria: false,
    motivo: "",
  });
  const [dialogAberto, setDialogAberto] = useState(false);

  // Tipos de máquina disponíveis
  const tiposMaquinas = [
    "P/P1",
    "P/P2 2 agulhas",
    "P/C N flat lock",
    "P/C 4 presilhas",
  ];

  const handleTipoLayoutChange = (tipo: TipoLayout) => {
    const novoLayout = tipo === "espinha" 
      ? { ...layoutPadraoEspinha }
      : { ...layoutPadraoLinha };
    onLayoutChange(novoLayout);
  };

  const handleDistanciaMaximaChange = (distancia: number) => {
    onLayoutChange({ ...layout, distanciaMaxima: distancia });
  };

  const handlePermitirRetrocessoChange = (permitir: boolean) => {
    onLayoutChange({ ...layout, permitirRetrocesso: permitir });
  };

  const handlePostosPorLadoChange = (postos: number) => {
    onLayoutChange({ ...layout, postosPorLado: postos });
  };

  const handleAdicionarRestricao = () => {
    if (!novaRestricao.tipoMaquina1 || !novaRestricao.tipoMaquina2) {
      alert("Selecione ambos os tipos de máquina");
      return;
    }

    const restricao: RestricaoProximidade = {
      id: `REST${Date.now()}`,
      tipoMaquina1: novaRestricao.tipoMaquina1!,
      tipoMaquina2: novaRestricao.tipoMaquina2!,
      distanciaMaxima: novaRestricao.distanciaMaxima || 2,
      obrigatoria: novaRestricao.obrigatoria || false,
      motivo: novaRestricao.motivo || "",
    };

    onLayoutChange({
      ...layout,
      restricoesProximidade: [
        ...(layout.restricoesProximidade || []),
        restricao,
      ],
    });

    setNovaRestricao({
      tipoMaquina1: "",
      tipoMaquina2: "",
      distanciaMaxima: 2,
      obrigatoria: false,
      motivo: "",
    });
    setDialogAberto(false);
  };

  const handleRemoverRestricao = (id: string) => {
    onLayoutChange({
      ...layout,
      restricoesProximidade: layout.restricoesProximidade?.filter(r => r.id !== id),
    });
  };

  return (
    <div className="space-y-6">
      {/* Tipo de Layout */}
      

      {/* Parâmetros de Mobilidade */}
      

      {/* Restrições de Proximidade */}
      
    </div>
  );
}
