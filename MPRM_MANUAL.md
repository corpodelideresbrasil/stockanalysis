# Manual do Usuário: Market Physics Regime Model (MPRM) V4.2 (Versão Pine V6)

O MPRM é um sistema físico-estocástico projetado para identificar regimes de mercado através de analogias com a mecânica clássica e termodinâmica. Em vez de utilizar indicadores técnicos tradicionais, o MPRM modela o preço como um corpo em movimento sujeito a forças de inércia, aceleração e coerência estrutural.

---

## 1. Teoria Física do Mercado

O modelo baseia-se em quatro pilares fundamentais:

### 1.1 Cinemática (Movimento)
*   **Velocidade ($v$):** Variação logarítmica do preço no tempo ($\ln(P_t / P_{t-1})$). Isso torna o modelo invariante à escala de preço do ativo.
*   **Aceleração ($a$):** Taxa de variação da velocidade.
*   **Correlação Estrutural ($\rho$):** Mede a direção dominante do movimento nos últimos N períodos. É a bússola que mantém o regime TREND mesmo em pequenos pullbacks.
*   **Jerk ($j$):** Taxa de variação da aceleração. Mede a instabilidade e "vibração" do sistema.

### 1.2 Dinâmica e Energia
*   **Massa ($m$):** Representa a "carga" do movimento, baseada na volatilidade e volume relativo.
*   **Momentum ($p$):** Quantidade de movimento ($m \cdot v$).
*   **Força ($F$):** Impacto da aceleração na massa do mercado ($m \cdot a$).
*   **Energia Estrutural ($\Phi$):** Intensidade direcional do movimento ponderada pela coerência.
*   **Eficiência ($\eta$):** Razão entre o deslocamento líquido e o caminho total percorrido.
*   **Inércia ($I$):** Persistência do movimento, calculada como uma média ponderada do momentum absoluto.
*   **Coerência Estrutural ($C$):** Grau de organização do movimento, medido pela correlação entre preço e tempo.

---

## 2. Regimes de Mercado (Legenda de Cores)

O sistema classifica o mercado em cinco estados principais, representados por cores no fundo e nas barras:

| Regime | Cor | Descrição Física | Comportamento Esperado |
| :--- | :--- | :--- | :--- |
| **BULL TREND** | 🟩 Verde | Alta Energia + Coerência Positiva + Aceleração Confirmada. | Tendência de alta estruturada. |
| **BEAR TREND** | 🟥 Vermelho | Alta Energia + Coerência Negativa + Aceleração Confirmada. | Tendência de baixa estruturada. |
| **COMPRESSION** | 🟦 Azul | Baixa Energia + Baixa Volatilidade + Alta Coerência. | Acúmulo de energia potencial para um rompimento. |
| **EXHAUSTION** | 🟧 Laranja | Alta Instabilidade ($j$) + Perda de Eficiência + Divergência. | Risco iminente de exaustão e reversão. |
| **CHAOS** | 🟪 Roxo | Baixa Coerência + Baixa Eficiência + Alta Turbulência. | Ruído dominante, sem direção clara (Lateralidade). |

---

## 3. Guia Operacional (Trading)

O MPRM V3.3 inclui uma camada operacional explícita para facilitar a tomada de decisão:

### 3.1 Entradas (Entry)
*   **Sinal BUY (Triângulo Verde):** Ocorre quando o sistema transita para o regime **BULL TREND** vindo de estados de acúmulo (Compression) ou equilíbrio (Chaos).
*   **Sinal SELL (Triângulo Vermelho):** Ocorre quando o sistema transita para o regime **BEAR TREND**.

### 3.2 Saídas (Exit)
*   **Sinal EXIT (X Branco):** Indica o fechamento da posição. Ocorre em situações principais:
    1.  O sistema detecta **Exaustão** física (Orange) **E** a energia estrutural ($\Phi$) está em queda.
    2.  Surge um **Risco de Reversão** (‼) severo (combinação de exaustão, desaceleração e divergência).
    3.  O regime de tendência se inverte (ex: de BULL para BEAR) **E** a direção estrutural ($\rho$) confirma a inversão.
    4.  **Energy Collapse:** Queda significativa da energia estrutural em relação à média histórica, sem proteção do macro filtro.

**Novidade V4.2 (Macro-Aware Hurst Exit):**
*   **Gatilho Hurst Dinâmico:** Para evitar saídas prematuras em tendências "monstruosas" (como TRON ou BTC), o limite de saída por Hurst agora é dinâmico. Se o filtro macro (`macro_rho`) confirmar uma tendência forte (> 0.4), o sistema permite que o Hurst caia até **0.35** antes de encerrar a posição, permitindo que o ativo "respire" sem disparar o botão de pânico.

**Novidade V4.1 (Intra-bar Physics & Absorption):**
*   **Física de Pavios (Intra-bar Work):** O modelo agora analisa o "jogo de forças" dentro de cada candle. Pavios longos resultantes de tentativas de inversão frustradas são modelados como **Energia de Absorção**.
*   **Reforço de Inércia:** Se uma força contrária tenta empurrar o preço mas a tendência a absorve (deixando um pavio), essa energia é injetada nos logits de regime como suporte, impedindo saídas prematuras e confirmando a dominância da inércia atual.

**Novidade V4.0 (Inertia-Hurst Coupling & Dynamic Stability):**
*   **Inertia-Hurst Coupling:** O sistema agora utiliza o Expoente de Hurst para reforçar a inércia do regime. Quando $H > 0.60$ (Persistência), o custo estatístico para sair de uma tendência aumenta (`hurst_boost`), evitando o "flickering" (trocas rápidas de sinal) em tendências macro.
*   **Dynamic Stability Threshold:** A sensibilidade de entrada (`stability_thr`) agora é escalada dinamicamente pela Coerência Estrutural ($\rho$). Em zonas de alta coerência (> 0.8), o sistema torna-se mais exigente para mudar de estado, filtrando ruídos de micro-volatilidade.

**Novidade V3.9 (Hurst Exit Overrides & Markov Decay):**
*   **Hurst Exit Overrides:** Introdução de gatilhos de saída imediata baseados em anti-persistência. Se $H < 0.40$ (Forte Reversão), o sistema encerra a posição ignorando a probabilidade de permanência de Markov, otimizando a saída em topos/fundos de exaustão.
*   **Classificação Granular de Hurst:**
    *   *EXTREME:* $H > 0.75$ (Tendência extremamente forte, possível fragilidade estrutural).
    *   *PERSISTENCE:* $H > 0.52$ (Tendência saudável).
    *   *RANDOM:* $0.48 \leq H \leq 0.52$ (Ruído).
    *   *CONSOLIDATION:* $0.40 \leq H < 0.48$ (Perda de memória direcional).
    *   *REVERSION:* $H < 0.40$ (Forte viés de retorno à média).
*   **Markov Memory Decay:** Implementação de um fator de decaimento (`markov_decay`) para a matriz de transição. Isso permite que o modelo "esqueça" comportamentos antigos e se adapte mais rapidamente às mudanças recentes na dinâmica do ativo.

**Novidade V3.8 (Hurst Classification & Predictive Markov):**
*   **Classificação de Hurst:** O valor do Expoente de Hurst traduzido em estados compreensíveis.
*   **Previsão de Próximo Estado:** O dashboard agora exibe qual é o regime mais provável após o atual, baseado na memória estatística da Matriz de Markov, incluindo a probabilidade percentual dessa transição.

**Novidade V3.7 (Position Tracking & Visual Linking):**
*   **Monitoramento de Status:** O dashboard agora exibe se o sistema está em modo **LONG**, **SHORT** ou **FLAT**, com cores correspondentes.
*   **Vínculo Visual de Trades:** Para facilitar a leitura do gráfico, os sinais de saída (`EXIT`) agora utilizam a mesma cor do sinal de entrada correspondente:
    *   *Sinal BUY (Verde Limão) -> Sinal EXIT LONG (Verde Limão).*
    *   *Sinal SELL (Vermelho) -> Sinal EXIT SHORT (Vermelho).*
*   **Correção de Deadlock (V3.6.4):** Motor de Markov ajustado com regra de "Descoberta" para evitar travamento no regime inicial.

**Novidade V3.6 (Hurst, Torque & Pine V6):**
*   **Migração para Pine V6:** Código modernizado com `enums` e tipagem estrita para maior performance e estabilidade.
*   **Hurst Exponent (Proxy):** Substituição da coerência linear por uma medida de persistência fractal. H > 0.5 indica tendência estruturada; H < 0.5 indica comportamento de reversão à média ou caos.
*   **Torque Estrutural ($\tau = r \times F$):** Nova métrica de exaustão que mede a força de "rotação de regime". Detecta quando o preço está sobre-estendido em relação à sua massa e força de aceleração.
*   **HMM-Lite (Markov Filter):** As transições de regime agora são filtradas estatisticamente. Na V3.6.3, foi adicionado um período de bootstrap (100 barras) para evitar que o sistema fique travado em Caos por falta de dados iniciais.
*   **Separação $E_k$ e $E_p$:** Diferenciação clara entre Energia Cinética (movimento ativo) e Energia Potencial (acúmulo em compressão).

**Novidade V3.3 (Inertia Persistence & Physical Gating):**
*   **Filtro de Inércia (Inertia Buffer):** O sinal de saída antecipada (PEAK) agora exige que a Energia Ativa ($\Phi$) caia abaixo da Inércia Acumulada ($I$).
*   **Gatilho de Transição Física (Physical Gating):** Impede que o sistema saia do regime de tendência por ruído estatístico se não houver um "Impulso Contrário" significativo.

### 3.3 Avisos e Potenciais
*   **Desaceleração (!):** Alerta que o preço continua subindo/descendo, mas a aceleração física já é contrária ao movimento.
*   **Divergência (D):** O preço atingiu novas máximas/mínimas, mas a Energia ($\Phi$) ou Eficiência ($\eta$) caiu. Sinal clássico de topo/fundo fraco.
*   **Risco de Reversão (‼):** Alerta crítico. Combinação de exaustão, desaceleração e divergência.
*   **Potencial de Rompimento (⊙):** Detectado durante a Compressão quando a eficiência e a energia começam a subir. Antecipa o início de uma tendência.

---

## 4. Ajuste de Sensibilidade

*   **Risk Warning Sensitivity:** Ajuste para tornar os sinais (‼) mais ou menos frequentes. Ativos voláteis como Cripto exigem valores maiores (ex: 2.0).
*   **Divergence Sensitivity:** Controla quão sensível o sinal (D) é à queda de energia.
*   **Trend Hysteresis:** Evita que o sistema saia do modo TREND por causa de pequenos ruídos. Mantém a posição "viva" durante correções saudáveis.
*   **Markov Stay Persistence:** Aumenta a persistência em regimes de tendência baseada na memória estatística do ativo.

---

## 4. Parâmetros V3.0
*   **Macro Lookback (200):** Janela para o filtro de viés estrutural.
*   **Proximity Damping:** Algoritmo interno que calibra a sensibilidade da exaustão baseada na distância (em desvios padrões) do topo/fundo.

---

## 5. Matriz de Markov

O painel superior direito exibe a probabilidade estatística de transição.
*   **Next Likely #1:** Indica para qual regime o mercado costuma ir a partir do estado atual, baseado em todo o histórico do gráfico.
*   **Stay Probability:** Indica a persistência do regime atual. O V3.3 usa essa métrica dinamicamente para endurecer a saída de tendências estáveis.
