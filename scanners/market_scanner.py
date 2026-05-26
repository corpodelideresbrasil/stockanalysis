from data.data_loader import DataLoader
from indicators.indicators import Indicators
from strategies.strategy_router import StrategyRouter
from engines.risk_engine import RiskEngine
from engines.position_engine import PositionEngine
from engines.trailing_engine import TrailingEngine
from config.symbols import SYMBOLS
from config.config import TIMEFRAME_MACRO, TIMEFRAME_TACTICAL

class MarketScanner:

    def __init__(self):
        self.pos_engine = PositionEngine()

    def run(self):
        results = []
        open_positions = self.pos_engine.get_open_positions()

        for symbol in SYMBOLS:
            try:
                print(f"Analyzing {symbol}...", flush=True)

                df_daily = DataLoader.get_ohlcv(symbol, TIMEFRAME_MACRO)
                df_4h = DataLoader.get_ohlcv(symbol, TIMEFRAME_TACTICAL)

                if df_daily is None or df_4h is None:
                    continue

                df_daily = Indicators.apply_all(df_daily)
                df_4h = Indicators.apply_all(df_4h)

                if symbol in open_positions:
                    pos = open_positions[symbol]

                    # Self-healing: Recalculate with Dynamic Leverage
                    _, margin, notional, leverage = RiskEngine.calculate_position_size(pos['entry'], pos['stop'])
                    pos['margin_used'] = margin
                    pos['notional'] = notional
                    pos['leverage'] = leverage
                    self.pos_engine.update_position(symbol, {"margin_used": margin, "notional": notional, "leverage": leverage})

                    new_stop = TrailingEngine.calculate_new_stop(symbol, pos, df_4h)
                    if new_stop:
                        self.pos_engine.update_position(symbol, {"stop": new_stop})
                        pos['stop'] = new_stop

                    action = StrategyRouter.evaluate_position(pos, df_daily, df_4h)

                    last_price = df_4h.iloc[-1]['close']
                    if pos['direction'] == 'LONG':
                        if last_price <= pos['stop']:
                            self.pos_engine.close_position(symbol, "STOP_LOSS", last_price)
                            action = "CLOSED_STOP"
                    else: # SHORT
                        if last_price >= pos['stop']:
                            self.pos_engine.close_position(symbol, "STOP_LOSS", last_price)
                            action = "CLOSED_STOP"

                    results.append({
                        "symbol": symbol,
                        "direction": pos["direction"],
                        "action": action,
                        "entry": pos["entry"],
                        "stop": pos["stop"],
                        "target": pos.get("target"),
                        "size": pos["size"],
                        "margin": pos.get("margin_used", 0),
                        "leverage": pos.get("leverage", 1),
                        "regime": StrategyRouter.get_market_regime(df_daily)
                    })
                    continue

                setup = StrategyRouter.route(df_daily, df_4h)

                if setup:
                    setup = RiskEngine.get_risk_parameters(setup)
                    results.append({
                        "symbol": symbol,
                        "direction": setup["direction"],
                        "action": "ENTER",
                        "entry": setup["entry"],
                        "stop": setup["stop"],
                        "target": setup.get("target"),
                        "size": setup["position_size"],
                        "margin": setup.get("margin_required", 0),
                        "leverage": setup.get("leverage", 1),
                        "regime": setup["regime"]
                    })

            except Exception as e:
                print(f"Error analyzing {symbol}: {e}")

        return results, self.pos_engine.get_open_positions()
