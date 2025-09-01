# Manual do Sistema de Análise Quantitativa

## 1. Introdução

Este documento serve como o manual oficial para o sistema de análise e backtesting de estratégias de trading desenvolvido em Google Apps Script. O sistema foi projetado para ser uma ferramenta poderosa de pesquisa, permitindo que um analista descubra, valide e calibre estratégias de reversão à média para day-trading de forma sistemática e baseada em dados.

O projeto evoluiu significativamente desde sua concepção. Começamos com uma abordagem simples, baseada em gatilhos de entrada fixos, e, através de um processo iterativo de análise de resultados e refinamento de hipóteses, chegamos a um motor de análise sofisticado. A versão final do sistema utiliza o perfil estatístico de cada ativo para definir alvos dinâmicos e emprega métricas de avaliação robustas, como a Expectativa Matemática (EV) e um "Score" de qualidade, para identificar as oportunidades mais promissoras.

O objetivo deste manual é fornecer uma visão completa da metodologia, da aplicação prática e dos conceitos teóricos que fundamentam a ferramenta, capacitando o usuário a extrair o máximo de seu potencial.

---

## 2. Descrição Metodológica

O coração do sistema é um processo de múltiplos passos que transforma dados brutos de mercado em recomendações de trade acionáveis e testadas.

### 2.1. Conceito Central: Reversão à Média

A filosofia fundamental por trás da estratégia é a **reversão à média**. Este conceito postula que os preços dos ativos tendem a reverter para sua média histórica ao longo do tempo. O sistema busca explorar essa tendência identificando movimentos de preço que se desviam significativamente do comportamento recente, apostando em um retorno ao equilíbrio. Especificamente, ele procura por quedas ou altas abruptas no início do dia (em relação ao fechamento anterior) como gatilhos de entrada.

### 2.2. Passo 1: Análise de Perfil do Ativo

O sistema não trata todos os ativos da mesma forma. A primeira etapa de qualquer análise é construir um "perfil de personalidade" para cada ação. Para cada ticker, o script analisa seu histórico de dados para calcular quatro estatísticas fundamentais sobre suas variações diárias (`(Fechamento - Abertura) / Abertura`):

1.  **`avgPosVar`**: A média de todas as variações diárias que foram positivas.
2.  **`stdDevPosVar`**: O desvio padrão (DP) dessas variações positivas.
3.  **`avgNegVar`**: A média de todas as variações diárias que foram negativas.
4.  **`stdDevNegVar`**: O desvio padrão dessas variações negativas.

Esses quatro valores representam o comportamento típico do ativo em dias de alta e de baixa, formando a base para a definição de alvos realistas.

### 2.3. Passo 2: Definição de Alvos Dinâmicos e Calibráveis

Com o perfil estatístico em mãos, o sistema define metas de lucro e perda que são dinâmicas e adaptadas a cada ativo. A ambição dessas metas é controlada por dois parâmetros-chave no `CONFIG`:

-   `DP_MULTIPLIER_GAIN`
-   `DP_MULTIPLIER_STOP`

As fórmulas são:
-   **Alvo de Ganho (`targetGain`)**: `média das variações positivas + (DP_MULTIPLIER_GAIN * desvio padrão das variações positivas)`
-   **Alvo de Stop (`targetStop`)**: `média das variações negativas (em valor absoluto) + (DP_MULTIPLIER_STOP * desvio padrão das variações negativas)`

Isso permite ao analista calibrar a estratégia. Um `DP_MULTIPLIER_GAIN` menor (ex: 0.5) busca alvos mais curtos e mais prováveis. Um `DP_MULTIPLIER_STOP` maior (ex: 1.5) estabelece um stop loss mais conservador e mais distante.

### 2.4. Passo 3: Descoberta da Estratégia (Gatilho de Entrada)

Para cada ativo e cada direção (COMPRA/VENDA), o sistema itera através de uma faixa de possíveis "gatilhos de entrada" (percentuais de queda ou alta em relação ao fechamento do dia anterior). Para cada um desses gatilhos, ele simula o desempenho da estratégia ao longo de todo o histórico de dados, usando os alvos dinâmicos calculados no passo anterior.

### 2.5. Passo 4: Métricas de Avaliação

Cada estratégia simulada é avaliada com base em um conjunto de métricas:

-   **Probabilidade de Ganho (`probS1`)**: A porcentagem de vezes que um trade ativado atingiu a meta de lucro.
-   **Probabilidade de Perda (`probS3`)**: A porcentagem de vezes que um trade ativado atingiu a meta de stop loss.
-   **Expectativa Matemática (EV)**: A métrica de lucratividade real. Responde à pergunta: "Quanto eu espero ganhar, em média, por operação?". A fórmula é `EV = (probS1 * % Ganho) - (probS3 * % Perda)`. Um EV positivo é essencial para a viabilidade a longo prazo.
-   **Score**: A métrica de otimização final, que equilibra lucratividade com consistência. A fórmula é `Score = EV * probS1`. Ela favorece estratégias que não apenas são lucrativas, mas que também têm uma taxa de acerto razoável.

### 2.6. Passo 5: Validação com Backtest Ponto-no-Tempo

Esta é a validação final e mais robusta. O `executarBacktestPontoNoTempo` simula o comportamento de um trader real, evitando o "viés de olhar para o futuro". Para cada um dos últimos 45 dias:
1.  O sistema "finge" que está naquele dia, usando apenas os dados históricos disponíveis até então.
2.  Ele gera as melhores recomendações para aquele dia específico.
3.  Ele então simula a execução dessas recomendações no dia seguinte.
4.  O resultado (lucro, prejuízo ou não execução) é registrado.

Isso garante que a validação da estratégia é feita em condições o mais próximo possível da realidade.

---

## 3. Aplicação (Como Usar o Sistema)

### 3.1. Setup Inicial
-   **Aba `ativos`**: Liste todos os tickers que você deseja que o sistema analise na coluna A desta aba, começando da célula A2.

### 3.2. Calibração (O Objeto `CONFIG`)
Este é o painel de controle do sistema. Ajustar estes parâmetros é a principal forma de pesquisar e refinar estratégias.

-   `DIAS_DADOS_MANTER`: Número de dias de dados históricos a serem mantidos e usados na análise.
-   `NUM_DIAS_BACKTEST`: Quantidade de dias para o backtest Ponto-no-Tempo.
-   `MIN_TRADES_PARA_SIGNIFICANCIA`: Número mínimo de ocorrências de uma estratégia no histórico para que ela seja considerada estatisticamente relevante.
-   `DP_MULTIPLIER_GAIN` / `DP_MULTIPLIER_STOP`: Os fatores de calibração da "ambição" dos alvos de ganho e perda. Valores menores que 1.0 são mais conservadores; maiores que 1.0 são mais agressivos.
-   `MIN_EXPECTED_VALUE`: O filtro mínimo de lucratividade (EV). Um valor de `0.005` exige que uma estratégia tenha uma expectativa de ganho de pelo menos 0.5% por operação para ser considerada.
-   `MIN_PROB_S1`: O filtro mínimo de taxa de acerto. Um valor de `0.40` exige que uma estratégia tenha pelo menos 40% de chance de sucesso.
-   `OTIMIZAR_POR`: A métrica usada para escolher a melhor recomendação (`'score'` é o padrão e recomendado).

### 3.3. Fluxos de Trabalho (As Funções)
No editor de Apps Script, você pode executar manualmente três funções principais:

1.  **`executarAtualizacaoCompleta()`**: Use esta função uma vez por dia ou quando quiser garantir que os dados de mercado estão atualizados. Ela busca novos dados e depois gera as recomendações.
2.  **`apenasGerarRecomendacoes()`**: Use esta função para testar rapidamente novos parâmetros no `CONFIG`. Ela pula a etapa de busca de dados e usa apenas as informações que já estão na aba "Dados diários", sendo muito mais rápida.
3.  **`executarBacktestPontoNoTempo()`**: Use esta função para realizar a validação completa e robusta da sua configuração atual de parâmetros.

### 3.4. Interpretando os Resultados
-   **`Recomendacoes_Conservador` / `_Agressivo`**: Mostra a melhor recomendação para cada ativo/direção que passou nos filtros do perfil correspondente.
-   **`Todas_Recomendacoes`**: Um "dump" de todas as estratégias simuladas, ordenadas pelo `Score`. Útil para encontrar oportunidades que podem não ter passado nos filtros, mas que merecem uma análise mais aprofundada.
-   **`Backtest_Resultados_PiT`**: O resultado financeiro consolidado do backtest Ponto-no-Tempo. Mostra o desempenho da sua configuração de parâmetros nos últimos 45 dias.
-   **`Backtest_Log`**: A ferramenta de depuração mais importante. Mostra o que aconteceu com cada recomendação em cada dia do backtest, informando se ela foi executada com lucro/prejuízo ou por que não foi executada.

---

## 4. Conclusões

Este sistema é uma ferramenta de pesquisa e assistente de análise, não um provedor de sinais de "compre" ou "venda". Seu verdadeiro poder não está nas recomendações que ele gera em uma única execução, mas na capacidade que ele confere ao analista de:
-   Formular hipóteses (ex: "Será que alvos mais curtos funcionam melhor para ativos de alta volatilidade?").
-   Testar essas hipóteses ajustando os parâmetros no `CONFIG`.
-   Validar os resultados de forma robusta através do backtest Ponto-no-Tempo.

O objetivo final do uso desta ferramenta é encontrar uma combinação de parâmetros de `CONFIG` que, ao longo do tempo, produza resultados consistentemente positivos no backtest, indicando uma estratégia potencialmente viável.

---

## 5. Disclaimers (Avisos Legais)

-   **Não é Aconselhamento Financeiro:** Este script e seus resultados são para fins educacionais e de pesquisa apenas. Eles não constituem, de forma alguma, aconselhamento de investimento.
-   **Risco de Mercado:** Toda e qualquer operação no mercado financeiro envolve riscos, incluindo a perda total do capital investido.
-   **Desempenho Passado Não Garante Resultados Futuros:** Os resultados do backtest são baseados em dados históricos e não são garantia de desempenho futuro. As condições de mercado mudam constantemente.
-   **Limitações Técnicas:** O script depende de serviços externos (Google Finance) que podem ter falhas ou imprecisões nos dados. O tempo de execução do Google Apps Script é limitado e pode impedir backtests de períodos muito longos.
-   **Uso por Conta e Risco:** O uso deste script para a execução de operações reais é de inteira responsabilidade do usuário. É crucial que o usuário entenda completamente o código e suas limitações antes de tomar qualquer decisão financeira com base em seus resultados.
```
