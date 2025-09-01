```javascript
/**
 * @OnlyCurrentDoc
 *
 * O script a seguir é uma ferramenta para backtesting de estratégias de day-trading
 * baseadas em reversão à média. Esta é a versão final, que incorpora um "Score" de
 * otimização, um robusto backtest "Ponto-no-Tempo" e parâmetros de calibração de alvo.
 *
 * VERSÃO: Final com Calibração de Alvo
 * DATA: 2025-09-01
 */

// ===================================================================================
// 1. CONFIGURAÇÕES GLOBAIS
// ===================================================================================

const CONFIG = {
  DIAS_DADOS_MANTER: 365,
  NUM_DIAS_BACKTEST: 45,
  LOTE_ACOES_BACKTEST: 100,

  MIN_TRADES_PARA_SIGNIFICANCIA: 30,
  GATILHO_STEP: 0.1,
  GATILHO_INICIAL: 0.2,

  // --- Parâmetros de Calibração de Alvo ---
  DP_MULTIPLIER_GAIN: 0.8, // Fator de ambição para o alvo de ganho (Média + Fator * DP)
  DP_MULTIPLIER_STOP: 1.2, // Fator de segurança para o stop loss (Média + Fator * DP)

  PERFIS: {
    CONSERVADOR: {
      SHEET_NAME: "Recomendacoes_Conservador",
      MIN_EXPECTED_VALUE: 0.005,
      MIN_PROB_S1: 0.40,
      OTIMIZAR_POR: 'score'
    },
    AGRESSIVO: {
      SHEET_NAME: "Recomendacoes_Agressivo",
      MIN_EXPECTED_VALUE: 0.002,
      MIN_PROB_S1: 0.30,
      OTIMIZAR_POR: 'score'
    }
  }
};

// ===================================================================================
// 2. FUNÇÕES DE EXECUÇÃO PRINCIPAL (Para serem chamadas manualmente)
// ===================================================================================

function executarAtualizacaoCompleta() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast("Iniciando atualização e análise completa...", "Status", -1);
  try {
    atualizarDadosDiarios();
    apenasGerarRecomendacoes();
  } catch (e) {
    Logger.log(`ERRO FATAL em executarAtualizacaoCompleta: ${e.message}\n${e.stack}`);
    SpreadsheetApp.getUi().alert(`Ocorreu um erro: ${e.message}`);
  }
}

function apenasGerarRecomendacoes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast("Iniciando apenas a geração de recomendações...", "Status", -1);
  try {
    const allData = ss.getSheetByName("Dados diários").getDataRange().getValues();
    if (!allData || allData.length < 2) {
      throw new Error("Aba 'Dados diários' está vazia ou não foi encontrada.");
    }
    const recs = motorDeAnalise(ss, allData, null);
    escreverResultadosAnalise(ss, recs);
    ss.toast("Novas recomendações geradas com sucesso!", "Status", 10);
  } catch (e) {
    Logger.log(`ERRO FATAL em apenasGerarRecomendacoes: ${e.message}\n${e.stack}`);
    SpreadsheetApp.getUi().alert(`Ocorreu um erro: ${e.message}`);
  }
}

function executarBacktestPontoNoTempo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast(`Iniciando Backtest Ponto-no-Tempo (${CONFIG.NUM_DIAS_BACKTEST} dias)...`, "Status", -1);
  try {
    const allData = ss.getSheetByName("Dados diários").getDataRange().getValues();
    const hoje = new Date();
    const allBacktestResults = [];
    const backtestLog = [];

    const logSheet = upsertSheet(ss, "Backtest_Log");
    logSheet.clear();
    const logHeader = ["Data Simulação", "Ticker", "Direção", "Preço Entrada", "Status", "Resultado (R$)"];
    logSheet.appendRow(logHeader);
    logSheet.getRange(1, 1, 1, logHeader.length).setFontWeight("bold");

    for (let i = CONFIG.NUM_DIAS_BACKTEST - 1; i >= 0; i--) {
      const backtestDate = new Date(hoje.getTime() - ((i + 1) * 24 * 3600 * 1000));
      const dayOfWeek = backtestDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        Logger.log(`BACKTEST: Pulando fim de semana: ${backtestDate.toDateString()}`);
        continue;
      }

      const tradeDate = new Date(hoje.getTime() - (i * 24 * 3600 * 1000));
      const backtestDateStr = Utilities.formatDate(backtestDate, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");

      Logger.log(`BACKTEST: Gerando recomendações para ${backtestDateStr}`);
      ss.toast(`Analisando para o dia: ${backtestDateStr}...`, `Backtest (${CONFIG.NUM_DIAS_BACKTEST - i}/${CONFIG.NUM_DIAS_BACKTEST})`, 5);

      const recsDoDia = motorDeAnalise(ss, allData, backtestDate);

      let combinedRecs = [];
      for (const profileName in recsDoDia.recsByTickerProfile) {
          combinedRecs = combinedRecs.concat(Object.values(recsDoDia.recsByTickerProfile[profileName]));
      }

      const uniqueBestRecs = {};
      for (const rec of combinedRecs) {
          const key = `${rec.ticker}|${rec.direcao}`;
          if (!uniqueBestRecs[key] || rec.score > uniqueBestRecs[key].score) {
              uniqueBestRecs[key] = rec;
          }
      }
      const finalRecs = Object.values(uniqueBestRecs);

      if (finalRecs.length === 0) {
        backtestLog.push([backtestDateStr, "N/A", "N/A", "N/A", "Nenhuma recomendação gerada", 0]);
        continue;
      }

      const priceDataForTradeDay = getPriceDataForDate(allData, tradeDate);

      for (const rec of finalRecs) {
        const priceDay = priceDataForTradeDay[rec.ticker];
        let tradeResult = { resultado: 0, status: "NÃO EXECUTADO - SEM DADOS DO DIA" };
        if (priceDay) {
          tradeResult = simularTrade(rec, priceDay, CONFIG.LOTE_ACOES_BACKTEST);
        }

        backtestLog.push([backtestDateStr, rec.ticker, rec.direcao, rec.precoEntrada, tradeResult.status, tradeResult.resultado]);

        if (tradeResult.status.startsWith("EXECUTADO")) {
          allBacktestResults.push({ data: tradeDate, ticker: rec.ticker, direcao: rec.direcao, resultado: tradeResult.resultado });
        }
      }
    }

    if (backtestLog.length > 0) {
      logSheet.getRange(logSheet.getLastRow() + 1, 1, backtestLog.length, logHeader.length).setValues(backtestLog);
      formatarLogSheet(logSheet);
    }

    escreverResultadosBacktest(ss, allBacktestResults);
    ss.toast("Backtest Ponto-no-Tempo concluído!", "Status", 10);
  } catch (e) {
    Logger.log(`ERRO FATAL em executarBacktestPontoNoTempo: ${e.message}\n${e.stack}`);
    SpreadsheetApp.getUi().alert(`Ocorreu um erro no backtest: ${e.message}`);
  }
}

// ===================================================================================
// 3. MOTOR DE ANÁLISE E FUNÇÕES CORE
// ===================================================================================

function motorDeAnalise(ss, allData, endDate) {
    const header = allData[0];
    const iDate = header.indexOf("Date");
    const values = endDate ? allData.slice(1).filter(row => row[iDate] && new Date(row[iDate]) <= endDate) : allData.slice(1);

    const iTicker = header.indexOf("Ticker");
    const iOpen = header.indexOf("Open");
    const iHigh = header.indexOf("High");
    const iLow = header.indexOf("Low");
    const iClose = header.indexOf("Close");

    const byTicker = {};
    for (const row of values) {
        const tk = String(row[iTicker]).trim();
        if (!tk || tk.includes("TICKER_NAO_ENCONTRADO")) continue;
        if (!byTicker[tk]) byTicker[tk] = [];
        byTicker[tk].push({ open: toNum(row[iOpen]), high: toNum(row[iHigh]), low: toNum(row[iLow]), close: toNum(row[iClose]) });
    }

    const statsByTicker = {};
    for (const ticker in byTicker) {
        const priceData = byTicker[ticker];
        const variations = priceData.map(day => (day.close - day.open) / day.open).filter(isFinite);
        const posVariations = variations.filter(v => v > 0);
        const negVariations = variations.filter(v => v < 0);
        statsByTicker[ticker] = {
            avgPosVar: posVariations.length > 0 ? posVariations.reduce((a, b) => a + b, 0) / posVariations.length : 0,
            stdDevPosVar: posVariations.length > 1 ? standardDeviation(posVariations) : 0,
            avgNegVar: negVariations.length > 0 ? negVariations.reduce((a, b) => a + b, 0) / negVariations.length : 0,
            stdDevNegVar: negVariations.length > 1 ? standardDeviation(negVariations) : 0,
        };
    }

    let allResults = [];
    for (const ticker in byTicker) {
        const priceData = byTicker[ticker];
        if (priceData.length < 2) continue;
        const stats = statsByTicker[ticker];
        if (!stats || priceData.length < CONFIG.MIN_TRADES_PARA_SIGNIFICANCIA) continue;

        const targetGain = stats.avgPosVar + (CONFIG.DP_MULTIPLIER_GAIN * stats.stdDevPosVar);
        const targetStop = Math.abs(stats.avgNegVar) + (CONFIG.DP_MULTIPLIER_STOP * stats.stdDevNegVar);

        if (targetGain <= 0 || targetStop <= 0) continue;
        const intervaloMaximo = Math.max(stats.avgPosVar, Math.abs(stats.avgNegVar)) + Math.max(stats.stdDevPosVar, stats.stdDevNegVar);
        for (const direcao of ['COMPRA', 'VENDA']) {
            for (let p = CONFIG.GATILHO_INICIAL; p <= intervaloMaximo * 100; p += CONFIG.GATILHO_STEP) {
                const result = analisarEstrategia(priceData, p, direcao, targetGain, targetStop);
                if (result && result.totalTrades >= CONFIG.MIN_TRADES_PARA_SIGNIFICANCIA) {
                    allResults.push({ ticker, direcao, ...result });
                }
            }
        }
    }

    const recsByTickerProfile = {};
    for (const profileName in CONFIG.PERFIS) {
        const perfilConfig = CONFIG.PERFIS[profileName];
        recsByTickerProfile[profileName] = {};
        const qualifiedRecs = allResults.filter(r => r.expectedValue >= perfilConfig.MIN_EXPECTED_VALUE && r.probS1 >= perfilConfig.MIN_PROB_S1);
        for (const rec of qualifiedRecs) {
            const key = `${rec.ticker}|${rec.direcao}`;
            if (!recsByTickerProfile[profileName][key] || rec[perfilConfig.OTIMIZAR_POR] > recsByTickerProfile[profileName][key][perfilConfig.OTIMIZAR_POR]) {
                const priceData = byTicker[rec.ticker];
                const lastClose = priceData[priceData.length - 1].close;
                const entryPrice = rec.direcao === 'COMPRA' ? lastClose * (1 - rec.gatilhoPercent / 100) : lastClose * (1 + rec.gatilhoPercent / 100);
                recsByTickerProfile[profileName][key] = {...rec, precoEntrada: entryPrice, alvoGanho: rec.avgS1Profit, stopLoss: rec.maxDrawdown};
            }
        }
    }

    return { allResults, byTicker, recsByTickerProfile };
}

function analisarEstrategia(priceData, gatilhoPercent, direcao, targetGain, targetStop) {
  let cenario1 = 0, cenario2 = 0, cenario3 = 0;
  for (let i = 1; i < priceData.length; i++) {
    const prevDay = priceData[i - 1];
    const day = priceData[i];
    if (!isFinite(prevDay.close) || prevDay.close <= 0) continue;
    let entryPrice = 0;
    if (direcao === 'COMPRA') {
      entryPrice = prevDay.close * (1 - gatilhoPercent / 100);
      if (day.low <= entryPrice) {
        const profitTargetPrice = entryPrice * (1 + targetGain);
        const stopLossPrice = entryPrice * (1 - targetStop);
        if (day.low <= stopLossPrice) cenario3++;
        else if (day.high >= profitTargetPrice) cenario1++;
        else cenario2++;
      }
    } else {
      entryPrice = prevDay.close * (1 + gatilhoPercent / 100);
      if (day.high >= entryPrice) {
        const profitTargetPrice = entryPrice * (1 - targetGain);
        const stopLossPrice = entryPrice * (1 + targetStop);
        if (day.high >= stopLossPrice) cenario3++;
        else if (day.low <= profitTargetPrice) cenario1++;
        else cenario2++;
      }
    }
  }
  const totalTrades = cenario1 + cenario2 + cenario3;
  if (totalTrades === 0) return null;
  const probS1 = cenario1 / totalTrades;
  const probS3 = cenario3 / totalTrades;
  const expectedValue = (probS1 * targetGain) - (probS3 * targetStop);
  const score = expectedValue * probS1;
  return {
    gatilhoPercent, totalTrades, probS1, probS2: cenario2 / totalTrades, probS3,
    maxDrawdown: targetStop, avgS1Profit: targetGain, expectedValue, score
  };
}

function simularTrade(rec, priceDay, lote) {
  let resultado = 0;
  let status = "NÃO EXECUTADO: Gatilho de entrada não atingido";
  if (rec.direcao === 'COMPRA') {
    if (priceDay.low <= rec.precoEntrada) {
      const alvoDeGanhoAbs = rec.precoEntrada * (1 + rec.alvoGanho);
      const stopLossAbs = rec.precoEntrada * (1 - rec.stopLoss);
      if (priceDay.low <= stopLossAbs) {
        resultado = (stopLossAbs - rec.precoEntrada) * lote;
        status = `EXECUTADO - PREJUÍZO`;
      } else if (priceDay.high >= alvoDeGanhoAbs) {
        resultado = (alvoDeGanhoAbs - rec.precoEntrada) * lote;
        status = `EXECUTADO - LUCRO`;
      } else {
        resultado = (priceDay.close - rec.precoEntrada) * lote;
        status = `EXECUTADO - NEUTRO (Saída no Fechamento)`;
      }
    }
  } else {
    if (priceDay.high >= rec.precoEntrada) {
      const alvoDeGanhoAbs = rec.precoEntrada * (1 - rec.alvoGanho);
      const stopLossAbs = rec.precoEntrada * (1 + rec.stopLoss);
      if (priceDay.high >= stopLossAbs) {
        resultado = (rec.precoEntrada - stopLossAbs) * lote;
        status = `EXECUTADO - PREJUÍZO`;
      } else if (priceDay.low <= alvoDeGanhoAbs) {
        resultado = (rec.precoEntrada - alvoDeGanhoAbs) * lote;
        status = `EXECUTADO - LUCRO`;
      } else {
        resultado = (rec.precoEntrada - priceDay.close) * lote;
        status = `EXECUTADO - NEUTRO (Saída no Fechamento)`;
      }
    }
  }
  return {resultado, status};
}

// ===================================================================================
// 4. FUNÇÕES DE ESCRITA E FORMATAÇÃO
// ===================================================================================

function escreverResultadosAnalise(ss, recs) {
  escreverTodasRecomendacoes(ss, recs.allResults);
  for (const profileName in CONFIG.PERFIS) {
      escreverRecomendacoesPorPerfil(ss, recs.recsByTickerProfile[profileName], recs.byTicker, profileName);
  }
}

function escreverTodasRecomendacoes(ss, allResults) {
  const sheet = upsertSheet(ss, "Todas_Recomendacoes");
  sheet.clear();
  const header = ["Ticker", "Direção", "Score", "Gatilho (%)", "EV (%)", "% Alvo Ganho", "% Stop Loss", "Prob. Ganho (%)", "Trades Totais"];
  sheet.appendRow(header);
  sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
  if (allResults.length === 0) { sheet.getRange("A2").setValue("Nenhum resultado."); return; }
  allResults.sort((a, b) => b.score - a.score);
  const rows = allResults.map(rec => [rec.ticker, rec.direcao, rec.score, rec.gatilhoPercent / 100, rec.expectedValue, rec.avgS1Profit, rec.maxDrawdown, rec.probS1, rec.totalTrades]);
  sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  sheet.getRange('C:C').setNumberFormat("0.0000");
  sheet.getRange('D:H').setNumberFormat("0.00%");
  sheet.getRange('I:I').setNumberFormat("0");
  sheet.autoResizeColumns(1, header.length);
}

function escreverRecomendacoesPorPerfil(ss, recsByTicker, byTicker, profileName) {
  const perfilConfig = CONFIG.PERFIS[profileName];
  const sheet = upsertSheet(ss, perfilConfig.SHEET_NAME);
  sheet.clear();
  const header = ["Ticker", "Direção", "Score", "Gatilho (%)", "Fech. Anterior", "Preço Entrada", "% Alvo Ganho", "% Stop Loss", "Prob. Ganho (%)", "Trades Totais", "EV (%)"];
  sheet.appendRow(header);
  sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
  const finalRecs = Object.values(recsByTicker).sort((a, b) => b[perfilConfig.OTIMIZAR_POR] - a[perfilConfig.OTIMIZAR_POR]);
  if (finalRecs.length === 0) { sheet.getRange("A2").setValue("Nenhuma recomendação encontrada."); return; }
  const rows = finalRecs.map(rec => {
    const priceData = byTicker[rec.ticker];
    const lastClose = priceData[priceData.length - 1].close;
    return [rec.ticker, rec.direcao, rec.score, rec.gatilhoPercent / 100, lastClose, rec.precoEntrada, rec.avgS1Profit, rec.maxDrawdown, rec.probS1, rec.totalTrades, rec.expectedValue];
  });
  sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  sheet.getRange('C:C').setNumberFormat("0.0000");
  sheet.getRange('D:D').setNumberFormat("0.00%");
  sheet.getRange('E:F').setNumberFormat("R$ #,##0.00");
  sheet.getRange('G:I').setNumberFormat("0.00%");
  sheet.getRange('J:J').setNumberFormat("0");
  sheet.getRange('K:K').setNumberFormat("0.00%");
  rows.forEach((row, index) => {
    const range = sheet.getRange(index + 2, 1, 1, header.length);
    if (row[1] === 'COMPRA') range.setBackground('#d9ead3');
    else if (row[1] === 'VENDA') range.setBackground('#f4cccc');
  });
  sheet.autoResizeColumns(1, header.length);
}

function escreverResultadosBacktest(ss, allBacktestResults) {
    const sheet = upsertSheet(ss, "Backtest_Resultados_PiT");
    sheet.clear();
    const header = ["Data", "Ticker", "Direção", "Resultado (R$)"];
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
    if (allBacktestResults.length > 0) {
        allBacktestResults.sort((a, b) => new Date(a.data) - new Date(b.data));
        const rows = allBacktestResults.map(r => [Utilities.formatDate(r.data, ss.getSpreadsheetTimeZone(), "yyyy-MM-dd"), r.ticker, r.direcao, r.resultado]);
        sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
        const total = allBacktestResults.reduce((sum, r) => sum + r.resultado, 0);
        sheet.getRange("F1").setValue("Resultado Total:").setFontWeight("bold");
        sheet.getRange("G1").setValue(total).setNumberFormat('R$ #,##0.00');
        sheet.getRange("D:D").setNumberFormat('R$ #,##0.00');
        sheet.autoResizeColumns(1, header.length);
    } else {
        sheet.getRange("A2").setValue("Nenhum trade foi executado no período do backtest.");
    }
}

function formatarLogSheet(sheet) {
    sheet.getRange('D:D').setNumberFormat("R$ #,##0.00");
    sheet.getRange('F:F').setNumberFormat('R$ #,##0.00');
    sheet.autoResizeColumns(1, sheet.getLastColumn());
}

// ===================================================================================
// 5. FUNÇÕES UTILITÁRIAS
// ===================================================================================

function getPriceDataForDate(allData, date) {
    const header = allData[0];
    const iDate = header.indexOf("Date");
    const iTicker = header.indexOf("Ticker");
    const dateStr = Utilities.formatDate(date, SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd");
    const prices = {};
    allData.slice(1).forEach(row => {
        if (row[iDate] && Utilities.formatDate(new Date(row[iDate]), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), "yyyy-MM-dd") === dateStr) {
            prices[row[iTicker]] = { open: toNum(row[header.indexOf("Open")]), high: toNum(row[header.indexOf("High")]), low: toNum(row[header.indexOf("Low")]), close: toNum(row[header.indexOf("Close")]) };
        }
    });
    return prices;
}

function atualizarDadosDiarios() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const ativosSh = ss.getSheetByName("ativos");
  if (!ativosSh) { ui.alert("Aba 'ativos' não encontrada."); return; }
  const tickers = ativosSh.getRange("A2:A").getValues().flat().filter(String);
  if (tickers.length === 0) { ui.alert("Nenhum ticker encontrado na aba 'ativos'."); return; }
  const dadosSh = upsertSheet(ss, "Dados diários");
  const hoje = new Date();
  const dataInicio = new Date(hoje.getTime() - (CONFIG.DIAS_DADOS_MANTER * 24 * 3600 * 1000));
  const formulas = tickers.map(ticker => `=GOOGLEFINANCE("${ticker}"; "all"; DATE(${dataInicio.getFullYear()};${dataInicio.getMonth()+1};${dataInicio.getDate()}); TODAY())`);
  dadosSh.clearContents();
  dadosSh.appendRow(["Fórmula para Ticker:"]);
  dadosSh.getRange(2, 1, formulas.length, 1).setFormulas(formulas.map(f => [f]));
  SpreadsheetApp.flush();
  Utilities.sleep(5000);
  const dataRange = dadosSh.getDataRange();
  const values = dataRange.getValues();
  dataRange.clearContent();
  const finalData = [];
  let currentTicker = "";
  let tickerIndex = -1;
  finalData.push(["Ticker", "Date", "Open", "High", "Low", "Close", "Volume"]);
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    if (String(row[0]).includes("Fórmula para Ticker:")) {
       tickerIndex++;
       currentTicker = tickers[tickerIndex];
    } else if (row[0] && row[0] !== "Date" && row[1]) {
      finalData.push([currentTicker, ...row]);
    }
  }
  if (finalData.length > 1) {
    dadosSh.getRange(1, 1, finalData.length, finalData[0].length).setValues(finalData);
  }
}

function limparDadosAntigos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Dados diários");
  if (!sheet || sheet.getLastRow() < 2) return;
  const data = sheet.getDataRange().getValues();
  const header = data.shift();
  const iDate = header.indexOf("Date");
  const dataLimite = new Date(new Date().getTime() - (CONFIG.DIAS_DADOS_MANTER * 24 * 3600 * 1000));
  const dadosMantidos = data.filter(row => row[iDate] && new Date(row[iDate]) >= dataLimite);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, header.length).setValues([header]);
  if (dadosMantidos.length > 0) {
    sheet.getRange(2, 1, dadosMantidos.length, header.length).setValues(dadosMantidos);
  }
}

function upsertSheet(ss, sheetName) {
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    return sheet;
  }
  return ss.insertSheet(sheetName);
}

function toNum(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function standardDeviation(arr) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}
```
