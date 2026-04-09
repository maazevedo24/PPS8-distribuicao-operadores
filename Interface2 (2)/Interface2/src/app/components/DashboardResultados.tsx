import { ResultadosBalanceamento, ConfiguracaoDistribuicao } from "../types";
import { useState } from "react";
import { calcularBalanceamento } from "../utils/balanceamento";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { RefreshCw, Settings2 } from "lucide-react";
import svgPaths from "../../imports/Card-2/svg-8qif09w5n2";

interface DashboardResultadosProps {
  resultados: ResultadosBalanceamento;
  operadores: any[];
  operacoes: any[];
  config: ConfiguracaoDistribuicao;
  onRecalcular: (novosResultados: ResultadosBalanceamento, novaConfig: ConfiguracaoDistribuicao) => void;
}

// Cor da bateria conforme nível de ocupação
function getBatteryColor(ocupacao: number) {
  if (ocupacao > 100) return "#F97316";
  if (ocupacao >= 90) return "#10B981";
  if (ocupacao >= 80) return "#FBBF24";
  if (ocupacao >= 70) return "#F59E0B";
  return "#F97316";
}

// Gera o path SVG dinâmico para o preenchimento da bateria
function generateFillPath(height: number) {
  const h = Math.max(height, 3.27);
  return `M37.6364 0H1.63636C0.732625 0 0 0.732625 0 1.63636V${(h - 1.63636).toFixed(5)}C0 ${(h - 0.732625).toFixed(5)} 0.732625 ${h.toFixed(5)} 1.63636 ${h.toFixed(5)}H37.6364C38.5401 ${h.toFixed(5)} 39.2727 ${(h - 0.732625).toFixed(5)} 39.2727 ${(h - 1.63636).toFixed(5)}V1.63636C39.2727 0.732625 38.5401 0 37.6364 0Z`;
}

const BATTERY_TOTAL_HEIGHT = 174.545;
const BATTERY_START_MT = 6.55;

const METODOS = [
  {
    value: "1" as const,
    label: "Distribuição Ideal",
    desc: "Balanceamento automático com base nas horas do turno e produtividade estimada",
  },
  {
    value: "2" as const,
    label: "Por Quantidade Objetivo",
    desc: "Meta de produção diária — o sistema calcula os operadores necessários",
  },
  {
    value: "3" as const,
    label: "Por Número de Operadores",
    desc: "Distribui a carga com um número fixo de operadores",
  },
];

const DEFAULT_CONFIG: ConfiguracaoDistribuicao = {
  possibilidade: 1,
  horasTurno: 8,
  produtividadeEstimada: 85,
  agruparMaquinas: false,
  cargaMaximaOperador: 95,
  naoDividirMaiorQue: 0.9,
  naoDividirMenorQue: 1.1,
};

export function DashboardResultados({
  resultados,
  operadores,
  operacoes,
  config,
  onRecalcular,
}: DashboardResultadosProps) {
  const safeConfig: ConfiguracaoDistribuicao = config
    ? { ...DEFAULT_CONFIG, ...config }
    : { ...DEFAULT_CONFIG };

  const [editedConfig, setEditedConfig] = useState<ConfiguracaoDistribuicao>(safeConfig);
  const [dirty, setDirty] = useState(false);

  const update = (partial: Partial<ConfiguracaoDistribuicao>) => {
    setEditedConfig((prev) => ({ ...prev, ...partial }));
    setDirty(true);
  };

  const handleRecalcular = () => {
    const novosResultados = calcularBalanceamento(operadores, operacoes, editedConfig);
    onRecalcular(novosResultados, editedConfig);
    setDirty(false);
  };

  const dadosCarga = resultados.distribuicao.map((dist, index) => ({
    idx: `op_${index}`,
    displayName: dist.operadorId,
    ocupacao: Math.round(dist.ocupacao),
    cargaHoraria: Math.round(dist.cargaHoraria),
    numOperacoes: dist.operacoes.length,
  }));

  return (
    <div className="flex gap-4 items-start">
      {/* ── Gráfico Bateria ── */}
      <div className="bg-white content-stretch flex flex-col gap-[41px] items-center pb-[24px] pt-px px-px relative rounded-[6px] w-fit shrink-0">
        <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[6px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />

        {/* CardHeader */}
        <div className="relative shrink-0 w-full">
          <div aria-hidden="true" className="absolute border-[#e5e7eb] border-b border-solid inset-0 pointer-events-none" />
          <div className="content-stretch flex flex-col gap-[6px] items-start p-[24px] relative w-full">
            <div className="h-[20px] relative shrink-0 w-full">
              <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[#101828] text-[14px] top-0 tracking-[-0.1504px] whitespace-nowrap">
                Ocupação por Operador
              </p>
            </div>
            <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full">
              <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#717182] text-[12px]">
                Percentagem de carga horária atribuída
              </p>
            </div>
          </div>
        </div>

        {/* Batteries */}
        <div className="content-stretch flex gap-[8px] items-start overflow-x-auto px-[40px] relative shrink-0 w-fit">
          {dadosCarga.map((d) => {
            const ocupacao = d.ocupacao;
            const totalTimeSeconds = d.cargaHoraria * 60;
            const fillHeight = (Math.min(ocupacao, 105) / 100) * BATTERY_TOTAL_HEIGHT;
            const fillMT = BATTERY_START_MT + (BATTERY_TOTAL_HEIGHT - fillHeight);
            const color = getBatteryColor(ocupacao);
            const fillPath = generateFillPath(fillHeight);

            return (
              <div key={d.idx} className="content-stretch flex flex-col gap-px items-center relative shrink-0 w-[63px]">
                {/* Battery Group */}
                <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
                  {/* Terminal (top cap) */}
                  <div className="col-1 h-[6.545px] ml-[13.09px] mt-0 relative row-1 w-[17.455px]">
                    <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17.4545 6.54545">
                      <path d={svgPaths.p2631fa00} fill="#9CA3AF" />
                    </svg>
                  </div>
                  {/* Battery shell */}
                  <div className="col-1 h-[174.545px] ml-0 mt-[6.55px] relative row-1 w-[43.636px]">
                    <div className="absolute inset-[-0.47%_-1.87%_-0.47%_-1.88%]">
                      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 45.2727 176.182">
                        <path d={svgPaths.p3d6b6400} fill="#F9FAFB" stroke="#D1D5DB" strokeWidth="1.63636" />
                      </svg>
                    </div>
                  </div>
                  {/* Fill */}
                  {fillHeight > 2 && (
                    <div
                      className="col-1 ml-[2.18px] relative row-1 w-[39.273px]"
                      style={{ height: `${fillHeight}px`, marginTop: `${fillMT}px` }}
                    >
                      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox={`0 0 39.2727 ${fillHeight}`}>
                        <path d={fillPath} fill={color} />
                      </svg>
                    </div>
                  )}
                  {/* Grid lines */}
                  {[144.73, 108.36, 72, 35.64].map((mt, idx) => (
                    <div key={idx} className="col-1 h-0 ml-[3.27px] relative row-1 w-[37.091px]" style={{ marginTop: `${mt}px` }}>
                      <div className="absolute inset-[-0.27px_0]">
                        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 37.0909 0.545455">
                          <path d="M0 0.272727H37.0909" stroke="#E5E7EB" strokeDasharray="2.18 2.18" strokeWidth="0.545455" />
                        </svg>
                      </div>
                    </div>
                  ))}
                  {/* OP labels */}
                  {["OP1", "OP2", "OP3", "OP4", "OP5"].map((op, i) => {
                    const tops = [156.05, 120.05, 87.14, 50.05, 14.05];
                    return (
                      <p key={op} className="col-1 font-bold leading-[normal] not-italic relative row-1 text-[#dddbdb] text-[10.909px] text-center whitespace-nowrap" style={{ marginLeft: "9.91px", marginTop: `${tops[i]}px` }}>
                        {op}
                      </p>
                    );
                  })}
                </div>

                {/* Label below battery */}
                <div className="relative shrink-0 w-full">
                  <div className="flex flex-col items-center justify-center size-full">
                    <div className="content-stretch flex flex-col gap-[8px] items-center justify-center p-[2px] relative w-full">
                      <p className="font-normal leading-[normal] not-italic relative shrink-0 text-[#6b7280] text-[9.818px] text-center whitespace-nowrap">{d.displayName}</p>
                      <div className="content-stretch flex gap-[8px] h-[14px] items-center justify-center relative shrink-0 w-[59px]">
                        <p className="font-bold leading-[normal] not-italic relative shrink-0 text-[#6b7280] text-[9.818px] text-center whitespace-nowrap">{totalTimeSeconds.toFixed(0)}s</p>
                        <div className="flex flex-[1_0_0] h-[14px] items-center justify-center min-h-px min-w-px relative" style={{ containerType: "size" } as React.CSSProperties}>
                          <div className="-scale-y-100 flex-none h-[100cqw] rotate-90">
                            <div className="h-full relative w-[14px]">
                              <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 1">
                                <path d="M14 0V1H0V0H14Z" fill="#6B7280" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        <p className="font-bold leading-[normal] not-italic relative shrink-0 text-[#6b7280] text-[9.818px] text-center whitespace-nowrap">{d.ocupacao}%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Takt Time line */}
          <div className="absolute content-stretch flex items-center justify-end left-0 right-0 z-10" style={{ top: 0 }}>
            <div className="flex-[1_0_0] h-0 min-h-px min-w-px relative">
              <div className="absolute inset-[-0.82px_0]">
                <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 534.896 1.63636">
                  <path d="M0 0.818182H534.896" stroke="#1E3A5F" strokeDasharray="6.55 3.27" strokeWidth="1.63636" />
                </svg>
              </div>
            </div>
            <div className="bg-[#1e3a5f] content-stretch flex h-[17.455px] items-center justify-center p-[6px] relative rounded-[4px] shrink-0 w-[73.104px]">
              <p className="font-bold leading-[normal] not-italic relative shrink-0 text-[8.727px] text-center text-white whitespace-nowrap">
                TT {(resultados.taktTime * 60).toFixed(1)}s
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Painel de Parâmetros ── */}
      <div className="flex-1 bg-white rounded-[6px] relative" style={{ minWidth: 300 }}>
        <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[6px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />

        {/* Header */}
        <div className="relative">
          <div aria-hidden="true" className="absolute border-[#e5e7eb] border-b border-solid inset-0 pointer-events-none" />
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-7 h-7 bg-blue-50 rounded-sm flex items-center justify-center shrink-0">
              <Settings2 className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <p className="font-semibold text-[13px] text-[#101828] leading-tight">Parâmetros do Balanceamento</p>
              <p className="text-[11px] text-[#717182] leading-tight mt-0.5">Algoritmo e critérios utilizados no cálculo</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-5">
          {/* Método */}
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Método de Distribuição
            </Label>
            <div className="space-y-1.5">
              {METODOS.map((m) => {
                const isActive = editedConfig.possibilidade.toString() === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => update({ possibilidade: Number(m.value) as 1 | 2 | 3 })}
                    className={`w-full text-left flex items-start gap-3 px-3 py-2.5 border rounded-sm transition-colors ${
                      isActive
                        ? "border-[#1e3a5f] bg-[#f0f4f9]"
                        : "border-[#e5e7eb] hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className={`mt-0.5 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${isActive ? "border-[#1e3a5f]" : "border-gray-300"}`}>
                      {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#1e3a5f]" />}
                    </div>
                    <div>
                      <p className={`text-[12px] font-medium leading-tight ${isActive ? "text-[#1e3a5f]" : "text-gray-700"}`}>{m.label}</p>
                      <p className="text-[10px] text-gray-400 leading-snug mt-0.5">{m.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inputs específicos por método */}
          {editedConfig.possibilidade === 1 && (
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-gray-100">
              <div className="space-y-1">
                <Label className="text-[10px] text-gray-500 font-medium">Horas de Turno</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    step={0.5}
                    value={editedConfig.horasTurno}
                    onChange={(e) => update({ horasTurno: Number(e.target.value) })}
                    className="rounded-sm text-[12px] h-8 pr-8 font-mono"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">h</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-gray-500 font-medium">Produtividade Estimada</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={50}
                    max={100}
                    step={1}
                    value={editedConfig.produtividadeEstimada}
                    onChange={(e) => update({ produtividadeEstimada: Number(e.target.value) })}
                    className="rounded-sm text-[12px] h-8 pr-8 font-mono"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                </div>
              </div>
            </div>
          )}

          {editedConfig.possibilidade === 2 && (
            <div className="pt-1 border-t border-gray-100">
              <div className="space-y-1">
                <Label className="text-[10px] text-gray-500 font-medium">Quantidade Objetivo</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={editedConfig.quantidadeObjetivo ?? ""}
                    onChange={(e) => update({ quantidadeObjetivo: Number(e.target.value) })}
                    className="rounded-sm text-[12px] h-8 pr-16 font-mono"
                    placeholder="0"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">peças/dia</span>
                </div>
              </div>
            </div>
          )}

          {editedConfig.possibilidade === 3 && (
            <div className="pt-1 border-t border-gray-100">
              <div className="space-y-1">
                <Label className="text-[10px] text-gray-500 font-medium">Número de Operadores</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={editedConfig.numeroOperadores ?? ""}
                    onChange={(e) => update({ numeroOperadores: Number(e.target.value) })}
                    className="rounded-sm text-[12px] h-8 pr-12 font-mono"
                    placeholder="0"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">ops.</span>
                </div>
              </div>
            </div>
          )}

          {/* Parâmetros gerais */}
          <div className="space-y-2 pt-1 border-t border-gray-100">
            <Label className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
              Parâmetros Gerais
            </Label>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] text-gray-500 font-medium">Carga Máx. Operador</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={50}
                    max={100}
                    step={1}
                    value={editedConfig.cargaMaximaOperador}
                    onChange={(e) => update({ cargaMaximaOperador: Number(e.target.value) })}
                    className="rounded-sm text-[12px] h-8 pr-6 font-mono"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">%</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-gray-500 font-medium">Não Dividir &gt;</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={editedConfig.naoDividirMaiorQue}
                    onChange={(e) => update({ naoDividirMaiorQue: Number(e.target.value) })}
                    className="rounded-sm text-[12px] h-8 pr-8 font-mono"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">min</span>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-gray-500 font-medium">Não Dividir &lt;</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    step={0.1}
                    value={editedConfig.naoDividirMenorQue}
                    onChange={(e) => update({ naoDividirMenorQue: Number(e.target.value) })}
                    className="rounded-sm text-[12px] h-8 pr-8 font-mono"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">min</span>
                </div>
              </div>
            </div>

            {/* Agrupar máquinas */}
            <div className="flex items-center justify-between px-3 py-2.5 border border-[#e5e7eb] rounded-sm mt-1">
              <div>
                <p className="text-[12px] font-medium text-gray-700">Agrupar por Tipo de Máquina</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Reduz deslocamentos agrupando operações similares</p>
              </div>
              <Switch
                checked={editedConfig.agruparMaquinas}
                onCheckedChange={(v) => update({ agruparMaquinas: v })}
              />
            </div>
          </div>

          {/* Recalcular */}
          <div className="pt-1">
            <Button
              onClick={handleRecalcular}
              className={`w-full rounded-sm h-9 text-[12px] gap-2 transition-all ${
                dirty
                  ? "bg-[#1e3a5f] hover:bg-[#162d4a] text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${dirty ? "animate-pulse" : ""}`} />
              {dirty ? "Recalcular com Novos Parâmetros" : "Recalcular"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}