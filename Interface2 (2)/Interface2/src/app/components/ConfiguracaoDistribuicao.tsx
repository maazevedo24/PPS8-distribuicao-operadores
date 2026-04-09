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
  return (
    <Card className="shadow-sm border border-gray-200 rounded-sm bg-white">
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="flex items-center gap-3 text-gray-900">
          <div className="w-8 h-8 bg-purple-100 rounded-sm flex items-center justify-center">
            <Calculator className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-base font-semibold">Configuração de Distribuição</div>
            <CardDescription className="text-gray-500 mt-0.5 text-xs">
              Critérios para o balanceamento da linha de produção
            </CardDescription>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Método de Distribuição
          </Label>
          <RadioGroup
            value={config.possibilidade.toString()}
            onValueChange={(value) =>
              onChange({ ...config, possibilidade: Number(value) as 1 | 2 | 3 | 4 })
            }
          >
            <div className="flex items-start space-x-3 p-4 border border-gray-200 rounded-sm hover:border-blue-300 transition-colors">
              <RadioGroupItem value="1" id="r1" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="r1" className="font-medium cursor-pointer text-gray-900 text-sm">
                  Distribuição Ideal (Automática)
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Calcula automaticamente o balanceamento mais eficiente com base nas horas do turno e produtividade estimada
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border border-gray-200 rounded-sm hover:border-blue-300 transition-colors">
              <RadioGroupItem value="2" id="r2" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="r2" className="font-medium cursor-pointer text-gray-900 text-sm">
                  Por Quantidade Objetivo
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Define meta de produção diária — o sistema calcula o número de operadores necessários
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border border-gray-200 rounded-sm hover:border-blue-300 transition-colors">
              <RadioGroupItem value="3" id="r3" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="r3" className="font-medium cursor-pointer text-gray-900 text-sm">
                  Por Número de Operadores
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Distribui carga com número fixo de operadores definido por si
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border border-gray-200 rounded-sm hover:border-blue-300 transition-colors">
              <RadioGroupItem value="4" id="r4" className="mt-0.5" />
              <div className="flex-1">
                <Label htmlFor="r4" className="font-medium cursor-pointer text-gray-900 text-sm flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-blue-600" />
                  Entrada Manual de Operações
                </Label>
                <p className="text-xs text-gray-500 mt-1">
                  Insere manualmente os dados das operações (ID, nome, tempo, máquina) numa tabela editável
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {config.possibilidade !== 4 && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <Label className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            Parâmetros Adicionais
          </Label>

          <div className="flex items-center justify-between p-4 border border-gray-200 rounded-sm">
            <div className="flex-1">
              <Label htmlFor="agrupar" className="font-medium text-gray-900 text-sm">
                Agrupar por Tipo de Máquina
              </Label>
              <p className="text-xs text-gray-500 mt-1">
                Reduz deslocamentos agrupando operações similares
              </p>
            </div>
            <Switch
              id="agrupar"
              checked={config.agruparMaquinas}
              onCheckedChange={(checked) => onChange({ ...config, agruparMaquinas: checked })}
            />
          </div>

          {/* Campos numéricos de configuração */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-gray-200 rounded-sm">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">
                Carga Máxima por Operador
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
              <Label className="text-xs font-medium text-gray-700">Não Dividir Operações Maiores Que </Label>
              <Input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={config.naoDividirMaiorQue}
                onChange={(e) =>
                  onChange({ ...config, naoDividirMaiorQue: Number(e.target.value) })
                }
                className="rounded-sm text-sm font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700">Não Dividir Operações Menores Que </Label>
              <Input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={config.naoDividirMenorQue}
                onChange={(e) =>
                  onChange({ ...config, naoDividirMenorQue: Number(e.target.value) })
                }
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