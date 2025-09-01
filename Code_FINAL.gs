function executarAtualizacaoCompleta() {
  Logger.log("== INICIANDO executarAtualizacaoCompleta ==");
  SpreadsheetApp.getActiveSpreadsheet().toast("Iniciando processamento...");
  const isDataUpdateComplete = atualizarDadosDiarios();
  if (isDataUpdateComplete) {
    Logger.log("Atualização de dados diários concluída. Iniciando nova análise estatística...");
    gerarRecomendacoesEstatisticas();
  }
  Logger.log("== SUCESSO: executarAtualizacaoCompleta concluído. ==");
}

function resetarProgresso() {
  try {
    PropertiesService.getUserProperties().deleteProperty('lastProcessedTickerIndex');
    Logger.log("Progresso de lote resetado pelo usuário.");
    SpreadsheetApp.getActiveSpreadsheet().toast("Progresso dos lotes foi resetado.");
  } catch (e) {
    Logger.log(`Erro ao resetar progresso: ${e.message}`);
    SpreadsheetApp.getActiveSpreadsheet().toast("Erro ao resetar o progresso: " + e.message);
  }
}

function limparDadosAntigos() {
  Logger.log("== INICIANDO limparDadosAntigos ==");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ["Dados diários", "Recomendacoes_Conservador", "Recomendacoes_Agressivo", "Todas_Recomendacoes"];
  sheetNames.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.clear();
      Logger.log(`Planilha '${name}' foi limpa.`);
      if (name === "Dados diários") {
        sheet.appendRow(["Ticker", "Date", "Open", "High", "Low", "Close", "Var%"]);
      }
    }
  });
  resetarProgresso();
  SpreadsheetApp.getActiveSpreadsheet().toast("Abas de dados e resultados foram limpas.");
  Logger.log("== SUCESSO: limparDadosAntigos concluído. ==");
}

// =================================================================
// =================== CONFIGURAÇÕES GLOBAIS =======================
// =================================================================

const CONFIG = {
  // --- Configurações de Busca de Dados ---
  FORMULA_SEPARATOR: ';',
  BATCH_SIZE: 40,
  MAX_WAIT_MS: 15000,
  POLL_MS: 1000,
  HARD_START_DATE: new Date(2025, 0, 1),

  // --- Parâmetros da Análise Estatística ---
  MIN_TRADES_PARA_SIGNIFICANCIA: 30,
  GATILHO_STEP: 0.1,
  GATILHO_INICIAL: 0.2,

  // --- Configurações dos Perfis de Risco ---
  PERFIS: {
    CONSERVADOR: {
      SHEET_NAME: "Recomendacoes_Conservador",
      PROB_LUCRO_TOTAL_MIN: 0.70,
      DRAWDOWN_MAX: 0.03,
      RELACAO_GANHO_RISCO_MIN: 1.0, // Alterado para 1.0 para simulação 1:1
      OTIMIZAR_POR: 'probS1'
    },
    AGRESSIVO: {
      SHEET_NAME: "Recomendacoes_Agressivo",
      PROB_LUCRO_TOTAL_MIN: 0.65,
      DRAWDOWN_MAX: 0.05,
      RELACAO_GANHO_RISCO_MIN: 1.0, // Alterado para 1.0 para simulação 1:1
      OTIMIZAR_POR: 'probS1'
    }
  }
};


// =================================================================
// =================== NOVA ANÁLISE ESTATÍSTICA ====================
// =================================================================

/**
 * Função principal que orquestra a nova análise estatística.
 */
function gerarRecomendacoesEstatisticas() {
  Logger.log("== INICIANDO gerarRecomendacoesEstatisticas ==");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetDados = ss.getSheetByName("Dados diários");
  if (!sheetDados) {
    Logger.log("ERRO: Aba 'Dados diários' não encontrada.");
    ss.toast("ERRO: Aba 'Dados diários' não encontrada. Execute a atualização primeiro.");
    throw new Error("Aba 'Dados diários' não encontrada.");
  }

  // GARANTIR ORDENAÇÃO CORRETA ANTES DE QUALQUER ANÁLISE
  if (sheetDados.getLastRow() > 1) {
    const range = sheetDados.getRange(2, 1, sheetDados.getLastRow() - 1, sheetDados.getLastColumn());
    Logger.log("Garantindo a ordenação da planilha 'Dados diários' por Ticker e Data antes da análise.");
    range.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);
    SpreadsheetApp.flush(); // Garante que a ordenação seja concluída antes de prosseguir
  }

  const values = sheetDados.getDataRange().getValues();
  if (values.length < 2) {
    Logger.log("Nenhum dado para analisar na aba 'Dados diários'.");
    ss.toast("Nenhum dado para analisar na aba 'Dados diários'.");
    return;
  }

  const header = values[0];
  const iTicker = header.indexOf("Ticker");
  const iDate   = header.indexOf("Date");
  const iOpen   = header.indexOf("Open");
  const iHigh   = header.indexOf("High");
  const iLow    = header.indexOf("Low");
  const iClose  = header.indexOf("Close");
  if ([iTicker,iDate,iOpen,iHigh,iLow,iClose].some(i => i === -1)) {
    Logger.log("ERRO: Cabeçalho inválido em 'Dados diários'.");
    throw new Error("Cabeçalho inválido em 'Dados diários'.");
  }

  Logger.log("Agrupando dados por ticker...");
  const byTicker = {};
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const tk = String(row[iTicker]).trim();
    if (!tk) continue;
    if (!byTicker[tk]) byTicker[tk] = [];
    byTicker[tk].push({
      date: toDate(row[iDate]), open: toNum(row[iOpen]),
      high: toNum(row[iHigh]), low:  toNum(row[iLow]),
      close:toNum(row[iClose])
    });
  }
  Object.keys(byTicker).forEach(tk => {
    byTicker[tk] = byTicker[tk]
      .filter(c => c.date && isFinite(c.close) && isFinite(c.high) && isFinite(c.low))
      .sort((a,b) => a.date - b.date);
  });
  Logger.log(`Dados agrupados para ${Object.keys(byTicker).length} tickers.`);

  let allResults = [];
  Logger.log("Iniciando a análise de estratégias para cada ticker...");

  for (const ticker of Object.keys(byTicker)) {
    const priceData = byTicker[ticker];
    if (priceData.length < CONFIG.MIN_TRADES_PARA_SIGNIFICANCIA) continue;

    Logger.log(`- Analisando Ticker: ${ticker}`);

    const mediasDeVariacao = precalcularMediasDeVariacao(priceData);
    Logger.log(`  - Médias pré-calculadas -> Positiva: ${(mediasDeVariacao.media_variacao_positiva * 100).toFixed(2)}%, Negativa: ${(mediasDeVariacao.media_variacao_negativa * 100).toFixed(2)}%`);

    for (const direcao of ['COMPRA', 'VENDA']) {
      const { gatilhoMax, mediaVariacoes, desvioPadrao } = calcularIntervaloDinamicoDeGatilho(priceData, direcao);
      Logger.log(`  - Direção ${direcao}. Intervalo de gatilho dinâmico: ${CONFIG.GATILHO_INICIAL}% a ${gatilhoMax.toFixed(2)}% (Média: ${mediaVariacoes.toFixed(2)}%, DP: ${desvioPadrao.toFixed(2)}%)`);

      for (let p = CONFIG.GATILHO_INICIAL; p <= gatilhoMax; p += CONFIG.GATILHO_STEP) {
        const result = analisarEstrategia(priceData, p, direcao, mediasDeVariacao);
        if (result && result.totalTrades >= CONFIG.MIN_TRADES_PARA_SIGNIFICANCIA) {
          allResults.push({
            ticker: ticker,
            direcao: direcao,
            mediaVariacoes: mediaVariacoes,
            desvioPadrao: desvioPadrao,
            ...result
          });
        }
      }
    }
  }

  Logger.log(`Análise concluída. ${allResults.length} resultados brutos gerados. Formatando recomendações...`);

  escreverTodasRecomendacoes(ss, allResults);

  for (const profileName in CONFIG.PERFIS) {
    const perfilConfig = CONFIG.PERFIS[profileName];
    escreverRecomendacoesPorPerfil(ss, allResults, perfilConfig, byTicker);
  }

  SpreadsheetApp.getActiveSpreadsheet().toast("Análise estatística concluída!");
  Logger.log("== SUCESSO: gerarRecomendacoesEstatisticas concluída. ==");
}

function escreverTodasRecomendacoes(ss, allResults) {
  const SHEET_NAME = "Todas_Recomendacoes";
  Logger.log(`-- Gerando a planilha de diagnóstico: ${SHEET_NAME} --`);
  const recSheet = upsertSheet(ss, SHEET_NAME);
  recSheet.clear();
  const header = [
    "Ticker", "Direção", "Gatilho de Entrada (%)", "Média Variações (%)", "Desvio Padrão (%)",
    "% Alvo de Ganho", "% Stop Loss", "Risco/Retorno",
    "Prob. Lucro Total (%)", "Prob. Lucro Parcial (%)", "Prob. Perda (%)", "Trades Totais"
  ];
  recSheet.appendRow(header);

  if (allResults.length === 0) {
    Logger.log("Nenhum resultado bruto para analisar.");
    return;
  }

  const rows = allResults.map(rec => {
      const riskRewardRatio = rec.maxDrawdown > 0 ? rec.avgS1Profit / rec.maxDrawdown : 0;
      return {
        ticker: rec.ticker,
        direcao: rec.direcao,
        gatilho: rec.gatilhoPercent / 100,
        mediaVariacoes: rec.mediaVariacoes / 100,
        desvioPadrao: rec.desvioPadrao / 100,
        alvoGanho: rec.avgS1Profit,
        stopLoss: rec.maxDrawdown,
        riscoRetorno: riskRewardRatio,
        probS1: rec.probS1,
        probS2: rec.probS2,
        probS3: rec.probS3,
        trades: rec.totalTrades
      };
  });

  rows.sort((a, b) => b.riscoRetorno - a.riscoRetorno);

  const arows = rows.map(r => [r.ticker, r.direcao, r.gatilho, r.mediaVariacoes, r.desvioPadrao, r.alvoGanho, r.stopLoss, r.riscoRetorno, r.probS1, r.probS2, r.probS3, r.trades]);

  const range = recSheet.getRange(2, 1, arows.length, header.length);
  range.setValues(arows);

  recSheet.getRange('C:I').setNumberFormat("0.00%");
  recSheet.getRange('K:K').setNumberFormat("0.00%");
  recSheet.getRange('H:H').setNumberFormat("0.00");
  recSheet.getRange('L:L').setNumberFormat("0");

  recSheet.autoResizeColumns(1, header.length);
  Logger.log(`  - ${rows.length} recomendações escritas na planilha '${SHEET_NAME}'.`);
}

function escreverRecomendacoesPorPerfil(ss, allResults, perfilConfig, byTicker) {
  Logger.log(`-- Iniciando geração para o perfil: ${perfilConfig.SHEET_NAME} --`);
  const recSheet = upsertSheet(ss, perfilConfig.SHEET_NAME);
  recSheet.clear();
  const header = [
    "Ticker", "Direção", "Gatilho de Entrada (%)", "Fechamento Anterior", "Preço de Entrada",
    "% Alvo de Ganho", "% Stop Loss", "Prob. Lucro Total (%)", "Trades Totais", "Risco/Retorno"
  ];
  recSheet.appendRow(header);

  const qualifiedRecs = allResults.filter(r =>
    r.probS1 >= perfilConfig.PROB_LUCRO_TOTAL_MIN &&
    r.maxDrawdown <= perfilConfig.DRAWDOWN_MAX
  );
  Logger.log(`  - ${qualifiedRecs.length} de ${allResults.length} resultados qualificados para o perfil.`);

  const bestRecsMap = new Map();
  for (const rec of qualifiedRecs) {
    const key = `${rec.ticker}|${rec.direcao}`;
    const existing = bestRecsMap.get(key);
    const optimizeMetric = perfilConfig.OTIMIZAR_POR;

    if (!existing || rec[optimizeMetric] > existing[optimizeMetric]) {
      bestRecsMap.set(key, rec);
    }
  }

  const finalRecs = Array.from(bestRecsMap.values()).sort((a, b) => {
    if (a.ticker < b.ticker) return -1;
    if (a.ticker > b.ticker) return 1;
    if (a.direcao < b.direcao) return -1;
    if (a.direcao > b.direcao) return 1;
    return 0;
  });
  Logger.log(`  - ${finalRecs.length} recomendações finais selecionadas para o perfil.`);

  if (finalRecs.length > 0) {
    const rows = finalRecs.map(rec => {
      const priceData = byTicker[rec.ticker];
      const lastClose = priceData[priceData.length - 1].close;
      const entryPrice = rec.direcao === 'COMPRA'
        ? lastClose * (1 - rec.gatilhoPercent / 100)
        : lastClose * (1 + rec.gatilhoPercent / 100);
      const riskRewardRatio = 1.0;

      return [
        rec.ticker,
        rec.direcao,
        rec.gatilhoPercent / 100,
        lastClose,
        entryPrice,
        rec.avgS1Profit,
        rec.avgS1Profit,
        rec.probS1,
        rec.totalTrades,
        riskRewardRatio
      ];
    });

    const range = recSheet.getRange(2, 1, rows.length, header.length);
    range.setValues(rows);

    recSheet.getRange('C:C').setNumberFormat("0.00%");
    recSheet.getRange('D:E').setNumberFormat("R$ #,##0.00");
    recSheet.getRange('F:H').setNumberFormat("0.00%");
    recSheet.getRange('I:I').setNumberFormat("0");
    recSheet.getRange('J:J').setNumberFormat("0.00");

    for (let i = 0; i < rows.length; i++) {
      const direction = rows[i][1];
      recSheet.getRange(i + 2, 1, 1, header.length)
        .setBackground(direction === "COMPRA" ? "#e6f4ea" : "#fce8e6");
    }

    recSheet.autoResizeColumns(1, header.length);
    Logger.log(`  - Recomendações escritas e formatadas na planilha '${perfilConfig.SHEET_NAME}'.`);
  } else {
    Logger.log(`  - Nenhuma recomendação final para escrever na planilha '${perfilConfig.SHEET_NAME}'.`);
  }
}


function analisarEstrategia(priceData, gatilhoPercent, direcao, mediasDeVariacao) {
  if (priceData.length < 2) return null;

  let cenario1 = 0, cenario2 = 0, cenario3 = 0;
  let maxDrawdown = 0;
  let s1ProfitSum = 0;

  for (let i = 1; i < priceData.length; i++) {
    const prevClose = priceData[i - 1].close;
    const { high, low, close } = priceData[i];

    if (!isFinite(prevClose) || prevClose <= 0 || !isFinite(high) || !isFinite(low) || !isFinite(close)) {
      continue;
    }

    let entryPrice = 0;

    if (direcao === 'COMPRA') {
      entryPrice = prevClose * (1 - gatilhoPercent / 100);
      if (low <= entryPrice) {
        const potentialLoss = (entryPrice - low) / entryPrice;
        if (potentialLoss > maxDrawdown) {
          maxDrawdown = potentialLoss;
        }

        if (high > prevClose) {
          cenario1++;
          s1ProfitSum += mediasDeVariacao.media_variacao_positiva;
        }
        else if (high > entryPrice) {
          cenario2++;
        }
        else {
          cenario3++;
        }
      }
    } else { // VENDA
      entryPrice = prevClose * (1 + gatilhoPercent / 100);
      if (high >= entryPrice) {
        const potentialLoss = (high - entryPrice) / entryPrice;
        if (potentialLoss > maxDrawdown) {
          maxDrawdown = potentialLoss;
        }

        if (low < prevClose) {
          cenario1++;
           s1ProfitSum += Math.abs(mediasDeVariacao.media_variacao_negativa);
        }
        else if (low < entryPrice) {
          cenario2++;
        }
        else {
          cenario3++;
        }
      }
    }
  }

  const totalTrades = cenario1 + cenario2 + cenario3;
  if (totalTrades === 0) {
    return {
      gatilhoPercent, totalTrades: 0, probS1: 0, probS2: 0, probS3: 0, maxDrawdown: 0, avgS1Profit: 0
    };
  }

  return {
    gatilhoPercent,
    totalTrades,
    probS1: cenario1 / totalTrades,
    probS2: cenario2 / totalTrades,
    probS3: cenario3 / totalTrades,
    maxDrawdown: maxDrawdown,
    avgS1Profit: cenario1 > 0 ? s1ProfitSum / cenario1 : 0
  };
}


// =================================================================
// =================== FUNÇÃO DE ATUALIZAÇÃO DE DADOS ================
// =================================================================

function atualizarDadosDiarios() {
  Logger.log("== INICIANDO atualizarDadosDiarios ==");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const properties = PropertiesService.getUserProperties();
  const lastIndexStr = properties.getProperty('lastProcessedTickerIndex') || '0';
  let lastIndex = parseInt(lastIndexStr, 10);
  const tz = ss.getSpreadsheetTimeZone();

  let tickersSh = ss.getSheetByName("TICKERS");
  if (!tickersSh) {
    tickersSh = ss.insertSheet("TICKERS");
    tickersSh.getRange("A1:B1").setValues([["Ticker", "<- Adicione seus tickers na Coluna A, a partir da linha 2"]]);
    tickersSh.getRange("A2").setValue("EXEMPLO: PETR4");
    tickersSh.autoResizeColumn(1);
    tickersSh.autoResizeColumn(2);
    Logger.log("Aba 'TICKERS' não encontrada. Criando uma nova.");
    ss.toast("Aba 'TICKERS' não encontrada. Criei uma para você. Adicione suas ações e rode novamente.");
    return false;
  }

  const allTickers = tickersSh.getRange(2, 1, tickersSh.getLastRow() - 1, 1).getValues().flat()
    .map(x => String(x || "").trim()).filter(Boolean);

  if (!allTickers.length) {
    Logger.log("Nenhum ticker válido encontrado em 'TICKERS'. Processamento encerrado.");
    ss.toast("Nenhum ticker válido encontrado em 'TICKERS'.");
    return true;
  }

  if (lastIndex >= allTickers.length) {
    Logger.log("Todos os tickers já foram processados. A atualização de hoje está completa.");
    ss.toast("Todos os tickers já foram processados. A atualização de hoje está completa.");
    properties.deleteProperty('lastProcessedTickerIndex');
    return true;
  }

  const tickersToProcess = allTickers.slice(lastIndex, lastIndex + CONFIG.BATCH_SIZE);
  Logger.log(`Processando lote: ${lastIndex + 1} a ${lastIndex + tickersToProcess.length} de ${allTickers.length} tickers.`);
  ss.toast(`Processando lote: ${lastIndex + 1} a ${lastIndex + tickersToProcess.length} de ${allTickers.length} tickers.`);

  let dadosSh = upsertSheet(ss, "Dados diários");
  if (dadosSh.getLastRow() < 1) {
    dadosSh.appendRow(["Ticker", "Date", "Open", "High", "Low", "Close", "Var%"]);
    SpreadsheetApp.flush();
  }

  const lastDates = {};
  const values = dadosSh.getDataRange().getValues();
  if (values.length > 1) {
    const header = values[0];
    const tickerIdxHeader = header.indexOf("Ticker");
    const dateIdxHeader = header.indexOf("Date");

    if (tickerIdxHeader !== -1 && dateIdxHeader !== -1) {
      for (let i = 1; i < values.length; i++) {
        const ticker = values[i][tickerIdxHeader];
        const date = toDate(values[i][dateIdxHeader]);
        if (ticker && date) {
          const cleanTicker = removeBVMF(ticker);
          if (!lastDates[cleanTicker] || date > lastDates[cleanTicker]) {
            lastDates[cleanTicker] = date;
          }
        }
      }
    }
  }

  const hoje = new Date();
  const ontem = new Date(hoje.getTime() - 24 * 3600 * 1000);
  const rowsToWrite = [];
  const tmpName = `_TMP_DATA_FETCH_${Utilities.getUuid().slice(0,8)}`;
  const tmp = ss.insertSheet(tmpName);

  try {
    for (const fullTicker of tickersToProcess) {
      Logger.log(`- Buscando dados para o ticker: ${fullTicker}`);
      const cleanTicker = removeBVMF(fullTicker);
      let startDate = CONFIG.HARD_START_DATE;
      if (lastDates[cleanTicker]) {
        const nextDay = new Date(lastDates[cleanTicker].getTime());
        nextDay.setDate(nextDay.getDate() + 1);
        startDate = nextDay;
      }

      const ontemStr = Utilities.formatDate(ontem, tz, 'yyyy-MM-dd');
      const startDateStr = Utilities.formatDate(startDate, tz, 'yyyy-MM-dd');

      if (startDateStr > ontemStr) {
        Logger.log(`  - Ticker ${fullTicker} já está atualizado. Pulando.`);
        continue;
      }

      tmp.clear();
      SpreadsheetApp.flush();

      const date1 = `DATEVALUE("${startDateStr}")`;
      const date2 = `DATEVALUE("${ontemStr}")`;
      const sep = CONFIG.FORMULA_SEPARATOR;
      const formula = `=GOOGLEFINANCE("${fullTicker}"${sep}"all"${sep}${date1}${sep}${date2}${sep}"DAILY")`;
      Logger.log(`  - Fórmula GOOGLEFINANCE: ${formula}`);

      tmp.getRange(1, 1).setFormula(formula);
      SpreadsheetApp.flush();

      let waited = 0;
      let all = [];
      while (waited < CONFIG.MAX_WAIT_MS) {
        Utilities.sleep(CONFIG.POLL_MS);
        waited += CONFIG.POLL_MS;
        all = tmp.getDataRange().getValues();
        if (all.length > 1 && all[0].length > 1) {
            const maybe = all[1];
            if (maybe && (isDateLike(maybe[0]) || typeof maybe[1] === "number")) break;
        } else if (all.length === 1 && all[0][0] && String(all[0][0]).includes("#N/A")) {
          Logger.log(`  - Erro #N/A retornado para ${fullTicker}.`);
          break;
        }
      }

      if (!all || all.length < 2 || (all[0][0] && String(all[0][0]).includes("#N/A"))) {
        Logger.log(`  - Não foi possível buscar dados para ${fullTicker}.`);
        continue;
      }

      const headerResult = all[0].map(h => (h || "").toString().toLowerCase());
      const dateHIdx  = headerResult.findIndex(h => h.indexOf("date")!==-1 || h.indexOf("data")!==-1);
      const openHIdx  = headerResult.findIndex(h => h.indexOf("open")!==-1);
      const highHIdx  = headerResult.findIndex(h => h.indexOf("high")!==-1);
      const lowHIdx   = headerResult.findIndex(h => h.indexOf("low")!==-1);
      const closeHIdx = headerResult.findIndex(h => h.indexOf("close")!==-1);
      const lastIdx = findLastRowIndex(all, [dateHIdx, closeHIdx]);

      if (lastIdx < 1) continue;

      let newRowsForTicker = 0;
      for (let r = 1; r <= lastIdx; r++) {
        const row = all[r] || [];
        const dateVal = row[dateHIdx];
        if (!dateVal) continue;
        const dateObj = toDate(dateVal);
        if (!dateObj) continue;
        if (lastDates[cleanTicker] && dateObj.getTime() <= lastDates[cleanTicker].getTime()) continue;
        const open = toNum(row[openHIdx]);
        const high = toNum(row[highHIdx]);
        const low  = toNum(row[lowHIdx]);
        const close= toNum(row[closeHIdx]);
        if (isNaN(close)) continue;
        const varPct = (!isNaN(open) && open !== 0) ? ((close - open) / open) : 0;
        rowsToWrite.push([cleanTicker, dateObj, open, high, low, close, varPct]);
        newRowsForTicker++;
      }
      Logger.log(`  - ${newRowsForTicker} novas linhas de dados encontradas para ${fullTicker}.`);
    }
  } catch(err) {
      Logger.log(`ERRO em atualizarDadosDiarios: ${err.message} \n ${err.stack}`);
      ss.toast("Ocorreu um erro. Verifique os Logs (Extensões > Apps Script > Registros).");
      properties.deleteProperty('lastProcessedTickerIndex');
      throw err;
  } finally {
      try { ss.deleteSheet(tmp); } catch(e) { /* ignore */ }
  }

  if (rowsToWrite.length > 0) {
    Logger.log(`Adicionando ${rowsToWrite.length} novas linhas de dados à planilha 'Dados diários'.`);
    const targetRange = dadosSh.getRange(dadosSh.getLastRow() + 1, 1, rowsToWrite.length, 7);
    targetRange.setValues(rowsToWrite);
    targetRange.offset(0, 1, rowsToWrite.length, 1).setNumberFormat("yyyy-MM-dd");
    targetRange.offset(0, 6, rowsToWrite.length, 1).setNumberFormat("0.00%");
  } else {
    Logger.log("Nenhuma linha nova para adicionar neste lote.");
  }

  const newIndex = lastIndex + tickersToProcess.length;
  if (newIndex >= allTickers.length) {
    properties.deleteProperty('lastProcessedTickerIndex');
    ss.toast(`Lote final concluído! Total de ${allTickers.length} tickers processados.`);
    Logger.log("== SUCESSO: atualizarDadosDiarios concluído (todos os lotes). ==");
    return true;
  } else {
    properties.setProperty('lastProcessedTickerIndex', newIndex.toString());
    ss.toast(`Lote concluído. ${newIndex} de ${allTickers.length} tickers processados. Execute novamente para continuar.`);
    Logger.log(`Processamento de lote concluído. Próximo índice: ${newIndex}. Execute novamente para continuar.`);
    return false;
  }
}

// A função gerarParametrosERecomendacoes() foi removida.

/* ================== helpers ================== */

function removeBVMF(s) { return String(s||"").replace(/^BVMF:/i,"").trim(); }
function isDateLike(v) { if (!v) return false; if (v instanceof Date && !isNaN(v.getTime())) return true; const d = new Date(v); return !isNaN(d.getTime()); }
function findLastRowIndex(allRows, colIndices) {for (let r = allRows.length - 1; r >= 1; r--) {for (let ci of colIndices) {if (allRows[r] && allRows[r][ci] !== undefined && allRows[r][ci] !== "") return r;}}return 0;}
function toDate(v){if (v instanceof Date) return v; const d = new Date(v); return isNaN(d.getTime()) ? null : d;}
function toNum(v){const n = Number(v); return isFinite(n) ? n : NaN;}
function upsertSheet(ss, name){return ss.getSheetByName(name) || ss.insertSheet(name);}

/**
 * Calcula o desvio padrão de uma amostra de números.
 */
function standardDeviation(data) {
  const n = data.length;
  if (n < 2) return 0;
  const mean = data.reduce((acc, val) => acc + val, 0) / n;
  const variance = data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1);
  return Math.sqrt(variance);
}

/**
 * Pré-calcula as médias de variação (close-open) positivas e negativas para um histórico de dados.
 */
function precalcularMediasDeVariacao(priceData) {
  const positiveVariations = [];
  const negativeVariations = [];

  for (const day of priceData) {
    if (isFinite(day.open) && day.open > 0 && isFinite(day.close)) {
      const variation = (day.close - day.open) / day.open;
      if (variation > 0) {
        positiveVariations.push(variation);
      } else if (variation < 0) {
        negativeVariations.push(variation);
      }
    }
  }

  const media_variacao_positiva = positiveVariations.length > 0
    ? positiveVariations.reduce((acc, val) => acc + val, 0) / positiveVariations.length
    : 0;

  const media_variacao_negativa = negativeVariations.length > 0
    ? negativeVariations.reduce((acc, val) => acc + val, 0) / negativeVariations.length
    : 0;

  return { media_variacao_positiva, media_variacao_negativa };
}


/**
 * Calcula o limite superior dinâmico para o teste de gatilho.
 */
function calcularIntervaloDinamicoDeGatilho(priceData, direcao) {
  const dailyChanges = [];
  for (let i = 1; i < priceData.length; i++) {
    const prevClose = priceData[i - 1].close;
    const { high, low } = priceData[i];

    if (isFinite(prevClose) && prevClose > 0 && isFinite(high) && isFinite(low)) {
      let change;
      if (direcao === 'COMPRA') {
        change = (prevClose - low) / prevClose * 100; // Queda percentual
      } else { // VENDA
        change = (high - prevClose) / prevClose * 100; // Alta percentual
      }
      if (change > 0) {
        dailyChanges.push(change);
      }
    }
  }

  if (dailyChanges.length === 0) {
    return { gatilhoMax: CONFIG.GATILHO_INICIAL, mediaVariacoes: 0, desvioPadrao: 0 };
  }

  const mean = dailyChanges.reduce((acc, val) => acc + val, 0) / dailyChanges.length;
  const stdDev = standardDeviation(dailyChanges);

  return { gatilhoMax: mean + stdDev, mediaVariacoes: mean, desvioPadrao: stdDev };
}
// As funções round2() e wilsonLower() foram removidas por não serem mais necessárias.
