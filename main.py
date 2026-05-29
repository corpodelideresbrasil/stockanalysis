from scanners.market_scanner import MarketScanner
from engines.risk_engine import RiskEngine
from config.config import INITIAL_CAPITAL, MAX_PORTFOLIO_LEVERAGE

def display_table(results):
    w_tk, w_dir, w_act, w_ent, w_stp, w_lev, w_val, w_mar, w_sco, w_pnl = 12, 6, 12, 12, 12, 8, 15, 12, 8, 12
    header = (
        f"{'Ticker':<{w_tk}} {'Dir':<{w_dir}} {'Ação':<{w_act}} "
        f"{'Entrada':<{w_ent}} {'Stop':<{w_stp}} {'Alav.':<{w_lev}} "
        f"{'Qtd(USDT)':<{w_val}} {'Margem':<{w_mar}} {'Score':<{w_sco}} {'PnL(USDT)':<{w_pnl}}"
    )
    print("\n" + header)
    print("-" * (w_tk + w_dir + w_act + w_ent + w_stp + w_lev + w_val + w_mar + w_sco + w_pnl + 9))

    if not results:
        print(f"{'Sem sinais ou posições ativas.':^135}")
        return

    def action_priority(r):
        prio = {"ENTER": 0, "EXIT_PROFIT": 1, "CLOSED_STOP": 1, "HOLD": 2}
        return prio.get(r['action'], 99)

    # Filtrar sinais de ENTER com tamanho zero (sem margem)
    filtered_results = [r for r in results if not (r['action'] == 'ENTER' and r['size'] <= 0)]

    sorted_results = sorted(filtered_results, key=action_priority)
    for r in sorted_results:
        action_str = r['action']

        # Indica estágio das parciais
        if r.get('tp2_hit'): action_str = f"HOLD (TP2)"
        elif r.get('tp1_hit'): action_str = f"HOLD (TP1)"

        if "CLOSED" in action_str or "EXIT" in action_str: action_str = f"!! {action_str}"
        elif "ENTER" in action_str: action_str = f">> {action_str}"

        qtd_usdt = r['size'] * r['entry']

        # Cálculo de PnL
        pnl = 0
        if r['action'] != 'ENTER':
            ref_price = r.get('last_price', r['entry'])
            if r['direction'] == 'LONG':
                pnl = (ref_price - r['entry']) * r['size']
            else:
                pnl = (r['entry'] - ref_price) * r['size']

        pnl_str = f"{pnl:.2f}" if r['action'] != 'ENTER' else "-"

        print(
            f"{r['symbol']:<{w_tk}} {r['direction']:<{w_dir}} {action_str:<{w_act}} "
            f"{r['entry']:<{w_ent}.4f} {r['stop']:<{w_stp}.4f} {int(r.get('leverage', 1)):<{w_lev}} "
            f"{qtd_usdt:<{w_val}.2f} {r.get('margin', 0):<{w_mar}.2f} {int(r.get('score', 0)):<{w_sco}} {pnl_str:<{w_pnl}}"
        )
    print("-" * (w_tk + w_dir + w_act + w_ent + w_stp + w_lev + w_val + w_mar + w_sco + w_pnl + 9))

def display_summary(results):
    active = [r for r in results if r['action'] in ['ENTER', 'HOLD', 'REDUCE', 'HOLD_CAUTION']]
    total_margin = sum(r.get('margin', 0) for r in active)
    total_notional = sum(r['size'] * r['entry'] for r in active)
    current_leverage = total_notional / INITIAL_CAPITAL if INITIAL_CAPITAL > 0 else 0

    # Total PnL (Agregado de todas as ações no set atual)
    total_pnl = 0
    for r in results:
        if r['action'] == 'ENTER': continue
        ref_price = r.get('last_price', r['entry'])
        if r['direction'] == 'LONG':
            total_pnl += (ref_price - r['entry']) * r['size']
        else:
            total_pnl += (r['entry'] - ref_price) * r['size']

    print(f"SALDO INICIAL: {INITIAL_CAPITAL:.2f} USDT | MARGEM TOTAL: {total_margin:.2f} USDT")
    print(f"ALAVANCAGEM ATUAL: {current_leverage:.2f}x (MAX: {MAX_PORTFOLIO_LEVERAGE}x) | PnL TOTAL: {total_pnl:.2f} USDT")
    return current_leverage

def main():
    print("\n" + "=" * 135)
    print(f"{'SWING ENGINE V2 - GESTÃO DE PORTFÓLIO':^135}")
    print("=" * 135)

    scanner = MarketScanner()
    results, latest_open = scanner.run()

    # --- FASE 1: GESTÃO DO QUE JÁ ESTÁ ABERTO ---
    if latest_open:
        while True:
            print("\n📊 ESTADO ATUAL DO PORTFÓLIO (POSIÇÕES ABERTAS)")
            holds = [r for r in results if r['symbol'] in latest_open]
            display_table(holds)
            display_summary(holds)

            ans = input("\nDeseja [R]eduzir/Encerrar posição ou [C]ontinuar para novas entradas? (r/c): ").lower()
            if ans != 'r': break

            tk_list = list(latest_open.keys())
            for i, tk in enumerate(tk_list): print(f"[{i}] {tk}")

            try:
                idx = int(input("Ativo nº: "))
                pct = float(input("Porcentagem (0.1 a 1.0): "))
                symbol = tk_list[idx]
                if scanner.pos_engine.close_position(symbol, "MANUAL", 0, partial_pct=pct):
                    print(f"✅ {symbol} atualizado!")
                    if pct >= 1.0:
                        results = [r for r in results if r['symbol'] != symbol]
                        del latest_open[symbol]
                    else:
                        for r in results:
                            if r['symbol'] == symbol:
                                r['size'] *= (1.0 - pct)
                                r['margin'] *= (1.0 - pct)
                        latest_open[symbol]['size'] *= (1.0 - pct)
                        latest_open[symbol]['margin_used'] *= (1.0 - pct)
            except: print("⚠️ Entrada inválida.")

    # --- FASE 2: ALOCAÇÃO DE NOVOS SINAIS ---
    print("\n" + "=" * 135)
    print(f"{'PLANEJAMENTO DE NOVAS ENTRADAS (ALOCAÇÃO OTIMIZADA)':^135}")
    print("=" * 135)

    # O RiskEngine agora calcula as quantidades REAIS baseadas no que SOBROU de margem/leverage
    results = RiskEngine.allocate_portfolio(results)

    display_table(results)
    display_summary(results)

    new_entries = [r for r in results if r['action'] == 'ENTER' and r['size'] > 0]
    if new_entries:
        ans = input(f"\nDeseja iniciar rastreio para {len(new_entries)} novos sinais ajustados? (s/n): ")
        if ans.lower() == 's':
            for r in new_entries: scanner.pos_engine.open_position(r['symbol'], r)
            print("✅ Rastreador atualizado com sucesso!")
    else:
        print("\n⚠️ Sem margem ou sinais viáveis para novas entradas no momento.")

    print("\n" + "=" * 135)

if __name__ == "__main__":
    main()
