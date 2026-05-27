from scanners.market_scanner import MarketScanner
from config.config import INITIAL_CAPITAL, MAX_PORTFOLIO_LEVERAGE

def main():
    print("\n" + "=" * 135)
    print(f"{'SWING ENGINE V2 (INSTITUTIONAL FUTURES)':^135}")
    print("=" * 135)

    scanner = MarketScanner()
    results, latest_open = scanner.run()

    # Cabeçalhos: Ticker, Dir, Ação, Entrada, Stop, Alavancagem, Qtd(USDT), Margem, Score
    w_tk, w_dir, w_act, w_ent, w_stp, w_lev, w_val, w_mar, w_sco = 12, 6, 12, 12, 12, 8, 15, 12, 8

    header = (
        f"{'Ticker':<{w_tk}} {'Dir':<{w_dir}} {'Ação':<{w_act}} "
        f"{'Entrada':<{w_ent}} {'Stop':<{w_stp}} {'Alav.':<{w_lev}} "
        f"{'Qtd(USDT)':<{w_val}} {'Margem':<{w_mar}} {'Score':<{w_sco}}"
    )

    print("\n" + header)
    print("-" * (w_tk + w_dir + w_act + w_ent + w_stp + w_lev + w_val + w_mar + w_sco + 8))

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
                f"{qtd_usdt:<{w_val}.2f} {r.get('margin', 0):<{w_mar}.2f} {int(r.get('score', 0)):<{w_sco}}"
            )

    print("-" * (w_tk + w_dir + w_act + w_ent + w_stp + w_lev + w_val + w_mar + w_sco + 8))

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

    # 🚀 OTIMIZAÇÃO DE PORTFÓLIO (Sugestão de troca de ativos)
    if enters and current_leverage >= MAX_PORTFOLIO_LEVERAGE:
        print("\n🚀 SUGESTÕES DE OTIMIZAÇÃO DE CAPITAL")
        print("-" * 50)
        best_enters = sorted(enters, key=lambda x: x.get('score', 0), reverse=True)
        worst_holds = sorted(holds, key=lambda x: x.get('score', 0))

        if best_enters and worst_holds:
            top_new = best_enters[0]
            bottom_old = worst_holds[0]
            if top_new.get('score', 0) > bottom_old.get('score', 0):
                print(f"OPORTUNIDADE: O sinal {top_new['symbol']} (Score {int(top_new['score'])}) é tecnicamente superior ao ativo {bottom_old['symbol']} (Score {int(bottom_old['score'])}).")
                print(f"SUGESTÃO: Encerre {bottom_old['symbol']} para liberar margem para {top_new['symbol']}.")
            else:
                print("ANÁLISE: Seus ativos atuais em HOLD possuem score superior aos novos sinais. Mantenha as posições.")

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
            # Se houve cálculo de fator_reducao por falta de saldo, aplica-o antes de salvar
            if 'fator_reducao' in locals() and fator_reducao < 1.0:
                print(f"Applying reduction factor of {fator_reducao:.2f}x to new positions.")
                for r in new_entries:
                    r['size'] *= max(0, fator_reducao)
                    r['margin'] *= max(0, fator_reducao)
                    # notional e position_size no r também precisam ser ajustados para o engine
                    r['position_size'] = r['size']
                    r['margin_required'] = r['margin']

            for r in new_entries: scanner.pos_engine.open_position(r['symbol'], r)
            print("Rastreador atualizado!")

if __name__ == "__main__":
    main()
