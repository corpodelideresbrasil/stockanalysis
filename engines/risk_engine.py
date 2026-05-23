from config.config import INITIAL_CAPITAL, RISK_PER_TRADE

class RiskEngine:
    """
    Calculates position size based on risk and distance to stop.
    """

    @staticmethod
    def calculate_position_size(entry, stop, capital=INITIAL_CAPITAL, risk_pct=RISK_PER_TRADE):
        """
        Risk-based position sizing.
        Formula: (Capital * Risk%) / Distance to Stop
        """
        if entry == stop:
            return 0

        risk_amount = capital * risk_pct
        distance = abs(entry - stop)

        if distance == 0:
            return 0

        size_in_units = risk_amount / distance
        return size_in_units

    @staticmethod
    def get_risk_parameters(setup, capital=INITIAL_CAPITAL):
        """
        Enhances the setup with position sizing.
        """
        if not setup:
            return None

        entry = setup['entry']
        stop = setup['stop']

        size = RiskEngine.calculate_position_size(entry, stop, capital)

        setup['position_size'] = size
        setup['risk_amount'] = capital * RISK_PER_TRADE

        return setup
