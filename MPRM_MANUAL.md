# Manual do Usuário: Market Physics Regime Model (MPRM) V4.7

O MPRM é um modelo avançado que transforma o mercado em um sistema físico. Ele não "prevê" o preço, mas identifica o **estado de energia** do mercado (Regime) para dizer se a tendência é sustentável ou se o movimento está prestes a colapsar.

---

## 1. Entendendo as Cores (Regimes)

O gráfico utiliza um sistema de cores duplo (Fundo e Candles) para que você nunca tenha dúvida sobre o estado atual.

### O que as cores significam?
*   🟩 **Verde (BULL):** Tendência de alta forte. O "motor" está girando com força e direção.
*   🟥 **Vermelho (BEAR):** Tendência de baixa forte. O mercado está em queda livre estruturada.
*   🟦 **Azul (COMPRESSION):** O mercado está "enchendo a mola". Baixa volatilidade, mas muita energia acumulada. Prepare-se para um estouro.
*   🟧 **Laranja (EXHAUSTION):** O movimento cansou. Aceleração extrema ou divergência. É hora de apertar o stop ou realizar lucros.
*   🟪 **Roxo (CHAOS):** Ruído total. Não há direção clara. Evite operar.

### Fundo vs. Candles: Qual seguir?
*   **Cor do Fundo:** É o regime **Definitivo**. Ele manda na sua decisão macro.
*   **Cor do Candle:** Segue o regime para facilitar a leitura visual.
*   **Bordas do Candle:** Se a borda for **Verde Limão**, o preço fechou acima da abertura (alta no candle). Se for **Vinho/Marrom**, fechou abaixo (baixa no candle).
*   **Dica de Ouro:** Se o fundo estiver **Verde** mas o candle tiver borda **Vinho**, é apenas um respiro (pullback) dentro de uma tendência de alta saudável. **Mantenha a posição.**

---

## 2. Guia de Operação (Passo a Passo)

### Passo 1: A Entrada (Quando comprar ou vender)
Não tente adivinhar. Espere o sinal visual:
1.  **Sinal Visual:** Procure pelo **Triângulo Verde (BUY)** ou **Triângulo Vermelho (SELL)** abaixo/acima das barras.
2.  **Confirmação no Dashboard:** Olhe para o painel no canto superior direito.
    *   O **Hurst** deve estar acima de **0.52** (cor verde ou azul) para uma entrada de alta convicção.
    *   Se o Hurst estiver abaixo de 0.48, a entrada é arriscada (pode ser um falso rompimento).
3.  **Ação:** Entre no fechamento do candle do sinal. O dashboard mostrará seu **Entry Price** e o **Stop Loss** sugerido.

### Passo 2: Gestão da Posição (O lucro automático)
O sistema usa o método **PMPT** (Realização Mecânica):
*   **P1 (Alvo Amarelo):** Quando o preço atingir o **P1 Target** mostrado no painel, o sistema avisa. Venda **50%** da sua posição e mova seu stop para o preço de entrada (**Breakeven - BE**). Agora o risco é zero!
*   **P2 (Alvo Laranja):** Se o valor de **Torque** no painel ficar maior que o limite, venda mais **25%**. Você capturou o topo da exaustão.
*   **Restante (25%):** Deixe o preço correr enquanto estiver acima da linha cinza pontilhada (**Inertia Trail**).

### Passo 3: A Saída Final (EXIT)
Saia totalmente da operação se:
1.  Aparecer um **X (EXIT)** no gráfico.
2.  O preço tocar a linha de **Inertia Trail**.
3.  Aparecer o aviso **QL (Quick Loss)**: Isso significa que a energia do mercado colapsou logo após sua entrada. Saia imediatamente para proteger seu capital.

---

## 3. Dicas de Otimização (Como ser um expert)

O Passo 4 de otimização serve para ajustar o sistema ao seu perfil de risco e ao ativo que você opera.

### Quando e como ajustar?
1.  **Ativos muito "nervosos" (Cripto):**
    *   Se você notar muitos sinais falsos de exaustão (Laranja) que logo voltam a ficar Verde, aumente o **Trend Hysteresis** para 0.15 ou 0.20. Isso dá mais "espaço" para a tendência respirar.
2.  **Ativos Direcionais (Ações Blue Chips):**
    *   Se a tendência for muito forte (Coerência > 0.90 no dashboard), você pode ignorar sinais de saída por exaustão e esperar o **Inertia Trail** ser atingido. Isso maximiza o lucro em grandes tendências (como NVIDIA ou AAPL).
3.  **Uso do Filtro de Markov:**
    *   Mantenha o **Use Markov Transition Filter** ligado. Ele evita que o sistema mude de ideia a cada pequena oscilação, exigindo uma "prova estatística" antes de mudar a cor do fundo.
4.  **Hurst como Filtro de Qualidade:**
    *   Se o dashboard mostrar **Hurst: RANDOM**, diminua o tamanho da sua mão. O mercado está sem memória e os sinais têm menos chance de seguir adiante.

---

## 4. Legenda Rápida de Avisos
*   **( ! ) Desaceleração:** O preço sobe, mas o "combustível" está acabando. Atenção.
*   **( D ) Divergência:** O preço fez máxima nova, mas a energia não acompanhou. Perigo de topo.
*   **( !! ) Risco de Reversão:** Alerta máximo. Quase sempre precede uma mudança de cor para Laranja ou Roxo.
*   **QL (Quick Loss):** Proteção de emergência. A inércia falhou logo após a compra.
