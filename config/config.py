# Configurações de Capital e Risco
INITIAL_CAPITAL = 200.0  # USD
RISK_PER_TRADE = 0.02    # 2% de risco do capital total por trade (valor em risco)

# Configurações de Alavancagem Institucional
DEFAULT_LEVERAGE = 10         # Alavancagem usada na corretora
MAX_TRADE_NOTIONAL_PCT = 1.0  # Nenhuma posição pode exceder 100% do capital (1x equity)
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
SUPERTREND_MULTIPLIER = 3.5  # Aumentado para 3.5 para perseguir tendências de semanas e evitar ruído
