from config.config import INITIAL_CAPITAL, RISK_PER_TRADE, DEFAULT_LEVERAGE, MAX_TRADE_NOTIONAL_PCT

class RiskEngine:
    """
    Cálculo Institucional: Diferencia Quantidade de Moedas e Valor Financeiro.
    """

    @staticmethod
    def calculate_position_size(entry, stop, capital=INITIAL_CAPITAL):
        if entry == stop or not entry:
            return 0, 0, 0

        # 1. Tamanho pelo Risco (Quantas moedas comprar para arriscar 2% do capital)
        risk_amount = capital * RISK_PER_TRADE
        distance = abs(entry - stop)
        size_by_risk = risk_amount / distance

        # 2. Teto de Exposição (Não permite investir mais de 100% do saldo em uma moeda)
        max_notional = capital * MAX_TRADE_NOTIONAL_PCT
        size_by_cap = max_notional / entry

        # O tamanho final é o menor entre o risco planejado e o teto de segurança
        final_qty = min(size_by_risk, size_by_cap)

        notional_value = final_qty * entry # Valor real da posição no mercado
        margin_required = notional_value / DEFAULT_LEVERAGE # Dinheiro "travado" na Binance

        return final_qty, margin_required, notional_value

    @staticmethod
    def get_risk_parameters(setup, capital=INITIAL_CAPITAL):
        """
        Enhances the setup with professional position sizing.
        """
        if not setup:
            return None

        entry = setup['entry']
        stop = setup['stop']

        qty, margin, notional = RiskEngine.calculate_position_size(entry, stop, capital)

        setup['position_size'] = qty
        setup['margin_required'] = margin
        setup['notional_value'] = notional
        setup['risk_amount'] = capital * RISK_PER_TRADE

        return setup
