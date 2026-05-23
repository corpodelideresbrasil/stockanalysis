class StrategyRouter:
    """
    Decides the trading setup based on market regime and tactical indicators.
    """

    @staticmethod
    def get_market_regime(df_daily):
        """
        Determines the market regime based on daily data.
        """
        if df_daily is None or len(df_daily) < 1:
            return "UNKNOWN"

        last = df_daily.iloc[-1]

        st_dir = last.get('supertrend_direction', 0)
        ema21 = last.get('ema21', 0)
        sma50 = last.get('sma50', 0)
        adx = last.get('adx', 0)

        # Basic Regime Logic
        if st_dir == 1 and ema21 > sma50:
            regime = "TREND_UP"
        elif st_dir == -1 and ema21 < sma50:
            regime = "TREND_DOWN"
        else:
            regime = "RANGING"

        # Optional: Add ADX for strength
        if adx < 20:
            regime = "CONSOLIDATION"

        return regime

    @staticmethod
    def evaluate_position(position, df_daily, df_4h):
        """
        Evaluates an active position for proactive exits or status updates.
        """
        if df_daily is None or df_4h is None:
            return "HOLD"

        last_4h = df_4h.iloc[-1]
        last_daily = df_daily.iloc[-1]

        direction = position['direction']
        rsi = last_4h['rsi']
        adx = last_4h['adx']
        close = last_4h['close']
        ema21 = last_4h['ema21']

        # Proactive Exit Logic
        if direction == 'LONG':
            # Exit if RSI is extremely overbought or trend is dead
            if rsi > 85: return "EXIT_PROFIT"
            if close < ema21: return "REDUCE" # Weakness
            if adx < 20: return "HOLD_CAUTION"

        elif direction == 'SHORT':
            if rsi < 15: return "EXIT_PROFIT"
            if close > ema21: return "REDUCE"
            if adx < 20: return "HOLD_CAUTION"

        return "HOLD"

    @staticmethod
    def route(df_daily, df_4h):
        """
        Generates a trade setup based on both macro (daily) and tactical (4h) data.
        """
        if df_daily is None or df_4h is None or len(df_daily) < 1 or len(df_4h) < 1:
            return None

        regime = StrategyRouter.get_market_regime(df_daily)
        last_4h = df_4h.iloc[-1]
        close = last_4h['close']
        rsi = last_4h['rsi']
        atr = last_4h['atr']

        # Example Strategy Logic
        if regime == "TREND_UP":
            # Buy on pullbacks in uptrend
            if rsi < 60:
                return {
                    "direction": "LONG",
                    "entry": close,
                    "stop": close - (2 * atr), # 2x ATR stop
                    "target": close + (4 * atr), # 2:1 RR
                    "regime": regime
                }

        elif regime == "TREND_DOWN":
            # Sell on rallies in downtrend
            if rsi > 40:
                return {
                    "direction": "SHORT",
                    "entry": close,
                    "stop": close + (2 * atr),
                    "target": close - (4 * atr),
                    "regime": regime
                }

        return None
