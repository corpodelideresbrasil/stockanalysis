class StrategyRouter:
    """
    Decides the trading setup based on market regime and tactical indicators.
    """

    @staticmethod
    def get_market_regime(df_daily):
        if df_daily is None or len(df_daily) < 1:
            return "UNKNOWN"

        last = df_daily.iloc[-1]
        st_dir = last.get('supertrend_direction', 0)
        ema21 = last.get('ema21', 0)
        sma50 = last.get('sma50', 0)

        if st_dir == 1 and ema21 > sma50:
            return "TREND_UP"
        elif st_dir == -1 and ema21 < sma50:
            return "TREND_DOWN"
        else:
            return "RANGING"

    @staticmethod
    def calculate_score(df_daily, df_4h):
        """
        Cálculo de Convicção Institucional (0 a 100).
        Baseado em: Força ADX, Alinhamento de Médias e RSI.
        """
        if df_daily is None or df_4h is None: return 0

        daily = df_daily.iloc[-1]
        tatico = df_4h.iloc[-1]

        score = 0

        # 1. Força da Tendência (ADX) - Até 40 pontos
        adx = daily.get('adx', 0)
        score += min(adx, 40)

        # 2. Alinhamento Macro - Até 30 pontos
        st_dir = daily.get('supertrend_direction', 0)
        ema21 = daily.get('ema21', 0)
        sma50 = daily.get('sma50', 0)

        if st_dir != 0: score += 10
        if (st_dir == 1 and ema21 > sma50) or (st_dir == -1 and ema21 < sma50):
            score += 20

        # 3. Qualidade do Setup (RSI) - Até 30 pontos
        rsi = tatico.get('rsi', 50)
        if (st_dir == 1 and rsi < 50) or (st_dir == -1 and rsi > 50):
            score += 30 # Pullback de qualidade
        elif (st_dir == 1 and rsi < 70) or (st_dir == -1 and rsi > 30):
            score += 15

        return score

    @staticmethod
    def evaluate_position(position, df_daily, df_4h):
        """
        Avaliação Institucional: Mantém a posição até o sinal de exaustão extrema.
        Binary state: Either IN or OUT.
        """
        if df_daily is None or df_4h is None:
            return "HOLD"

        last_4h = df_4h.iloc[-1]
        direction = position['direction']
        # RSI 14 (tactical)
        rsi = last_4h['rsi']

        if direction == 'LONG' and rsi > 85:
            return "EXIT_PROFIT"

        elif direction == 'SHORT' and rsi < 15:
            return "EXIT_PROFIT"

        return "HOLD"

    @staticmethod
    def route(df_daily, df_4h):
        if df_daily is None or df_4h is None or len(df_daily) < 1 or len(df_4h) < 1:
            return None

        regime = StrategyRouter.get_market_regime(df_daily)
        last_4h = df_4h.iloc[-1]
        close, rsi, atr = last_4h['close'], last_4h['rsi'], last_4h['atr']

        if regime == "TREND_UP" and rsi < 60:
            return {
                "direction": "LONG", "entry": close,
                "stop": close - (2 * atr), "target": close + (4 * atr),
                "regime": regime
            }

        elif regime == "TREND_DOWN" and rsi > 40:
            return {
                "direction": "SHORT", "entry": close,
                "stop": close + (2 * atr), "target": close - (4 * atr),
                "regime": regime
            }

        return None
