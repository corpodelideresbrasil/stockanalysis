# 🔋 Contexto: Swing Engine V2 (Versão Institucional)

Este documento resume o estado atual do motor de trading desenvolvido para operar no mercado de Futuros da Binance, focado em **Swing Trade** com análise de energia, cinemática e gestão rigorosa de risco.

## 🎯 1. Arquitetura do Sistema
O sistema foi reconstruído do zero com uma arquitetura modular para eliminar erros estruturais e dependências circulares:
- `main.py`: Orquestrador da interface e fluxo operacional.
- `config/`: Configurações de capital, risco, exchange e lista de símbolos.
- `data/`: Loader de dados OHLCV (`ccxt`) e persistência de estado (`positions.json`).
- `engines/`: Motores de Risco (Sizing/Alocação), Posição (Lifecycle) e Trailing Stop.
- `indicators/`: Cálculos técnicos (Supertrend, RSI, ADX, ATR, EMA, SMA).
- `strategies/`: Lógica de roteamento de sinais e detecção de regime.

## 🛡️ 2. Gestão de Risco Institucional
Implementamos travas de segurança de nível profissional:
- **Risco Fixo:** 2% do capital total por operação.
- **Notional Capping:** Máximo de 1x o capital total exposto em uma única moeda.
- **Portfolio Capping:** Alavancagem total do portfólio limitada a **3x Equity**.
- **Portfolio Allocator:** O sistema escala automaticamente o tamanho de novos sinais baseando-se no orçamento restante de margem e alavancagem, priorizando ativos por **Score de Convicção**.
- **Portfolio Heat:** Exibe o risco total em dólares (USDT) caso todos os stops sejam atingidos simultaneamente.
- **Taxas:** Desconto automático de **0.04%** (Binance Futures) em todas as operações de abertura e fechamento.

## 🧠 3. Estratégia e Filtros de Robustez
A estratégia opera em **Multi-Timeframe**:
- **Macro (1D):** Define o regime (UP/DOWN/RANGING). Requer alinhamento com **SMA200**, Supertrend e **ADX > 20**.
- **Tático (4H):** Identifica entradas em pullbacks via **RSI** (entre 40-60).
- **Inércia e Energia:** Filtros adicionais de **Volume > Volume Mean** e **ADX Slope positivo** para garantir que o mercado tem energia para seguir o movimento e não está apenas consolidando.
- **Stop Loss:** Inicialmente posicionado em **3.5x ATR** para suportar a volatilidade das criptos.

## 🔁 4. Gestão de Saídas (DPE)
Saídas parciais dinâmicas para proteção de capital:
1. **TP1 (1.5R):** Realiza **50%** do lucro e move o Stop Loss para o **Break-even**.
2. **TP2 (3.0R):** Realiza mais **25%** da posição inicial.
3. **Moon Bag:** Os 25% restantes seguem o **Trailing Stop** técnico (Supertrend 4H limitado a 2x ATR por ajuste).
*As saídas são apresentadas como **Recomendações Interativas** na UI para confirmação do usuário.*

## 📊 5. Estado Atual do Portfólio (Sincronizado)
- **Saldo Base:** 203.25 USDT.
- **Ativos Monitorados:** 32 moedas de alta liquidez e momentum (Lista de ADA a XRP, incluindo POL, ONDO, DOGE).
- **PnL Tracking:** Rastreio de PnL Aberto (Unrealized) e PnL Realizado Histórico (Líquido de taxas).

## 🚀 6. Como Continuar
O sistema está pronto para rodar o ciclo diário.
Execução: `python main.py`
Foco atual: Monitorar o comportamento dos filtros de robustez e das saídas parciais para garantir que o saldo retorne à trajetória de crescimento.
