# 🧭 Manual do Usuário - Swing Engine V2 (Versão Institucional)

Este documento explica como utilizar, entender e ajustar o seu motor de trading para obter o melhor desempenho e segurança de capital.

---

## 🚀 1. Como Utilizar

### Execução Stand-alone
O sistema foi desenhado para ser operado sob demanda. Recomenda-se rodar o script **uma vez por dia** (ou a cada 4 horas, dependendo da sua disponibilidade) para capturar as mudanças de regime.

No seu terminal:
```bash
python main.py
```

### O Painel Operacional
- **ENTER (>>):** Um novo setup foi identificado. O tamanho da posição (`Size`) e a margem necessária já estão calculados para o seu capital.
- **HOLD:** Você já possui essa posição no rastreador e a tendência continua saudável.
- **EXIT_PROFIT (!!):** O mercado atingiu um estado de exaustão (RSI extremo). Sugestão de encerramento imediato para garantir lucro.
- **CLOSED_STOP (!!):** O preço atingiu o seu Stop Loss e a posição foi marcada como encerrada no rastreador.

---

## 🧠 2. Estratégias Integradas

O sistema utiliza uma abordagem **Multi-Timeframe Institucional**:

1.  **Macro (1D):** Define o "Regime de Mercado".
    - `TREND_UP`: Supertrend positivo e Preço > Média 21.
    - `TREND_DOWN`: Supertrend negativo e Preço < Média 21.
    - `RANGING`: Mercado lateral ou indeciso.
2.  **Tático (4H):** Define o "Timing" e a "Gestão".
    - Entra em `LONG` apenas se o Macro for `TREND_UP` e houver um recuo (RSI < 60).
    - Entra em `SHORT` apenas se o Macro for `TREND_DOWN` e houver um repique (RSI > 40).
    - **Trailing Stop:** O Stop Loss é movido dinamicamente pelo Supertrend de 4H para proteger o lucro.

---

## 🛡️ 3. Gestão de Risco (Institutional Grade)

Diferente de sistemas amadores, este motor possui **duas travas de segurança**:

1.  **Risco por Operação (2%):** O sistema calcula o tamanho da posição para que, se o Stop for atingido, você perca exatamente 2% do seu capital total.
2.  **Notional Capping (Trava de Ativo):** Mesmo que o Stop seja muito curto (o que geraria um tamanho de posição enorme), o sistema **limita** a exposição a no máximo 100% do seu capital (1x equity) por ativo.
3.  **Portfolio Capping (Alavancagem Total):** O sistema impede novas entradas se a alavancagem total da conta (soma de todas as exposições) exceder **3x o seu capital**.

---

## ⚙️ 4. Como Ajustar os Parâmetros

Você pode calibrar a agressividade do sistema no arquivo `config/config.py`:

### Para Tornar MAIS Agressivo (Busca por mais retorno):
- `RISK_PER_TRADE`: Aumente para `0.03` (3%) ou `0.05` (5%).
- `MAX_PORTFOLIO_LEVERAGE`: Aumente para `5.0`.
- `MAX_TRADE_NOTIONAL_PCT`: Aumente para `2.0` (Permite posições de até 2x o capital).
- No `strategy_router.py`: Mude o filtro de RSI para `70` (Long) e `30` (Short).

### Para Tornar MAIS Conservador (Foco em segurança):
- `RISK_PER_TRADE`: Diminua para `0.01` (1%).
- `MAX_PORTFOLIO_LEVERAGE`: Diminua para `1.5` ou `2.0`.
- `TIMEFRAME_TACTICAL`: Mude para `1d` (Opera apenas no fechamento diário).

---

## 📂 Estrutura de Arquivos para Manutenção

- `config/config.py`: Seus limites e chaves.
- `config/symbols.py`: Sua lista de moedas.
- `data/positions.json`: Onde o sistema "lembra" das suas ordens.
- `strategies/strategy_router.py`: Onde você altera a lógica de entrada e saída.

---

## 📈 5. Expansão e Dinâmica do Mercado

### Adicionando Novos Ativos (`config/symbols.py`)
Você pode adicionar quantos ativos desejar na lista de monitoramento. O mercado é dinâmico e novos ativos surgem constantemente.
- **Análise Independente:** O motor analisa cada moeda de forma técnica e isolada. Se uma moeda nova atingir os critérios de entrada, ela aparecerá como `>> ENTER`.
- **Equilíbrio do Portfólio:** Mesmo que você adicione 100 moedas, o sistema **protege seu saldo global**. Se o somatório das posições abertas mais o novo sinal exceder o limite de **3x Alavancagem**, o sistema emitirá um alerta e impedirá o rastreio da nova posição.
- **Gestão de Fila:** Em um mercado com muitas oportunidades, o sistema prioriza o capital para as primeiras posições que você decidir rastrear, preservando a margem para segurança.

### Escabilidade de Capital (Abstração de Unidades)
O sistema opera de forma **linear e proporcional**:
- **Proporcionalidade:** Uma conta de 600 USD terá posições exatamente 3x maiores que uma conta de 200 USD, mantendo o mesmo risco percentual de 2%.
- **Atualização Simples:** Quando seu capital crescer (por lucro ou aporte), basta atualizar o valor de `INITIAL_CAPITAL` no arquivo `config/config.py`. O motor recalculará instantaneamente todos os novos valores de **Qtd (USDT)** e **Margem** para o novo patamar, sem que você precise fazer cálculos manuais.

---
**Aviso Legal:** Este sistema é uma ferramenta de apoio à decisão. O mercado de futuros perpétuos envolve alto risco. Sempre valide os sinais antes de executar ordens reais.
