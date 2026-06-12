class TrailingEngine:
    """
    Handles dynamic stop loss updates.
    """

    @staticmethod
    def calculate_new_stop(symbol, position, df_4h):
        """
        Calculates a new trailing stop based on Supertrend or ATR.
        """
        if not position or position['status'] != 'OPEN':
            return None

        direction = position['direction']
        current_stop = position['stop']

        last_row = df_4h.iloc[-1]
        st_value = last_row['supertrend']
        st_dir = last_row['supertrend_direction']

        new_stop = current_stop
        atr = last_row.get('atr', 0)

        if direction == 'LONG':
            # Only move stop UP
            if st_dir == 1 and st_value > current_stop:
                # Safety: Não move o stop mais que 2x ATR de uma vez (evita glitches)
                if atr > 0 and (st_value - current_stop) > (2 * atr):
                    new_stop = current_stop + (2 * atr)
                else:
                    new_stop = st_value
        elif direction == 'SHORT':
            # Only move stop DOWN
            if st_dir == -1 and st_value < current_stop:
                # Safety: Não move o stop mais que 2x ATR de uma vez
                if atr > 0 and (current_stop - st_value) > (2 * atr):
                    new_stop = current_stop - (2 * atr)
                else:
                    new_stop = st_value

        if new_stop != current_stop:
            return new_stop

        return None
