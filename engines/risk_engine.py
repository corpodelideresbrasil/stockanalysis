from config.config import INITIAL_CAPITAL, RISK_PER_TRADE, MAX_TRADE_NOTIONAL_PCT

class RiskEngine:
    """
    Cálculo Institucional: A alavancagem é um subproduto do risco financeiro.
    """

    @staticmethod
    def calculate_position_size(entry, stop, capital=INITIAL_CAPITAL):
        if entry == stop or not entry:
            return 0, 0, 0, 1

        # 1. Valor Financeiro em Risco (Ex: 4 USD para capital de 200)
        risk_amount = capital * RISK_PER_TRADE

        # 2. Distância Percentual do Stop
        dist_pct = abs(entry - stop) / entry
        dist_pct = max(dist_pct, 0.005)

        # 3. VALOR NOMINAL (NOTIONAL)
        notional_by_risk = risk_amount / dist_pct

        # 4. Teto de Exposição Institucional
        max_notional = capital * MAX_TRADE_NOTIONAL_PCT
        final_notional = min(notional_by_risk, max_notional)

        # 5. ALAVANCAGEM DINÂMICA
        recommended_leverage = final_notional / risk_amount
        final_leverage = min(max(1, int(recommended_leverage)), 20)

        final_qty = final_notional / entry
        margin_required = final_notional / final_leverage

        return final_qty, margin_required, final_notional, final_leverage

    @staticmethod
    def get_risk_parameters(setup, capital=INITIAL_CAPITAL):
        """
        Enhances the setup with professional position sizing.
        Unpacks all 4 values from calculate_position_size.
        """
        if not setup:
            return None

        entry = setup['entry']
        stop = setup['stop']

        qty, margin, notional, leverage = RiskEngine.calculate_position_size(entry, stop, capital)

        setup['position_size'] = qty
        setup['margin_required'] = margin
        setup['notional_value'] = notional
        setup['leverage'] = leverage
        setup['risk_amount'] = capital * RISK_PER_TRADE

        return setup
