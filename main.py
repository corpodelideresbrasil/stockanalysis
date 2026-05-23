from scanners.market_scanner import MarketScanner

def main():
    print("=" * 100)
    print("SWING ENGINE V2 - OPERATIONAL PANEL")
    print("=" * 100)

    scanner = MarketScanner()
    results, open_positions = scanner.run()

    print("\n" + "=" * 100)
    print("CURRENT OPEN POSITIONS")
    print("-" * 100)
    if not open_positions:
        print("No open positions.")
    else:
        print(f"{'Ticker':<12} {'Dir':<8} {'Entry':<12} {'Stop':<12} {'Target':<12} {'Size':<12}")
        for symbol, pos in open_positions.items():
            print(
                f"{symbol:<12} {pos['direction']:<8} "
                f"{pos['entry']:<12.4f} {pos['stop']:<12.4f} {pos['target']:<12.4f} {pos['size']:<12.4f}"
            )

    print("\n" + "=" * 100)
    print("NEW TRADE SIGNALS")
    print("-" * 100)
    if not results:
        print("No new signals found.")
    else:
        print(f"{'Ticker':<12} {'Dir':<8} {'Regime':<15} {'Entry':<12} {'Stop':<12} {'Target':<12} {'Size':<10}")
        for r in results:
            print(
                f"{r['symbol']:<12} {r['direction']:<8} {r['regime']:<15} "
                f"{r['entry']:<12.4f} {r['stop']:<12.4f} {r['target']:<12.4f} {r['position_size']:<10.4f}"
            )
    print("=" * 100)

if __name__ == "__main__":
    main()
