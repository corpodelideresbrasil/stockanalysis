# Manual do Usuário: Market Physics Regime Model (MPRM)

O MPRM é um sistema físico-stocástico projetado para identificar regimes de mercado através de analogias com a mecânica clássica e termodinâmica. Em vez de utilizar indicadores técnicos tradicionais, o MPRM modela o preço como um corpo em movimento sujeito a forças de inércia, aceleração e coerência estrutural.

---

## 1. Teoria Física do Mercado

O modelo baseia-se em quatro pilares fundamentais:

### 1.1 Cinemática (Movimento)
*   **Velocidade ($v$):** Variação do preço no tempo ($P_t - P_{t-1}$).
*   **Aceleração ($a$):** Taxa de variação da velocidade. Determina se o movimento está ganhando ou perdendo força.
*   **Jerk ($j$):** Taxa de variação da aceleração. Mede a instabilidade e "vibração" do sistema.
*   **Vetor Projetado ($v_{proj}$):** Estimativa da próxima posição baseada na velocidade e aceleração atuais ($v + a$).

### 1.2 Dinâmica e Energia
*   **Energia Cinética ($E_k$):** Intensidade direcional do movimento ($v^2$).
*   **Eficiência ($\eta$):** Razão entre o deslocamento líquido e o caminho total percorrido. Alta eficiência indica uma tendência clara; baixa eficiência indica ruído/caos.
*   **Inércia ($I$):** Persistência do movimento, calculada como uma média ponderada do momentum (volatilidade $\times$ velocidade).
*   **Coerência Estrutural ($C$):** Grau de organização do movimento, medido pela correlação entre preço e tempo.

---

## 2. Regimes de Mercado (Legenda de Cores)

O sistema classifica o mercado em quatro estados principais, representados por cores no fundo e nas barras:

| Regime | Cor | Descrição Física | Comportamento Esperado |
| :--- | :--- | :--- | :--- |
| **TREND** | 🟩 Verde | Alta Energia + Alta Coerência + Aceleração Confirmada. | Tendência estruturada e persistente. |
| **COMPRESSION** | 🟦 Azul | Baixa Energia + Baixa Volatilidade + Alta Coerência. | Acúmulo de energia potencial para um rompimento. |
| **EXHAUSTION** | 🟧 Laranja | Alta Instabilidade ($j$) + Perda de Eficiência. | Risco iminente de exaustão e reversão. |
| **CHAOS** | 🟪 Roxo | Baixa Coerência + Baixa Eficiência + Alta Turbulência. | Ruído dominante, sem direção clara (Lateralidade errática). |

---

## 3. Sinais e Avisos Antecipatórios

O MPRM busca avisar sobre mudanças **antes** que elas ocorram:

*   **Triângulo Verde (TREND):** Início de um regime de tendência validado.
*   **Triângulo Laranja (EXH):** Entrada em zona de exaustão física.
*   **X Roxo (CHAOS):** Início de regime de caos/turbulência.
*   **Aviso de Desaceleração (!):** Exibido quando a Aceleração se opõe à Velocidade (ex: preço subindo mas perdendo força).
*   **Risco de Reversão (‼):** Sinal de alerta máximo (Exaustão combinada com Desaceleração).
*   **Potencial de Rompimento (⊙):** Detectado durante a Compressão quando a eficiência e a energia começam a subir.

---

## 4. Ajuste de Parâmetros

*   **Stability Threshold:** Controla quão "exigente" o sistema é para mudar de regime. Aumente para evitar sinais falsos em mercados laterais.
*   **Trend Hysteresis:** Cria uma "memória" no estado de tendência. Exige que um sinal contrário seja muito forte para abandonar a tendência verde. Útil para ativos que tendem a ter correções rápidas dentro de uma alta.
*   **Coherence Lookback:** Período usado para medir a organização do preço. Use valores menores (10-15) para scalping e maiores (20-30) para swing trade.

---

## 5. Conclusão

O MPRM não prevê o preço futuro de forma determinística, mas infere o **estado físico** do sistema. O objetivo é operar a favor da coerência (Trend) e evitar o ruído (Chaos), antecipando-se às quebras de simetria (Exh/Comp).
