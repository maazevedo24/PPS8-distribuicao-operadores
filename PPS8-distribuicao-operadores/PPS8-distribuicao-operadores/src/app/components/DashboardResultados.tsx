import { ResultadosBalanceamento, ConfiguracaoDistribuicao, DistribuicaoCarga } from "../types";
import { TabelaDistribuicao } from "./TabelaDistribuicao";
import svgPaths from "../../imports/Card-2/svg-8qif09w5n2";

interface DashboardResultadosProps {
  resultados: ResultadosBalanceamento;
  operadores: any[];
  operacoes: any[];
  config: ConfiguracaoDistribuicao;
  onRecalcular: (novosResultados: ResultadosBalanceamento, novaConfig: ConfiguracaoDistribuicao) => void;
  onDistribuicaoChange?: (novaDistribuicao: DistribuicaoCarga[]) => void;
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getShortOperatorCode(raw: string): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const inParens = text.match(/\(([^)]+)\)/)?.[1]?.trim();
  if (inParens) return inParens;
  const codeToken = text.match(/\b[A-Za-z]{1,}\d+\b/)?.[0];
  if (codeToken) return codeToken;
  return text;
}

function resolveOperatorCode(operadorId: string, operadores: any[]): string {
  const idKey = normalizeKey(operadorId);
  const idDigits = (operadorId.match(/\d+/g) || []).join("");
  const byId = operadores.find((op: any) => normalizeKey(String(op?.id || "")) === idKey);
  if (byId?.id) return String(byId.id);

  const byNome = operadores.find((op: any) => normalizeKey(String(op?.nome || "")) === idKey);
  if (byNome?.id) return String(byNome.id);

  const byNomeParcial = operadores.find((op: any) => {
    const nomeKey = normalizeKey(String(op?.nome || ""));
    if (!nomeKey) return false;
    return nomeKey.includes(idKey) || idKey.includes(nomeKey);
  });
  if (byNomeParcial?.id) return String(byNomeParcial.id);

  const shortFromRaw = getShortOperatorCode(operadorId);
  const shortKey = normalizeKey(shortFromRaw);
  const byShort = operadores.find((op: any) => normalizeKey(String(op?.id || "")) === shortKey);
  if (byShort?.id) return String(byShort.id);

  if (idDigits) {
    const byDigits = operadores.find((op: any) => {
      const opDigits = (String(op?.id || "").match(/\d+/g) || []).join("");
      return Boolean(opDigits) && (opDigits === idDigits || opDigits.endsWith(idDigits) || idDigits.endsWith(opDigits));
    });
    if (byDigits?.id) return String(byDigits.id);
  }

  return shortFromRaw || operadorId;
}

function buildDisplayCodeMap(distribuicao: DistribuicaoCarga[]): Map<string, string> {
  const map = new Map<string, string>();
  distribuicao.forEach((dist) => {
    const rawId = String(dist?.operadorId || "").trim();
    if (!rawId || map.has(rawId)) return;
    map.set(rawId, `OP${map.size + 1}`);
  });
  return map;
}

function getBatteryColor(ocupacao: number): string {
  if (ocupacao > 100) return "#DC2626";
  if (ocupacao >= 90) return "#10B981";
  if (ocupacao >= 80) return "#FBBF24";
  if (ocupacao >= 70) return "#F59E0B";
  return "#F97316";
}

function getCollaboratorLabel(rawOperatorId: string, fallbackCode: string): string {
  const rawDigits = (String(rawOperatorId || "").match(/\d+/g) || []).join("");
  if (rawDigits) return String(Number(rawDigits));

  const codeDigits = (String(fallbackCode || "").match(/\d+/g) || []).join("");
  if (codeDigits) return String(Number(codeDigits));

  return fallbackCode || rawOperatorId;
}

function generateFillPath(height: number): string {
  const h = Math.max(height, 3.27);
  return `M37.6364 0H1.63636C0.732625 0 0 0.732625 0 1.63636V${(h - 1.63636).toFixed(5)}C0 ${(h - 0.732625).toFixed(5)} 0.732625 ${h.toFixed(5)} 1.63636 ${h.toFixed(5)}H37.6364C38.5401 ${h.toFixed(5)} 39.2727 ${(h - 0.732625).toFixed(5)} 39.2727 ${(h - 1.63636).toFixed(5)}V1.63636C39.2727 0.732625 38.5401 0 37.6364 0Z`;
}

const BATTERY_TOTAL_HEIGHT = 174.545;
const BATTERY_START_MT = 6.55;

export function DashboardResultados({
  resultados,
  operadores,
  operacoes,
  onDistribuicaoChange,
}: DashboardResultadosProps) {
  const displayCodeByOperatorId = buildDisplayCodeMap(resultados.distribuicao || []);
  const dadosCarga = resultados.distribuicao.map((dist, index) => {
    const codigo =
      displayCodeByOperatorId.get(String(dist?.operadorId || "").trim()) ||
      resolveOperatorCode(dist.operadorId, operadores);
    const colaboradorLabel = getCollaboratorLabel(dist.operadorId, codigo);

    return {
      idx: `op_${index}`,
      codigo,
      colaboradorLabel,
      ocupacao: Math.round(dist.ocupacao),
      cargaHoraria: Math.round(dist.cargaHoraria),
    };
  });

  return (
    <div className="flex gap-4 items-start">
      <div className="bg-white content-stretch flex flex-col gap-[41px] items-center pb-[24px] pt-px px-px relative rounded-[6px] w-fit shrink-0">
        <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[6px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />

        <div className="relative shrink-0 w-full">
          <div aria-hidden="true" className="absolute border-[#e5e7eb] border-b border-solid inset-0 pointer-events-none" />
          <div className="content-stretch flex flex-col gap-[6px] items-start p-[24px] relative w-full">
            <div className="h-[20px] relative shrink-0 w-full">
              <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[20px] left-0 not-italic text-[#101828] text-[14px] top-0 tracking-[-0.1504px] whitespace-nowrap">
                Ocupacao por Trabalhador
              </p>
            </div>
            <div className="content-stretch flex h-[16px] items-start relative shrink-0 w-full">
              <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[16px] min-h-px min-w-px not-italic relative text-[#717182] text-[12px]">
                Percentagem de carga horaria atribuida
              </p>
            </div>
          </div>
        </div>

        <div className="content-stretch flex gap-[8px] items-start overflow-x-auto px-[40px] relative shrink-0 w-fit">
          {dadosCarga.map((d) => {
            const totalTimeSeconds = d.cargaHoraria * 60;
            const fillHeight = (Math.min(d.ocupacao, 100) / 100) * BATTERY_TOTAL_HEIGHT;
            const fillMT = BATTERY_START_MT + (BATTERY_TOTAL_HEIGHT - fillHeight);
            const color = getBatteryColor(d.ocupacao);
            const fillPath = generateFillPath(fillHeight);

            return (
              <div key={d.idx} className="content-stretch flex flex-col gap-px items-center relative shrink-0 w-[63px]">
                <div className="grid-cols-[max-content] grid-rows-[max-content] inline-grid leading-[0] place-items-start relative shrink-0">
                  <div className="col-1 h-[6.545px] ml-[13.09px] mt-0 relative row-1 w-[17.455px]">
                    <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 17.4545 6.54545">
                      <path d={svgPaths.p2631fa00} fill="#9CA3AF" />
                    </svg>
                  </div>

                  <div className="col-1 h-[174.545px] ml-0 mt-[6.55px] relative row-1 w-[43.636px]">
                    <div className="absolute inset-[-0.47%_-1.87%_-0.47%_-1.88%]">
                      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 45.2727 176.182">
                        <path d={svgPaths.p3d6b6400} fill="#F9FAFB" stroke="#D1D5DB" strokeWidth="1.63636" />
                      </svg>
                    </div>
                  </div>

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

                  {[144.73, 108.36, 72, 35.64].map((mt, idx) => (
                    <div key={idx} className="col-1 h-0 ml-[3.27px] relative row-1 w-[37.091px]" style={{ marginTop: `${mt}px` }}>
                      <div className="absolute inset-[-0.27px_0]">
                        <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 37.0909 0.545455">
                          <path d="M0 0.272727H37.0909" stroke="#E5E7EB" strokeDasharray="2.18 2.18" strokeWidth="0.545455" />
                        </svg>
                      </div>
                    </div>
                  ))}

                  {["OP1", "OP2", "OP3", "OP4", "OP5"].map((op, i) => {
                    const tops = [156.05, 120.05, 87.14, 50.05, 14.05];
                    return (
                      <p key={op} className="col-1 font-bold leading-[normal] not-italic relative row-1 text-[#dddbdb] text-[10.909px] text-center whitespace-nowrap" style={{ marginLeft: "9.91px", marginTop: `${tops[i]}px` }}>
                        {op}
                      </p>
                    );
                  })}
                </div>

                <div className="relative shrink-0 w-full">
                  <div className="flex flex-col items-center justify-center size-full">
                    <div className="content-stretch flex flex-col gap-[8px] items-center justify-center p-[2px] relative w-full">
                      <p title={d.codigo} className="font-normal leading-[normal] not-italic relative shrink-0 text-[#6b7280] text-[9.818px] text-center whitespace-nowrap cursor-help">
                        {d.colaboradorLabel}
                      </p>
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

      <div className="flex-1 min-w-0">
        <TabelaDistribuicao
          resultados={resultados}
          operadores={operadores}
          operacoes={operacoes}
          unidadeTempo="s"
          onDistribuicaoChange={onDistribuicaoChange}
        />
      </div>
    </div>
  );
}
