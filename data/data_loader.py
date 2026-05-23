import ccxt
import pandas as pd
from config.config import EXCHANGE_ID, EXCHANGE_CONFIG

class DataLoader:
    _exchange = None

    @classmethod
    def _get_exchange(cls):
        if cls._exchange is None:
            # Dynamically get the exchange class from ccxt
            exchange_class = getattr(ccxt, EXCHANGE_ID)
            cls._exchange = exchange_class(EXCHANGE_CONFIG)
        return cls._exchange

    @classmethod
    def get_ohlcv(cls, symbol, timeframe='1d', limit=200):
        """
        Fetches OHLCV data from the configured exchange and returns a pandas DataFrame.
        """
        try:
            exchange = cls._get_exchange()
            ohlcv = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)

            if not ohlcv:
                return None

            df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
            df['timestamp'] = pd.to_datetime(df['timestamp'], unit='ms')

            # Ensure numeric types
            for col in ['open', 'high', 'low', 'close', 'volume']:
                df[col] = pd.to_numeric(df[col])

            return df
        except Exception as e:
            print(f"Error fetching {timeframe} data for {symbol}: {e}")
            return None
