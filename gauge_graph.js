looker.visualizations.add({
  id: "gauge_chart_custom",
  label: "Gauge Chart com Threshold",
  options: {
    thresholdValue: {
      type: "number",
      label: "Threshold (Limite)",
      default: 800
    },
    maxValue: {
      type: "number",
      label: "Valor Máximo",
      default: 1000
    }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .gauge-container { position: relative; width: 100%; height: 100%; }
        canvas { width: 100% !important; height: 100% !important; }
      </style>
      <div class="gauge-container">
        <canvas id="gaugeChart"></canvas>
      </div>
    `;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    // Limpa erros anteriores
    this.clearErrors();

    // Referência do Canvas
    const canvas = element.querySelector('#gaugeChart');
    const ctx = canvas.getContext('2d');

    // Valores (Pode ser dinâmico vindo do 'data' do Looker ou do 'config')
    const valorAtual = data[0][queryResponse.fields.measure_like[0].name].value || 400; // Pega o primeiro valor da query
    const threshold = config.thresholdValue || 800;
    const maxVal = config.maxValue || 1000;

    // Cálculos de porcentagem
    const percentualAtual = ((valorAtual / maxVal) * 100).toFixed(2);
    const percentualThreshold = ((threshold / maxVal) * 100).toFixed(2);

    // Destruir gráfico existente para evitar sobreposição no Looker
    if (window.myGaugeChart) {
      window.myGaugeChart.destroy();
    }

    // Configuração do Chart.js
    window.myGaugeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [valorAtual, maxVal - valorAtual],
          backgroundColor: [
            valorAtual >= threshold ? '#ff4d4d' : '#8cdb29', // Muda cor se passar do limite
            '#e0e0e0'
          ],
          borderWidth: 0,
          circumference: 180,
          rotation: 270,
          cutout: '75%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: { enabled: false },
          legend: { display: false },
          annotation: {
            annotations: {
              // Texto Central (Valor Atual e %)
              labelAtual: {
                type: 'label',
                xValue: 0,
                yValue: 0,
                content: [`${percentualAtual}%`, `${valorAtual} CPU`],
                font: [
                  { size: 30, weight: 'bold' },
                  { size: 16, color: '#666' }
                ],
                color: valorAtual >= threshold ? '#ff4d4d' : '#8cdb29',
                position: 'center',
                yAdjust: -20
              },
              // Marcação do Threshold (Linha Vertical)
              thresholdLine: {
                type: 'line',
                label: {
                  display: true,
                  content: `Limite: ${percentualThreshold}% (${threshold})`,
                  position: 'end',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  font: { size: 10 }
                },
                // Cálculo do ângulo para o threshold (0 a 180 graus)
                // O doughnut começa em 270 graus, então precisamos mapear
                scaleID: 'x',
                value: 0, // No doughnut o posicionamento por linha exige plugin de geometria ou agulha
                borderColor: 'black',
                borderWidth: 2,
              }
            }
          }
        }
      },
      plugins: [{
        // Plugin customizado para desenhar a agulha/marcador do Threshold
        id: 'thresholdMarker',
        afterDraw: (chart) => {
          const { ctx, chartArea: { width, height } } = chart;
          ctx.save();
          const centerX = width / 2;
          const centerY = chart.getDatasetMeta(0).data[0].y;
          const outerRadius = chart.getDatasetMeta(0).data[0].outerRadius;
          const innerRadius = chart.getDatasetMeta(0).data[0].innerRadius;

          // Ângulo do threshold (mapeando de 0-1000 para 180 graus)
          const angle = Math.PI + (Math.PI * (threshold / maxVal));

          ctx.translate(centerX, centerY);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(innerRadius - 5, 0);
          ctx.lineTo(outerRadius + 5, 0);
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#333';
          ctx.stroke();
          ctx.restore();
        }
      }]
    });

    done();
  }
});