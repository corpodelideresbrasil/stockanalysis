# Configurações de Capital e Risco
INITIAL_CAPITAL = 203.25  # USD (Saldo Atualizado)
RISK_PER_TRADE = 0.02     # 2% de risco do capital total por trade
COMMISSION_PCT = 0.0004   # 0.04% (Taxa média Binance Futures)

# Configurações de Alavancagem Institucional
MAX_LEVERAGE = 12             # Teto máximo rigoroso
MAX_TRADE_NOTIONAL_PCT = 1.0  # Max 100% do capital por moeda (1x equity)
MAX_PORTFOLIO_LEVERAGE = 3.0  # Alavancagem total máxima do portfólio (3x equity)

# Configurações da Exchange (Binance Futures)
EXCHANGE_ID = 'binance'
EXCHANGE_CONFIG = {
    'apiKey': '',
    'secret': '',
    'enableRateLimit': True,
    'options': {
        'defaultType': 'future',
    }
}

# Timeframes
TIMEFRAME_MACRO = '1d'
TIMEFRAME_TACTICAL = '4h'

# Parâmetros Supertrend
SUPERTREND_PERIOD = 15
SUPERTREND_MULTIPLIER = 3.5  # Foco em tendências longas
