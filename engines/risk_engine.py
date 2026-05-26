from config.config import INITIAL_CAPITAL, RISK_PER_TRADE, MAX_TRADE_NOTIONAL_PCT, MAX_LEVERAGE

class RiskEngine:
    """
    Cálculo Institucional: A alavancagem é estrutural e limitada.
    """

    @staticmethod
    def calculate_position_size(entry, stop, capital=INITIAL_CAPITAL):
        if entry == stop or not entry:
            return 0, 0, 0, 1

        # 1. Valor Financeiro em Risco (Ex: 6 USD para capital de 300)
        risk_amount = capital * RISK_PER_TRADE

        # 2. Distância Percentual do Stop
        dist_pct = abs(entry - stop) / entry
        dist_pct = max(dist_pct, 0.005)

        # 3. VALOR NOMINAL (NOTIONAL) baseado no Risco
        # Formula: Risco / Distancia
        notional_by_risk = risk_amount / dist_pct

        # 4. Teto de Exposição Individual (Capping)
        max_notional = capital * MAX_TRADE_NOTIONAL_PCT
        final_notional = min(notional_by_risk, max_notional)

        # 5. ALAVANCAGEM ESTRUTURAL OTIMIZADA
        # Sugerimos alavancagem tal que a MARGEM seja IGUAL ao valor em RISCO (Eficiência Máxima).
        recommended_leverage = final_notional / risk_amount

        # Arredondamos para baixo e limitamos ao teto configurado (12x)
        final_leverage = min(max(1, int(recommended_leverage)), MAX_LEVERAGE)

        final_qty = final_notional / entry
        margin_required = final_notional / final_leverage

        return final_qty, margin_required, final_notional, final_leverage

    @staticmethod
    def get_risk_parameters(setup, capital=INITIAL_CAPITAL):
        """
        Enhances the setup with professional position sizing.
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
