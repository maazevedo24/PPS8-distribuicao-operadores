import { Operador, Operacao, ConfiguracaoDistribuicao, ResultadosBalanceamento, DistribuicaoCarga } from "../types";

/**
 * Encontra o índice do operador com menor carga horária atual
 */
function encontrarOperadorMenosCarga(distribuicao: DistribuicaoCarga[]): number {
  let minIndex = 0;
  let minCarga = distribuicao[0].cargaHoraria;
  for (let i = 1; i < distribuicao.length; i++) {
    if (distribuicao[i].cargaHoraria < minCarga) {
      minCarga = distribuicao[i].cargaHoraria;
      minIndex = i;
    }
  }
  return minIndex;
}

/**
 * Encontra o próximo operador disponível que ainda não atingiu 100% de carga
 * (atribuição sequencial por ordem de ID)
 */
function encontrarProximoOperadorSequencial(
  distribuicao: DistribuicaoCarga[], 
  cargaMaxima: number
): number {
  // Procura o primeiro operador que ainda tem capacidade
  for (let i = 0; i < distribuicao.length; i++) {
    if (distribuicao[i].cargaHoraria < cargaMaxima) {
      return i;
    }
  }
  // Se todos estão cheios, retorna o último (vai ficar sobrecarregado)
  return distribuicao.length - 1;
}

export function calcularBalanceamento(
  operadores: Operador[],
  operacoes: Operacao[],
  config: ConfiguracaoDistribuicao
): ResultadosBalanceamento {
  // Ordenar operações por sequência
  const operacoesOrdenadas = [...operacoes].sort((a, b) => a.sequencia - b.sequencia);
  
  // Tempo total de todas as operações
  const tempoTotal = operacoesOrdenadas.reduce((acc, op) => acc + op.tempo, 0);
  
  // Horas do turno em minutos
  const horasTurno = config.horasTurno || 8;
  const minutosDisponiveis = horasTurno * 60;
  
  let numeroOperadores: number;
  
  // Determinar número de operadores baseado na possibilidade
  switch (config.possibilidade) {
    case 1: {
      // Distribuição ideal - calcular operadores necessários
      const produtividade = (config.produtividadeEstimada || 100) / 100;
      const minutosEfetivos = minutosDisponiveis * produtividade;
      const cargaMaxMinutos = (minutosEfetivos * config.cargaMaximaOperador) / 100;
      numeroOperadores = Math.max(1, Math.ceil(tempoTotal / cargaMaxMinutos));
      break;
    }
    case 2: {
      // Baseado em quantidade objetivo
      const quantidadeObjetivo = config.quantidadeObjetivo || 100;
      const taktTimeNecessario = minutosDisponiveis / quantidadeObjetivo;
      numeroOperadores = Math.max(1, Math.ceil(tempoTotal / taktTimeNecessario));
      break;
    }
    case 3: {
      // Número fixo de operadores
      numeroOperadores = config.numeroOperadores || operadores.length;
      break;
    }
    default:
      numeroOperadores = operadores.length;
      break;
  }
  
  // Limitar ao número de operadores disponíveis
  numeroOperadores = Math.min(numeroOperadores, operadores.length);
  numeroOperadores = Math.max(1, numeroOperadores);
  
  // Selecionar operadores e ordenar por ID (ordem alfanumérica)
  const operadoresSelecionados = [...operadores]
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, numeroOperadores);
  
  // Calcular carga máxima ideal por operador (takt time estimado)
  // Para distribuição sequencial, cada operador deve ter aproximadamente tempoTotal/numeroOperadores
  const cargaIdealPorOperador = tempoTotal / numeroOperadores;
  
  // Inicializar distribuição
  const distribuicao: DistribuicaoCarga[] = operadoresSelecionados.map(op => ({
    operadorId: op.id,
    operacoes: [],
    cargaHoraria: 0,
    ocupacao: 0,
    pecasHora: 0,
  }));

  // Atribuição sequencial com balanceamento: 
  // - Preencher operadores por ordem de ID
  // - Mas se adicionar uma operação ultrapassar muito a carga ideal, passa para o próximo operador
  // - Tolerância: aceita até 20% acima da carga ideal antes de mudar
  let operadorAtualIdx = 0;
  const tolerancia = 1.2; // 20% de tolerância acima da carga ideal
  
  console.log('=== DEBUG BALANCEAMENTO ===');
  console.log('Número de operadores:', numeroOperadores);
  console.log('Tempo total:', tempoTotal);
  console.log('Carga ideal por operador:', cargaIdealPorOperador);
  console.log('Carga máxima permitida (com tolerância):', cargaIdealPorOperador * tolerancia);
  console.log('Operadores selecionados:', operadoresSelecionados.map(op => op.id));
  
  operacoesOrdenadas.forEach((op, idx) => {
    // Verificar se adicionar esta operação ao operador atual ultrapassaria muito a carga ideal
    const cargaAposAdicionar = distribuicao[operadorAtualIdx].cargaHoraria + op.tempo;
    
    // Se ultrapassar a tolerância E ainda houver operadores disponíveis, tenta o próximo
    if (operadorAtualIdx < distribuicao.length - 1 && 
        cargaAposAdicionar > cargaIdealPorOperador * tolerancia) {
      console.log(`Adicionar ${op.id} (${op.tempo}min) a ${distribuicao[operadorAtualIdx].operadorId} resultaria em ${cargaAposAdicionar.toFixed(2)}min (limite: ${(cargaIdealPorOperador * tolerancia).toFixed(2)}) - mudando para próximo`);
      operadorAtualIdx++;
    }
    
    // Atribui a operação ao operador atual
    console.log(`Op ${idx + 1}/${operacoesOrdenadas.length}: ${op.id} (${op.tempo}min) -> ${distribuicao[operadorAtualIdx].operadorId}`);
    distribuicao[operadorAtualIdx].operacoes.push(op.id);
    distribuicao[operadorAtualIdx].cargaHoraria += op.tempo;
  });
  
  console.log('=== RESULTADO ===');
  distribuicao.forEach(d => {
    console.log(`${d.operadorId}: ${d.cargaHoraria.toFixed(2)}min, ${d.operacoes.length} operações`);
  });
  console.log('===================');
  
  // Tempo de ciclo = carga do operador mais carregado (bottleneck)
  const tempoCiclo = Math.max(...distribuicao.map(d => d.cargaHoraria));
  
  // Calcular métricas finais - ocupação em relação ao bottleneck
  distribuicao.forEach(d => {
    // Ocupação é relativa ao tempo de ciclo (bottleneck), não ao turno
    d.ocupacao = tempoCiclo > 0 ? (d.cargaHoraria / tempoCiclo) * 100 : 0;
    if (d.operacoes.length > 0 && d.cargaHoraria > 0) {
      d.ciclosPorHora = 60 / d.cargaHoraria;
    } else {
      d.ciclosPorHora = 0;
    }
  });
  
  // Ciclos por hora limitado pelo bottleneck
  const numeroCiclosPorHora = tempoCiclo > 0 ? 60 / tempoCiclo : 0;
  
  // Calcular TAKT time baseado no modo de balanceamento
  let taktTime: number;
  switch (config.possibilidade) {
    case 2: {
      // Por quantidade objetivo - TAKT time = tempo disponível / quantidade objetivo
      const quantidadeObjetivo = config.quantidadeObjetivo || 100;
      taktTime = minutosDisponiveis / quantidadeObjetivo;
      break;
    }
    case 3: {
      // Por número de operadores - TAKT time = tempo de ciclo (bottleneck)
      taktTime = tempoCiclo;
      break;
    }
    case 1:
    default: {
      // Distribuição ideal - TAKT time = tempo de ciclo (bottleneck)
      taktTime = tempoCiclo;
      break;
    }
  }
  
  // Produtividade = média da ocupação
  const ocupacaoMedia = distribuicao.reduce((acc, d) => acc + d.ocupacao, 0) / distribuicao.length;
  const produtividade = Math.min(ocupacaoMedia, 100);
  const perdas = 100 - produtividade;
  
  return {
    distribuicao,
    numeroCiclosPorHora,
    taktTime,
    tempoCiclo,
    produtividade,
    perdas,
    numeroOperadores,
  };
}