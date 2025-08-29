/**
 * @OnlyCurrentDoc
 *
 * To run, open the Script Editor (Extensions > Apps Script).
 * In the top bar, select the function you want to run (e.g., runFullUpdate) and click "Run".
 * The first time, you will need to authorize the permissions requested by the script.
 */

// =================================================================
// =================== GLOBAL CONFIGURATION ========================
// =================================================================

const CONFIG = {
  // --- Sheet Names ---
  TICKERS_SHEET: "TICKERS",
  DAILY_DATA_SHEET: "Dados diários",
  PARAMS_SHEET: "Parametros_por_Ticker",
  RECOMMENDATIONS_SHEET: "Recomendacoes_diarias",

  // --- Data Fetching ---
  FORMULA_SEPARATOR: ';', // Use ';' for Brazil/Europe, ',' for US
  BATCH_SIZE: 40,         // Number of tickers to process in each run
  MAX_WAIT_MS: 15000,     // Max time to wait for GOOGLEFINANCE to load
  POLL_MS: 1000,          // How often to check if data has loaded
  HARD_START_DATE: new Date(2025, 0, 1), // Absolute earliest date to fetch data from

  // --- Backtesting Strategy Parameters ---
  DYNAMIC_ENTRY_PERCENTILE: 25, // Percentile for dynamic entry calculation (e.g., 25th percentile of historical moves)
  PERCENT_MAX: 4.0,       // Maximum percentage to test for an entry point. Acts as a ceiling for the dynamic search.
  PERCENT_STEP: 0.1,      // Step to increment percentage in tests
  ATR_PERIOD: 14,         // The period for calculating the Average True Range (ATR).
  STOP_LOSS_ATR_MULTIPLIERS: [1.2, 1.6, 2.0, 2.5], // Stop loss options to test, as multiples of ATR.
  REWARD_RISK_RATIO_OPTIONS: [1.2, 1.6, 2.0, 2.5], // Reward/Risk ratio options to test

  // --- Recommendation Filtering Criteria ---
  MIN_ACCURACY_PERCENT: 70, // Minimum win rate for a strategy to be considered
  MIN_TRADES: 20,             // Minimum number of trades for statistical significance
  MIN_WILSON_LOWER_BOUND: 0.50, // Minimum Wilson score lower bound for confidence
  MIN_AVG_GAIN_PERCENT: 0.4, // Minimum average gain for a strategy (serves as EV filter)
  MAX_DRAWDOWN_PERCENT: 5.0,  // Maximum historic drawdown for a strategy to be considered
  MAX_RECOMMENDATIONS_TO_SHOW: 15, // Limits the final number of recommendations shown
};

// =================================================================
// ===================   MAIN FUNCTIONS    =========================
// =================================================================

/**
 * Runs the complete data update and analysis process.
 * First, it fetches all daily data, then it generates parameters and recommendations.
 */
function runFullUpdate() {
  SpreadsheetApp.getActiveSpreadsheet().toast("Starting processing...");
  const isDataUpdateComplete = updateDailyData();
  if (isDataUpdateComplete) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Data update complete. Starting analysis...");
    generateParametersAndRecommendations();
  }
}

/**
 * Resets the batch processing progress, allowing the script to run from the beginning.
 */
function resetBatchProgress() {
  try {
    PropertiesService.getUserProperties().deleteProperty('lastProcessedTickerIndex');
    SpreadsheetApp.getActiveSpreadsheet().toast("Batch progress has been reset.");
  } catch (e) {
    SpreadsheetApp.getActiveSpreadsheet().toast("Error resetting progress: " + e.message);
  }
}

/**
 * Clears all data from the output sheets to start fresh.
 */
function clearOldData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetNames = [CONFIG.DAILY_DATA_SHEET, CONFIG.PARAMS_SHEET, CONFIG.RECOMMENDATIONS_SHEET];
  sheetNames.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      sheet.clear();
      if (name === CONFIG.DAILY_DATA_SHEET) {
        sheet.appendRow(["Ticker", "Date", "Open", "High", "Low", "Close", "Var%"]);
      }
    }
  });
  resetBatchProgress();
  SpreadsheetApp.getActiveSpreadsheet().toast("Data and result sheets have been cleared.");
}

// =================================================================
// =================== DATA UPDATE FUNCTION ========================
// =================================================================

/**
 * Fetches historical daily data for tickers listed in the TICKERS_SHEET.
 * Processes tickers in batches to stay within Google Apps Script execution limits.
 * @returns {boolean} True if all tickers have been processed, false if more batches are remaining.
 */
function updateDailyData() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const userProperties = PropertiesService.getUserProperties();
  const lastIndexStr = userProperties.getProperty('lastProcessedTickerIndex') || '0';
  let lastProcessedIndex = parseInt(lastIndexStr, 10);
  const timezone = spreadsheet.getSpreadsheetTimeZone();

  let tickersSheet = spreadsheet.getSheetByName(CONFIG.TICKERS_SHEET);
  if (!tickersSheet) {
    tickersSheet = spreadsheet.insertSheet(CONFIG.TICKERS_SHEET);
    tickersSheet.getRange("A1:B1").setValues([["Ticker", "<- Add your tickers in Column A, starting from row 2"]]);
    tickersSheet.getRange("A2").setValue("EXAMPLE: PETR4");
    tickersSheet.autoResizeColumn(1);
    tickersSheet.autoResizeColumn(2);
    spreadsheet.toast(`Sheet '${CONFIG.TICKERS_SHEET}' not found. I created one for you. Add stocks and run again.`);
    return false;
  }

  const allTickers = tickersSheet.getRange(2, 1, tickersSheet.getLastRow() - 1, 1).getValues().flat()
    .map(x => String(x || "").trim()).filter(Boolean);

  if (!allTickers.length) {
    spreadsheet.toast(`No valid tickers found in '${CONFIG.TICKERS_SHEET}'.`);
    return true; // Nothing to process
  }

  if (lastProcessedIndex >= allTickers.length) {
    spreadsheet.toast("All tickers have been processed. Today's update is complete.");
    userProperties.deleteProperty('lastProcessedTickerIndex');
    return true;
  }

  const tickersToProcess = allTickers.slice(lastProcessedIndex, lastProcessedIndex + CONFIG.BATCH_SIZE);
  spreadsheet.toast(`Processing batch: ${lastProcessedIndex + 1} to ${lastProcessedIndex + tickersToProcess.length} of ${allTickers.length} tickers.`);

  let dataSheet = getOrCreateSheet(spreadsheet, CONFIG.DAILY_DATA_SHEET);
  if (dataSheet.getLastRow() < 1) {
    dataSheet.appendRow(["Ticker", "Date", "Open", "High", "Low", "Close", "Var%"]);
    SpreadsheetApp.flush();
  }

  const lastDateByTicker = {};
  const dataValues = dataSheet.getDataRange().getValues();
  if (dataValues.length > 1) {
    const header = dataValues[0];
    const tickerColIdx = header.indexOf("Ticker");
    const dateColIdx = header.indexOf("Date");
    if (tickerColIdx !== -1 && dateColIdx !== -1) {
      for (let i = 1; i < dataValues.length; i++) {
        const ticker = dataValues[i][tickerColIdx];
        const date = convertToDate(dataValues[i][dateColIdx]);
        if (ticker && date) {
          const cleanedTicker = cleanTickerSymbol(ticker);
          if (!lastDateByTicker[cleanedTicker] || date > lastDateByTicker[cleanedTicker]) {
            lastDateByTicker[cleanedTicker] = date;
          }
        }
      }
    }
  }

  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
  const newRows = [];
  const tempSheetName = `_TMP_DATA_FETCH_${Utilities.getUuid().slice(0, 8)}`;
  const tempSheet = spreadsheet.insertSheet(tempSheetName);

  try {
    for (const ticker of tickersToProcess) {
      const cleanedTicker = cleanTickerSymbol(ticker);
      let startDate = CONFIG.HARD_START_DATE;
      if (lastDateByTicker[cleanedTicker]) {
        const nextDay = new Date(lastDateByTicker[cleanedTicker].getTime());
        nextDay.setDate(nextDay.getDate() + 1);
        startDate = nextDay;
      }

      const yesterdayStr = Utilities.formatDate(yesterday, timezone, 'yyyy-MM-dd');
      const startDateStr = Utilities.formatDate(startDate, timezone, 'yyyy-MM-dd');

      if (startDateStr > yesterdayStr) continue;

      tempSheet.clear();
      SpreadsheetApp.flush();

      const startDateValue = `DATEVALUE("${startDateStr}")`;
      const endDateValue = `DATEVALUE("${yesterdayStr}")`;
      const googleFinanceFormula = `=GOOGLEFINANCE("${ticker}"${CONFIG.FORMULA_SEPARATOR}"all"${CONFIG.FORMULA_SEPARATOR}${startDateValue}${CONFIG.FORMULA_SEPARATOR}${endDateValue}${CONFIG.FORMULA_SEPARATOR}"DAILY")`;

      tempSheet.getRange(1, 1).setFormula(googleFinanceFormula);
      SpreadsheetApp.flush();

      // Poll for GOOGLEFINANCE results
      let timeWaited = 0;
      let fetchedData = [];
      while (timeWaited < CONFIG.MAX_WAIT_MS) {
        Utilities.sleep(CONFIG.POLL_MS);
        timeWaited += CONFIG.POLL_MS;
        fetchedData = tempSheet.getDataRange().getValues();
        if (fetchedData.length > 1 && fetchedData[0].length > 1) {
          const firstDataRow = fetchedData[1];
          if (firstDataRow && (isDateLike(firstDataRow[0]) || typeof firstDataRow[1] === "number")) break;
        } else if (fetchedData.length === 1 && fetchedData[0][0] && String(fetchedData[0][0]).includes("#N/A")) {
          break; // Formula error
        }
      }

      if (!fetchedData || fetchedData.length < 2 || (fetchedData[0][0] && String(fetchedData[0][0]).includes("#N/A"))) {
        continue;
      }

      const resultHeader = fetchedData[0].map(h => (h || "").toString().toLowerCase());
      const resultDateIdx = resultHeader.findIndex(h => h.includes("date") || h.includes("data"));
      const resultOpenIdx = resultHeader.findIndex(h => h.includes("open"));
      const resultHighIdx = resultHeader.findIndex(h => h.includes("high"));
      const resultLowIdx = resultHeader.findIndex(h => h.includes("low"));
      const resultCloseIdx = resultHeader.findIndex(h => h.includes("close"));
      const lastRowInResult = findLastPopulatedRowIndex(fetchedData, [resultDateIdx, resultCloseIdx]);

      if (lastRowInResult < 1) continue;

      for (let r = 1; r <= lastRowInResult; r++) {
        const dataRow = fetchedData[r] || [];
        const dateValue = dataRow[resultDateIdx];
        if (!dateValue) continue;
        const dateObject = convertToDate(dateValue);
        if (!dateObject) continue;
        if (lastDateByTicker[cleanedTicker] && dateObject.getTime() <= lastDateByTicker[cleanedTicker].getTime()) continue;
        const open = convertToNumber(dataRow[resultOpenIdx]);
        const high = convertToNumber(dataRow[resultHighIdx]);
        const low = convertToNumber(dataRow[resultLowIdx]);
        const close = convertToNumber(dataRow[resultCloseIdx]);
        if (isNaN(close)) continue;
        const changePct = (!isNaN(open) && open !== 0) ? ((close - open) / open) : 0;
        newRows.push([cleanedTicker, dateObject, open, high, low, close, changePct]);
      }
    }
  } catch (err) {
    spreadsheet.toast("An error occurred. Check Logs (Extensions > Apps Script > Executions).");
    userProperties.deleteProperty('lastProcessedTickerIndex');
    throw err;
  } finally {
    try {
      spreadsheet.deleteSheet(tempSheet);
    } catch (e) { /* ignore */ }
  }

  if (newRows.length > 0) {
    const targetRange = dataSheet.getRange(dataSheet.getLastRow() + 1, 1, newRows.length, 7);
    targetRange.setValues(newRows);
    targetRange.offset(0, 1, newRows.length, 1).setNumberFormat("yyyy-MM-dd");
    targetRange.offset(0, 6, newRows.length, 1).setNumberFormat("0.00%");
  }

  const newIndex = lastProcessedIndex + tickersToProcess.length;
  if (newIndex >= allTickers.length) {
    // --- PERFORMANCE OPTIMIZATION ---
    // Sort only once when all batches are complete.
    const dataRange = dataSheet.getRange(2, 1, dataSheet.getLastRow() - 1, dataSheet.getLastColumn());
    if (dataRange.getNumRows() > 1) {
       dataRange.sort([{ column: 1, ascending: true }, { column: 2, ascending: true }]);
    }
    userProperties.deleteProperty('lastProcessedTickerIndex');
    spreadsheet.toast(`Final batch complete! Total of ${allTickers.length} tickers processed.`);
    return true;
  } else {
    userProperties.setProperty('lastProcessedTickerIndex', newIndex.toString());
    spreadsheet.toast(`Batch complete. ${newIndex} of ${allTickers.length} tickers processed. Run again to continue.`);
    return false;
  }
}

// =================================================================
// =================== ANALYSIS & RECOMMENDATION ===================
// =================================================================

/**
 * Runs a multi-layered optimization to find the best strategies for a given ticker and data period.
 * It finds the best strategy by Profit Factor and the best strategy by Accuracy for both BUY and SELL directions.
 * @param {string} ticker The ticker symbol.
 * @param {Array<Object>} priceData The price data for the ticker.
 * @param {string} analysisType A string identifier for the analysis period (e.g., "Análise Completa").
 * @returns {Array<Object>} An array of recommendation objects for all unique best found strategies.
 */
function runAnalysisForPeriod(ticker, priceData, analysisType) {
  const bests = {
    'BUY': { byProfitFactor: null, byAccuracy: null },
    'SELL': { byProfitFactor: null, byAccuracy: null }
  };

  if (priceData.length >= CONFIG.ATR_PERIOD) {
    const dynamicParams = calculateDynamicEntryParameters(priceData);
    const atrData = calculateATR(priceData, CONFIG.ATR_PERIOD);

    for (const direction of ['BUY', 'SELL']) {
      const startPercent = direction === 'BUY' ? dynamicParams.minBuyP : dynamicParams.minSellP;
      const minP = Math.max(0.1, startPercent); // Use dynamic value but ensure a floor of 0.1%

      for (const stopMultiplier of CONFIG.STOP_LOSS_ATR_MULTIPLIERS) {
        for (const ratio of CONFIG.REWARD_RISK_RATIO_OPTIONS) {
          for (let p = minP; p <= CONFIG.PERCENT_MAX + 1e-9; p += CONFIG.PERCENT_STEP) {
            const metrics = calculateBacktestMetrics(priceData, p, direction, atrData, stopMultiplier, ratio);
            const isValid = metrics.trades >= CONFIG.MIN_TRADES &&
                            metrics.accuracy >= CONFIG.MIN_ACCURACY_PERCENT &&
                            metrics.ciLower >= CONFIG.MIN_WILSON_LOWER_BOUND &&
                            metrics.avgGain >= CONFIG.MIN_AVG_GAIN_PERCENT &&
                            metrics.maxDD <= CONFIG.MAX_DRAWDOWN_PERCENT;

            if (isValid) {
              // Check for best by Profit Factor
              if (!bests[direction].byProfitFactor || metrics.profitFactor > bests[direction].byProfitFactor.profitFactor) {
                bests[direction].byProfitFactor = metrics;
              }
              // Check for best by Accuracy
              if (!bests[direction].byAccuracy || metrics.accuracy > bests[direction].byAccuracy.accuracy) {
                bests[direction].byAccuracy = metrics;
              }
            }
          }
        }
      }
    }
  }

  const strategies = new Map();

  // Helper to add a strategy to the map, avoiding duplicates and tagging how it was optimized
  const addStrategy = (strategy, optimizedBy, direction) => {
    if (!strategy) return;
    const key = `${direction}-${strategy.p}-${strategy.stopLossAtrMultiplier}-${strategy.rewardRiskRatio}`;
    if (strategies.has(key)) {
      // If the same strategy is optimal for both, combine the 'optimizedBy' tag
      const existing = strategies.get(key);
      if (!existing.optimizedBy.includes(optimizedBy)) {
        existing.optimizedBy += ` & ${optimizedBy}`;
      }
    } else {
      strategies.set(key, { ...strategy, optimizedBy: optimizedBy, direction: direction });
    }
  };

  addStrategy(bests.BUY.byProfitFactor, 'Profit Factor', 'COMPRA');
  addStrategy(bests.BUY.byAccuracy, 'Accuracy', 'COMPRA');
  addStrategy(bests.SELL.byProfitFactor, 'Profit Factor', 'VENDA');
  addStrategy(bests.SELL.byAccuracy, 'Accuracy', 'VENDA');

  const recommendations = [];
  const cleanedTicker = cleanTickerSymbol(ticker);
  const previousClose = priceData.length >= 2 ? priceData[priceData.length - 1].close : 0;
  const latestAtr = atrData[atrData.length - 1];

  strategies.forEach(strat => {
    const entryPrice = strat.direction === 'COMPRA'
      ? previousClose * (1 - strat.p / 100)
      : previousClose * (1 + strat.p / 100);

    recommendations.push({
      ticker: cleanedTicker,
      direction: strat.direction,
      optimizedBy: strat.optimizedBy,
      entry: entryPrice,
      stopLossAtrMultiplier: strat.stopLossAtrMultiplier,
      rewardRiskRatio: strat.rewardRiskRatio,
      // Add human-readable stop/target based on latest data
      stopValue: latestAtr * strat.stopLossAtrMultiplier,
      targetValue: latestAtr * strat.stopLossAtrMultiplier * strat.rewardRiskRatio,
      profitFactor: strat.profitFactor,
      accuracy: strat.accuracy,
      maxDD: strat.maxDD,
      analysisType: analysisType,
      fullMetrics: strat
    });
  });

  return recommendations;
}


/**
 * Analyzes the downloaded daily data to find the best trading parameters and generate recommendations
 * for both a full historical period and a recent 3-month period.
 */
function generateParametersAndRecommendations() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = spreadsheet.getSheetByName(CONFIG.DAILY_DATA_SHEET);
  if (!dataSheet) {
    spreadsheet.toast(`ERROR: Sheet '${CONFIG.DAILY_DATA_SHEET}' not found. Run the update first.`);
    throw new Error(`Sheet '${CONFIG.DAILY_DATA_SHEET}' not found.`);
  }

  const allData = dataSheet.getDataRange().getValues();
  if (allData.length < 2) {
    spreadsheet.toast(`No data to analyze in '${CONFIG.DAILY_DATA_SHEET}'.`);
    return;
  }

  const header = allData[0];
  const headerIndices = {
    ticker: header.indexOf("Ticker"), date: header.indexOf("Date"), open: header.indexOf("Open"),
    high: header.indexOf("High"), low: header.indexOf("Low"), close: header.indexOf("Close")
  };
  if (Object.values(headerIndices).some(i => i === -1)) {
    throw new Error(`Invalid header in '${CONFIG.DAILY_DATA_SHEET}'.`);
  }

  const dataByTicker = {};
  for (let r = 1; r < allData.length; r++) {
    const row = allData[r];
    const ticker = String(row[headerIndices.ticker]).trim();
    if (!ticker) continue;
    if (!dataByTicker[ticker]) dataByTicker[ticker] = [];
    dataByTicker[ticker].push({
      date: convertToDate(row[headerIndices.date]), open: convertToNumber(row[headerIndices.open]),
      high: convertToNumber(row[headerIndices.high]), low: convertToNumber(row[headerIndices.low]),
      close: convertToNumber(row[headerIndices.close])
    });
  }
  Object.keys(dataByTicker).forEach(ticker => {
    dataByTicker[ticker] = dataByTicker[ticker]
      .filter(c => c.date && isFinite(c.close) && isFinite(c.high) && isFinite(c.low))
      .sort((a, b) => a.date - b.date);
  });

  let allRecommendations = [];

  const today = new Date();
  const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());

  for (const ticker of Object.keys(dataByTicker)) {
    const fullPriceData = dataByTicker[ticker];
    if (fullPriceData.length < 2) continue;

    // --- 1. Run Full Analysis ---
    const fullAnalysisRecs = runAnalysisForPeriod(ticker, fullPriceData, "Análise Completa");
    allRecommendations.push(...fullAnalysisRecs);

    // --- 2. Run 3-Month Analysis ---
    const priceData3M = fullPriceData.filter(d => d.date >= threeMonthsAgo);
    const threeMonthAnalysisRecs = runAnalysisForPeriod(ticker, priceData3M, "Análise de 3 Meses");
    allRecommendations.push(...threeMonthAnalysisRecs);
  }

  const finalRecommendations = filterAndFormatRecommendations(allRecommendations);

  // Clear the now-obsolete parameters sheet
  const paramsSheet = spreadsheet.getSheetByName(CONFIG.PARAMS_SHEET);
  if (paramsSheet) {
    paramsSheet.clear();
    paramsSheet.getRange("A1").setValue("Esta aba não é mais utilizada a partir da v3.0 do script.");
  }

  writeRecommendationsToSheet(spreadsheet, finalRecommendations);

  spreadsheet.toast("Recommendations generated!");
}

// =================================================================
// ===================  HELPER FUNCTIONS   =========================
// =================================================================

/**
 * Calculates backtesting metrics for a given dataset and a specific OCO (One-Cancels-the-Other) strategy.
 * This version uses a dynamic ATR-based stop loss and target.
 * @param {Array<Object>} priceData Array of price objects {close, high, low}.
 * @param {number} p The percentage trigger for the entry.
 * @param {string} direction 'BUY' or 'SELL'.
 * @param {Array<number|null>} atrData The array of ATR values for the dataset.
 * @param {number} stopLossAtrMultiplier The multiplier for the ATR to set the stop loss.
 * @param {number} rewardRiskRatio The reward/risk ratio for the strategy.
 * @returns {Object} An object containing all calculated metrics for the strategy.
 */
function calculateBacktestMetrics(priceData, p, direction, atrData, stopLossAtrMultiplier, rewardRiskRatio) {
  let trades = 0, wins = 0, sumSignedReturns = 0, totalGains = 0, totalLosses = 0;
  let cumulativeReturn = 0, peak = 0, maxDrawdown = 0;

  for (let i = 1; i < priceData.length; i++) {
    const previousClose = priceData[i - 1].close;
    const { high, low, close } = priceData[i];
    const atrValue = atrData[i - 1]; // Use yesterday's ATR for today's trade setup

    if (!isFinite(previousClose) || previousClose === 0 || !atrValue || atrValue <= 0) {
      continue;
    }

    let entryPrice = 0;
    let returnPct = 0;
    let tradeOccurred = false;

    // Define stop and target amounts based on ATR
    const stopAmount = atrValue * stopLossAtrMultiplier;
    const targetAmount = stopAmount * rewardRiskRatio;

    if (direction === 'BUY') {
      entryPrice = previousClose * (1 - p / 100);
      if (low <= entryPrice && entryPrice > 0) {
        tradeOccurred = true;
        const stopPrice = entryPrice - stopAmount;
        const targetPrice = entryPrice + targetAmount;

        if (low <= stopPrice) {
          returnPct = (-stopAmount / entryPrice) * 100; // Stopped out
        } else if (high >= targetPrice) {
          returnPct = (targetAmount / entryPrice) * 100; // Target hit
        } else {
          returnPct = ((close - entryPrice) / entryPrice) * 100; // Exit at close
        }
      }
    } else { // SELL
      entryPrice = previousClose * (1 + p / 100);
      if (high >= entryPrice && entryPrice > 0) {
        tradeOccurred = true;
        const stopPrice = entryPrice + stopAmount;
        const targetPrice = entryPrice - targetAmount;

        if (high >= stopPrice) {
          returnPct = (-stopAmount / entryPrice) * 100; // Stopped out
        } else if (low <= targetPrice) {
          returnPct = (targetAmount / entryPrice) * 100; // Target hit
        } else {
          returnPct = ((entryPrice - close) / entryPrice) * 100; // Exit at close
        }
      }
    }

    if (tradeOccurred) {
      trades++;
      sumSignedReturns += returnPct;
      if (returnPct > 0) {
        wins++;
        totalGains += returnPct;
      } else {
        totalLosses += Math.abs(returnPct);
      }
      cumulativeReturn += returnPct;
      if (cumulativeReturn > peak) {
        peak = cumulativeReturn;
      }
      const drawdown = peak - cumulativeReturn;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
  }

  const accuracy = trades ? (wins / trades) * 100 : 0;
  const avgGain = trades ? sumSignedReturns / trades : 0;
  const numLosses = trades - wins;
  const avgWin = wins > 0 ? (totalGains / wins) : 0;
  const avgLoss = numLosses > 0 ? (totalLosses / numLosses) : 0;
  const ciLower = trades ? calculateWilsonScoreLowerBound(wins, trades) : 0;
  const profitFactor = totalLosses > 0 ? totalGains / totalLosses : (totalGains > 0 ? 1000 : 0);

  return {
    accuracy, trades, avgGain, ciLower, avgWin, avgLoss, maxDD: maxDrawdown, profitFactor,
    p, stopLossAtrMultiplier, rewardRiskRatio // Pass through the params for easy tracking
  };
}


/**
 * Filters, ranks, limits, and formats recommendations for final output.
 * @param {Array<Object>} allRecommendations An array of all valid recommendation objects found.
 * @returns {Array<Array>} A final, sorted 2D array ready for the spreadsheet.
 */
function filterAndFormatRecommendations(allRecommendations) {
  // 1. Filter to get the best recommendation for each unique strategy type (e.g., PETR4-COMPRA-Accuracy)
  // This chooses between the "Full Analysis" and "3-Month" versions of a strategy.
  const bestRecs = {};
  for (const rec of allRecommendations) {
    const key = `${rec.ticker}_${rec.direction}_${rec.optimizedBy}`;
    const metricToCompare = rec.optimizedBy.includes('Profit Factor') ? 'profitFactor' : 'accuracy';

    if (!bestRecs[key] || rec[metricToCompare] > bestRecs[key][metricToCompare]) {
      bestRecs[key] = rec;
    }
  }
  const uniqueBestRecs = Object.values(bestRecs);

  // 2. Separate recommendations by optimization type
  const accuracyRecs = uniqueBestRecs.filter(r => r.optimizedBy.includes('Accuracy'));
  const profitFactorRecs = uniqueBestRecs.filter(r => r.optimizedBy.includes('Profit Factor'));

  // 3. Sort each list independently and apply the limit
  accuracyRecs.sort((a, b) => b.accuracy - a.accuracy);
  profitFactorRecs.sort((a, b) => b.profitFactor - a.profitFactor);

  const topAccuracy = accuracyRecs.slice(0, CONFIG.MAX_RECOMMENDATIONS_TO_SHOW);
  const topProfitFactor = profitFactorRecs.slice(0, CONFIG.MAX_RECOMMENDATIONS_TO_SHOW);

  // 4. Combine the limited lists and remove duplicates.
  // A strategy might appear in both lists if it was optimal for both metrics.
  const combinedRecs = [...topAccuracy, ...topProfitFactor];
  const finalRecsMap = new Map();
  for (const rec of combinedRecs) {
    // A key based on the core strategy parameters ensures uniqueness.
    const strategyKey = `${rec.ticker}_${rec.direction}_${rec.fullMetrics.p}_${rec.fullMetrics.stopLossAtrMultiplier}_${rec.fullMetrics.rewardRiskRatio}`;
    if (!finalRecsMap.has(strategyKey)) {
      finalRecsMap.set(strategyKey, rec);
    }
  }
  const finalRecs = Array.from(finalRecsMap.values());


  // 5. Sort the final de-duplicated list for display: by Optimization method, then by the relevant metric
  finalRecs.sort((a, b) => {
    // Group by the 'Optimized_By' field first. 'Accuracy' will come before 'Profit Factor'.
    // We achieve this by sorting alphabetically, as "Accuracy" comes before "Profit Factor".
    if (a.optimizedBy < b.optimizedBy) return -1;
    if (a.optimizedBy > b.optimizedBy) return 1;

    // Within each group, sort by the relevant metric in descending order.
    if (a.optimizedBy.includes('Accuracy')) {
      return b.accuracy - a.accuracy;
    } else { // Assumes 'Profit Factor'
      return b.profitFactor - a.profitFactor;
    }
  });

  // 6. Format into a 2D array for the sheet with all the detailed columns
  return finalRecs.map(rec => [
    rec.ticker,
    rec.direction,
    rec.optimizedBy,
    rec.entry,
    rec.stopValue, // Human-readable stop loss value for today
    rec.targetValue, // Human-readable target gain value for today
    rec.stopLossAtrMultiplier,
    rec.rewardRiskRatio,
    rec.profitFactor,
    rec.accuracy / 100,
    rec.maxDD / 100
  ]);
}

/**
 * Writes the generated recommendations to the 'Recomendacoes_diarias' sheet.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss The active spreadsheet.
 * @param {Array<Array>} recommendations The final, formatted 2D array of recommendations.
 */
function writeRecommendationsToSheet(ss, recommendations) {
  const recommendationsSheet = getOrCreateSheet(ss, CONFIG.RECOMMENDATIONS_SHEET);
  recommendationsSheet.clear();
  const header = ["Ticker", "Direction", "Optimized_By", "Entrada", "Stop_Value", "Target_Value", "Stop_ATR_x", "RR_Ratio", "Profit_Factor", "Accuracy(%)", "Max_Drawdown(%)"];
  recommendationsSheet.appendRow(header);

  if (recommendations.length > 0) {
    const range = recommendationsSheet.getRange(2, 1, recommendations.length, header.length);
    range.setValues(recommendations);

    // --- Apply Formatting ---
    recommendationsSheet.getRange('D2:F').setNumberFormat("R$ #,##0.00");      // Entry, Stop_Value, Target_Value
    recommendationsSheet.getRange('G2:H').setNumberFormat("0.00");          // Stop_ATR_x, RR_Ratio
    recommendationsSheet.getRange('I2:I').setNumberFormat("#,##0.00");       // Profit Factor
    recommendationsSheet.getRange('J2:K').setNumberFormat("0.00%");          // Accuracy and Drawdown

    for (let i = 0; i < recommendations.length; i++) {
      const direction = recommendations[i][1]; // Column B
      recommendationsSheet.getRange(i + 2, 1, 1, header.length)
        .setBackground(direction === "COMPRA" ? "#e6f4ea" : "#fce8e6");
    }

    recommendationsSheet.autoResizeColumns(1, header.length);
  }
}


/**
 * Removes the "BVMF:" prefix from a ticker symbol.
 * @param {string} s The ticker symbol string.
 * @returns {string} The cleaned ticker symbol.
 */
function cleanTickerSymbol(s) { return String(s || "").replace(/^BVMF:/i, "").trim(); }

/**
 * Checks if a value is a Date or can be converted to a valid Date.
 * @param {*} v The value to check.
 * @returns {boolean}
 */
function isDateLike(v) { if (!v) return false; if (v instanceof Date && !isNaN(v.getTime())) return true; const d = new Date(v); return !isNaN(d.getTime()); }

/**
 * Finds the index of the last row in a 2D array that has any content in the specified columns.
 * @param {Array<Array>} allRows The 2D array of data.
 * @param {Array<number>} colIndices The column indices to check for content.
 * @returns {number} The index of the last populated row.
 */
function findLastPopulatedRowIndex(allRows, colIndices) { for (let r = allRows.length - 1; r >= 1; r--) { for (let ci of colIndices) { if (allRows[r] && allRows[r][ci] !== undefined && allRows[r][ci] !== "") return r; } } return 0; }

/**
 * Safely converts a value to a Date object.
 * @param {*} v The value to convert.
 * @returns {Date|null} The Date object or null if invalid.
 */
function convertToDate(v) { if (v instanceof Date) return v; const d = new Date(v); return isNaN(d.getTime()) ? null : d; }

/**
 * Safely converts a value to a number.
 * @param {*} v The value to convert.
 * @returns {number|NaN} The number or NaN if not convertible.
 */
function convertToNumber(v) { const n = Number(v); return isFinite(n) ? n : NaN; }

/**
 * Rounds a number to two decimal places.
 * @param {number|string} x The number to round.
 * @returns {number|*} The rounded number or the original value if not a number.
 */
function roundToTwoDecimals(x) { const n = parseFloat(String(x).replace(",", ".")); if (isNaN(n)) return x; return Math.round(n * 100) / 100; }

/**
 * Gets a sheet by name, or creates it if it doesn't exist.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss The spreadsheet object.
 * @param {string} name The name of the sheet.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The sheet object.
 */
function getOrCreateSheet(ss, name) { return ss.getSheetByName(name) || ss.insertSheet(name); }

/**
 * Calculates the Wilson Score lower bound for a binomial proportion.
 * @param {number} wins The number of successful trials.
 * @param {number} n The total number of trials.
 * @param {number} [z=1.96] The z-score for the desired confidence level (1.96 for 95%).
 * @returns {number} The lower bound of the confidence interval.
 */
function calculateWilsonScoreLowerBound(wins, n, z = 1.96) { if (!n) return 0; const p = wins / n; const z2 = z * z; const denominator = 1 + z2 / n; const center = p + z2 / (2 * n); const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n); return Math.max(0, (center - margin) / denominator); }


/**
 * Calculates the Average True Range (ATR) for a given dataset.
 * @param {Array<Object>} priceData Array of price objects {high, low, close}.
 * @param {number} period The period over which to calculate the ATR.
 * @returns {Array<number|null>} An array of ATR values, aligned with priceData, with nulls for non-calculable initial periods.
 */
function calculateATR(priceData, period) {
  if (!priceData || priceData.length < period) {
    return new Array(priceData.length).fill(null);
  }

  const trs = [];
  // First TR is just high - low, as there's no previous close
  trs.push(priceData[0].high - priceData[0].low);

  // Calculate TR for the rest of the data
  for (let i = 1; i < priceData.length; i++) {
    const high = priceData[i].high;
    const low = priceData[i].low;
    const prevClose = priceData[i - 1].close;

    const tr = Math.max(
      high - low,
      isFinite(prevClose) ? Math.abs(high - prevClose) : 0,
      isFinite(prevClose) ? Math.abs(low - prevClose) : 0
    );
    trs.push(tr);
  }

  const atrs = new Array(priceData.length).fill(null);

  // Calculate the first ATR value (simple average of first 'period' TRs)
  let sumFirstTrs = 0;
  for (let i = 0; i < period; i++) {
    sumFirstTrs += trs[i];
  }
  atrs[period - 1] = sumFirstTrs / period;

  // Calculate subsequent ATRs using the Wilder's smoothing method
  for (let i = period; i < priceData.length; i++) {
    atrs[i] = (atrs[i - 1] * (period - 1) + trs[i]) / period;
  }

  return atrs;
}


/**
 * Calculates the dynamic minimum entry percentages based on historical price volatility.
 * @param {Array<Object>} priceData The historical price data for a ticker.
 * @returns {{minBuyP: number, minSellP: number}} An object containing the calculated min percentages.
 */
function calculateDynamicEntryParameters(priceData) {
  const dipPercents = [];
  const rallyPercents = [];

  for (let i = 1; i < priceData.length; i++) {
    const prevClose = priceData[i - 1].close;
    const { high, low } = priceData[i];

    if (isFinite(prevClose) && prevClose > 0 && isFinite(high) && isFinite(low)) {
      const dip = (prevClose - low) / prevClose * 100;
      const rally = (high - prevClose) / prevClose * 100;

      if (dip > 0) {
        dipPercents.push(dip);
      }
      if (rally > 0) {
        rallyPercents.push(rally);
      }
    }
  }

  const minBuyP = calculatePercentile(dipPercents, CONFIG.DYNAMIC_ENTRY_PERCENTILE);
  const minSellP = calculatePercentile(rallyPercents, CONFIG.DYNAMIC_ENTRY_PERCENTILE);

  return { minBuyP, minSellP };
}


/**
 * Calculates the value at a given percentile in a sorted numeric array.
 * @param {Array<number>} data An array of numbers.
 * @param {number} percentile The percentile to calculate (e.g., 25 for the 25th percentile).
 * @returns {number} The value at the specified percentile. Returns 0 if data is empty.
 */
function calculatePercentile(data, percentile) {
  if (!data || data.length === 0) {
    return 0;
  }
  // Sort the data in ascending order
  data.sort((a, b) => a - b);

  // Calculate the index
  const index = (percentile / 100) * (data.length - 1);

  if (index % 1 === 0) {
    // If the index is an integer, return the value at that index
    return data[index];
  } else {
    // If the index is a decimal, interpolate between the two closest values
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const weight = index - lowerIndex;

    if (upperIndex >= data.length) return data[lowerIndex]; // Should not happen if percentile <= 100

    return data[lowerIndex] * (1 - weight) + data[upperIndex] * weight;
  }
}
