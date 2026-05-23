# Configurações de Capital e Risco
INITIAL_CAPITAL = 200.0  # USD
RISK_PER_TRADE = 0.02    # 2% de risco do capital total por trade

# Configurações da Exchange (Binance Futures)
EXCHANGE_ID = 'binance'
EXCHANGE_CONFIG = {
    'apiKey': '', # Insira sua chave
    'secret': '', # Insira seu secret
    'enableRateLimit': True,
    'options': {
        'defaultType': 'future', # OBRIGATÓRIO PARA PERPÉTUOS
    }
}

# Gestão de Alavancagem e Margem
DEFAULT_LEVERAGE = 10  # Alavancagem padrão (Ex: 10x)

# Timeframes
TIMEFRAME_MACRO = '1d'
TIMEFRAME_TACTICAL = '4h'

# Parâmetros Supertrend
SUPERTREND_PERIOD = 15
SUPERTREND_MULTIPLIER = 1.4
