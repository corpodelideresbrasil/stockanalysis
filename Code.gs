// =================================================================
// =================== FUNÇÕES PRINCIPAIS E MENU ===================
// =================================================================

function onOpen() {
  SpreadsheetApp.getUi()
      .createMenu('🤖 Análise de Ações')
      .addItem('Executar Atualização Completa', 'executarAtualizacaoCompleta')
      .addSeparator()
      .addItem('Apenas Gerar Recomendações', 'gerarParametrosERecomendacoes')
      .addSeparator()
      .addItem('Limpar Dados Antigos', 'limparDadosAntigos')
      .addItem('Resetar Progresso de Lotes', 'resetarProgresso')
      .addToUi();
}

function executarAtualizacaoCompleta() {
  SpreadsheetApp.getActiveSpreadsheet().toast("Iniciando processamento...");
  const isDataUpdateComplete = atualizarDadosDiarios();
  if (isDataUpdateComplete) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Atualização de dados concluída. Iniciando análise...");
    gerarParametrosERecomendacoes();
  }
}

function resetarProgresso() {
  try {
    PropertiesService.getUserProperties().deleteProperty('lastProcessedTickerIndex');
    SpreadsheetApp.getActiveSpreadsheet().toast("Progresso dos lotes foi resetado.");
  } catch (e) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Erro ao resetar o progresso: " + e.message);
  }
}

function limparDadosAntigos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = ["Dados diários", "Parametros_por_Ticker", "Recomendacoes_diarias"];
  sheetNames.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.clear();
      if (name === "Dados diários") {
        sheet.appendRow(["Ticker", "Date", "Open", "High", "Low", "Close", "Var%"]);
      }
    }
  });
  resetarProgresso();
  SpreadsheetApp.getActiveSpreadsheet().toast("Abas de dados e resultados foram limpas.");
}

// =================================================================
// =================== CONFIGURAÇÕES GLOBAIS =======================
// =================================================================

const FORMULA_SEPARATOR = ';';
const BATCH_SIZE = 4;
const MAX_WAIT_MS = 15000;
const POLL_MS     = 1000;
const HARD_START_DATE = new Date(2025, 0, 1);
const PERC_MIN = 0.2;
const PERC_MAX = 3.0;
const PERC_STEP = 0.1;
const MIN_ACERTO = 60;
const MIN_TRADES = 0;
const EV_MIN = 0;
const CI_LOWER_MIN = 0.50;
const MIN_GAIN_PERCENT = 0.15; // Ganho médio mínimo para que uma recomendação seja exibida

// =================================================================
// =================== FUNÇÃO DE ATUALIZAÇÃO DE DADOS ================
// =================================================================

function atualizarDadosDiarios() {
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
    ss.toast("Aba 'TICKERS' não encontrada. Criei uma para você. Adicione suas ações e rode novamente.");
    return false;
  }

  const allTickers = tickersSh.getRange(2, 1, tickersSh.getLastRow() - 1, 1).getValues().flat()
    .map(x => String(x || "").trim()).filter(Boolean);

  if (!allTickers.length) {
    ss.toast("Nenhum ticker válido encontrado em 'TICKERS'.");
    return true;
  }

  if (lastIndex >= allTickers.length) {
    ss.toast("Todos os tickers já foram processados. A atualização de hoje está completa.");
    properties.deleteProperty('lastProcessedTickerIndex');
    return true;
  }

  const tickersToProcess = allTickers.slice(lastIndex, lastIndex + BATCH_SIZE);
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
      const cleanTicker = removeBVMF(fullTicker);
      let startDate = HARD_START_DATE;
      if (lastDates[cleanTicker]) {
        const nextDay = new Date(lastDates[cleanTicker].getTime());
        nextDay.setDate(nextDay.getDate() + 1);
        startDate = nextDay;
      }

      // *** LÓGICA DE DATA CORRIGIDA PARA EVITAR ERROS DE FUSO HORÁRIO ***
      const ontemStr = Utilities.formatDate(ontem, tz, 'yyyy-MM-dd');
      const startDateStr = Utilities.formatDate(startDate, tz, 'yyyy-MM-dd');

      if (startDateStr > ontemStr) continue;

      tmp.clear();
      SpreadsheetApp.flush();

      const date1 = `DATEVALUE("${startDateStr}")`;
      const date2 = `DATEVALUE("${ontemStr}")`;
      const sep = FORMULA_SEPARATOR;
      const formula = `=GOOGLEFINANCE("${fullTicker}"${sep}"all"${sep}${date1}${sep}${date2}${sep}"DAILY")`;

      tmp.getRange(1, 1).setFormula(formula);
      SpreadsheetApp.flush();

      let waited = 0;
      let all = [];
      while (waited < MAX_WAIT_MS) {
        Utilities.sleep(POLL_MS);
        waited += POLL_MS;
        all = tmp.getDataRange().getValues();
        if (all.length > 1 && all[0].length > 1) {
            const maybe = all[1];
            if (maybe && (isDateLike(maybe[0]) || typeof maybe[1] === "number")) break;
        } else if (all.length === 1 && all[0][0] && String(all[0][0]).includes("#N/A")) break;
      }

      if (!all || all.length < 2 || (all[0][0] && String(all[0][0]).includes("#N/A"))) continue;

      const headerResult = all[0].map(h => (h || "").toString().toLowerCase());
      const dateHIdx  = headerResult.findIndex(h => h.indexOf("date")!==-1 || h.indexOf("data")!==-1);
      const openHIdx  = headerResult.findIndex(h => h.indexOf("open")!==-1);
      const highHIdx  = headerResult.findIndex(h => h.indexOf("high")!==-1);
      const lowHIdx   = headerResult.findIndex(h => h.indexOf("low")!==-1);
      const closeHIdx = headerResult.findIndex(h => h.indexOf("close")!==-1);
      const lastIdx = findLastRowIndex(all, [dateHIdx, closeHIdx]);

      if (lastIdx < 1) continue;

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
      }
    }
  } catch(err) {
      ss.toast("Ocorreu um erro. Verifique os Logs (Extensões > Apps Script > Registros).");
      properties.deleteProperty('lastProcessedTickerIndex');
      throw err;
  } finally {
      try { ss.deleteSheet(tmp); } catch(e) { /* ignore */ }
  }

  if (rowsToWrite.length > 0) {
    const targetRange = dadosSh.getRange(dadosSh.getLastRow() + 1, 1, rowsToWrite.length, 7);
    targetRange.setValues(rowsToWrite);
    targetRange.offset(0, 1, rowsToWrite.length, 1).setNumberFormat("yyyy-MM-dd");
    targetRange.offset(0, 6, rowsToWrite.length, 1).setNumberFormat("0.00%");
    const dataRangeToSort = dadosSh.getRange(2, 1, dadosSh.getLastRow() - 1, dadosSh.getLastColumn());
    dataRangeToSort.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);
  }

  const newIndex = lastIndex + tickersToProcess.length;
  if (newIndex >= allTickers.length) {
    properties.deleteProperty('lastProcessedTickerIndex');
    ss.toast(`Lote final concluído! Total de ${allTickers.length} tickers processados.`);
    return true;
  } else {
    properties.setProperty('lastProcessedTickerIndex', newIndex);
    ss.toast(`Lote concluído. ${newIndex} de ${allTickers.length} tickers processados. Execute novamente para continuar.`);
    return false;
  }
}


function gerarParametrosERecomendacoes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetDados = ss.getSheetByName("Dados diários");
  if (!sheetDados) {
    ss.toast("ERRO: Aba 'Dados diários' não encontrada. Execute a atualização primeiro.");
    throw new Error("Aba 'Dados diários' não encontrada.");
  }

  const values = sheetDados.getDataRange().getValues();
  if (values.length < 2) {
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
    throw new Error("Cabeçalho inválido em 'Dados diários'.");
  }

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

  const resultados = [];
  const comprasRecomendadas = [];
  const vendasRecomendadas = [];

  for (const tk of Object.keys(byTicker)) {
    const candles = byTicker[tk];
    if (candles.length < 2) continue;

    let bestBuy = {p:0, acerto:0, trades:0, ganho:0, ev:0, ciL:0};
    let bestSell= {p:0, acerto:0, trades:0, ganho:0, ev:0, ciL:0};

    for (let p = PERC_MIN; p <= PERC_MAX + 1e-9; p += PERC_STEP) {
      let compTrades=0, compWins=0, compSumSigned=0, compWinSum=0, compLossSumAbs=0;
      let vendTrades=0, vendWins=0, vendSumSigned=0, vendWinSum=0, vendLossSumAbs=0;

      for (let i = 1; i < candles.length; i++) {
        const prevClose = candles[i-1].close;
        const {high, low, close} = candles[i];
        if (!isFinite(prevClose) || prevClose === 0) continue;

        const buyEntry = prevClose * (1 - p/100);
        if (low <= buyEntry && buyEntry > 0) {
          compTrades++;
          const retPct = ((close - buyEntry) / buyEntry) * 100;
          compSumSigned += retPct;
          if (retPct > 0) { compWins++; compWinSum += retPct; }
          else { compLossSumAbs += -retPct; }
        }

        const sellEntry = prevClose * (1 + p/100);
        if (high >= sellEntry && sellEntry > 0) {
          vendTrades++;
          const retPct = ((sellEntry - close) / sellEntry) * 100;
          vendSumSigned += retPct;
          if (retPct > 0) { vendWins++; vendWinSum += retPct; }
          else { vendLossSumAbs += -retPct; }
        }
      }

      const compAcc   = compTrades ? (compWins/compTrades)*100 : 0;
      const vendAcc   = vendTrades ? (vendWins/vendTrades)*100 : 0;
      const compGain  = compTrades ? compSumSigned/compTrades : 0;
      const vendGain  = vendTrades ? vendSumSigned/ vendTrades : 0;

      const numCompLosses = compTrades - compWins;
      const compAvgWin  = compWins > 0 ? (compWinSum/compWins) : 0;
      const compAvgLoss = numCompLosses > 0 ? (compLossSumAbs / numCompLosses) : 0;

      const numVendLosses = vendTrades - vendWins;
      const vendAvgWin  = vendWins > 0 ? (vendWinSum/vendWins) : 0;
      const vendAvgLoss = numVendLosses > 0 ? (vendLossSumAbs / numVendLosses) : 0;

      const compEV  = compTrades > 0 ? ((compWins/compTrades)*compAvgWin - (numCompLosses/compTrades)*compAvgLoss) : 0;
      const vendEV  = vendTrades > 0 ? ((vendWins/vendTrades)*vendAvgWin - (numVendLosses/vendTrades)*vendAvgLoss) : 0;

      const compCiL = compTrades ? wilsonLower(compWins, compTrades) : 0;
      const vendCiL = vendTrades ? wilsonLower(vendWins, vendTrades) : 0;

      if (compAcc > bestBuy.acerto || (compAcc === bestBuy.acerto && compGain > bestBuy.ganho)) {
        bestBuy = {p, acerto:compAcc, trades:compTrades, ganho:compGain, ev:compEV, ciL:compCiL};
      }
      if (vendAcc > bestSell.acerto || (vendAcc === bestSell.acerto && vendGain > bestSell.ganho)) {
        bestSell = {p, acerto:vendAcc, trades:vendTrades, ganho:vendGain, ev:vendEV, ciL:vendCiL};
      }
    }

    const plainTk = removeBVMF(tk);
    resultados.push([
      plainTk,
      round2(bestBuy.p), round2(bestBuy.acerto), bestBuy.trades, round2(bestBuy.ganho), round2(bestBuy.ev), round2(bestBuy.ciL*100),
      round2(bestSell.p), round2(bestSell.acerto), bestSell.trades, round2(bestSell.ganho), round2(bestSell.ev), round2(bestSell.ciL*100)
    ]);

    if (candles.length >= 1) {
      const prevClose = candles[candles.length - 1].close;
      const buyEntry  = prevClose * (1 - bestBuy.p/100);
      const buyTarget = buyEntry * (1 + bestBuy.ganho/100);
      const sellEntry = prevClose * (1 + bestSell.p/100);
      const sellTarget= sellEntry * (1 - bestSell.ganho/100);

      if (bestBuy.trades >= MIN_TRADES && bestBuy.acerto >= MIN_ACERTO && bestBuy.ev > EV_MIN && bestBuy.ciL > CI_LOWER_MIN && bestBuy.ganho > MIN_GAIN_PERCENT) {
        comprasRecomendadas.push([plainTk, "COMPRA", round2(bestBuy.p), round2(prevClose), round2(buyEntry), round2(bestBuy.acerto), round2(bestBuy.ganho), round2(bestBuy.ev), round2(bestBuy.ciL*100), round2(buyTarget)]);
      }
      if (bestSell.trades >= MIN_TRADES && bestSell.acerto >= MIN_ACERTO && bestSell.ev > EV_MIN && bestSell.ciL > CI_LOWER_MIN && bestSell.ganho > MIN_GAIN_PERCENT) {
        vendasRecomendadas.push([plainTk, "VENDA",  round2(bestSell.p), round2(prevClose), round2(sellEntry), round2(bestSell.acerto), round2(bestSell.ganho), round2(bestSell.ev), round2(bestSell.ciL*100), round2(sellTarget)]);
      }
    }
  }

  const shP = upsertSheet(ss, "Parametros_por_Ticker");
  shP.clear();
  shP.appendRow(["Ticker","Melhor_Param_Compra(%)","Taxa_Acerto_Compra(%)","Trades_Compra","#Ganho_Médio_Compra(%)","EV_Compra(%)","IC95_L_Compra(%)","Melhor_Param_Venda(%)","Taxa_Acerto_Venda(%)","Trades_Venda","#Ganho_Médio_Venda(%)","EV_Venda(%)","IC95_L_Venda(%)"]);
  if (resultados.length) {
    shP.getRange(2,1,resultados.length,resultados[0].length).setValues(resultados);
    shP.autoResizeColumns(1,13);
  }

  const shR = upsertSheet(ss, "Recomendacoes_diarias");
  shR.clear();
  shR.appendRow(["Ticker","Direção","Gatilho(%)","Fech. Anterior","Entrada","Acerto(%)","Ganho_Médio(%)","EV(%)","IC95_L(%)","Alvo"]);
  const recomends = comprasRecomendadas.concat(vendasRecomendadas);
  if (recomends.length){
    // Ordena por Ganho (%) descendente
    recomends.sort((a, b) => b[6] - a[6]);

    shR.getRange(2,1,recomends.length,recomends[0].length).setValues(recomends);

    // Aplica formatação de números
    shR.getRange('C2:C').setNumberFormat("0.0\"%\"");
    shR.getRange('D2:E').setNumberFormat("R$ #,##0.00");
    shR.getRange('F2:I').setNumberFormat("0.00\"%\"");
    shR.getRange('J2:J').setNumberFormat("R$ #,##0.00");

    // Aplica formatação condicional de cor
    for (let i=0; i<recomends.length; i++){
      const dir = recomends[i][1];
      shR.getRange(i+2, 1, 1, 10).setBackground(dir === "COMPRA" ? "#e6f4ea" : "#fce8e6");
    }
    shR.autoResizeColumns(1,10);
  }
  SpreadsheetApp.getActiveSpreadsheet().toast("Parâmetros e Recomendações gerados!");
}

/* ================== helpers ================== */

function removeBVMF(s) { return String(s||"").replace(/^BVMF:/i,"").trim(); }
function isDateLike(v) { if (!v) return false; if (v instanceof Date && !isNaN(v.getTime())) return true; const d = new Date(v); return !isNaN(d.getTime()); }
function findLastRowIndex(allRows, colIndices) {for (let r = allRows.length - 1; r >= 1; r--) {for (let ci of colIndices) {if (allRows[r] && allRows[r][ci] !== undefined && allRows[r][ci] !== "") return r;}}return 0;}
function toDate(v){if (v instanceof Date) return v; const d = new Date(v); return isNaN(d.getTime()) ? null : d;}
function toNum(v){const n = Number(v); return isFinite(n) ? n : NaN;}
function round2(x){ const n = parseFloat(String(x).replace(",", ".")); if (isNaN(n)) return x; return Math.round(n*100)/100; }
function upsertSheet(ss, name){return ss.getSheetByName(name) || ss.insertSheet(name);}
function wilsonLower(wins, n, z = 1.96){if (!n) return 0;const p = wins/n;const z2 = z*z;const denom = 1 + z2/n;const center = p + z2/(2*n);const margin = z * Math.sqrt((p*(1-p) + z2/(4*n))/n);return Math.max(0, (center - margin)/denom);}
