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

                # 1. Load Data
                df_daily = DataLoader.get_ohlcv(symbol, TIMEFRAME_MACRO)
                df_4h = DataLoader.get_ohlcv(symbol, TIMEFRAME_TACTICAL)

                if df_daily is None or df_4h is None:
                    continue

                # 2. Apply Indicators
                df_daily = Indicators.apply_all(df_daily)
                df_4h = Indicators.apply_all(df_4h)

                # 3. Handle Existing Positions
                if symbol in open_positions:
                    pos = open_positions[symbol]

                    # Update trailing stop
                    new_stop = TrailingEngine.calculate_new_stop(symbol, pos, df_4h)
                    if new_stop:
                        self.pos_engine.update_position(symbol, {"stop": new_stop})
                        pos['stop'] = new_stop # Update local ref for report

                    # Evaluate status (HOLD, REDUCE, etc)
                    action = StrategyRouter.evaluate_position(pos, df_daily, df_4h)

                    last_price = df_4h.iloc[-1]['close']
                    # Check hard exits (Stop/Target)
                    is_closed = False
                    if pos['direction'] == 'LONG':
                        if last_price <= pos['stop']:
                            self.pos_engine.close_position(symbol, "STOP_LOSS", last_price)
                            action, is_closed = "CLOSED_STOP", True
                        elif last_price >= pos['target']:
                            self.pos_engine.close_position(symbol, "TAKE_PROFIT", last_price)
                            action, is_closed = "CLOSED_TARGET", True
                    else: # SHORT
                        if last_price >= pos['stop']:
                            self.pos_engine.close_position(symbol, "STOP_LOSS", last_price)
                            action, is_closed = "CLOSED_STOP", True
                        elif last_price <= pos['target']:
                            self.pos_engine.close_position(symbol, "TAKE_PROFIT", last_price)
                            action, is_closed = "CLOSED_TARGET", True

                    results.append({
                        "symbol": symbol,
                        "direction": pos["direction"],
                        "action": action,
                        "entry": pos["entry"],
                        "stop": pos["stop"],
                        "target": pos["target"],
                        "size": pos["size"],
                        "current_price": last_price,
                        "regime": StrategyRouter.get_market_regime(df_daily)
                    })
                    continue

                # 4. Strategy Routing (Entry Logic)
                setup = StrategyRouter.route(df_daily, df_4h)

                if setup:
                    # 5. Risk Management
                    setup = RiskEngine.get_risk_parameters(setup)
                    results.append({
                        "symbol": symbol,
                        "direction": setup["direction"],
                        "action": "ENTER",
                        "entry": setup["entry"],
                        "stop": setup["stop"],
                        "target": setup["target"],
                        "size": setup["position_size"],
                        "current_price": df_4h.iloc[-1]['close'],
                        "regime": setup["regime"]
                    })

                    # Optional: Automatically "open" position in the engine for tracking
                    # self.pos_engine.open_position(symbol, setup)

            except Exception as e:
                print(f"Error analyzing {symbol}: {e}")

        # Return the latest state after processing
        return results, self.pos_engine.get_open_positions()
