from scanners.market_scanner import MarketScanner

def main():
    print("\n" + "=" * 120)
    print(f"{'SWING ENGINE V2 - OPERATIONAL PANEL':^120}")
    print("=" * 120)

    scanner = MarketScanner()
    results, latest_open = scanner.run()

    # Define Column Widths
    w_tk, w_dir, w_act, w_reg, w_ent, w_stp, w_tgt, w_siz = 12, 8, 15, 15, 12, 12, 12, 12

    header = (
        f"{'Ticker':<{w_tk}} {'Dir':<{w_dir}} {'Action':<{w_act}} "
        f"{'Regime':<{w_reg}} {'Entry':<{w_ent}} {'Stop':<{w_stp}} "
        f"{'Target':<{w_tgt}} {'Size':<{w_siz}}"
    )

    print("\n" + header)
    print("-" * 120)

    if not results:
        print(f"{'No active signals or positions to report.':^120}")
    else:
        # Sort results: Actions first (ENTER, REDUCE, EXIT, then HOLD)
        def action_priority(r):
            prio = {"ENTER": 0, "EXIT_PROFIT": 1, "CLOSED_STOP": 1, "CLOSED_TARGET": 1, "REDUCE": 2, "HOLD_CAUTION": 3, "HOLD": 4}
            return prio.get(r['action'], 99)

        sorted_results = sorted(results, key=action_priority)

        for r in sorted_results:
            action_str = r['action']

            # Simple "color" markers for the terminal
            if "CLOSED" in action_str or "EXIT" in action_str:
                action_str = f"!! {action_str}"
            elif "ENTER" in action_str:
                action_str = f">> {action_str}"
            elif "REDUCE" in action_str:
                action_str = f"* {action_str}"

            print(
                f"{r['symbol']:<{w_tk}} {r['direction']:<{w_dir}} {action_str:<{w_act}} "
                f"{r['regime']:<{w_reg}} {r['entry']:<{w_ent}.4f} {r['stop']:<{w_stp}.4f} "
                f"{r['target']:<{w_tgt}.4f} {r['size']:<{w_siz}.4f}"
            )

    print("=" * 120)
    print(f"Total Open Positions: {len(latest_open)}")
    print("=" * 120)

    # Auto-Open signals (Optional)
    new_entries = [r for r in results if r['action'] == 'ENTER']
    if new_entries:
        ans = input(f"\nDeseja abrir as {len(new_entries)} novas posições no rastreador? (s/n): ")
        if ans.lower() == 's':
            pe = scanner.pos_engine
            for r in new_entries:
                pe.open_position(r['symbol'], {
                    "direction": r['direction'],
                    "entry": r['entry'],
                    "stop": r['stop'],
                    "target": r['target'],
                    "position_size": r['size']
                })
            print("Posições abertas com sucesso no positions.json!")

if __name__ == "__main__":
    main()
