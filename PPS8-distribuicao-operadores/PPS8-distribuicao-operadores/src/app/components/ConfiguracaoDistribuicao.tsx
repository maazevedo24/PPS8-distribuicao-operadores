import { useEffect, useState } from "react";
import { ConfiguracaoDistribuicao } from "../types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Calculator, Edit3 } from "lucide-react";

interface ConfiguracaoDistribuicaoProps {
  config: ConfiguracaoDistribuicao;
  onChange: (config: ConfiguracaoDistribuicao) => void;
  numeroOperadoresDisponiveis: number;
  operacoes: any[];
  onCalcularOperadoresNecessarios?: (quantidade: number) => void;
}

export function ConfiguracaoDistribuicaoComponent({
  config,
  onChange,
  numeroOperadoresDisponiveis,
  operacoes,
  onCalcularOperadoresNecessarios,
}: ConfiguracaoDistribuicaoProps) {
  const [naoDividirMaiorInput, setNaoDividirMaiorInput] = useState(String(config.naoDividirMaiorQue));
  const [naoDividirMenorInput, setNaoDividirMenorInput] = useState(String(config.naoDividirMenorQue));

  useEffect(() => {
    setNaoDividirMaiorInput(String(config.naoDividirMaiorQue));
  }, [config.naoDividirMaiorQue]);

  useEffect(() => {
    setNaoDividirMenorInput(String(config.naoDividirMenorQue));
  }, [config.naoDividirMenorQue]);

  const parseDecimalInput = (raw: string): number | null => {
    const normalized = raw.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const commitNaoDividirMaior = () => {
    const parsed = parseDecimalInput(naoDividirMaiorInput);
    const next = parsed == null ? config.naoDividirMaiorQue : Math.max(1.01, Math.min(10, parsed));
    onChange({ ...config, naoDividirMaiorQue: next });
    setNaoDividirMaiorInput(String(next));
  };

  const commitNaoDividirMenor = () => {
    const parsed = parseDecimalInput(naoDividirMenorInput);
    const next = parsed == null ? config.naoDividirMenorQue : Math.min(0.99, Math.max(0, parsed));
    onChange({ ...config, naoDividirMenorQue: next });
    setNaoDividirMenorInput(String(next));
  };

  return (
    <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="flex items-center gap-3 text-gray-900">
          <div className="w-8 h-8 bg-purple-100 rounded-sm flex items-center justify-center">
            <Calculator className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-base font-semibold">Configuracao de Distribuicao</div>
            <CardDescription className="text-gray-500 mt-0.5 text-xs">
              Criterios para o balanceamento da linha de producao
            </CardDescription>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Metodo de Distribuicao
          </Label>
          <RadioGroup
            value={config.possibilidade.toString()}
            onValueChange={(value) =>
              onChange({ ...config, possibilidade: Number(value) as 1 | 2 | 3 | 4 })
            }
          >
            <div
              className="flex items-start space-x-3 p-4 border border-gray-200 rounded-sm hover:border-blue-300 transition-colors cursor-pointer"
              onClick={() => onChange({ ...config, possibilidade: 1 })}
            >
              <RadioGroupItem value="1" id="r1" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="r1" className="font-medium cursor-pointer text-gray-900 text-sm">
                  Distribuicao Ideal (Automatica)
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Calcula automaticamente o balanceamento mais eficiente com base nas horas do turno e produtividade estimada
                </p>
              </div>
            </div>

            <div
              className="flex items-start space-x-3 p-4 border border-gray-200 rounded-sm hover:border-blue-300 transition-colors cursor-pointer"
              onClick={() => onChange({ ...config, possibilidade: 2 })}
            >
              <RadioGroupItem value="2" id="r2" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="r2" className="font-medium cursor-pointer text-gray-900 text-sm">
                  Por Quantidade Objetivo
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Define meta de producao diaria - o sistema calcula o numero de operadores necessarios
                </p>
              </div>
            </div>

            <div
              className="flex items-start space-x-3 p-4 border border-gray-200 rounded-sm hover:border-blue-300 transition-colors cursor-pointer"
              onClick={() => onChange({ ...config, possibilidade: 3 })}
            >
              <RadioGroupItem value="3" id="r3" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="r3" className="font-medium cursor-pointer text-gray-900 text-sm">
                  Por Numero de Operadores
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Distribui carga com numero fixo de operadores definido por si
                </p>
              </div>
            </div>

            <div
              className="flex items-start space-x-3 p-4 border border-gray-200 rounded-sm hover:border-blue-300 transition-colors cursor-pointer"
              onClick={() => onChange({ ...config, possibilidade: 4 })}
            >
              <RadioGroupItem value="4" id="r4" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="r4" className="font-medium cursor-pointer text-gray-900 text-sm flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  Entrada Manual de Operacoes
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Insere manualmente os dados das operacoes (ID, nome, tempo, maquina) numa tabela editavel
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {config.possibilidade !== 4 && (
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
              Parametros Adicionais
            </Label>

            <div className="flex items-center justify-between p-4 border border-gray-200 rounded-sm">
              <div className="flex-1">
                <Label htmlFor="agrupar" className="font-medium text-gray-900 text-sm cursor-pointer">
                  Agrupar por Tipo de Maquina
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Reduz deslocamentos agrupando operacoes similares
                </p>
              </div>
              <Switch
                id="agrupar"
                checked={config.agruparMaquinas}
                onCheckedChange={(checked) => onChange({ ...config, agruparMaquinas: checked })}
                className="cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-gray-200 rounded-sm">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">
                  Carga Maxima por Operador
                </Label>
                <Input
                  type="number"
                  min={50}
                  max={100}
                  step={1}
                  value={config.cargaMaximaOperador}
                  onChange={(e) =>
                    onChange({ ...config, cargaMaximaOperador: Number(e.target.value) })
                  }
                  className="rounded-sm text-sm font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">Nao Dividir Operacoes Maiores Que </Label>
                <Input
                  type="number"
                  min={1.01}
                  max={10}
                  step={0.1}
                  value={naoDividirMaiorInput}
                  onChange={(e) => setNaoDividirMaiorInput(e.target.value)}
                  onBlur={commitNaoDividirMaior}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitNaoDividirMaior();
                    }
                  }}
                  className="rounded-sm text-sm font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700">Nao Dividir Operacoes Menores Que </Label>
                <Input
                  type="number"
                  min={0}
                  max={0.99}
                  step={0.1}
                  value={naoDividirMenorInput}
                  onChange={(e) => setNaoDividirMenorInput(e.target.value)}
                  onBlur={commitNaoDividirMenor}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitNaoDividirMenor();
                    }
                  }}
                  className="rounded-sm text-sm font-mono"
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
