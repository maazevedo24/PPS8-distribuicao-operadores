import { HistoricoBalanceamento } from "../types";

const STORAGE_KEY = "balanceamento_historico";
const MAX_HISTORICO = 50; // Limite de registros guardados

export const salvarHistorico = (historico: HistoricoBalanceamento): void => {
  try {
    const historicoAtual = obterHistorico();
    const novoHistorico = [historico, ...historicoAtual].slice(0, MAX_HISTORICO);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novoHistorico));
  } catch (error) {
    console.error("Erro ao salvar histórico:", error);
  }
};

export const obterHistorico = (): HistoricoBalanceamento[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    
    const historico = JSON.parse(data);
    // Converter strings de data para objetos Date
    return historico.map((item: any) => ({
      ...item,
      timestamp: new Date(item.timestamp),
    }));
  } catch (error) {
    console.error("Erro ao obter histórico:", error);
    return [];
  }
};

export const limparHistorico = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Erro ao limpar histórico:", error);
  }
};

export const removerItemHistorico = (id: string): void => {
  try {
    const historico = obterHistorico();
    const novoHistorico = historico.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novoHistorico));
  } catch (error) {
    console.error("Erro ao remover item do histórico:", error);
  }
};

export const obterEstatisticas = () => {
  const historico = obterHistorico();
  
  if (historico.length === 0) {
    return {
      totalCalculos: 0,
      oleMedio: 0,
      perdasMedia: 0,
      melhorConfiguracao: null,
      taktTimeMedio: 0,
    };
  }

  const oleMedio = historico.reduce((sum, h) => sum + h.oleMedia, 0) / historico.length;
  const perdasMedia = historico.reduce((sum, h) => sum + h.resultados.perdas, 0) / historico.length;
  const taktTimeMedio = historico.reduce((sum, h) => sum + h.resultados.taktTime, 0) / historico.length;

  // Melhor configuração = menor perdas
  const melhorConfiguracao = historico.reduce((melhor, atual) => 
    atual.resultados.perdas < melhor.resultados.perdas ? atual : melhor
  );

  return {
    totalCalculos: historico.length,
    oleMedio,
    perdasMedia,
    melhorConfiguracao,
    taktTimeMedio,
  };
};

// Gerar histórico mock para demonstração
export const gerarHistoricoDemo = (): void => {
  const historicoDemo: HistoricoBalanceamento[] = [];
  const dataBase = new Date();
  
  // Simular evolução ao longo de 15 dias com tendência de melhoria
  const configuracoes = [
    { ole: 72, perdas: 28, ops: 8, metodo: 1 as 1 | 2 | 3, produto: "GRUPO001" },
    { ole: 75, perdas: 25, ops: 8, metodo: 1 as 1 | 2 | 3, produto: "GRUPO001" },
    { ole: 73, perdas: 27, ops: 7, metodo: 2 as 1 | 2 | 3, produto: "GRUPO002" },
    { ole: 78, perdas: 22, ops: 7, metodo: 1 as 1 | 2 | 3, produto: "GRUPO001" },
    { ole: 76, perdas: 24, ops: 8, metodo: 3 as 1 | 2 | 3, produto: "GRUPO003" },
    { ole: 81, perdas: 19, ops: 7, metodo: 1 as 1 | 2 | 3, produto: "GRUPO002" },
    { ole: 79, perdas: 21, ops: 8, metodo: 2 as 1 | 2 | 3, produto: "GRUPO001" },
    { ole: 84, perdas: 16, ops: 7, metodo: 1 as 1 | 2 | 3, produto: "GRUPO002" },
    { ole: 82, perdas: 18, ops: 8, metodo: 1 as 1 | 2 | 3, produto: "GRUPO005" },
    { ole: 86, perdas: 14, ops: 7, metodo: 2 as 1 | 2 | 3, produto: "GRUPO001" },
    { ole: 85, perdas: 15, ops: 7, metodo: 1 as 1 | 2 | 3, produto: "GRUPO004" },
    { ole: 88, perdas: 12, ops: 7, metodo: 1 as 1 | 2 | 3, produto: "GRUPO001" },
    { ole: 87, perdas: 13, ops: 8, metodo: 3 as 1 | 2 | 3, produto: "GRUPO003" },
    { ole: 91, perdas: 9, ops: 7, metodo: 1 as 1 | 2 | 3, produto: "GRUPO002" },
    { ole: 89, perdas: 11, ops: 7, metodo: 1 as 1 | 2 | 3, produto: "GRUPO005" },
  ];

  const produtosInfo = {
    "GRUPO001": { nome: "Calças", ref: "GA-CALCAS" },
    "GRUPO002": { nome: "Camisolas", ref: "GA-CAMISOLAS" },
    "GRUPO003": { nome: "Casacos", ref: "GA-CASACOS" },
    "GRUPO004": { nome: "Vestidos", ref: "GA-VESTIDOS" },
    "GRUPO005": { nome: "Roupa Interior", ref: "GA-INTERIOR" },
  };

  configuracoes.forEach((config, index) => {
    const data = new Date(dataBase);
    data.setDate(data.getDate() - (configuracoes.length - index - 1));
    
    const prodInfo = produtosInfo[config.produto as keyof typeof produtosInfo];
    
    historicoDemo.push({
      id: `DEMO_${Date.now()}_${index}`,
      timestamp: data,
      unidade: ((index % 3) + 1) as 1 | 2 | 3,
      produtoId: config.produto,
      produtoNome: prodInfo.nome,
      produtoReferencia: prodInfo.ref,
      metodo: config.metodo,
      resultados: {
        distribuicao: Array.from({ length: config.ops }, (_, i) => ({
          operadorId: `OP${String(i + 1).padStart(3, "0")}`,
          operacoes: i < 3 ? ["Fechar vista", "Virar"] : ["Pregar gola"],
          cargaHoraria: 6.5 + Math.random() * 1,
          ocupacao: config.ole + (Math.random() * 10 - 5),
          ciclosPorHora: 45 + Math.random() * 10,
        })),
        numeroCiclosPorHora: 360 + Math.random() * 40,
        taktTime: 0.16 + Math.random() * 0.02,
        tempoCiclo: 12.5 + Math.random() * 2,
        produtividade: config.ole,
        perdas: config.perdas,
        numeroOperadores: config.ops,
      },
      configuracao: {
        possibilidade: config.metodo,
        horasTurno: 8,
        produtividadeEstimada: 85,
        agruparMaquinas: true,
        cargaMaximaOperador: 95,
        naoDividirMaiorQue: 5.0,
        naoDividirMenorQue: 0.3,
      },
      oleMedia: config.ole,
      numeroOperacoes: 21,
    });
  });

  // Guardar no localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(historicoDemo));
  } catch (error) {
    console.error("Erro ao gerar histórico demo:", error);
  }
};