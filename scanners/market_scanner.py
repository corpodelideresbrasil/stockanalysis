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
                print(f"Analisando {symbol}...", flush=True)

                df_daily = DataLoader.get_ohlcv(symbol, TIMEFRAME_MACRO)
                df_4h = DataLoader.get_ohlcv(symbol, TIMEFRAME_TACTICAL)

                if df_daily is None or df_4h is None:
                    continue

                df_daily = Indicators.apply_all(df_daily)
                df_4h = Indicators.apply_all(df_4h)

                if symbol in open_positions:
                    pos = open_positions[symbol]

                    # PROTEÇÃO: NUNCA altera alavancagem de posição aberta (HOLD)
                    if not pos.get('margin_used') or pos.get('margin_used') == 0:
                        # Recupera parâmetros ideais para auto-correção baseada no risco atual
                        params = RiskEngine.get_risk_parameters({'entry': pos['entry'], 'stop': pos['stop']})
                        lev = pos.get('leverage') or params['leverage']
                        notional = pos['size'] * pos['entry']
                        pos.update({
                            "margin_used": notional / lev,
                            "notional": notional,
                            "leverage": lev
                        })
                        self.pos_engine.update_position(symbol, pos)

                    new_stop = TrailingEngine.calculate_new_stop(symbol, pos, df_4h)
                    if new_stop:
                        self.pos_engine.update_position(symbol, {"stop": new_stop})
                        pos['stop'] = new_stop

                    action = StrategyRouter.evaluate_position(pos, df_daily, df_4h)
                    last_price = df_4h.iloc[-1]['close']

                    # --- Lógica de Alvos Parciais (TP) e Break-even ---
                    if action == "HOLD":
                        direction = pos['direction']
                        tp1, tp2 = pos.get('tp1'), pos.get('tp2')

                        # TP1: Realiza 50% e move para Break-even
                        if not pos.get('tp1_hit') and tp1:
                            hit = (direction == 'LONG' and last_price >= tp1) or (direction == 'SHORT' and last_price <= tp1)
                            if hit:
                                print(f"🎯 TP1 Atingido em {symbol}! Realizando 50% e ajustando Break-even.")
                                self.pos_engine.close_position(symbol, "TP1_1.5R", last_price, partial_pct=0.5)
                                self.pos_engine.update_position(symbol, {"tp1_hit": True, "stop": pos['entry']})
                                pos['stop'] = pos['entry'] # Update local for the stop check below

                        # TP2: Realiza mais 25% do inicial
                        if pos.get('tp1_hit') and not pos.get('tp2_hit') and tp2:
                            hit = (direction == 'LONG' and last_price >= tp2) or (direction == 'SHORT' and last_price <= tp2)
                            if hit:
                                print(f"🎯 TP2 Atingido em {symbol}! Realizando mais 25%.")
                                # initial_size * 0.25 / current_size
                                current_size = self.pos_engine.positions[symbol]['size']
                                initial_size = pos.get('initial_size', current_size * 2)
                                pct_to_close = (initial_size * 0.25) / current_size
                                self.pos_engine.close_position(symbol, "TP2_3.0R", last_price, partial_pct=min(1.0, pct_to_close))
                                self.pos_engine.update_position(symbol, {"tp2_hit": True})

                    # --- Verificação de Stop Loss ---
                    if pos['direction'] == 'LONG':
                        if last_price <= pos['stop']:
                            self.pos_engine.close_position(symbol, "STOP_LOSS", last_price)
                            action = "CLOSED_STOP"
                    else: # SHORT
                        if last_price >= pos['stop']:
                            self.pos_engine.close_position(symbol, "STOP_LOSS", last_price)
                            action = "CLOSED_STOP"

                    results.append({
                        "symbol": symbol, "direction": pos["direction"], "action": action,
                        "entry": pos["entry"], "stop": pos["stop"], "size": pos["size"],
                        "margin": pos.get("margin_used", 0), "leverage": pos.get("leverage", 1),
                        "score": StrategyRouter.calculate_score(df_daily, df_4h),
                        "regime": StrategyRouter.get_market_regime(df_daily),
                        "last_price": last_price,
                        "tp1_hit": pos.get('tp1_hit'),
                        "tp2_hit": pos.get('tp2_hit')
                    })
                    continue

                setup = StrategyRouter.route(df_daily, df_4h)
                if setup:
                    setup = RiskEngine.get_risk_parameters(setup)
                    results.append({
                        "symbol": symbol, "direction": setup["direction"], "action": "ENTER",
                        "entry": setup["entry"], "stop": setup["stop"], "size": setup["position_size"],
                        "margin": setup.get("margin_required", 0), "leverage": setup.get("leverage", 1),
                        "score": StrategyRouter.calculate_score(df_daily, df_4h),
                        "regime": setup["regime"]
                    })
            except Exception as e:
                print(f"Erro em {symbol}: {e}")

        return results, self.pos_engine.get_open_positions()
