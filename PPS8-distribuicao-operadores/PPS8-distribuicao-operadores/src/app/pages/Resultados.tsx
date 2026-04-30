import { useLocation, useNavigate } from "react-router";
import { ResultadosBalanceamento, ConfiguracaoDistribuicao } from "../types";
import { DashboardResultados } from "../components/DashboardResultados";
import { VisualizadorFluxo } from "../components/VisualizadorFluxo";
import { ResumoResultados } from "../components/ResumoResultados";
import { Button } from "../components/ui/button";
import { ArrowLeft, Download, Printer, Calculator } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config";

export default function Resultados() {
  const location = useLocation();
  const navigate = useNavigate();

  // Tentar obter dados do state ou do sessionStorage
  let dataSource = location.state;
  
  if (!dataSource || !dataSource.resultados) {
    const stored = sessionStorage.getItem('balanceamentoData');
    if (stored) {
      try {
        dataSource = JSON.parse(stored);
      } catch (e) {
        console.error('Erro ao parsear dados do sessionStorage:', e);
      }
    }
  }

  // Check if state exists, if not redirect to home
  useEffect(() => {
    if (!dataSource || !dataSource.resultados) {
      navigate("/");
    }
  }, [dataSource, navigate]);

  // Early return if no state
  if (!dataSource || !dataSource.resultados) {
    return null;
  }

  const { resultados, operadores, operacoes, config } = dataSource as {
    resultados: ResultadosBalanceamento;
    operadores: any[];
    operacoes: any[];
    config: ConfiguracaoDistribuicao;
  };
  const initialTaskCode = String((dataSource as any)?.taskCode || "").trim();
  const initialAjusteBodyBase = (dataSource as any)?.ajusteBodyBase;

  // Estado para resultados editaveis
  const [resultadosAtuais, setResultadosAtuais] = useState<ResultadosBalanceamento>(resultados);
  const [configAtual, setConfigAtual] = useState<ConfiguracaoDistribuicao>(config);
  const [viewMode, setViewMode] = useState<"tempo" | "percentagem">("tempo");
  const [taskCode] = useState<string>(initialTaskCode);
  const [ajusteBodyBase, setAjusteBodyBase] = useState<any>(initialAjusteBodyBase);
  const [isAjustando, setIsAjustando] = useState(false);

  const parseNumberLike = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const normalized = value.trim().replace(",", ".");
      const direct = Number(normalized);
      if (Number.isFinite(direct)) return direct;
    }
    return null;
  };

  const ensureArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

  const buildDistribuicaoFromAllocations = (operationAllocations: any[]): any[] => {
    const byOperator: Record<string, { operacoes: Set<string>; segundos: number; temposOperacoes: Record<string, number> }> = {};

    operationAllocations.forEach((row: any) => {
      const opCode = String(row?.operation_code || row?.operation_id || "").trim();
      const operatorTimes = row?.operator_times && typeof row.operator_times === "object" ? row.operator_times : {};
      Object.entries(operatorTimes).forEach(([operatorRef, secondsRaw]) => {
        const seconds = parseNumberLike(secondsRaw) ?? 0;
        if (!operatorRef || seconds <= 0) return;
        if (!byOperator[operatorRef]) {
          byOperator[operatorRef] = { operacoes: new Set<string>(), segundos: 0, temposOperacoes: {} };
        }
        if (opCode) byOperator[operatorRef].operacoes.add(opCode);
        byOperator[operatorRef].segundos += seconds;
        if (opCode) {
          byOperator[operatorRef].temposOperacoes[opCode] =
            (byOperator[operatorRef].temposOperacoes[opCode] || 0) + seconds / 60;
        }
      });
    });

    const tempoCicloMin = parseNumberLike(resultadosAtuais.tempoCiclo) ?? 0;
    return Object.entries(byOperator).map(([operadorId, dados]) => {
      const cargaHoraria = dados.segundos / 60;
      return {
        operadorId,
        operacoes: Array.from(dados.operacoes),
        cargaHoraria,
        ocupacao: tempoCicloMin > 0 ? (cargaHoraria / tempoCicloMin) * 100 : 0,
        ciclosPorHora: cargaHoraria > 0 ? 60 / cargaHoraria : 0,
        temposOperacoes: dados.temposOperacoes,
      };
    });
  };

  const mergeRowsIntoAdjustBody = (baseBody: any, editedRows: any[]): any => {
    const clone = structuredClone(baseBody);
    const originalRows = ensureArray(clone?.operation_allocations);
    if (originalRows.length === 0) return clone;

    const editedByKey = new Map<string, any>();
    editedRows.forEach((row) => {
      const key = `${String(row?.seq ?? "")}::${String(row?.operation_code || row?.operation_id || "")}`;
      editedByKey.set(key, row);
    });

    clone.operation_allocations = originalRows.map((row: any) => {
      const key = `${String(row?.seq ?? "")}::${String(row?.operation_code || row?.operation_id || "")}`;
      const edited = editedByKey.get(key);
      if (!edited) return row;

      const nextRow = { ...row };
      const nextOperatorTimes = { ...(nextRow.operator_times || {}) };
      Object.entries(edited.operator_times || {}).forEach(([opKey, value]) => {
        const seconds = Math.max(0, parseNumberLike(value) ?? 0);
        nextOperatorTimes[opKey] = seconds;
      });
      nextRow.operator_times = nextOperatorTimes;

      if (Array.isArray(nextRow.operator_allocations)) {
        nextRow.operator_allocations = nextRow.operator_allocations.map((alloc: any) => {
          const operatorCode = String(
            alloc?.operator_code ?? alloc?.operator_id ?? alloc?.operador_id ?? alloc?.operator ?? alloc?.operador ?? alloc?.code ?? ""
          ).trim();
          if (!operatorCode) return alloc;
          const seconds = parseNumberLike(nextOperatorTimes[operatorCode]);
          if (seconds == null) return alloc;
          return { ...alloc, time_seconds: seconds };
        });
      }

      return nextRow;
    });
    return clone;
  };

  const buildResultadosFromApi = (raw: any): ResultadosBalanceamento => {
    const operationAllocations = ensureArray(raw?.operation_allocations ?? raw?.operationAllocations);
    const taktSeconds = parseNumberLike(raw?.takt_time_seconds ?? raw?.takt_time ?? raw?.taktTime) ?? 0;
    const cicloApi = parseNumberLike(raw?.real_cycle_time_seconds ?? raw?.cycle_time_seconds ?? raw?.cycle_time ?? raw?.tempo_ciclo_segundos) ?? 0;
    const tempoCiclo = cicloApi > 10 ? cicloApi / 60 : cicloApi;
    const produtividadeRaw = parseNumberLike(raw?.estimated_productivity ?? raw?.productivity ?? raw?.produtividade_estimada) ?? (resultadosAtuais.produtividade ?? 0);
    const produtividade = produtividadeRaw <= 1 ? produtividadeRaw * 100 : produtividadeRaw;

    const distribuicaoFromApi = ensureArray(raw?.distribuicao ?? raw?.distribution);
    const distribuicao = distribuicaoFromApi.length > 0 ? distribuicaoFromApi : buildDistribuicaoFromAllocations(operationAllocations);

    return {
      distribuicao: distribuicao as any,
      operation_allocations: operationAllocations as any,
      taktTime: taktSeconds / 60,
      tempoCiclo,
      numeroCiclosPorHora:
        (parseNumberLike(raw?.production_per_hour ?? raw?.numero_ciclos_por_hora) ??
          (tempoCiclo > 0 ? 60 / tempoCiclo : resultadosAtuais.numeroCiclosPorHora)) || 0,
      produtividade,
      perdas: Math.max(0, 100 - produtividade),
      numeroOperadores:
        (parseNumberLike(raw?.num_operators ?? raw?.numero_operadores ?? raw?.numeroOperadores) ?? distribuicao.length) || 0,
      ocupacaoTotal:
        (parseNumberLike(raw?.occupancy_total ?? raw?.ocupacao_total ?? raw?.total_occupancy ?? raw?.total_load) ??
          distribuicao.reduce((sum: number, d: any) => sum + ((parseNumberLike(d?.cargaHoraria) ?? 0) * 60), 0)) || 0,
    };
  };

  const handleConfirmarEdicao = useCallback(
    async (editedRows: any[]) => {
      if (!taskCode || !ajusteBodyBase) {
        alert("Nao foi possivel ajustar: faltam task code ou payload base da chamada inicial.");
        return;
      }
      setIsAjustando(true);
      try {
        const body = mergeRowsIntoAdjustBody(ajusteBodyBase, editedRows);
        const resposta = await axios.post(
          `${API_BASE_URL}/tasks/${encodeURIComponent(taskCode)}/adjust`,
          body
        );
        const novoRaw = resposta.data ?? {};
        const novosResultados = buildResultadosFromApi(novoRaw);
        setResultadosAtuais(novosResultados);
        setAjusteBodyBase(novoRaw);
      } catch (error) {
        console.error("Erro ao ajustar alocacao:", error);
        alert("Erro ao ajustar alocacao. Verifica os valores editados e tenta novamente.");
        throw error;
      } finally {
        setIsAjustando(false);
      }
    },
    [taskCode, ajusteBodyBase, resultadosAtuais]
  );

  const handleRecalcular = useCallback((novosResultados: ResultadosBalanceamento, novaConfig: ConfiguracaoDistribuicao) => {
    setResultadosAtuais(novosResultados);
    setConfigAtual(novaConfig);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const data = {
      resultados: resultadosAtuais,
      operadores,
      operacoes,
      config,
      dataGeracao: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `balanceamento_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-50">
      {/* Header */}
      <div className="sticky top-[53px] z-40 bg-white border-b border-gray-200 print:hidden shadow-sm">
        <div className="w-full px-6 py-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => navigate("/")} 
                className="text-gray-600 hover:text-gray-900 -ml-2 h-7 px-2 text-xs"
                size="sm"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Voltar
              </Button>
              <div className="h-5 w-px bg-gray-200"></div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-100 rounded-sm flex items-center justify-center">
                  <Calculator className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-gray-900">
                    Analise de Resultados
                  </h1>
                  <p className="text-gray-500 text-[10px]">
                    Relatorio do balanceamento calculado
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleExport}
                size="sm"
                className="text-gray-600 border-gray-200 hover:bg-gray-50 rounded-sm text-[10px] h-7 px-2.5"
              >
                <Download className="w-3 h-3 mr-1.5" />
                Exportar
              </Button>
              <Button 
                variant="outline" 
                onClick={handlePrint}
                size="sm"
                className="text-gray-600 border-gray-200 hover:bg-gray-50 rounded-sm text-[10px] h-7 px-2.5"
              >
                <Printer className="w-3 h-3 mr-1.5" />
                Imprimir
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-6 py-6 space-y-6">
        {/* KPIs */}
        <div className="sticky top-[95px] z-30 bg-gray-50 pb-3">
          <ResumoResultados resultados={resultadosAtuais} config={config} />
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-end print:hidden">
            <div className="inline-flex items-center rounded-sm border border-gray-200 bg-white p-0.5">
              <Button
                type="button"
                size="sm"
                variant={viewMode === "tempo" ? "default" : "ghost"}
                onClick={() => setViewMode("tempo")}
                className="h-7 px-2.5 text-[10px]"
              >
                Tempo
              </Button>
              <Button
                type="button"
                size="sm"
                variant={viewMode === "percentagem" ? "default" : "ghost"}
                onClick={() => setViewMode("percentagem")}
                className="h-7 px-2.5 text-[10px]"
              >
                Percentagem
              </Button>
            </div>
          </div>

          <DashboardResultados
            resultados={resultadosAtuais}
            operadores={operadores}
            operacoes={operacoes}
            config={configAtual}
            onRecalcular={handleRecalcular}
            viewMode={viewMode}
            onConfirmarEdicao={handleConfirmarEdicao}
            isAjustando={isAjustando}
          />

          <VisualizadorFluxo
            resultados={resultadosAtuais}
            operadores={operadores}
            operacoes={operacoes}
            layoutConfig={dataSource.layoutConfig}
          />
        </div>
      </main>
    </div>
  );
}

