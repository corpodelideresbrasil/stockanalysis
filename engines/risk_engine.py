from config.config import INITIAL_CAPITAL, RISK_PER_TRADE, DEFAULT_LEVERAGE

class RiskEngine:
    """
    Calculates position size and margin requirements based on institutional risk standards.
    """

    @staticmethod
    def calculate_position_size(entry, stop, capital=INITIAL_CAPITAL, risk_pct=RISK_PER_TRADE, leverage=DEFAULT_LEVERAGE):
        """
        Risk-based position sizing.
        Formula: (Capital * Risk%) / Distance to Stop
        Returns: (size_in_units, margin_required, notional_value)
        """
        if entry == stop or not entry:
            return 0, 0, 0

        risk_amount = capital * risk_pct
        distance = abs(entry - stop)

        if distance == 0:
            return 0, 0, 0

        size_in_units = risk_amount / distance
        notional_value = size_in_units * entry
        margin_required = notional_value / leverage

        # Safety check: Cannot use more margin than available capital
        if margin_required > capital:
            # Scale down size to fit maximum available margin
            margin_required = capital * 0.90 # 10% safety buffer
            notional_value = margin_required * leverage
            size_in_units = notional_value / entry

        return size_in_units, margin_required, notional_value

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
