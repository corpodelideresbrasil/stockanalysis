import ta
import numpy as np
import pandas as pd
from config.config import SUPERTREND_PERIOD, SUPERTREND_MULTIPLIER

class Indicators:

    @staticmethod
    def supertrend(df, period=SUPERTREND_PERIOD, multiplier=SUPERTREND_MULTIPLIER):
        """
        Calculates the Supertrend indicator.
        """
        hl2 = (df['high'] + df['low']) / 2

        atr = ta.volatility.AverageTrueRange(
            high=df['high'],
            low=df['low'],
            close=df['close'],
            window=period
        ).average_true_range()

        upperband = hl2 + (multiplier * atr)
        lowerband = hl2 - (multiplier * atr)

        # Initialize supertrend and direction
        supertrend = np.zeros(len(df))
        direction = np.ones(len(df))

        for i in range(1, len(df)):
            if df['close'].iloc[i] > upperband.iloc[i - 1]:
                direction[i] = 1
            elif df['close'].iloc[i] < lowerband.iloc[i - 1]:
                direction[i] = -1
            else:
                direction[i] = direction[i - 1]

                # Copy bands if not changed
                if direction[i] > 0 and lowerband.iloc[i] < lowerband.iloc[i - 1]:
                    lowerband.iloc[i] = lowerband.iloc[i - 1]
                if direction[i] < 0 and upperband.iloc[i] > upperband.iloc[i - 1]:
                    upperband.iloc[i] = upperband.iloc[i - 1]

            if direction[i] > 0:
                supertrend[i] = lowerband.iloc[i]
            else:
                supertrend[i] = upperband.iloc[i]

        df['supertrend'] = supertrend
        df['supertrend_direction'] = direction
        return df

    @staticmethod
    def apply_all(df):
        """
        Applies all necessary indicators to the DataFrame.
        """
        if df is None or len(df) == 0:
            return df

        # RSI
        df['rsi'] = ta.momentum.RSIIndicator(
            close=df['close'],
            window=14
        ).rsi()

        # EMAs and SMAs
        df['ema21'] = ta.trend.EMAIndicator(
            close=df['close'],
            window=21
        ).ema_indicator()

        df['sma50'] = ta.trend.SMAIndicator(
            close=df['close'],
            window=50
        ).sma_indicator()

        df['sma200'] = ta.trend.SMAIndicator(
            close=df['close'],
            window=200
        ).sma_indicator()

        # ATR
        df['atr'] = ta.volatility.AverageTrueRange(
            high=df['high'],
            low=df['low'],
            close=df['close'],
            window=14
        ).average_true_range()

        # ADX
        adx_ind = ta.trend.ADXIndicator(
            high=df['high'],
            low=df['low'],
            close=df['close'],
            window=14
        )
        df['adx'] = adx_ind.adx()
        df['adx_pos'] = adx_ind.adx_pos()
        df['adx_neg'] = adx_ind.adx_neg()

        # Volume Mean
        df['volume_mean'] = df['volume'].rolling(20).mean()

        # Supertrend
        df = Indicators.supertrend(df)

        return df
