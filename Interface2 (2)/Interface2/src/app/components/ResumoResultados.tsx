import { ResultadosBalanceamento } from "../types";
import { Users, Clock, Package, Timer, TrendingUp, AlertTriangle } from "lucide-react";
import svgPaths from "../../imports/ResumoResultados/svg-lcfdbebd6c";

interface ResumoResultadosProps {
  resultados: ResultadosBalanceamento;
  config: {
    possibilidade: number;
    quantidadeObjetivo?: number;
    numeroOperadores?: number;
    agruparMaquinas?: boolean;
    cargaMaximaOperador: number;
    naoDividirMaiorQue: number;
    naoDividirMenorQue: number;
  };
}

export function ResumoResultados({ resultados, config }: ResumoResultadosProps) {
  // Compatibilidade retroativa: suporta tanto numeroCiclosPorHora (novo) como numeroPecasHora (legado)
  const ciclosPorHora = (resultados.numeroCiclosPorHora ?? (resultados as any).numeroPecasHora ?? 0);

  const kpis = [
    {
      label: 'Ciclos/Hora',
      value: ciclosPorHora.toFixed(2),
      unit: '',
      bgColor: 'bg-[#cbfbf1]',
      iconColor: '#009689',
      icon: (
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
          <g id="Icon">
            <path d={svgPaths.p2ebe2e00} stroke="#009689" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
            <path d="M7 12.8333V7" stroke="#009689" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
            <path d={svgPaths.p21a6a770} stroke="#009689" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
            <path d="M4.375 2.49083L9.625 5.495" stroke="#009689" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          </g>
        </svg>
      ),
    },
    {
      label: 'Takt Time',
      value: resultados.taktTime.toFixed(2),
      unit: 'min',
      bgColor: 'bg-[#dbeafe]',
      iconColor: '#155DFC',
      icon: (
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
          <g clipPath="url(#clip0_266_1141)">
            <path d={svgPaths.pc012c00} stroke="#155DFC" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
            <path d="M7 3.5V7L9.33333 8.16667" stroke="#155DFC" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          </g>
          <defs>
            <clipPath id="clip0_266_1141">
              <rect fill="white" height="14" width="14" />
            </clipPath>
          </defs>
        </svg>
      ),
    },
    {
      label: 'Tempo Ciclo',
      value: resultados.tempoCiclo.toFixed(2),
      unit: 'min',
      bgColor: 'bg-[#f3e8ff]',
      iconColor: '#9810FA',
      icon: (
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
          <g>
            <path d="M5.83333 1.16667H8.16667" stroke="#9810FA" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
            <path d="M7 8.16667L8.75 6.41667" stroke="#9810FA" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
            <path d={svgPaths.p3c1f7100} stroke="#9810FA" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          </g>
        </svg>
      ),
    },
    {
      label: 'Produtividade',
      value: resultados.produtividade.toFixed(1),
      unit: '%',
      bgColor: 'bg-[#dcfce7]',
      iconColor: '#00A63E',
      icon: (
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
          <g>
            <path d={svgPaths.p1977ee80} stroke="#00A63E" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
            <path d={svgPaths.p3471a100} stroke="#00A63E" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          </g>
        </svg>
      ),
    },
    {
      label: 'Perdas',
      value: resultados.perdas.toFixed(1),
      unit: '%',
      bgColor: 'bg-[#fef3c6]',
      iconColor: '#E17100',
      icon: (
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
          <g>
            <path d={svgPaths.p3ba1200} stroke="#E17100" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
            <path d="M7 5.25V7.58333" stroke="#E17100" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
            <path d="M7 9.91667H7.00583" stroke="#E17100" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          </g>
        </svg>
      ),
    },
    {
      label: 'Operadores',
      value: resultados.numeroOperadores.toString(),
      unit: '',
      bgColor: 'bg-[#e0e7ff]',
      iconColor: '#4F39F6',
      icon: (
        <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14 14">
          <g>
            <path d={svgPaths.p317fdd80} stroke="#4F39F6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
            <path d={svgPaths.p31c78b80} stroke="#4F39F6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
            <path d={svgPaths.p3625bb80} stroke="#4F39F6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
            <path d={svgPaths.p2ca18b80} stroke="#4F39F6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.16667" />
          </g>
        </svg>
      ),
    },
  ];

  return (
    <div className="flex flex-1 gap-2">
      {kpis.map((kpi, index) => (
        <div
          key={index}
          className="bg-white flex-1 rounded-md border border-[#e5e7eb] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]"
        >
          <div className="flex flex-col justify-center size-full">
            <div className="flex flex-col items-start justify-center p-[7px]">
              <div className="flex gap-[6px] items-center">
                {/* Icon */}
                <div className={`${kpi.bgColor} rounded-md shrink-0 size-7 flex items-center justify-center`}>
                  <div className="relative shrink-0 size-[14px]">
                    {kpi.icon}
                  </div>
                </div>

                {/* Label & Value */}
                <div className="flex flex-col">
                  <p className="font-medium leading-[13.5px] text-[#6a7282] text-[9px] tracking-[0.167px] uppercase whitespace-nowrap">
                    {kpi.label}
                  </p>
                  <p className="font-bold leading-7 text-[#101828] text-[18px] tracking-[-0.4395px] whitespace-nowrap">
                    {kpi.value}
                    {kpi.unit && (
                      <span className="font-normal leading-[15.556px] text-[#6a7282] text-[10px] tracking-[0.1172px]">
                        {kpi.unit}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}