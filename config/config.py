# Configuration settings for Swing Engine V2

INITIAL_CAPITAL = 200.0  # USD
RISK_PER_TRADE = 0.02    # 2% risk per trade

# Exchange Settings
EXCHANGE_ID = 'kraken' # Changed from 'binance' due to environment restrictions, user can revert to 'binance'
EXCHANGE_CONFIG = {
    'apiKey': '',
    'secret': '',
    'enableRateLimit': True,
}

# Operational Timeframes
TIMEFRAME_MACRO = '1d'
TIMEFRAME_TACTICAL = '4h'

# Indicator Parameters
SUPERTREND_PERIOD = 15
SUPERTREND_MULTIPLIER = 1.4

# Risk Settings
POSITION_SIZING_METHOD = 'risk_based'  # Calculation based on entry-stop distance
