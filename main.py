from scanners.market_scanner import MarketScanner
from config.config import INITIAL_CAPITAL, MAX_PORTFOLIO_LEVERAGE

def main():
    print("\n" + "=" * 130)
    print(f"{'SWING ENGINE V2 (INSTITUTIONAL FUTURES)':^130}")
    print("=" * 130)

    scanner = MarketScanner()
    results, latest_open = scanner.run()

    w_tk, w_dir, w_act, w_reg, w_ent, w_stp, w_tgt, w_siz, w_mar = 12, 8, 15, 15, 12, 12, 12, 12, 12

    header = (
        f"{'Ticker':<{w_tk}} {'Dir':<{w_dir}} {'Action':<{w_act}} "
        f"{'Regime':<{w_reg}} {'Entry':<{w_ent}} {'Stop':<{w_stp}} "
        f"{'Target':<{w_tgt}} {'Size':<{w_siz}} {'Margin':<{w_mar}}"
    )

    print("\n" + header)
    print("-" * 130)

    if not results:
        print(f"{'No active signals or positions to report.':^130}")
    else:
        def action_priority(r):
            prio = {"ENTER": 0, "EXIT_PROFIT": 1, "CLOSED_STOP": 1, "CLOSED_TARGET": 1, "HOLD": 2}
            return prio.get(r['action'], 99)

        sorted_results = sorted(results, key=action_priority)

        for r in sorted_results:
            action_str = r['action']
            if "CLOSED" in action_str or "EXIT" in action_str:
                action_str = f"!! {action_str}"
            elif "ENTER" in action_str:
                action_str = f">> {action_str}"

            print(
                f"{r['symbol']:<{w_tk}} {r['direction']:<{w_dir}} {action_str:<{w_act}} "
                f"{r['regime']:<{w_reg}} {r['entry']:<{w_ent}.4f} {r['stop']:<{w_stp}.4f} "
                f"{r['target']:<{w_tgt}.4f} {r['size']:<{w_siz}.4f} {r.get('margin', 0):<{w_mar}.2f}"
            )

    print("-" * 130)

    total_margin = sum(p.get('margin_used', 0) for p in latest_open.values())
    total_notional = sum(p.get('notional', 0) for p in latest_open.values())
    current_leverage = total_notional / INITIAL_CAPITAL if INITIAL_CAPITAL > 0 else 0

    print(f"POSIÇÕES NO RASTREADOR: {len(latest_open)}")
    print(f"MARGEM TOTAL EM USO:    {total_margin:.2f} USDT")
    print(f"EXPOSIÇÃO REAL (EXP):   {total_notional:.2f} USDT")
    print(f"ALAVANCAGEM ATUAL:      {current_leverage:.2f}x (MAX: {MAX_PORTFOLIO_LEVERAGE}x)")

    if current_leverage > MAX_PORTFOLIO_LEVERAGE:
        print(f"\n⚠️ ALERTA: Alavancagem total do portfólio ({current_leverage:.2f}x) excedeu o limite institucional de {MAX_PORTFOLIO_LEVERAGE}x!")

    print("=" * 130)

    new_entries = [r for r in results if r['action'] == 'ENTER']
    if new_entries:
        if current_leverage >= MAX_PORTFOLIO_LEVERAGE:
            print("\n🚫 NOVAS ENTRADAS BLOQUEADAS: Limite de alavancagem do portfólio atingido.")
        else:
            ans = input(f"\nDeseja iniciar rastreio para {len(new_entries)} novos sinais? (s/n): ")
            if ans.lower() == 's':
                pe = scanner.pos_engine
                for r in new_entries:
                    pe.open_position(r['symbol'], r)
                print("Rastreador atualizado com sucesso!")

if __name__ == "__main__":
    main()
