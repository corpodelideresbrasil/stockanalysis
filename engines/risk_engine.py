from config.config import INITIAL_CAPITAL, RISK_PER_TRADE, MAX_TRADE_NOTIONAL_PCT, MAX_LEVERAGE, MAX_PORTFOLIO_LEVERAGE

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
        recommended_leverage = final_notional / risk_amount
        final_leverage = min(max(1, int(recommended_leverage)), MAX_LEVERAGE)

        final_qty = final_notional / entry
        margin_required = final_notional / final_leverage

        return final_qty, margin_required, final_notional, final_leverage

    @staticmethod
    def get_risk_parameters(setup, capital=INITIAL_CAPITAL):
        if not setup: return None
        entry = setup['entry']
        stop = setup['stop']

        qty, margin, notional, leverage = RiskEngine.calculate_position_size(entry, stop, capital)

        # Cálculo de Alvos Parciais (Multiplicadores de Risco R)
        risk_dist = abs(entry - stop)
        direction = setup['direction']

        if direction == 'LONG':
            tp1 = entry + (risk_dist * 1.5)
            tp2 = entry + (risk_dist * 3.0)
        else:
            tp1 = entry - (risk_dist * 1.5)
            tp2 = entry - (risk_dist * 3.0)

        setup.update({
            'position_size': qty,
            'margin_required': margin,
            'notional_value': notional,
            'leverage': leverage,
            'tp1': tp1,
            'tp2': tp2
        })
        return setup

    @staticmethod
    def allocate_portfolio(results, initial_capital=INITIAL_CAPITAL):
        """
        Garante que o somatório de NOVOS sinais + HOLD não ultrapasse os limites.
        Prioriza sinais por SCORE.
        """
        # 1. Identificar o que já está comprometido (HOLD)
        holds = [r for r in results if r['action'] in ['HOLD', 'HOLD_CAUTION', 'REDUCE']]
        committed_notional = sum(r['size'] * r['entry'] for r in holds)
        committed_margin = sum(r.get('margin', 0) for r in holds)

        available_leverage_budget = (initial_capital * MAX_PORTFOLIO_LEVERAGE) - committed_notional
        available_margin_budget = initial_capital - committed_margin

        # 2. Processar Novos Sinais por Prioridade (Score)
        new_signals = [r for r in results if r['action'] == 'ENTER']
        new_signals = sorted(new_signals, key=lambda x: x.get('score', 0), reverse=True)

        allocated_signals = []
        for signal in new_signals:
            # Ideal Risk Parameters
            qty, margin, notional, leverage = RiskEngine.calculate_position_size(signal['entry'], signal['stop'], initial_capital)

            # Aplicar Trava de Orçamento de Alavancagem e Margem
            # Se o sinal ideal for maior que o orçamento restante, escala para baixo
            scaling_factor = 1.0
            if notional > available_leverage_budget:
                scaling_factor = min(scaling_factor, available_leverage_budget / notional)
            if margin > available_margin_budget:
                scaling_factor = min(scaling_factor, (available_margin_budget * 0.95) / margin) # 5% buffer

            # Se o orçamento estiver zerado ou negativo
            if available_leverage_budget <= 0 or available_margin_budget <= initial_capital * 0.05:
                scaling_factor = 0

            # Aplicar escala
            signal['size'] = qty * scaling_factor
            signal['margin'] = margin * scaling_factor
            signal['leverage'] = leverage
            signal['notional'] = notional * scaling_factor
            signal['position_size'] = signal['size']
            signal['margin_required'] = signal['margin']

            # Atualizar orçamentos
            available_leverage_budget -= (signal['size'] * signal['entry'])
            available_margin_budget -= signal['margin']

            allocated_signals.append(signal)

        # Reconstruir lista de resultados final
        return holds + allocated_signals + [r for r in results if r['action'] not in ['HOLD', 'HOLD_CAUTION', 'REDUCE', 'ENTER']]
