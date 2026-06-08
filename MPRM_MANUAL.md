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

### Passo 1: A Entrada (Sinais e Convicção)
Não tente adivinhar. O sistema mostra triângulos de **BUY** ou **SELL** sempre que um novo regime de tendência começa.

**Como ler a convicção do sinal:**
*   🚀 **Foguete (Ex: 🚀BUY):** Alta Convicção. O Hurst está acima de 0.55. A tendência tem "memória" e força para continuar.
*   **Sinal Padrão (Ex: BUY):** Convicção Normal. Hurst entre 0.47 e 0.55.
*   ⚠️ **Alerta (Ex: ⚠️BUY):** Baixa Convicção. Hurst abaixo de 0.47. O sinal é baseado apenas em momentum de curto prazo e pode falhar se a energia não entrar rápido.

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

## 3. Perguntas Frequentes (FAQ)

### Ainda dá tempo de entrar?
Se você abriu o gráfico e o fundo já está **Verde** ou **Vermelho**, mas você perdeu o triângulo inicial:
*   **Atenção:** Se o sinal inicial tiver um **Foguete (🚀)**, a tendência é forte e você tem mais segurança para entrar "atrasado".
*   **Regra de Segurança:** Só entre se o preço ainda estiver perto do **Entry Price** mostrado no dashboard e se o **P1 Target** ainda não tiver sido atingido. Se o P1 já foi batido, a operação já deu o lucro principal e o risco de correção é alto.

### O que significa "CRYPTO / EQUITIES / INDICES" na linha do indicador?
Este é o **Perfil de Física** (Physics Profile) ativo. O modelo ajusta seus cálculos de inércia e energia dependendo da "viscosidade" do mercado:
*   **CRYPTO:** Para ativos altamente voláteis.
*   **EQUITIES:** Para ações (B3, NYSE).
*   **INDICES:** Para mercados mais pesados (S&P500, IBOV).
*   Você pode mudar isso nas configurações do indicador em **Asset Physics Profile**.

---

## 4. Dicas de Otimização

### Quando ajustar a sensibilidade?
*   Se o mercado estiver muito lateral e dando muitos sinais de **⚠️ Alerta**, aumente o **Trend Hysteresis** para 0.12 ou mais. Isso filtrará os sinais mais fracos.
*   Mantenha o **Use Markov Transition Filter** sempre ligado para garantir que as mudanças de cor do fundo tenham base estatística.

---

## 5. Legenda Rápida de Avisos
*   **( ! ) Desaceleração:** O combustível do movimento está acabando.
*   **( D ) Divergência:** Preço subiu, mas a energia caiu. Cuidado com o topo.
*   **( !! ) Risco de Reversão:** Alerta crítico de exaustão iminente.
*   **QL (Quick Loss):** Saída de emergência por colapso de energia.
