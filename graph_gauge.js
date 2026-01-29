looker.plugins.visualizations.add({
  id: "chartjs_gauge_threshold_demo",
  label: "Chart.js Gauge + Threshold (Demo)",
  options: {
    // Opções simples para editar cores se quiser
    color_fill: {
      type: "string",
      label: "Cor de Preenchimento",
      default: "#36a2eb",
      display: "color"
    },
    threshold_value: {
      type: "number",
      label: "Valor do Threshold",
      default: 800
    }
  },

  // 1. Carregamento das bibliotecas
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .chart-container { position: relative; height: 100%; width: 100%; }
      </style>
      <div class="chart-container">
          <canvas id="gaugeChart"></canvas>
      </div>
    `;

    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    // Carrega Chart.js e Annotation Plugin em sequência
    loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js')
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js'))
      .then(() => { console.log("Chart.js Gauge Libs Loaded"); })
      .catch(err => console.error("Erro libs", err));
  },

  // 2. Renderização
  updateAsync: function(data, element, config, queryResponse, details, done) {
    
    if (typeof Chart === "undefined" || typeof window['chartjs-plugin-annotation'] === "undefined") {
      setTimeout(() => { this.updateAsync(data, element, config, queryResponse, details, done) }, 200);
      return;
    }

    this.clearErrors();
    if (this.chartInstance) { this.chartInstance.destroy(); }

    var ctx = document.getElementById('gaugeChart').getContext('2d');
    
    // --- DEFINIÇÃO DOS VALORES (DEMO) ---
    // Imagina que começa em 0 e vai até 1000
    const MIN = 0;
    const MAX = 1000;
    const ATUAL = 400; // Valor atual
    const THRESHOLD = config.threshold_value || 800; // Ponto de corte

    // Cálculo dos percentuais para o gráfico e textos
    const pctAtual = (ATUAL / MAX) * 100;
    const pctThreshold = (THRESHOLD / MAX) * 100;

    // --- MATEMÁTICA PARA POSICIONAR O THRESHOLD ---
    // O gráfico vai de 180 graus (Esquerda) até 0 graus (Direita) - Meia lua.
    // Precisamos converter o valor do threshold em coordenadas X/Y para a anotação.
    // Ângulo em radianos: PI (esquerda) -> 0 (direita).
    // Fórmula: Angulo = PI - (Percentual * PI)
    const angle = Math.PI - ((THRESHOLD / MAX) * Math.PI);
    
    // Raio: Usamos um raio fictício de 0.85 (dentro da escala -1 a 1) para posicionar a linha
    const radiusInner = 0.60; // Onde começa a linha (perto do furo)
    const radiusOuter = 1.05; // Onde termina a linha (fora do gráfico)
    
    // Coordenadas Polares -> Cartesianas
    // x = r * cos(angle), y = r * sin(angle)
    // Nota: Chart.js gauge começa na esquerda, então ajustamos o X.
    const x1 = Math.cos(angle) * radiusInner;
    const y1 = Math.sin(angle) * radiusInner;
    const x2 = Math.cos(angle) * radiusOuter;
    const y2 = Math.sin(angle) * radiusOuter;

    // --- CONFIGURAÇÃO DO GRÁFICO ---
    var chartConfig = {
      type: 'doughnut',
      data: {
        labels: ["Atual", "Restante"],
        datasets: [{
          data: [ATUAL, MAX - ATUAL], // 400 preenchido, 600 vazio
          backgroundColor: [
            config.color_fill || '#36a2eb', // Azul
            '#e0e0e0' // Cinza claro fundo
          ],
          borderWidth: 0,
          circumference: 180, // Meia volta
          rotation: -90,      // Começa na esquerda (Oeste)
          cutout: '75%'       // Espessura da borda
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 20 },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }, // Desabilita tooltip padrão
          
          // --- ANOTAÇÕES ---
          annotation: {
            annotations: {
              // 1. Linha do Threshold (Vermelha)
              lineThreshold: {
                type: 'line',
                xMin: x1,
                xMax: x2,
                yMin: y1,
                yMax: y2,
                borderColor: 'red',
                borderWidth: 3,
                borderDash: [5, 5]
              },
              // 2. Texto do Threshold ("800 - 80%")
              labelThreshold: {
                type: 'label',
                xValue: x2,
                yValue: y2 + 0.15, // Um pouco acima da linha
                content: [`Meta: ${THRESHOLD}`, `${pctThreshold.toFixed(0)}%`],
                color: 'red',
                font: { size: 11, weight: 'bold' },
                position: 'center'
              },
              // 3. Texto Central Gigante (Percentual Atual)
              labelCenterPercent: {
                type: 'label',
                xValue: 0,
                yValue: 0, // Centro do semi-círculo
                content: `${pctAtual.toFixed(0)}%`,
                font: { size: 40, weight: 'bold' },
                color: '#333',
                position: 'center',
                yAdjust: -10 // Ajuste fino pra subir um pouco
              },
              // 4. Texto Central Pequeno (Valor Absoluto)
              labelCenterValue: {
                type: 'label',
                xValue: 0,
                yValue: 0,
                content: `Valor: ${ATUAL}`,
                font: { size: 14 },
                color: '#666',
                position: 'center',
                yAdjust: 20 // Fica abaixo do percentual
              }
            }
          }
        },
        // --- TRUQUE: ESCALAS INVISÍVEIS ---
        // Para usar anotações X/Y num Doughnut, precisamos fingir que existe um plano cartesiano.
        scales: {
            x: {
                min: -1.2,
                max: 1.2,
                display: false // Esconde os números do eixo
            },
            y: {
                min: -0.2, // Corta a parte de baixo
                max: 1.2,
                display: false // Esconde os números do eixo
            }
        }
      }
    };

    this.chartInstance = new Chart(ctx, chartConfig);
    done();
  }
});