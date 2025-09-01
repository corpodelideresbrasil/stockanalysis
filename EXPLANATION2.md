```javascript
// =================================================================
// =================== FUNÇÕES DE CONTROLE =========================
// =================================================================

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

function executarBacktestDeDesempenho() {
  const NUM_DIAS_BACKTEST = 90;
  const LOTE_ACOES = 100;

  Logger.log("== INICIANDO Backtest de Desempenho ==");
  SpreadsheetApp.getActiveSpreadsheet().toast("Iniciando backtest de desempenho...");

  gerarRecomendacoesEstatisticas();
  SpreadsheetApp.flush();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const perfis = [CONFIG.PERFIS.CONSERVADOR.SHEET_NAME, CONFIG.PERFIS.AGRESSIVO.SHEET_NAME];
  const allRecommendations = [];

  for (const nomePerfil of perfis) {
    const recSheet = ss.getSheetByName(nomePerfil);
    if (!recSheet || recSheet.getLastRow() < 2) {
      Logger.log(`Nenhuma recomendação encontrada para o perfil ${nomePerfil}.`);
      continue;
    }
    const recs = recSheet.getRange(2, 1, recSheet.getLastRow() - 1, 10).getValues();
    recs.forEach(rec => {
      allRecommendations.push({
        perfil: nomePerfil,
        ticker: rec[0],
        direcao: rec[1],
        gatilho: rec[2],
        precoEntrada: rec[4],
        alvoGanho: rec[5],
        stopLoss: rec[6],
      });
    });
  }

  if (allRecommendations.length === 0) {
    Logger.log("Nenhuma recomendação encontrada para simular.");
    ss.toast("Nenhuma recomendação encontrada para simular.");
    return;
  }
  Logger.log(`Encontradas ${allRecommendations.length} recomendações totais para simular.`);

  const dadosSh = ss.getSheetByName("Dados diários");
  const priceValues = dadosSh.getRange(2, 1, dadosSh.getLastRow() - 1, dadosSh.getLastColumn()).getValues();
  const priceDataByTickerDate = {};
  for(const row of priceValues) {
    const key = `${row[0]}|${Utilities.formatDate(new Date(row[1]), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd")}`;
    priceDataByTickerDate[key] = { open: row[2], high: row[3], low: row[4], close: row[5] };
  }

  const hoje = new Date();
  const backtestResults = [];
  let totalGeral = 0;

  for (let i = 0; i < NUM_DIAS_BACKTEST; i++) {
    const diaSimulacao = new Date(hoje.getTime() - (i * 24 * 3600 * 1000));
    const diaStr = Utilities.formatDate(diaSimulacao, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
    let resultadoDoDia = 0;

    for (const rec of allRecommendations) {
      const key = `${rec.ticker}|${diaStr}`;
      const priceDay = priceDataByTickerDate[key];

      if (priceDay) {
        const resultadoTrade = simularTrade(rec, priceDay, LOTE_ACOES);
        if (resultadoTrade !== 0) {
           backtestResults.push([diaStr, rec.ticker, rec.perfil, rec.direcao, resultadoTrade]);
           resultadoDoDia += resultadoTrade;
        }
      }
    }
    totalGeral += resultadoDoDia;
  }

  Logger.log(`Backtest concluído. Resultado financeiro total nos últimos ${NUM_DIAS_BACKTEST} dias: R$ ${totalGeral.toFixed(2)}`);

  const backtestSheet = upsertSheet(ss, "Backtest_Desempenho");
  backtestSheet.clear();
  backtestSheet.appendRow(["Data", "Ticker", "Perfil", "Direção", "Resultado (R$)"]);
  if(backtestResults.length > 0) {
    backtestSheet.getRange(2, 1, backtestResults.length, 5).setValues(backtestResults);
    backtestSheet.getRange('E:E').setNumberFormat('R$ #,##0.00');
    backtestSheet.autoResizeColumns(1, 5);
  }

  backtestSheet.getRange("G1").setValue("Resultado Total:");
  backtestSheet.getRange("H1").setValue(totalGeral).setNumberFormat('R$ #,##0.00');

  ss.toast(`Backtest concluído! Resultado: R$ ${totalGeral.toFixed(2)}`);
  Logger.log("== SUCESSO: Backtest de Desempenho concluído. ==");
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
  const sheetNames = ["Dados diários", "Recomendacoes_Conservador", "Recomendacoes_Agressivo", "Todas_Recomendacoes", "Backtest_Desempenho"];
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
  FORMULA_SEPARATOR: ';',
  BATCH_SIZE: 40,
  MAX_WAIT_MS: 15000,
  POLL_MS: 1000,
  HARD_START_DATE: new Date(2025, 0, 1),

  MIN_TRADES_PARA_SIGNIFICANCIA: 30,
  GATILHO_STEP: 0.1,
  GATILHO_INICIAL: 0.2,
  ATR_PERIOD: 14,
  TARGET_ATR_MULTIPLE: 2.0,
  STOP_ATR_MULTIPLE: 1.5,

  PERFIS: {
    CONSERVADOR: {
      SHEET_NAME: "Recomendacoes_Conservador",
      PROB_LUCRO_TOTAL_MIN: 0.70,
      DRAWDOWN_MAX: 0.03,
      OTIMIZAR_POR: 'probS1'
    },
    AGRESSIVO: {
      SHEET_NAME: "Recomendacoes_Agressivo",
      PROB_LUCRO_TOTAL_MIN: 0.65,
      DRAWDOWN_MAX: 0.05,
      OTIMIZAR_POR: 'probS1'
    }
  }
};


// =================================================================
// =================== MOTOR DE ANÁLISE ============================
// =================================================================

function gerarRecomendacoesEstatisticas() {
  Logger.log("== INICIANDO gerarRecomendacoesEstatisticas ==");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetDados = ss.getSheetByName("Dados diários");
  if (!sheetDados) {
    Logger.log("ERRO: Aba 'Dados diários' não encontrada.");
    throw new Error("Aba 'Dados diários' não encontrada.");
  }

  if (sheetDados.getLastRow() > 1) {
    const range = sheetDados.getRange(2, 1, sheetDados.getLastRow() - 1, sheetDados.getLastColumn());
    Logger.log("Garantindo a ordenação da planilha 'Dados diários' por Ticker e Data antes da análise.");
    range.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);
    SpreadsheetApp.flush();
  }

  const values = sheetDados.getDataRange().getValues();
  if (values.length < 2) {
    Logger.log("Nenhum dado para analisar.");
    return;
  }

  const header = values[0];
  const iTicker = header.indexOf("Ticker");
  const iDate   = header.indexOf("Date");
  const iOpen   = header.indexOf("Open");
  const iHigh   = header.indexOf("High");
  const iLow    = header.indexOf("Low");
  const iClose  = header.indexOf("Close");

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

  let allResults = [];
  Logger.log("Iniciando a análise de estratégias...");

  for (const ticker of Object.keys(byTicker)) {
    let priceData = byTicker[ticker];
    if (priceData.length < CONFIG.MIN_TRADES_PARA_SIGNIFICANCIA + CONFIG.ATR_PERIOD) continue;

    priceData = calcularATR(priceData, CONFIG.ATR_PERIOD);

    for (const direcao of ['COMPRA', 'VENDA']) {
      const { gatilhoMax } = calcularIntervaloDinamicoDeGatilho(priceData, direcao);
      for (let p = CONFIG.GATILHO_INICIAL; p <= gatilhoMax; p += CONFIG.GATILHO_STEP) {
        const result = analisarEstrategia(priceData, p, direcao);
        if (result && result.totalTrades >= CONFIG.MIN_TRADES_PARA_SIGNIFICANCIA) {
          allResults.push({ ticker, direcao, ...result });
        }
      }
    }
  }

  Logger.log(`Análise concluída. ${allResults.length} resultados brutos gerados.`);
  escreverTodasRecomendacoes(ss, allResults);

  for (const profileName in CONFIG.PERFIS) {
    escreverRecomendacoesPorPerfil(ss, allResults, CONFIG.PERFIS[profileName], byTicker);
  }

  SpreadsheetApp.getActiveSpreadsheet().toast("Análise estatística concluída!");
  Logger.log("== SUCESSO: gerarRecomendacoesEstatisticas concluída. ==");
}

function analisarEstrategia(priceData, gatilhoPercent, direcao) {
  if (priceData.length < CONFIG.ATR_PERIOD + 1) return null;

  let cenario1 = 0, cenario2 = 0, cenario3 = 0;
  let s1ProfitSum = 0;

  for (let i = CONFIG.ATR_PERIOD + 1; i < priceData.length; i++) {
    const prevDay = priceData[i - 1];
    const day = priceData[i];
    const atr = day.atr;

    if (!atr || atr === 0 || !isFinite(prevDay.close) || prevDay.close <= 0) {
      continue;
    }

    let entryPrice = 0;

    if (direcao === 'COMPRA') {
      entryPrice = prevDay.close * (1 - gatilhoPercent / 100);
      if (day.low <= entryPrice) {
        const profitTargetPrice = entryPrice + (CONFIG.TARGET_ATR_MULTIPLE * atr);
        const stopLossPrice = entryPrice - (CONFIG.STOP_ATR_MULTIPLE * atr);

        if (day.low <= stopLossPrice) {
          cenario3++;
        } else if (day.high >= profitTargetPrice) {
          cenario1++;
          s1ProfitSum += (profitTargetPrice - entryPrice) / entryPrice;
        } else {
          cenario2++;
        }
      }
    } else { // VENDA
      entryPrice = prevDay.close * (1 + gatilhoPercent / 100);
      if (day.high >= entryPrice) {
        const profitTargetPrice = entryPrice - (CONFIG.TARGET_ATR_MULTIPLE * atr);
        const stopLossPrice = entryPrice + (CONFIG.STOP_ATR_MULTIPLE * atr);

        if (day.high >= stopLossPrice) {
          cenario3++;
        } else if (day.low <= profitTargetPrice) {
          cenario1++;
          s1ProfitSum += (entryPrice - profitTargetPrice) / entryPrice;
        } else {
          cenario2++;
        }
      }
    }
  }

  const totalTrades = cenario1 + cenario2 + cenario3;
  if (totalTrades === 0) {
    return { gatilhoPercent, totalTrades: 0, probS1: 0, probS2: 0, probS3: 0, maxDrawdown: 0, avgS1Profit: 0 };
  }

  const lastAtr = priceData[priceData.length-1].atr;
  const lastClose = priceData[priceData.length-1].close;
  const maxDrawdown = lastAtr && lastClose ? (CONFIG.STOP_ATR_MULTIPLE * (lastAtr / lastClose)) : 0;

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
// =================== FUNÇÕES DE EXIBIÇÃO =========================
// =================================================================

function escreverTodasRecomendacoes(ss, allResults) {
  const sheet = upsertSheet(ss, "Todas_Recomendacoes");
  sheet.clear();
  const header = [
    "Ticker", "Direção", "Gatilho (%)", "% Alvo Ganho (ATR)", "% Stop Loss (ATR)",
    "Prob. Ganho (%)", "Prob. Neutro (%)", "Prob. Perda (%)", "Trades Totais"
  ];
  sheet.appendRow(header);

  if (allResults.length === 0) return;

  const rows = allResults.map(rec => {
    return [
      rec.ticker, rec.direcao, rec.gatilhoPercent / 100, rec.avgS1Profit, rec.maxDrawdown,
      rec.probS1, rec.probS2, rec.probS3, rec.totalTrades
    ];
  });

  const range = sheet.getRange(2, 1, rows.length, header.length);
  range.setValues(rows);
  sheet.getRange('C:H').setNumberFormat("0.00%");
  sheet.autoResizeColumns(1, header.length);
}

function escreverRecomendacoesPorPerfil(ss, allResults, perfilConfig, byTicker) {
  const sheet = upsertSheet(ss, perfilConfig.SHEET_NAME);
  sheet.clear();
  const header = [
    "Ticker", "Direção", "Gatilho de Entrada (%)", "Fechamento Anterior", "Preço de Entrada",
    "% Alvo de Ganho", "% Stop Loss", "Prob. Lucro Total (%)", "Trades Totais", "Risco/Retorno"
  ];
  sheet.appendRow(header);

  const qualifiedRecs = allResults.filter(r =>
    r.probS1 >= perfilConfig.PROB_LUCRO_TOTAL_MIN &&
    r.maxDrawdown <= perfilConfig.DRAWDOWN_MAX
  );

  const bestRecsMap = new Map();
  for (const rec of qualifiedRecs) {
    const key = `${rec.ticker}|${rec.direcao}`;
    const existing = bestRecsMap.get(key);
    if (!existing || rec[perfilConfig.OTIMIZAR_POR] > existing[perfilConfig.OTIMIZAR_POR]) {
      bestRecsMap.set(key, rec);
    }
  }

  const finalRecs = Array.from(bestRecsMap.values()).sort((a, b) => {
    if (a.ticker < b.ticker) return -1;
    if (a.ticker > b.ticker) return 1;
    return (a.direcao < b.direcao) ? -1 : 1;
  });

  if (finalRecs.length > 0) {
    const rows = finalRecs.map(rec => {
      const priceData = byTicker[rec.ticker];
      const lastClose = priceData[priceData.length - 1].close;
      const entryPrice = rec.direcao === 'COMPRA'
        ? lastClose * (1 - rec.gatilhoPercent / 100)
        : lastClose * (1 + rec.gatilhoPercent / 100);

      return [
        rec.ticker, rec.direcao, rec.gatilhoPercent / 100, lastClose, entryPrice,
        rec.avgS1Profit, rec.maxDrawdown, rec.probS1, rec.totalTrades,
        rec.maxDrawdown > 0 ? rec.avgS1Profit / rec.maxDrawdown : 0
      ];
    });

    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
    sheet.getRange('C:C').setNumberFormat("0.00%");
    sheet.getRange('D:E').setNumberFormat("R$ #,##0.00");
    sheet.getRange('F:H').setNumberFormat("0.00%");
    sheet.getRange('J:J').setNumberFormat("0.00");
    sheet.autoResizeColumns(1, header.length);
  }
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
    tickersSh.getRange("A1:B1").setValues([["Ticker", "<- Adicione seus tickers na Coluna A"]]);
    ss.toast("Aba 'TICKERS' não encontrada. Criei uma para você.");
    return false;
  }

  const allTickers = tickersSh.getRange(2, 1, tickersSh.getLastRow() - 1, 1).getValues().flat()
    .map(x => String(x || "").trim()).filter(Boolean);

  if (!allTickers.length) {
    Logger.log("Nenhum ticker válido encontrado.");
    return true;
  }

  if (lastIndex >= allTickers.length) {
    Logger.log("Todos os tickers já foram processados.");
    properties.deleteProperty('lastProcessedTickerIndex');
    return true;
  }

  const tickersToProcess = allTickers.slice(lastIndex, lastIndex + CONFIG.BATCH_SIZE);
  ss.toast(`Processando lote: ${lastIndex + 1} a ${lastIndex + tickersToProcess.length} de ${allTickers.length}`);

  let dadosSh = upsertSheet(ss, "Dados diários");
  if (dadosSh.getLastRow() < 1) {
    dadosSh.appendRow(["Ticker", "Date", "Open", "High", "Low", "Close", "Var%"]);
  }

  const lastDates = {};
  const values = dadosSh.getDataRange().getValues();
  if (values.length > 1) {
    for (let i = 1; i < values.length; i++) {
      const ticker = values[i][0];
      const date = toDate(values[i][1]);
      if (ticker && date && (!lastDates[ticker] || date > lastDates[ticker])) {
        lastDates[ticker] = date;
      }
    }
  }

  const hoje = new Date();
  const rowsToWrite = [];
  const tmpName = `_TMP_DATA_FETCH_${Utilities.getUuid().slice(0,8)}`;
  const tmp = ss.insertSheet(tmpName);

  try {
    for (const fullTicker of tickersToProcess) {
      const cleanTicker = removeBVMF(fullTicker);
      let startDate = CONFIG.HARD_START_DATE;
      if (lastDates[cleanTicker]) {
        startDate = new Date(lastDates[cleanTicker].getTime() + 24 * 3600 * 1000);
      }

      if (startDate >= hoje) {
        continue;
      }

      tmp.clear();
      const formula = `=GOOGLEFINANCE("${fullTicker}";"all";DATE(${startDate.getFullYear()};${startDate.getMonth()+1};${startDate.getDate()});TODAY())`;
      tmp.getRange(1, 1).setFormula(formula);
      SpreadsheetApp.flush();

      let waited = 0;
      let all = [];
      while (waited < CONFIG.MAX_WAIT_MS) {
        Utilities.sleep(CONFIG.POLL_MS);
        waited += CONFIG.POLL_MS;
        all = tmp.getDataRange().getValues();
        if (all.length > 1 && all[0].length > 1 && isDateLike(all[1][0])) break;
        if (all.length === 1 && String(all[0][0]).includes("#N/A")) break;
      }

      if (!all || all.length < 2 || String(all[0][0]).includes("#N/A")) continue;

      const headerResult = all[0].map(h => (h || "").toString().toLowerCase());
      const dateHIdx  = headerResult.indexOf("date");
      const openHIdx  = headerResult.indexOf("open");
      const highHIdx  = headerResult.indexOf("high");
      const lowHIdx   = headerResult.indexOf("low");
      const closeHIdx = headerResult.indexOf("close");

      for (let r = 1; r < all.length; r++) {
        const row = all[r] || [];
        const dateVal = row[dateHIdx];
        if (!dateVal || !isDateLike(dateVal)) continue;
        const dateObj = toDate(dateVal);
        if (lastDates[cleanTicker] && dateObj.getTime() <= lastDates[cleanTicker].getTime()) continue;

        const open = toNum(row[openHIdx]);
        const high = toNum(row[highHIdx]);
        const low  = toNum(row[lowHIdx]);
        const close= toNum(row[closeHIdx]);
        if (isNaN(close)) continue;
        const varPct = (!isNaN(open) && open !== 0) ? ((close - open) / open) : 0;
        rowsToWrite.push([cleanTicker, dateObj, open, high, low, close, varPct]);
      }
    }
  } finally {
      ss.deleteSheet(tmp);
  }

  if (rowsToWrite.length > 0) {
    const targetRange = dadosSh.getRange(dadosSh.getLastRow() + 1, 1, rowsToWrite.length, 7);
    targetRange.setValues(rowsToWrite);
    targetRange.offset(0, 1, rowsToWrite.length, 1).setNumberFormat("yyyy-MM-dd");
    targetRange.offset(0, 6, rowsToWrite.length, 1).setNumberFormat("0.00%");
  }

  const newIndex = lastIndex + tickersToProcess.length;
  if (newIndex >= allTickers.length) {
    properties.deleteProperty('lastProcessedTickerIndex');
    ss.toast(`Lote final concluído! Total de ${allTickers.length} tickers processados.`);
    return true;
  } else {
    properties.setProperty('lastProcessedTickerIndex', newIndex.toString());
    ss.toast(`Lote concluído. ${newIndex} de ${allTickers.length} tickers processados. Execute novamente para continuar.`);
    return false;
  }
}


// =================================================================
// =================== HELPERS =====================================
// =================================================================

function removeBVMF(s) { return String(s||"").replace(/^BVMF:/i,"").trim(); }
function isDateLike(v) { if (!v) return false; if (v instanceof Date && !isNaN(v.getTime())) return true; const d = new Date(v); return !isNaN(d.getTime()); }
function toDate(v){if (v instanceof Date) return v; const d = new Date(v); return isNaN(d.getTime()) ? null : d;}
function toNum(v){const n = Number(v); return isFinite(n) ? n : NaN;}
function upsertSheet(ss, name){return ss.getSheetByName(name) || ss.insertSheet(name);}

function calcularATR(priceData, period) {
  if (priceData.length < period) return priceData;

  let trueRanges = [];
  for (let i = 1; i < priceData.length; i++) {
    const prevDay = priceData[i - 1];
    const currDay = priceData[i];
    const tr1 = currDay.high - currDay.low;
    const tr2 = Math.abs(currDay.high - prevDay.close);
    const tr3 = Math.abs(currDay.low - prevDay.close);
    trueRanges.push(Math.max(tr1, tr2, tr3));
  }

  let atrValues = [];
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trueRanges[i] || 0;
  }
  let prevAtr = sum / period;
  atrValues.push(prevAtr);

  for (let i = period; i < trueRanges.length; i++) {
    const currentAtr = ((prevAtr * (period - 1)) + trueRanges[i]) / period;
    atrValues.push(currentAtr);
    prevAtr = currentAtr;
  }

  priceData.forEach((day, index) => {
    if (index >= period) {
      day.atr = atrValues[index - period];
    } else {
      day.atr = null;
    }
  });
  return priceData;
}

function calcularIntervaloDinamicoDeGatilho(priceData, direcao) {
  const dailyChanges = [];
  for (let i = 1; i < priceData.length; i++) {
    const prevClose = priceData[i - 1].close;
    const { high, low } = priceData[i];

    if (isFinite(prevClose) && prevClose > 0 && isFinite(high) && isFinite(low)) {
      let change;
      if (direcao === 'COMPRA') {
        change = (prevClose - low) / prevClose * 100;
      } else {
        change = (high - prevClose) / prevClose * 100;
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
  const stdDev = standardDeviation(data);
  return { gatilhoMax: mean + stdDev, mediaVariacoes: mean, desvioPadrao: stdDev };
}

function simularTrade(rec, priceDay, lote) {
  let resultado = 0;
  const alvoDeGanhoAbs = rec.precoEntrada * (1 + rec.alvoGanho);
  const stopLossAbs = rec.precoEntrada * (1 - rec.stopLoss);

  if (rec.direcao === 'COMPRA') {
    if (priceDay.low <= rec.precoEntrada) {
      if (priceDay.high >= alvoDeGanhoAbs) {
        resultado = (alvoDeGanhoAbs - rec.precoEntrada) * lote;
      }
      else if (priceDay.low <= stopLossAbs) {
        resultado = (stopLossAbs - rec.precoEntrada) * lote;
      }
      else {
        resultado = (priceDay.close - rec.precoEntrada) * lote;
      }
    }
  } else { // VENDA
    if (priceDay.high >= rec.precoEntrada) {
      const alvoDeGanhoVendaAbs = rec.precoEntrada * (1 - rec.alvoGanho);
      const stopLossVendaAbs = rec.precoEntrada * (1 + rec.stopLoss);
      if (priceDay.low <= alvoDeGanhoVendaAbs) {
        resultado = (rec.precoEntrada - alvoDeGanhoVendaAbs) * lote;
      }
      else if (priceDay.high >= stopLossVendaAbs) {
        resultado = (rec.precoEntrada - stopLossVendaAbs) * lote;
      }
      else {
        resultado = (rec.precoEntrada - priceDay.close) * lote;
      }
    }
  }
  return resultado;
}
```
