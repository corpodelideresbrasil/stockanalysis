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
                    return json.load(f)
            except:
                return {}
        return {}

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
            "target": setup.get("target"),
            "size": setup.get("position_size") or setup.get("size", 0),
            "margin_used": setup.get("margin_required") or setup.get("margin", 0),
            "notional": setup.get("notional_value") or setup.get("notional", 0),
            "opened_at": str(setup.get("timestamp", "manual"))
        }
        self._save_positions()
        return True

    def close_position(self, symbol, reason, price):
        if symbol in self.positions:
            self.positions[symbol]['status'] = 'CLOSED'
            self.positions[symbol]['exit_reason'] = reason
            self.positions[symbol]['exit_price'] = price
            self._save_positions()
            return True
        return False

    def update_position(self, symbol, updates):
        if symbol in self.positions:
            self.positions[symbol].update(updates)
            self._save_positions()
            return True
        return False

    def get_open_positions(self):
        return {s: p for s, p in self.positions.items() if p['status'] == 'OPEN'}
