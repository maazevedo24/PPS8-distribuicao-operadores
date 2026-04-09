export interface Operador {
  id: string;
  competencias: { 
    [posicao: string]: { 
      operacao: string | null; 
      ole: number; 
    } | null 
  }; // POL_1, POL_2, etc. -> operação e OLE% específico
  oleHistorico: number; // OLE% histórico geral
  competenciasPorGrupo?: { [grupoId: string]: number }; // OLE% médio por grupo de artigo
}

export interface Operacao {
  id: string;
  nome: string;
  tipoMaquina: string;
  tipoMaquina2?: string; // segunda máquina (quando a operação usa 2 máquinas em simultâneo)
  largura: number; // largura da máquina (sempre especificada)
  ponto?: string; // tipo de ponto (opcional)
  setup?: string; // configuração de setup (opcional)
  permitirAgrupamento: boolean; // se pode ser agrupada com outras máquinas idênticas
  tempo: number; // minutos
  sequencia: number;
  critica?: boolean; // operação crítica (gargalo ou prioritária)
}

export interface Maquina {
  id: string;
  tipo: string; // ex: "P/P1", "P/C N flat lock"
  fabricante?: string;
  modelo?: string;
  largura: number; // em mm - sempre especificada
  ponto?: string; // tipo de ponto (ex: "301", "401", "605")
  setup: string; // configuração de setup (ex: "Standard", "Presilhas", "Elástico")
  permitirAgrupamento: boolean; // se pode ser agrupada com máquinas idênticas
  quantidade: number; // quantas máquinas deste tipo estão disponíveis
  operacoesCompativeis: string[]; // nomes das operações que esta máquina pode executar
  ativa: boolean; // se está disponível para uso
  observacoes?: string;
}

export interface GrupoArtigo {
  id: string;
  nome: string;
  referencia: string;
  cliente?: string;
  descricao?: string;
  operacoes: Operacao[];
  dataCriacao: string;
  dataModificacao: string;
}

// Alias para manter compatibilidade
export type Produto = GrupoArtigo;

export interface ConfiguracaoDistribuicao {
  possibilidade: 1 | 2 | 3 | 4;
  quantidadeObjetivo?: number; // peças/dia (possibilidade 2)
  numeroOperadores?: number; // (possibilidade 3)
  horasTurno: number; // horas disponíveis no turno (possibilidade 1)
  produtividadeEstimada: number; // percentagem estimada (possibilidade 1)
  agruparMaquinas: boolean;
  cargaMaximaOperador: number; // percentagem máxima de carga por operador
  naoDividirMaiorQue: number; // minutos - não dividir operações maiores que X
  naoDividirMenorQue: number; // minutos - não dividir operações menores que X
}

export type TipoLayout = "linha" | "espinha";

export interface PostoTrabalho {
  id: string;
  numero: number; // 1-16 (ou 1-8 para linha)
  lado?: "A" | "B"; // apenas para layout espinha
  operacaoId?: string | null;
  tipoMaquina?: string | null;
  operadorId?: string | null;
  posicaoX?: number; // para visualização
  posicaoY?: number; // para visualização
}

export interface ConfiguracaoLayout {
  tipo: TipoLayout;
  postosPorLado: number; // número de postos por lado (espinha) ou total (linha)
  distanciaMaxima: number; // quantas máquinas o operador pode avançar/regressar
  permitirRetrocesso: boolean; // permite voltar atrás na sequência
  postos: PostoTrabalho[];
  restricoesProximidade?: RestricaoProximidade[]; // sugestões/obrigações de proximidade
}

export interface RestricaoProximidade {
  id: string;
  tipoMaquina1: string;
  tipoMaquina2: string;
  distanciaMaxima: number; // em número de postos
  obrigatoria: boolean; // true = restrição, false = sugestão
  motivo?: string; // razão da restrição (ex: "transferência de material pesado")
}

export interface DistribuicaoCarga {
  operadorId: string;
  operacoes: string[];
  cargaHoraria: number;
  ocupacao: number;
  ciclosPorHora: number;
}

export interface ResultadosBalanceamento {
  distribuicao: DistribuicaoCarga[];
  numeroCiclosPorHora: number;
  taktTime: number; // minutos
  tempoCiclo: number; // minutos
}

export interface HistoricoBalanceamento {
  id: string;
  timestamp: Date;
  unidade: 1 | 2 | 3;
  produtoId: string;
  produtoNome: string;
  produtoReferencia: string;
  metodo: 1 | 2 | 3;
  resultados: ResultadosBalanceamento;
  configuracao: ConfiguracaoDistribuicao;
  oleMedia: number;
  numeroOperacoes: number;
}

export interface LogOperacao {
  id: string;
  timestamp: Date;
  tipo: 'adicionar' | 'remover' | 'editar';
  entidade: 'operador' | 'maquina' | 'operacao';
  entidadeId: string;
  entidadeNome?: string;
  detalhes?: any;
}