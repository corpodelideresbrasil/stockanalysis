import unittest
from engines.risk_engine import RiskEngine
from engines.position_engine import PositionEngine
from strategies.strategy_router import StrategyRouter
import pandas as pd

class TestSwingEngine(unittest.TestCase):

    def test_risk_calculation(self):
        # Capital 200, Risk 2% = 4 USD risk
        # Entry 100, Stop 90 = 10 USD distance (10%)
        # Size = 4 / 10 = 0.4
        qty, margin, notional, lev = RiskEngine.calculate_position_size(100, 90, capital=200)
        self.assertEqual(qty, 0.4)
        self.assertEqual(notional, 40)

    def test_position_engine_duplicate(self):
        pe = PositionEngine()
        pe.positions = {} # Reset
        setup = {"direction": "LONG", "entry": 100, "stop": 95, "target": 110, "position_size": 1}
        pe.open_position("BTC/USDT", setup)
        self.assertTrue(pe.has_position("BTC/USDT"))

        # Try to open again
        opened = pe.open_position("BTC/USDT", setup)
        self.assertFalse(opened)

    def test_regime_detection(self):
        df = pd.DataFrame({
            'supertrend_direction': [1],
            'ema21': [105],
            'sma50': [100],
            'adx': [25]
        })
        regime = StrategyRouter.get_market_regime(df)
        self.assertEqual(regime, "TREND_UP")

if __name__ == '__main__':
    unittest.main()
