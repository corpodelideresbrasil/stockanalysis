# Explicação do Cálculo do "Alvo de Ganho"

Olá! Peço desculpas, pois o sistema está me impedindo de enviar explicações diretamente no chat. Estou escrevendo a resposta para sua pergunta aqui.

**Pergunta:** O alvo de ganho está sendo calculado como?

**Resposta Curta:**

O "% Alvo de Ganho" é a **média do lucro máximo potencial** que foi historicamente alcançado *apenas* nos dias em que a estratégia teve sucesso (o que chamamos de "Lucro Total" ou Cenário 1).

---

**Resposta Detalhada:**

O valor não é uma meta pré-definida (como "sempre buscar 2%"), mas sim um resultado do backtest. Veja como funciona:

1.  **Simulação:** O script analisa o histórico e identifica todos os dias em que uma operação teria sido ativada com base no "Gatilho de Entrada".

2.  **Classificação:** Cada operação ativada é classificada. A que nos interessa para o "Alvo de Ganho" é a de **"Lucro Total" (S1)**.
    *   Uma operação de **COMPRA** é S1 se, no dia da entrada, a `Máxima` do dia superar o `Fechamento do dia anterior`.
    *   Uma operação de **VENDA** é S1 se, no dia da entrada, a `Mínima` do dia for inferior ao `Fechamento do dia anterior`.

3.  **Cálculo do Lucro Individual (para cada S1):** Para cada operação que foi classificada como S1, o script calcula o lucro que teria sido obtido se a saída fosse no melhor momento do dia.
    *   **Para COMPRA:**
        *   `Preço de Entrada = FechamentoAnterior * (1 - Gatilho%)`
        *   `Lucro Potencial = (MáximaDoDia - Preço de Entrada) / Preço de Entrada`
    *   **Para VENDA:**
        *   `Preço de Entrada = FechamentoAnterior * (1 + Gatilho%)`
        *   `Lucro Potencial = (Preço de Entrada - MínimaDoDia) / Preço de Entrada`

4.  **Cálculo da Média:** O valor que você vê na coluna "% Alvo de Ganho" é simplesmente a **média de todos os "Lucros Potenciais"** calculados no passo 3.

**Em resumo: O número representa o ganho médio que a estratégia gerou nos dias de sucesso, assumindo uma venda perfeita no pico (para compras) ou no fundo (para vendas) do dia.**

---
## Proposta de Ajuste (30/08/2025)

Olá. Minha tentativa de fazer uma pergunta de confirmação falhou. Vou detalhar a minha compreensão da sua solicitação e o ajuste que pretendo fazer aqui.

**Sua Solicitação:** O alvo de ganho deve ser calculado com base na "venda na média e não no pico".

**Minha Interpretação:**
Para os dias de sucesso (Cenário S1), o cálculo do lucro deve usar o **preço de fechamento (`close`)** como ponto de saída, em vez do melhor preço possível do dia (`high` ou `low`). A condição para *identificar* um dia de sucesso permanece a mesma.

**Mudança no Código:**
Eu vou alterar a função `analisarEstrategia`.

**Código ATUAL (incorreto):**
```javascript
// Para COMPRA (S1)
s1ProfitSum += (high - entryPrice) / entryPrice;

// Para VENDA (S1)
s1ProfitSum += (entryPrice - low) / entryPrice;
```

**Código PROPOSTO (com o ajuste):**
```javascript
// Para COMPRA (S1)
s1ProfitSum += (close - entryPrice) / entryPrice;

// Para VENDA (S1)
s1ProfitSum += (entryPrice - close) / entryPrice;
```

**Por favor, me confirme se esta interpretação e a mudança de código proposta estão corretas. Um "sim" ou "não" é suficiente.**

---
## Proposta de Ajuste v2 (30/08/2025)

Obrigado pelo esclarecimento. Sua resposta "Não" foi muito útil e evitou que eu fizesse o ajuste errado. Peço desculpas pela minha interpretação incorreta.

Com base na sua nova explicação, minha compreensão agora é muito diferente e mais complexa. Por favor, confirme se o plano a seguir está correto.

**Sua Nova Solicitação:** "Nos dias de sucesso o preco de fechamento deve ser o valor da média das variações positivas ou a média das variacoes negativas para a venda."

**Minha Nova Interpretação (Plano de Duas Etapas):**

**Etapa 1: Pré-cálculo de Médias Históricas (para cada Ticker)**
Antes de simular qualquer estratégia, para cada ticker, eu vou primeiro calcular duas novas métricas a partir de todo o seu histórico de dados:
1.  `media_variacao_positiva`: A média de todas as variações diárias `(close - open) / open` que foram maiores que zero.
2.  `media_variacao_negativa`: A média de todas as variações diárias `(close - open) / open` que foram menores que zero.

**Etapa 2: Novo Cálculo de Lucro na Simulação**
Quando uma operação de sucesso (Cenário S1) for identificada, eu NÃO usarei mais o `high`, `low` ou `close` daquele dia para calcular o lucro. Em vez disso, usarei as médias pré-calculadas da Etapa 1.

O código para calcular o lucro (dentro da função `analisarEstrategia`) seria alterado da seguinte forma:

**Código PROPOSTO (v2):**
```javascript
// Para uma COMPRA (S1), o lucro será a média histórica de variações positivas
s1ProfitSum += media_variacao_positiva;

// Para uma VENDA (S1), o lucro será o valor absoluto da média histórica de variações negativas
s1ProfitSum += Math.abs(media_variacao_negativa);
```
*(Nota: O lucro já é uma porcentagem, então simplesmente somamos a média das variações percentuais que calculamos na Etapa 1).*

**Isso significa que o "Alvo de Ganho" para um ticker será o mesmo para todas as estratégias de COMPRA (será sempre a `media_variacao_positiva`) e o mesmo para todas as estratégias de VENDA (será sempre a `media_variacao_negativa`), independentemente do gatilho.**

**Esta nova interpretação está correta? Por favor, confirme com "sim" ou "não".**

---
### Proposta de Ajuste v3 (30/08/2025)

Olá! Fico feliz que o ajuste anterior funcionou. Analisei seus novos pontos e tenho uma proposta de como podemos prosseguir.

---
#### Ponto 1: Relação Risco/Retorno (Stop Loss Simétrico)

**Sua Solicitação:** "Vamos fazer simulações. Inicialmente coloque o stop loss simétrico ao alvo de ganho. Ou seja, sempre 1:1."

**Minha Interpretação e Plano:**
Você quer simular uma estratégia onde o risco aceito é sempre igual ao ganho esperado. Para fazer isso:
1.  Eu vou alterar a lógica de filtragem e exibição. O `maxDrawdown` (o stop loss máximo observado) **não será mais usado para filtrar as recomendações**. Ele ainda será calculado e exibido na aba "Todas_Recomendacoes" pois é um dado importante, mas não vai mais desqualificar uma estratégia.
2.  Nas abas "Recomendacoes_Conservador" e "Recomendacoes_Agressivo", a coluna "% Stop Loss" agora irá mostrar o mesmo valor da coluna "% Alvo de Ganho".
3.  Consequentemente, a coluna "Risco/Retorno" mostrará sempre `1.00`.
4.  Para que isso funcione, eu vou **ignorar o filtro `RELACAO_GANHO_RISCO_MIN`** na sua configuração. As estratégias serão filtradas apenas pela `Prob. Lucro Total` e pelo `DRAWDOWN_MAX` (que continua sendo o máximo histórico, uma medida de segurança).

Isso irá remover a "penalidade exagerada" que você mencionou e nos permitirá ver as estratégias sob uma nova ótica de risco 1:1.

---
#### Ponto 2: Otimização por "Maior Ganho/Menor Gatilho" vs. "Alta Frequência"

**Sua Análise:** Você mencionou duas ideias:
-   Buscar a recomendação com "o maior ganho para o menor gatilho".
-   Encontrar trades com "uma grande frequencia de ganhos independente de ser o maior ganho ou não".

**Minha Análise:**
Essas duas ideias são um pouco contraditórias. A segunda ideia ("alta frequência de ganhos") é exatamente o que o script já faz! A configuração `OTIMIZAR_POR: 'probS1'` nos seus perfis de risco instrui o script a escolher, para cada ativo, a estratégia que tem a maior **probabilidade de sucesso (S1)**, que é a mesma coisa que a maior "frequência de ganhos".

Eu acredito que o cálculo anterior do `maxDrawdown` estava distorcendo tanto os resultados que essa otimização não parecia correta.

**Minha Sugestão:**
Vamos primeiro implementar a **mudança do Stop Loss Simétrico (Ponto 1)**. Depois de aplicarmos essa correção, a otimização atual por "maior frequência de ganhos" (`probS1`) provavelmente já irá gerar os resultados realistas que você procura. Se, mesmo assim, você não gostar dos resultados, podemos então implementar uma nova lógica de otimização como a de "maior ganho / menor gatilho".

**Resumo da Proposta:**
1.  Eu altero o script para usar o Stop Loss Simétrico (1:1) e ignoro o filtro de Risco/Retorno.
2.  Mantemos a otimização atual por maior frequência de acertos (`probS1`).
3.  Você analisa os novos resultados.

**Se você concorda com esta proposta, por favor, responda "sim".**

---
### Proposta de Ajuste v4: Backtest de Desempenho Diário

Olá! Recebi sua nova solicitação para criar uma simulação de backtest. Esta é uma excelente ideia para validar a estratégia. No entanto, é uma funcionalidade muito complexa e precisamos definir o escopo com cuidado, pois um backtest "puro" é muito difícil de ser executado no Google Apps Script devido aos limites de tempo de execução.

---
#### Entendendo a Complexidade: Backtest "Puro" vs. Simulação de Desempenho

-   Um **Backtest Puro (Ponto-no-Tempo)** significaria que, para cada um dos últimos 90 dias, teríamos que rodar a análise de recomendação *inteira* usando apenas os dados disponíveis até aquele dia. Isso seria como rodar o script 90 vezes, o que certamente excederia o limite de tempo do Google.

-   Uma **Simulação de Desempenho Histórico (a minha proposta)** é uma alternativa mais viável:
    1.  Primeiro, geramos a lista de recomendações **uma única vez**, usando todos os dados que temos (exatamente como o script faz agora).
    2.  Depois, nós "viajamos no tempo" com essa lista de recomendações e, para cada um dos últimos 90 dias, verificamos: "Se eu tivesse seguido estas recomendações, quais teriam sido ativadas e qual seria o resultado financeiro naquele dia?".

A minha sugestão é começarmos com a **Simulação de Desempenho**, que é o que descrevo abaixo.

---
#### Meu Plano de Implementação (Simulação de Desempenho)

1.  **Nova Função Principal:** Criarei uma nova função chamada `executarBacktestDeDesempenho()` que você poderá executar.

2.  **Nova Aba:** Esta função criará uma nova aba chamada "Backtest_Desempenho".

3.  **Lógica da Simulação:**
    a. A função primeiro chamará `gerarRecomendacoesEstatisticas()` para garantir que as recomendações estão atualizadas.
    b. Ela lerá as recomendações das abas "Conservador" e "Agressivo".
    c. Para cada um dos últimos 90 dias do histórico:
        i. Ela simulará a execução de cada ordem recomendada.
        ii. Para uma ordem de **COMPRA**:
            - Se o `low` do dia atingir o `preço de entrada`, a ordem é ativada.
            - **Saída com Ganho:** Se o `high` do dia atingir `entrada * (1 + alvo de ganho)`, o lucro é `( (entrada * (1 + alvo de ganho)) - entrada ) * 100`.
            - **Saída com Perda:** Se o `low` do dia atingir `entrada * (1 - alvo de ganho)`, a perda é `( (entrada * (1 - alvo de ganho)) - entrada ) * 100`.
            - **Saída no Fechamento:** Se nenhum dos acima ocorrer, a saída é no `close` do dia. O resultado é `(close - entrada) * 100`.
        iii. A lógica para **VENDA** será simétrica.
    d. Os resultados financeiros (Lucro/Prejuízo em R$) para cada ação em cada dia serão calculados e armazenados.

4.  **Resultado Final:** A aba "Backtest_Desempenho" terá colunas como: `Data`, `Ação`, `Perfil`, `Resultado do Dia (R$)`. No final, haverá um resumo do desempenho total da carteira para cada perfil.

Este plano é robusto, executável dentro das limitações do Google e nos dará uma excelente visão do desempenho histórico da estratégia atual.

**Se você concorda com esta abordagem (Simulação de Desempenho em vez de Backtest Puro), por favor, responda "sim".**

---
### Proposta de Ajuste v5: Refinando a Definição de "Sucesso" (31/08/2025)

Olá. O resultado negativo do backtest é uma informação extremamente valiosa. Ele nos mostra que a forma como o script *analisa* uma estratégia é diferente da forma como a estratégia *realmente se comporta* no mundo real (simulado pelo backtest). O resultado ruim é esperado com a lógica atual, e agora podemos corrigi-la.

---
#### O Problema: A Definição de "Lucro Total (S1)" é Otimista Demais

Atualmente, a análise (`analisarEstrategia`) considera uma operação de compra um "sucesso" (S1) se o preço simplesmente sobe acima do fechamento do dia anterior (`high > prevClose`).

No entanto, o nosso backtest (e a lógica de lucro) espera que o preço atinja um alvo bem mais alto: `entrada * (1 + alvoDeGanho)`.

Essa diferença é a causa do resultado ruim. O script está otimizando para uma condição de sucesso muito fácil de atingir, que não corresponde ao lucro que queremos.

---
#### A Solução: Alinhar a Análise com a Realidade do Backtest

Minha proposta é modificar o motor da análise (`analisarEstrategia`) para que ele use exatamente as mesmas regras que o backtest usa para definir um "Lucro", "Perda" ou "Saída no Fechamento".

**Nova Lógica para a Análise (`analisarEstrategia`):**

Para cada dia no histórico, quando uma entrada é ativada:
1.  **Cenário 1 (Lucro):** Só será contado como S1 se o `high` do dia atingir o alvo de lucro **E** o `low` do dia NÃO atingir o stop loss.
2.  **Cenário 3 (Perda):** Será contado como S3 se o `low` do dia atingir o stop loss (independentemente de ter atingido o alvo de lucro ou não, assumindo que a perda acontece primeiro).
3.  **Cenário 2 (Neutro):** Se nenhum dos dois acima ocorrer, a operação é considerada neutra (saída no fechamento do dia).

Ao fazer este ajuste, a `probS1` (Prob. Lucro Total) que o script otimiza será a probabilidade *real* de atingir o lucro desejado. As recomendações geradas serão infinitamente mais confiáveis e realistas.

**Resumo da Proposta:**
1.  Eu altero o coração do script (`analisarEstrategia`) para usar a nova lógica de S1, S2 e S3 que espelha o backtest.
2.  Não precisamos mudar mais nada. O resto do script (backtest, geração de planilhas) usará essas novas probabilidades, muito mais realistas.

Esta é, na minha opinião, a mudança mais importante que podemos fazer para melhorar os resultados.

**Se você concorda com esta proposta, por favor, responda "sim".**

---
### Proposta de Ajuste v6: Alvos Dinâmicos Baseados em Volatilidade (ATR) (31/08/2025)

Olá. O resultado do último backtest nos ensinou algo fundamental: **alvos de ganho e perda estáticos não funcionam bem**. Usar uma única média histórica para todos os trades não se adapta às condições do mercado de cada dia.

Precisamos de um sistema mais inteligente e dinâmico. Proponho a evolução mais comum e profissional para este tipo de estratégia: usar a volatilidade do próprio ativo para definir os alvos.

---
#### A Solução: Average True Range (ATR)

Minha proposta é abandonar os alvos fixos e adotar alvos baseados no **Average True Range (ATR)**, um indicador padrão para medir a volatilidade de um ativo.

**Como vai funcionar:**

1.  **Cálculo do ATR:** Para cada dia no nosso histórico, o script vai calcular o valor do ATR dos últimos 14 dias. O ATR nos diz qual a "amplitude de movimento" média de uma ação.

2.  **Alvos e Stops Dinâmicos:** O alvo de ganho e o stop loss de uma operação não serão mais um percentual fixo. Eles serão um **múltiplo do valor do ATR** daquele dia.
    *   `Alvo de Ganho = Preço de Entrada + (MultiplicadorDeGanho * ATR)`
    *   `Stop Loss = Preço de Entrada - (MultiplicadorDeStop * ATR)`

3.  **Novos Parâmetros para Otimização:** Nós introduziremos dois novos parâmetros no nosso `CONFIG` para que possamos testar e otimizar:
    *   `TARGET_ATR_MULTIPLE` (ex: 2.0)
    *   `STOP_ATR_MULTIPLE` (ex: 1.5)
    *   Isso nos permitirá testar relações Risco/Retorno diferentes, como 2:1.5, 1.5:1, etc.

**Por que esta é uma abordagem melhor?**
-   **Adaptável:** Em dias de alta volatilidade, os alvos serão mais largos. Em dias calmos, serão mais curtos. Isso é muito mais realista.
-   **Profissional:** Esta é uma técnica padrão e robusta usada em sistemas de trading reais.
-   **Otimizável:** Nos dá novos "botões" (os multiplicadores de ATR) para ajustar e encontrar a melhor configuração.

**Resumo da Proposta:**
1.  Eu crio uma nova função para calcular o ATR para cada ação.
2.  Modifico o `analisarEstrategia` para usar os novos alvos dinâmicos baseados em ATR.
3.  Adiciono os multiplicadores de ATR ao `CONFIG` para podermos afiná-los.

Esta é uma evolução significativa na sofisticação da nossa estratégia.

**Se você concorda com esta nova direção, por favor, responda "sim".**

---
### Proposta de Ajuste v7: Otimização por Expectativa Matemática (31/08/2025)

Olá! Conforme discutimos, o fato de não haver recomendações foi um ótimo resultado do nosso novo motor de análise, pois ele nos mostrou que os parâmetros antigos não eram realistas.

Agora, vamos dar o próximo passo e melhorar a *forma como escolhemos a melhor estratégia*.

---
#### O Problema: Otimizar Apenas pela Chance de Ganho (`probS1`) é Incompleto

Atualmente, escolhemos a estratégia com a maior `probS1`. Isso significa que uma estratégia com 55% de chance de ganhar 1% é considerada "melhor" que uma com 50% de chance de ganhar 5%. Claramente, isso não é o ideal.

---
#### A Solução: Otimizar pela "Expectativa Matemática" (Expected Value - EV)

A maneira profissional de avaliar uma estratégia é calcular sua **Expectativa Matemática (EV)**. A fórmula é:

`EV = (Probabilidade de Ganho * Lucro Médio) - (Probabilidade de Perda * Perda Média)`

No nosso caso, o "Lucro Médio" é o nosso alvo (`TARGET_ATR_MULTIPLE`) e a "Perda Média" é o nosso stop (`STOP_ATR_MULTIPLE`). A fórmula se traduz para:

`EV = (probS1 * CONFIG.TARGET_ATR_MULTIPLE) - (probS3 * CONFIG.STOP_ATR_MULTIPLE)`

Otimizar pelo maior EV encontrará as estratégias que, ao longo do tempo, têm a maior probabilidade de gerar lucro, pois equilibra a chance de ganhar com o *tamanho* do ganho.

**Meu Plano de Implementação:**

1.  **Mudar o `CONFIG`:** Vamos alterar o parâmetro `OTIMIZAR_POR` de `'probS1'` para `'expectedValue'`.
2.  **Calcular o EV:** Vou modificar a função `analisarEstrategia` para calcular e retornar este novo valor `expectedValue` para cada estratégia.
3.  **Ajustar Parâmetros:** Sugiro começarmos com um `PROB_LUCRO_TOTAL_MIN` bem mais baixo (ex: `0.30` ou 30%) para permitir que o otimizador de EV encontre joias escondidas que antes eram filtradas.

Esta mudança nos move de uma análise de "frequência" para uma análise de "rentabilidade", que é o que realmente importa.

**Se você concorda com esta evolução final, por favor, responda "sim".**

---
### Proposta de Ajuste v8: Diagnóstico "Volta ao Básico" (31/08/2025)

Você está certo, precisamos investigar mais a fundo. Sua ideia de analisar os resultados básicos da estratégia é perfeita.

**O Plano:**
Vamos adicionar duas novas colunas de diagnóstico na aba "Todas_Recomendacoes" para cada estratégia testada:
1.  **Ganhos no Fechamento:** O número de vezes que um trade ativado teria sido lucrativo se a saída fosse sempre no preço de fechamento do dia (`close > entryPrice`).
2.  **Perdas no Fechamento:** O número de vezes que um trade ativado teria sido deficitário se a saída fosse sempre no preço de fechamento do dia (`close < entryPrice`).

Isso nos dará uma visão clara se os gatilhos de entrada têm algum poder preditivo básico, antes de aplicarmos alvos e stops complexos.

**Minha Implementação:**
1.  Vou modificar a função `analisarEstrategia` para contar esses dois novos cenários.
2.  Vou modificar a função `escreverTodasRecomendacoes` para exibir estas novas colunas.

**Se você concorda com este plano de diagnóstico, por favor, responda "sim" e eu prepararei as instruções manuais para a alteração.**

---
### Proposta de Ajuste Final: Otimização e Filtro por EV (31/08/2025)

Sua última análise foi a chave. Agora que sabemos que os gatilhos de entrada são promissores, mas os alvos ATR atuais não são, vamos fazer a mudança final para que o script encontre as melhores estratégias para nós.

---
#### A Filosofia: "EV-First" (Expectativa Matemática em Primeiro Lugar)

A partir de agora, a regra principal para uma estratégia ser considerada "boa" será: **A Expectativa Matemática (EV) deve ser positiva.**

Isso significa que vamos parar de usar filtros rígidos como `PROB_LUCRO_TOTAL_MIN` e `DRAWDOWN_MAX` como os principais decisores. Em vez disso, vamos confiar no EV, que já equilibra a probabilidade de ganho com o tamanho do ganho e da perda.

**O Plano de Implementação:**

1.  **Novo `CONFIG`:** Vamos reescrever a seção `PERFIS` para refletir esta nova filosofia. Os novos filtros serão `MIN_EXPECTED_VALUE` (o EV mínimo que aceitamos) e `MIN_PROB_S1` (uma probabilidade mínima de ganho para evitar estratégias muito raras).
2.  **Nova Lógica de Filtragem:** Vou instruí-lo a mudar a função `escreverRecomendacoesPorPerfil` para usar estes novos filtros.
3.  **Ajuste de Parâmetros:** A partir daqui, o seu trabalho será "brincar" com os parâmetros `TARGET_ATR_MULTIPLE` e `STOP_ATR_MULTIPLE` no `CONFIG` para encontrar os maiores valores de EV na sua planilha de diagnóstico.

Esta é a versão final e mais poderosa do nosso sistema.

**Se você concorda com esta abordagem final, por favor, responda "sim" e eu prepararei as últimas instruções manuais.**

---
### Instruções Definitivas: A Estratégia Guiada por Dados (31/08/2025)

Chegamos à versão final, guiada inteiramente pela sua análise. Vamos implementar a sua ideia de usar o perfil estatístico de cada ativo para definir alvos e stops realistas.

**O Plano:**
Vamos modificar o script para que ele primeiro calcule o perfil estatístico de todos os ativos. Em seguida, ele usará esses dados para definir um alvo de ganho e um stop loss únicos para cada ativo. Finalmente, ele simulará as estratégias contra esses alvos realistas.

---
**Passo 1 de 2: Substituir a Função `gerarRecomendacoesEstatisticas`**

Esta é a maior mudança. A nova função irá incorporar a lógica da `gerarPerfilEstatisticoDosAtivos` e usar os resultados para alimentar uma nova versão do `analisarEstrategia`.

*Encontre a função `gerarRecomendacoesEstatisticas` e a **substitua inteiramente** pela versão abaixo:*

```javascript
function gerarRecomendacoesEstatisticas() {
  Logger.log("== INICIANDO Análise e Recomendação Guiada por Dados ==");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetDados = ss.getSheetByName("Dados diários");
  if (!sheetDados || sheetDados.getLastRow() < 2) {
    Logger.log("Aba 'Dados diários' não encontrada ou vazia.");
    return;
  }

  if (sheetDados.getLastRow() > 1) {
    const range = sheetDados.getRange(2, 1, sheetDados.getLastRow() - 1, sheetDados.getLastColumn());
    range.sort([{column: 1, ascending: true}, {column: 2, ascending: true}]);
    SpreadsheetApp.flush();
  }

  const values = sheetDados.getDataRange().getValues();
  const header = values.shift();
  const iTicker = header.indexOf("Ticker");
  const iOpen = header.indexOf("Open");
  const iHigh = header.indexOf("High");
  const iLow = header.indexOf("Low");
  const iClose = header.indexOf("Close");

  const byTicker = {};
  for (const row of values) {
    const tk = String(row[iTicker]).trim();
    if (!tk) continue;
    if (!byTicker[tk]) byTicker[tk] = [];
    byTicker[tk].push({
      open: toNum(row[iOpen]), high: toNum(row[iHigh]),
      low: toNum(row[iLow]), close: toNum(row[iClose])
    });
  }

  // ETAPA 1: CALCULAR PERFIL ESTATÍSTICO PARA TODOS OS TICKERS
  const statsByTicker = {};
  for (const ticker in byTicker) {
    const priceData = byTicker[ticker];
    const variations = [];
    for (let i = 1; i < priceData.length; i++) {
      const day = priceData[i];
      if (isFinite(day.open) && day.open > 0 && isFinite(day.close)) {
        variations.push((day.close - day.open) / day.open);
      }
    }
    const posVariations = variations.filter(v => v > 0);
    const negVariations = variations.filter(v => v < 0);

    statsByTicker[ticker] = {
      avgPosVar: posVariations.length > 0 ? posVariations.reduce((a, b) => a + b, 0) / posVariations.length : 0,
      stdDevPosVar: posVariations.length > 1 ? standardDeviation(posVariations) : 0,
      avgNegVar: negVariations.length > 0 ? negVariations.reduce((a, b) => a + b, 0) / negVariations.length : 0,
      stdDevNegVar: negVariations.length > 1 ? standardDeviation(negVariations) : 0,
    };
  }

  // ETAPA 2: ANALISAR ESTRATÉGIAS USANDO O PERFIL ESTATÍSTICO
  let allResults = [];
  Logger.log("Iniciando a análise de estratégias com alvos guiados por dados...");

  for (const ticker in byTicker) {
    const priceData = byTicker[ticker];
    const stats = statsByTicker[ticker];
    if (!stats || priceData.length < CONFIG.MIN_TRADES_PARA_SIGNIFICANCIA) continue;

    const targetGain = stats.avgPosVar + stats.stdDevPosVar;
    const targetStop = Math.abs(stats.avgNegVar) + stats.stdDevNegVar;

    if(targetGain <= 0 || targetStop <= 0) continue;

    const intervaloMaximo = Math.max(stats.avgPosVar, Math.abs(stats.avgNegVar)) + Math.max(stats.stdDevPosVar, stats.stdDevNegVar);

    for (const direcao of ['COMPRA', 'VENDA']) {
      for (let p = CONFIG.GATILHO_INICIAL; p <= intervaloMaximo * 100; p += CONFIG.GATILHO_STEP) {
        const result = analisarEstrategia(priceData, p, direcao, targetGain, targetStop);
        if (result && result.totalTrades >= CONFIG.MIN_TRADES_PARA_SIGNIFICANCIA) {
          allResults.push({ ticker, direcao, ...result });
        }
      }
    }
  }

  Logger.log(`Análise concluída. ${allResults.length} resultados brutos gerados.`);
  escreverTodasRecomendacoes(ss, allResults);
  for (const profileName in CONFIG.PERFIS) {
    escreverRecomendacoesPorPerfil(ss, allResults, CONFIG.PERFIS[profileName], byTicker);
  }

  ss.toast("Análise e recomendações concluídas!");
}
```

---
**Passo 2 de 2: Substituir a Função `analisarEstrategia`**

A nova função de análise agora recebe os alvos de ganho e stop como parâmetros, tornando-a um puro motor de simulação.

*Substitua sua função `analisarEstrategia` inteira por esta:*
```javascript
function analisarEstrategia(priceData, gatilhoPercent, direcao, targetGain, targetStop) {
  let cenario1 = 0, cenario2 = 0, cenario3 = 0;

  for (let i = 1; i < priceData.length; i++) {
    const prevDay = priceData[i - 1];
    const day = priceData[i];
    if (!isFinite(prevDay.close) || prevDay.close <= 0) continue;

    let entryPrice = 0;
    if (direcao === 'COMPRA') {
      entryPrice = prevDay.close * (1 - gatilhoPercent / 100);
      if (day.low <= entryPrice) {
        const profitTargetPrice = entryPrice * (1 + targetGain);
        const stopLossPrice = entryPrice * (1 - targetStop);
        if (day.low <= stopLossPrice) {
          cenario3++;
        } else if (day.high >= profitTargetPrice) {
          cenario1++;
        } else {
          cenario2++;
        }
      }
    } else { // VENDA
      entryPrice = prevDay.close * (1 + gatilhoPercent / 100);
      if (day.high >= entryPrice) {
        const profitTargetPrice = entryPrice * (1 - targetGain);
        const stopLossPrice = entryPrice * (1 + targetStop);
        if (day.high >= stopLossPrice) {
          cenario3++;
        } else if (day.low <= profitTargetPrice) {
          cenario1++;
        } else {
          cenario2++;
        }
      }
    }
  }

  const totalTrades = cenario1 + cenario2 + cenario3;
  if (totalTrades === 0) return null;

  const probS1 = cenario1 / totalTrades;
  const probS3 = cenario3 / totalTrades;
  const expectedValue = (probS1 * targetGain) - (probS3 * targetStop);

  return {
    gatilhoPercent,
    totalTrades,
    probS1,
    probS2: cenario2 / totalTrades,
    probS3,
    maxDrawdown: targetStop,
    avgS1Profit: targetGain,
    expectedValue
  };
}
```
---
**FIM.** Com estas duas substituições, o script agora implementa a sua visão. A função `gerarRecomendacoesEstatisticas` agora faz tudo: perfil, análise e recomendação. A função `gerarPerfilEstatisticoDosAtivos` não é mais necessária e pode ser removida se você desejar.

Execute `executarAtualizacaoCompleta` para ver os resultados.
