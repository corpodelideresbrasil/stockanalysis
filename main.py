from scanners.market_scanner import MarketScanner
from config.config import INITIAL_CAPITAL, MAX_PORTFOLIO_LEVERAGE

def main():
    print("\n" + "=" * 135)
    print(f"{'SWING ENGINE V2 (INSTITUTIONAL FUTURES)':^135}")
    print("=" * 135)

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
        print(f"{'Sem sinais ou posições ativas para reportar.':^135}")
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

            # Valor Real da Operação (Exposição em USDT)
            qtd_usdt = r['size'] * r['entry']

            print(
                f"{r['symbol']:<{w_tk}} {r['direction']:<{w_dir}} {action_str:<{w_act}} "
                f"{r['entry']:<{w_ent}.4f} {r['stop']:<{w_stp}.4f} {int(r.get('leverage', 1)):<{w_lev}} "
                f"{qtd_usdt:<{w_val}.2f} {r.get('margin', 0):<{w_mar}.2f}"
            )

    print("-" * (w_tk + w_dir + w_act + w_ent + w_stp + w_lev + w_val + w_mar + 7))

    # Cálculos de Portfólio (Prioriza o que já está aberto)
    active_results = [r for r in results if r['action'] in ['ENTER', 'HOLD', 'REDUCE', 'HOLD_CAUTION']]

    holds = [r for r in active_results if "ENTER" not in r['action']]
    margin_holds = sum(r.get('margin', 0) for r in holds)

    enters = [r for r in active_results if "ENTER" in r['action']]
    margin_enters = sum(r.get('margin', 0) for r in enters)

    total_margin_projetada = margin_holds + margin_enters

    # Proteção de Solvência: Se estourar saldo, avisa para reduzir apenas novos sinais
    if total_margin_projetada > INITIAL_CAPITAL:
        saldo_livre = max(0, INITIAL_CAPITAL - margin_holds)
        if margin_enters > 0:
            fator_reducao = (saldo_livre * 0.95) / margin_enters # 5% buffer
            print(f"⚠️ ESTRATÉGICO: Saldo insuficiente. Reduza novos sinais ('ENTER') em {int((1-max(0, fator_reducao))*100)}% para manter margem livre.")
            total_margin_projetada = margin_holds + (margin_enters * max(0, fator_reducao))

    total_notional = sum(r.get('size', 0) * r.get('entry', 0) for r in active_results)
    current_leverage = total_notional / INITIAL_CAPITAL if INITIAL_CAPITAL > 0 else 0

    print(f"SALDO INICIAL DA CONTA: {INITIAL_CAPITAL:.2f} USDT")
    print(f"MARGEM TOTAL ESTIMADA:  {total_margin_projetada:.2f} USDT")
    print(f"SALDO DISPONÍVEL (EST): {max(0, INITIAL_CAPITAL - total_margin_projetada):.2f} USDT")
    print(f"EXPOSIÇÃO TOTAL (EXP):  {total_notional:.2f} USDT")
    print(f"ALAVANCAGEM PROJETADA:  {current_leverage:.2f}x (MAX: {MAX_PORTFOLIO_LEVERAGE}x)")

    if current_leverage > MAX_PORTFOLIO_LEVERAGE:
        print(f"\n⚠️ ALERTA: Alavancagem ({current_leverage:.2f}x) excedeu o limite institucional!")

    print("=" * 135)

    if latest_open:
        print("\n🛠️ GERENCIAMENTO MANUAL")
        if input("Deseja encerrar ou reduzir alguma posição manualmente? (s/n): ").lower() == 's':
            tk_list = list(latest_open.keys())
            for i, tk in enumerate(tk_list): print(f"[{i}] {tk}")
            try:
                idx = int(input("Ativo nº: ")); pct = float(input("Porcentagem (0.1 a 1.0): "))
                if scanner.pos_engine.close_position(tk_list[idx], "MANUAL", 0, partial_pct=pct):
                    print("✅ Posição atualizada!")
            except: print("⚠️ Erro na entrada.")

    new_entries = [r for r in results if r['action'] == 'ENTER']
    if new_entries and current_leverage < MAX_PORTFOLIO_LEVERAGE:
        ans = input(f"\nDeseja iniciar rastreio para {len(new_entries)} novos sinais? (s/n): ")
        if ans.lower() == 's':
            for r in new_entries: scanner.pos_engine.open_position(r['symbol'], r)
            print("Rastreador atualizado!")

if __name__ == "__main__":
    main()
