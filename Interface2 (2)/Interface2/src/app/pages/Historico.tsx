import { useState, useMemo } from "react";
import { HistoricoBalanceamento } from "../types";
import { obterHistorico, removerItemHistorico, limparHistorico, obterEstatisticas, gerarHistoricoDemo } from "../utils/historico";
import { useStorage } from "../contexts/StorageContext";
import { Calendar, TrendingDown, TrendingUp, BarChart3, Trash2, Filter, X, Database } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";

export default function Historico() {
  const { salvar } = useStorage();
  const [historico, setHistorico] = useState<HistoricoBalanceamento[]>(() => {
    // Carregar do contexto (que leu do ficheiro) OU do localStorage como fallback
    return obterHistorico();
  });
  const [filtroUnidade, setFiltroUnidade] = useState<string>("all");
  const [filtroMetodo, setFiltroMetodo] = useState<string>("all");
  const [filtroOperador, setFiltroOperador] = useState<string>("all");
  const [filtroMaquina, setFiltroMaquina] = useState<string>("all");
  const [filtroArtigo, setFiltroArtigo] = useState<string>("all");
  const [comparar, setComparar] = useState<string[]>([]);

  const estatisticas = useMemo(() => obterEstatisticas(), [historico]);

  // Extrair listas únicas para filtros
  const operadoresUnicos = useMemo(() => {
    const ops = new Set<number>();
    historico.forEach(item => ops.add(item.resultados.numeroOperadores));
    return Array.from(ops).sort((a, b) => a - b);
  }, [historico]);

  const artigosUnicos = useMemo(() => {
    const artigos = new Map<string, string>();
    historico.forEach(item => {
      artigos.set(item.produtoId, item.produtoNome);
    });
    return Array.from(artigos.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [historico]);

  const historicoFiltrado = useMemo(() => {
    return historico.filter((item) => {
      const matchUnidade = filtroUnidade === "all" || item.unidade.toString() === filtroUnidade;
      const matchMetodo = filtroMetodo === "all" || item.metodo.toString() === filtroMetodo;
      const matchOperador = filtroOperador === "all" || item.resultados.numeroOperadores.toString() === filtroOperador;
      const matchArtigo = filtroArtigo === "all" || item.produtoId === filtroArtigo;
      
      // Filtro por máquina: extrair operações únicas do histórico
      let matchMaquina = true;
      if (filtroMaquina !== "all") {
        const operacoesUnicas = new Set<string>();
        item.resultados.distribuicao.forEach(dist => {
          dist.operacoes.forEach(op => operacoesUnicas.add(op));
        });
        matchMaquina = operacoesUnicas.size.toString() === filtroMaquina;
      }
      
      return matchUnidade && matchMetodo && matchOperador && matchMaquina && matchArtigo;
    });
  }, [historico, filtroUnidade, filtroMetodo, filtroOperador, filtroMaquina, filtroArtigo]);

  const handleRemoverItem = (id: string) => {
    if (window.confirm("Tem certeza que deseja remover este registro?")) {
      removerItemHistorico(id);
      const novoHistorico = obterHistorico();
      setHistorico(novoHistorico);
      setComparar(comparar.filter((c) => c !== id));
      // Guardar no ficheiro
      salvar({ historico: novoHistorico });
    }
  };

  const handleLimparHistorico = () => {
    if (window.confirm("Tem certeza que deseja limpar todo o histórico? Esta ação não pode ser desfeita.")) {
      limparHistorico();
      setHistorico([]);
      setComparar([]);
      // Guardar no ficheiro
      salvar({ historico: [] });
    }
  };

  const handleToggleComparar = (id: string) => {
    if (comparar.includes(id)) {
      setComparar(comparar.filter((c) => c !== id));
    } else if (comparar.length < 3) {
      setComparar([...comparar, id]);
    } else {
      alert("Pode comparar no máximo 3 registros de cada vez.");
    }
  };

  const registrosComparados = useMemo(() => {
    return comparar.map((id) => historico.find((h) => h.id === id)).filter(Boolean) as HistoricoBalanceamento[];
  }, [comparar, historico]);

  // Dados para o gráfico de evolução
  const dadosGrafico = useMemo(() => {
    return historicoFiltrado
      .slice()
      .reverse()
      .map((item, index) => ({
        data: new Date(item.timestamp).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
        dataKey: `${new Date(item.timestamp).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })}_${index}`,
        perdas: item.resultados.perdas,
        ole: item.oleMedia,
        taktTime: item.resultados.taktTime * 60,
      }));
  }, [historicoFiltrado]);

  const getMetodoNome = (metodo: 1 | 2 | 3): string => {
    switch (metodo) {
      case 1:
        return "Distribuição Ideal";
      case 2:
        return "Por Quantidade";
      case 3:
        return "Nº Fixo Operadores";
      default:
        return "Desconhecido";
    }
  };

  return (
    <main className="w-full px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Histórico de Balanceamentos</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Análise e comparação de cálculos anteriores
          </p>
        </div>
        {historico.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleLimparHistorico}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Limpar Histórico
          </Button>
        )}
      </div>

      {historico.length === 0 ? (
        <div className="bg-white rounded-sm border border-gray-200 p-12 text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sem histórico disponível</h3>
          <p className="text-gray-500 text-sm mb-6">
            Realize cálculos de balanceamento para começar a construir seu histórico de comparações.
          </p>
          <Button
            onClick={() => {
              gerarHistoricoDemo();
              const novoHistorico = obterHistorico();
              setHistorico(novoHistorico);
              // Guardar no ficheiro
              salvar({ historico: novoHistorico });
            }}
            className="bg-blue-500 hover:bg-blue-600 rounded-sm text-sm"
          >
            <Database className="w-4 h-4 mr-2" />
            Gerar Dados de Demonstração
          </Button>
        </div>
      ) : (
        <>
          {/* Estatísticas Gerais */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-sm flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Total Cálculos</div>
                  <div className="text-2xl font-bold text-gray-900">{estatisticas.totalCalculos}</div>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-sm flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">OLE Médio</div>
                  <div className="text-2xl font-bold text-gray-900">{estatisticas.oleMedio.toFixed(1)}%</div>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-orange-100 rounded-sm flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Perdas Médias</div>
                  <div className="text-2xl font-bold text-gray-900">{estatisticas.perdasMedia.toFixed(1)}%</div>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-sm border border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-sm flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Takt Time Médio</div>
                  <div className="text-2xl font-bold text-gray-900">{(estatisticas.taktTimeMedio * 60).toFixed(1)}s</div>
                </div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="bg-white p-5 rounded-sm border border-gray-200">
            <div className="flex items-center gap-4">
              <Filter className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-semibold text-gray-900">Filtros:</span>
              <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
                <SelectTrigger className="w-[200px] rounded-sm text-sm">
                  <SelectValue placeholder="Todas as linhas" />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  <SelectItem value="all">Todas as linhas</SelectItem>
                  <SelectItem value="1">Linha 1</SelectItem>
                  <SelectItem value="2">Linha 2</SelectItem>
                  <SelectItem value="3">Linha 3</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroMetodo} onValueChange={setFiltroMetodo}>
                <SelectTrigger className="w-[200px] rounded-sm text-sm">
                  <SelectValue placeholder="Todos os métodos" />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  <SelectItem value="all">Todos os métodos</SelectItem>
                  <SelectItem value="1">Distribuição Ideal</SelectItem>
                  <SelectItem value="2">Por Quantidade</SelectItem>
                  <SelectItem value="3">Nº Fixo Operadores</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroOperador} onValueChange={setFiltroOperador}>
                <SelectTrigger className="w-[200px] rounded-sm text-sm">
                  <SelectValue placeholder="Todos os operadores" />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  <SelectItem value="all">Todos os operadores</SelectItem>
                  {operadoresUnicos.map(op => (
                    <SelectItem key={op} value={op.toString()}>{op} Operador(es)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filtroMaquina} onValueChange={setFiltroMaquina}>
                <SelectTrigger className="w-[200px] rounded-sm text-sm">
                  <SelectValue placeholder="Todas as máquinas" />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  <SelectItem value="all">Todas as máquinas</SelectItem>
                  <SelectItem value="1">1 Máquina</SelectItem>
                  <SelectItem value="2">2 Máquinas</SelectItem>
                  <SelectItem value="3">3 Máquinas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroArtigo} onValueChange={setFiltroArtigo}>
                <SelectTrigger className="w-[200px] rounded-sm text-sm">
                  <SelectValue placeholder="Todos os artigos" />
                </SelectTrigger>
                <SelectContent className="rounded-sm">
                  <SelectItem value="all">Todos os artigos</SelectItem>
                  {artigosUnicos.map(([id, nome]) => (
                    <SelectItem key={id} value={id}>{nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(filtroUnidade !== "all" || filtroMetodo !== "all" || filtroOperador !== "all" || filtroMaquina !== "all" || filtroArtigo !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFiltroUnidade("all");
                    setFiltroMetodo("all");
                    setFiltroOperador("all");
                    setFiltroMaquina("all");
                    setFiltroArtigo("all");
                  }}
                  className="text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Limpar Filtros
                </Button>
              )}
            </div>
          </div>

          {/* Painel de Comparação */}
          {comparar.length > 0 && (
            <div className="bg-blue-50 p-6 rounded-sm border-2 border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-blue-900">
                  Comparação ({comparar.length}/3)
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setComparar([])}
                  className="text-blue-700 hover:text-blue-800 hover:bg-blue-100"
                >
                  <X className="w-4 h-4 mr-1" />
                  Limpar Seleção
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {registrosComparados.map((item) => (
                  <div key={item.id} className="bg-white p-4 rounded-sm border border-blue-200">
                    <div className="text-xs font-mono text-blue-600 mb-1">
                      {new Date(item.timestamp).toLocaleString("pt-PT")}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 mb-3">
                      {item.produtoNome}
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Linha:</span>
                        <span className="font-semibold text-gray-900">{item.unidade}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Método:</span>
                        <span className="font-semibold text-gray-900">{getMetodoNome(item.metodo)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Operadores:</span>
                        <span className="font-semibold text-gray-900">{item.resultados.numeroOperadores}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Perdas:</span>
                        <span className="font-semibold text-orange-600">{item.resultados.perdas.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">OLE Médio:</span>
                        <span className="font-semibold text-green-600">{item.oleMedia.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Takt Time:</span>
                        <span className="font-semibold text-gray-900">{(item.resultados.taktTime * 60).toFixed(1)}s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ciclos/Hora:</span>
                        <span className="font-semibold text-gray-900">{((item.resultados.numeroCiclosPorHora ?? (item.resultados as any).numeroPecasHora ?? 0)).toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabela de Histórico */}
          <div className="bg-white rounded-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-10">
                      Comparar
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Data/Hora
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Linha
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Grupo de Artigo
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Método
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Operadores
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      OLE Médio
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Perdas
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Takt Time
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase">
                      Ciclos/Hora
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-600 uppercase w-10">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {historicoFiltrado.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        comparar.includes(item.id) ? "bg-blue-50" : ""
                      }`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={comparar.includes(item.id)}
                          onChange={() => handleToggleComparar(item.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-3 font-mono text-xs text-gray-700">
                        {new Date(item.timestamp).toLocaleString("pt-PT", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-sm text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                          L{item.unidade}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-900">
                        <div className="font-medium">{item.produtoNome}</div>
                        <div className="text-xs text-gray-500 font-mono">{item.produtoReferencia}</div>
                      </td>
                      <td className="p-3 text-xs text-gray-700">{getMetodoNome(item.metodo)}</td>
                      <td className="p-3 font-mono text-sm text-gray-700 text-center">
                        {item.resultados.numeroOperadores}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-sm text-xs font-semibold font-mono ${
                            item.oleMedia >= 85
                              ? "bg-green-100 text-green-800 border border-green-200"
                              : item.oleMedia >= 75
                              ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                              : "bg-red-100 text-red-800 border border-red-200"
                          }`}
                        >
                          {item.oleMedia.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-sm text-xs font-semibold font-mono ${
                            item.resultados.perdas <= 10
                              ? "bg-green-100 text-green-800 border border-green-200"
                              : item.resultados.perdas <= 20
                              ? "bg-yellow-100 text-yellow-800 border border-yellow-200"
                              : "bg-red-100 text-red-800 border border-red-200"
                          }`}
                        >
                          {item.resultados.perdas.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3 font-mono text-sm text-gray-700">
                        {(item.resultados.taktTime * 60).toFixed(1)}s
                      </td>
                      <td className="p-3 font-mono text-sm text-gray-700">
                        {((item.resultados.numeroCiclosPorHora ?? (item.resultados as any).numeroPecasHora ?? 0)).toFixed(0)}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => handleRemoverItem(item.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gráfico de Evolução */}
          {dadosGrafico.length > 1 && (
            <div className="bg-white p-6 rounded-sm border border-gray-200">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Tendência do OLE</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dadosGrafico} id="ole-trend-chart">
                  <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis key="xaxis" dataKey="dataKey" stroke="#6b7280" style={{ fontSize: "12px" }} tickFormatter={(v) => v.split("_")[0]} />
                  <YAxis 
                    key="yaxis"
                    stroke="#6b7280" 
                    style={{ fontSize: "12px" }} 
                    domain={[0, 100]} 
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip 
                    key="tooltip"
                    contentStyle={{ 
                      backgroundColor: "#fff", 
                      border: "1px solid #e5e7eb",
                      borderRadius: "4px",
                      fontSize: "12px"
                    }}
                    formatter={(value: any) => [`${Number(value).toFixed(1)}%`, "OLE Médio"]}
                  />
                  <Legend key="legend" wrapperStyle={{ fontSize: "12px" }} />
                  <ReferenceLine key="ref-85" y={85} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} />
                  <Line 
                    key="line-ole"
                    type="monotone" 
                    dataKey="ole" 
                    stroke="#10b981" 
                    name="OLE Médio (%)" 
                    strokeWidth={2.5} 
                    dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                    activeDot={{ r: 6, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </main>
  );
}