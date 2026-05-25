# Manual do Usuário: Market Physics Regime Model (MPRM) V2.5

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

O MPRM V2.1 inclui uma camada operacional explícita para facilitar a tomada de decisão:

### 3.1 Entradas (Entry)
*   **Sinal BUY (Triângulo Verde):** Ocorre quando o sistema transita para o regime **BULL TREND** vindo de estados de acúmulo (Compression) ou equilíbrio (Chaos).
*   **Sinal SELL (Triângulo Vermelho):** Ocorre quando o sistema transita para o regime **BEAR TREND**.

### 3.2 Saídas (Exit)
*   **Sinal EXIT (X Branco):** Indica o fechamento da posição. Ocorre em três situações principais:
    1.  O sistema detecta **Exaustão** física (Orange) **E** a energia estrutural ($\Phi$) está em queda.
    2.  Surge um **Risco de Reversão** (‼) severo (combinação de exaustão, desaceleração e divergência).
    3.  O regime de tendência se inverte (ex: de BULL para BEAR) **E** a direção estrutural ($\rho$) confirma a inversão.

**Nota (V2.5):** As saídas agora são filtradas pela **Matriz de Markov**. Se a probabilidade de permanecer no regime atual ("Stay Probability") for alta, o sistema pode ignorar sinais de saída prematuros causados por ruído.

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

---

## 5. Matriz de Markov

O painel superior direito exibe a probabilidade estatística de transição.
*   **Next Likely #1:** Indica para qual regime o mercado costuma ir a partir do estado atual, baseado em todo o histórico do gráfico.
*   **Stay Probability:** Indica a persistência do regime atual.
