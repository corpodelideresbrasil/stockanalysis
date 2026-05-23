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
                print(f"Analyzing {symbol}...")

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
                    print(f"  Existing position found: {pos['direction']}")

                    # Check for exit conditions (trailing stop)
                    new_stop = TrailingEngine.calculate_new_stop(symbol, pos, df_4h)
                    if new_stop:
                        self.pos_engine.update_position(symbol, {"stop": new_stop})
                        print(f"  Trailing stop updated: {new_stop}")

                    # Check for exit (simulated for now, would check price vs stop/target)
                    last_price = df_4h.iloc[-1]['close']
                    if pos['direction'] == 'LONG':
                        if last_price <= pos['stop']:
                            self.pos_engine.close_position(symbol, "STOP_LOSS", last_price)
                            print("  Position closed by STOP_LOSS")
                        elif last_price >= pos['target']:
                            self.pos_engine.close_position(symbol, "TAKE_PROFIT", last_price)
                            print("  Position closed by TAKE_PROFIT")
                    else: # SHORT
                        if last_price >= pos['stop']:
                            self.pos_engine.close_position(symbol, "STOP_LOSS", last_price)
                            print("  Position closed by STOP_LOSS")
                        elif last_price <= pos['target']:
                            self.pos_engine.close_position(symbol, "TAKE_PROFIT", last_price)
                            print("  Position closed by TAKE_PROFIT")

                    continue # Skip entry logic if already in position

                # 4. Strategy Routing (Entry Logic)
                setup = StrategyRouter.route(df_daily, df_4h)

                if setup:
                    # 5. Risk Management
                    setup = RiskEngine.get_risk_parameters(setup)
                    setup['symbol'] = symbol
                    setup['close'] = df_4h.iloc[-1]['close']

                    results.append(setup)

                    # Optional: Automatically "open" position in the engine for tracking
                    # self.pos_engine.open_position(symbol, setup)

            except Exception as e:
                print(f"Error analyzing {symbol}: {e}")

        # Return the latest state after processing
        return results, self.pos_engine.get_open_positions()
