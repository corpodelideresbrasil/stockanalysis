import json
import os

class PositionEngine:
    """
    Manages the lifecycle of trading positions with margin tracking.
    """
    STATE_FILE = "data/positions.json"

    def __init__(self):
        self.positions = self._load_positions()

    def _load_positions(self):
        if os.path.exists(self.STATE_FILE):
            try:
                with open(self.STATE_FILE, 'r') as f:
                    data = json.load(f)
                    if "__GLOBAL_STATS__" not in data:
                        data["__GLOBAL_STATS__"] = {"total_realized_pnl": 0.0}
                    return data
            except:
                return {"__GLOBAL_STATS__": {"total_realized_pnl": 0.0}}
        return {"__GLOBAL_STATS__": {"total_realized_pnl": 0.0}}

    def _save_positions(self):
        os.makedirs("data", exist_ok=True)
        with open(self.STATE_FILE, 'w') as f:
            json.dump(self.positions, f, indent=4)

    def has_position(self, symbol):
        return symbol in self.positions and self.positions[symbol]['status'] == 'OPEN'

    def open_position(self, symbol, setup):
        """
        Opens and tracks a position with standardized institutional keys.
        """
        if self.has_position(symbol):
            return False

        # Unified mapping to ensure data is saved regardless of source key names
        self.positions[symbol] = {
            "status": "OPEN",
            "direction": setup.get("direction"),
            "entry": setup.get("entry"),
            "stop": setup.get("stop"),
            "tp1": setup.get("tp1"),
            "tp2": setup.get("tp2"),
            "target": setup.get("target"), # TP Final / Trailing
            "size": setup.get("position_size") or setup.get("size", 0),
            "initial_size": setup.get("position_size") or setup.get("size", 0),
            "margin_used": setup.get("margin_required") or setup.get("margin", 0),
            "notional": setup.get("notional_value") or setup.get("notional", 0),
            "leverage": setup.get("leverage") or 1,
            "tp1_hit": False,
            "tp2_hit": False,
            "realized_pnl": 0.0,
            "opened_at": str(setup.get("timestamp", "manual"))
        }
        self._save_positions()
        return True

    def close_position(self, symbol, reason, price, partial_pct=1.0):
        """
        Closes a position fully (default) or partially.
        partial_pct: float between 0 and 1 (e.g. 0.5 for 50% closure)
        """
        if symbol not in self.positions or self.positions[symbol].get('status') != 'OPEN':
            return False

        pos = self.positions[symbol]

        # Cálculo de PnL Realizado nesta parcela
        closing_size = pos['size'] * partial_pct
        if pos['direction'] == 'LONG':
            pnl_share = (price - pos['entry']) * closing_size
        else:
            pnl_share = (pos['entry'] - price) * closing_size

        # Atualiza PnL da Posição e o PnL GLOBAL
        pos['realized_pnl'] = pos.get('realized_pnl', 0.0) + pnl_share
        self.positions["__GLOBAL_STATS__"]["total_realized_pnl"] += pnl_share

        if partial_pct >= 1.0:
            pos['status'] = 'CLOSED'
            pos['exit_reason'] = reason
            pos['exit_price'] = price
            pos['size'] = 0
            pos['margin_used'] = 0
            pos['notional'] = 0
        else:
            # Partial reduction
            reduction_factor = 1.0 - partial_pct
            pos['size'] *= reduction_factor
            pos['margin_used'] *= reduction_factor
            if 'notional' in pos:
                pos['notional'] *= reduction_factor
            pos['partial_exit_reason'] = f"Reduced {partial_pct*100}% - {reason}"

        self._save_positions()
        return True

    def update_position(self, symbol, updates):
        if symbol in self.positions:
            self.positions[symbol].update(updates)
            self._save_positions()
            return True
        return False

    def get_open_positions(self):
        return {s: p for s, p in self.positions.items() if isinstance(p, dict) and p.get('status') == 'OPEN'}
