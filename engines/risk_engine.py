from config.config import INITIAL_CAPITAL, RISK_PER_TRADE, DEFAULT_LEVERAGE, MAX_TRADE_NOTIONAL_PCT

class RiskEngine:
    """
    Calculates position size and margin requirements based on institutional risk standards.
    """

    @staticmethod
    def calculate_position_size(entry, stop, capital=INITIAL_CAPITAL):
        """
        Risk-based position sizing with Notional Capping.
        1. Calculates size based on fixed risk (e.g. 2% of equity).
        2. Caps size so Notional Value does not exceed MAX_TRADE_NOTIONAL_PCT of equity.
        """
        if entry == stop or not entry:
            return 0, 0, 0

        # 1. Size based on Risk (Stop Loss distance)
        risk_amount = capital * RISK_PER_TRADE
        distance = abs(entry - stop)
        size_by_risk = risk_amount / distance

        # 2. Institutional Notional Cap (Safety Ceiling)
        # Prevents over-leveraging on a single asset even with a tight stop
        max_notional = capital * MAX_TRADE_NOTIONAL_PCT
        size_by_cap = max_notional / entry

        # Final size is the most conservative of the two
        final_size = min(size_by_risk, size_by_cap)

        notional_value = final_size * entry
        margin_required = notional_value / DEFAULT_LEVERAGE

        return final_size, margin_required, notional_value

    @staticmethod
    def get_risk_parameters(setup, capital=INITIAL_CAPITAL):
        """
        Enhances the setup with professional position sizing.
        """
        if not setup:
            return None

        entry = setup['entry']
        stop = setup['stop']

        size, margin, notional = RiskEngine.calculate_position_size(entry, stop, capital)

        setup['position_size'] = size
        setup['margin_required'] = margin
        setup['notional_value'] = notional
        setup['risk_amount'] = capital * RISK_PER_TRADE

        return setup
