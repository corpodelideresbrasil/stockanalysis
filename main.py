from scanners.market_scanner import MarketScanner
from config.config import INITIAL_CAPITAL, MAX_PORTFOLIO_LEVERAGE, DEFAULT_LEVERAGE

def main():
    print("\n" + "=" * 130)
    print(f"{'SWING ENGINE V2 (INSTITUTIONAL FUTURES)':^130}")
    print("=" * 130)

    scanner = MarketScanner()
    results, latest_open = scanner.run()

    # Cabeçalhos: Ticker, Dir, Ação, Entrada, Stop, Alavancagem, Qtd(USDT), Margem(USDT)
    w_tk, w_dir, w_act, w_ent, w_stp, w_lev, w_val, w_mar = 12, 6, 12, 12, 12, 10, 15, 12

    header = (
        f"{'Ticker':<{w_tk}} {'Dir':<{w_dir}} {'Ação':<{w_act}} "
        f"{'Entrada':<{w_ent}} {'Stop':<{w_stp}} {'Alav.':<{w_lev}} "
        f"{'Qtd (USDT)':<{w_val}} {'Margem(USDT)':<{w_mar}}"
    )

    print("\n" + header)
    print("-" * (w_tk + w_dir + w_act + w_ent + w_stp + w_lev + w_val + w_mar + 7))

    if not results:
        print(f"{'Sem sinais ou posições ativas para reportar.':^130}")
    else:
        def action_priority(r):
            prio = {"ENTER": 0, "EXIT_PROFIT": 1, "CLOSED_STOP": 1, "HOLD": 2}
            return prio.get(r['action'], 99)

        sorted_results = sorted(results, key=action_priority)

        for r in sorted_results:
            action_str = r['action']
            if "CLOSED" in action_str or "EXIT" in action_str:
                action_str = f"!! {action_str}"
            elif "ENTER" in action_str:
                action_str = f">> {action_str}"

            # Montante financeiro real alocado (Quantidade em USDT)
            qtd_usdt = r['size'] * r['entry']

            print(
                f"{r['symbol']:<{w_tk}} {r['direction']:<{w_dir}} {action_str:<{w_act}} "
                f"{r['entry']:<{w_ent}.4f} {r['stop']:<{w_stp}.4f} {int(DEFAULT_LEVERAGE):<{w_lev}} "
                f"{qtd_usdt:<{w_val}.2f} {r.get('margin', 0):<{w_mar}.2f}"
            )

    print("-" * (w_tk + w_dir + w_act + w_ent + w_stp + w_lev + w_val + w_mar + 7))

    # Cálculos de Portfólio Projetado
    active_results = [r for r in results if r['action'] in ['ENTER', 'HOLD', 'REDUCE', 'HOLD_CAUTION']]
    total_margin = sum(r.get('margin', 0) for r in active_results)
    total_notional = sum(r.get('size', 0) * r.get('entry', 0) for r in active_results)
    current_leverage = total_notional / INITIAL_CAPITAL if INITIAL_CAPITAL > 0 else 0

    print(f"SALDO INICIAL DA CONTA: {INITIAL_CAPITAL:.2f} USDT")
    print(f"MARGEM TOTAL EM USO:    {total_margin:.2f} USDT")
    print(f"SALDO DISPONÍVEL (EST): {(INITIAL_CAPITAL - total_margin):.2f} USDT")
    print(f"EXPOSIÇÃO TOTAL (EXP):  {total_notional:.2f} USDT")
    print(f"ALAVANCAGEM PROJETADA:  {current_leverage:.2f}x (MAX: {MAX_PORTFOLIO_LEVERAGE}x)")

    if current_leverage > MAX_PORTFOLIO_LEVERAGE:
        print(f"\n⚠️ ALERTA: Alavancagem ({current_leverage:.2f}x) excedeu o limite institucional!")

    print("=" * 130)

    new_entries = [r for r in results if r['action'] == 'ENTER']
    if new_entries:
        if current_leverage >= MAX_PORTFOLIO_LEVERAGE:
            print("\n🚫 NOVAS ENTRADAS BLOQUEADAS: Limite de alavancagem atingido.")
        else:
            ans = input(f"\nDeseja iniciar rastreio para {len(new_entries)} novos sinais? (s/n): ")
            if ans.lower() == 's':
                pe = scanner.pos_engine
                for r in new_entries:
                    pe.open_position(r['symbol'], r)
                print("Rastreador atualizado com sucesso!")

if __name__ == "__main__":
    main()
