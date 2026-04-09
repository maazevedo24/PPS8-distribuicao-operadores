import { useLocation, useNavigate } from "react-router";
import { ResultadosBalanceamento, DistribuicaoCarga, ConfiguracaoDistribuicao } from "../types";
import { DashboardResultados } from "../components/DashboardResultados";
import { TabelaDistribuicao } from "../components/TabelaDistribuicao";
import { VisualizadorFluxo } from "../components/VisualizadorFluxo";
import { ResumoResultados } from "../components/ResumoResultados";
import { Button } from "../components/ui/button";
import { ArrowLeft, Download, Printer, Calculator } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { useEffect, useState, useCallback } from "react";

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

  // Estado para resultados editáveis — recalcula outputs globais quando a distribuição muda
  const [resultadosAtuais, setResultadosAtuais] = useState<ResultadosBalanceamento>(resultados);
  const [configAtual, setConfigAtual] = useState<ConfiguracaoDistribuicao>(config);

  const handleDistribuicaoChange = useCallback((novaDistribuicao: DistribuicaoCarga[]) => {
    // Tempo total de todas as operações
    const tempoTotal = operacoes.reduce((sum: number, op: any) => sum + op.tempo, 0);
    
    // Tempo de ciclo = carga do operador mais carregado (bottleneck)
    const tempoCiclo = Math.max(...novaDistribuicao.map((d) => d.cargaHoraria));
    
    // Takt time mantém-se (baseado na procura, não na distribuição)
    const taktTime = resultados.taktTime;
    
    // Ciclos por hora = 60 / tempo de ciclo (bottleneck)
    const numeroCiclosPorHora = tempoCiclo > 0 ? 60 / tempoCiclo : 0;
    
    // Número de operadores com pelo menos 1 operação
    const numOperadoresAtivos = novaDistribuicao.filter((d) => d.operacoes.length > 0).length;
    
    // Produtividade (eficiência de linha) = tempoTotal / (nOps * tempoCiclo) * 100
    const produtividade = numOperadoresAtivos > 0 && tempoCiclo > 0
      ? (tempoTotal / (numOperadoresAtivos * tempoCiclo)) * 100
      : 0;
    
    // Perdas = 100 - produtividade
    const perdas = Math.max(0, 100 - produtividade);

    setResultadosAtuais({
      distribuicao: novaDistribuicao,
      taktTime,
      tempoCiclo,
      numeroCiclosPorHora,
      produtividade,
      perdas,
      numeroOperadores: resultados.numeroOperadores,
    });
  }, [operacoes, resultados.taktTime, resultados.numeroOperadores]);

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
                    Análise de Resultados
                  </h1>
                  <p className="text-gray-500 text-[10px]">
                    Relatório do balanceamento calculado
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
        {/* Tabs */}
        <Tabs defaultValue="dashboard" className="space-y-3">
          {/* Tabs + KPIs numa linha */}
          <div className="sticky top-[95px] z-30 bg-gray-50 pb-3">
            <div className="flex gap-4 items-end">
              {/* Tab List */}
              <TabsList className="print:hidden bg-white h-9 px-[5px] py-px rounded-md border border-[#e5e7eb] shrink-0">
                <TabsTrigger 
                  value="dashboard" 
                  className="data-[state=active]:bg-[#2b7fff] data-[state=active]:text-white h-[25px] px-[9px] py-[5px] rounded-md text-[12px] font-medium"
                >
                  Dashboard
                </TabsTrigger>
                <TabsTrigger 
                  value="distribuicao" 
                  className="data-[state=active]:bg-[#2b7fff] data-[state=active]:text-white h-[25px] px-[9px] py-[5px] rounded-md text-[12px] font-medium"
                >
                  Distribuição
                </TabsTrigger>
                <TabsTrigger 
                  value="fluxo" 
                  className="data-[state=active]:bg-[#2b7fff] data-[state=active]:text-white h-[25px] px-[9px] py-[5px] rounded-md text-[12px] font-medium"
                >
                  Visualização
                </TabsTrigger>
              </TabsList>

              {/* KPIs inline - ocupa todo o espaço restante */}
              <ResumoResultados resultados={resultadosAtuais} config={config} />
            </div>
          </div>

          <TabsContent value="dashboard" className="space-y-6">
            <DashboardResultados
              resultados={resultadosAtuais}
              operadores={operadores}
              operacoes={operacoes}
              config={configAtual}
              onRecalcular={handleRecalcular}
            />
          </TabsContent>

          <TabsContent value="distribuicao" className="space-y-6">
            <TabelaDistribuicao
              resultados={resultadosAtuais}
              operadores={operadores}
              operacoes={operacoes}
              onDistribuicaoChange={handleDistribuicaoChange}
            />
          </TabsContent>

          <TabsContent value="fluxo" className="space-y-6">
            <VisualizadorFluxo
              resultados={resultadosAtuais}
              operadores={operadores}
              operacoes={operacoes}
              layoutConfig={dataSource.layoutConfig}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}