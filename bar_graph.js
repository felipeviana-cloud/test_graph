looker.plugins.visualizations.add({
  id: "chartjs_bar_annotation_demo",
  label: "Chart.js Bar + Annotation",
  options: {
    // Opção para controlar a linha de meta quando tiver dados reais
    target_line_value: {
      type: "number",
      label: "Valor da Linha de Meta (Annotation)",
      default: 50,
      section: "Configuração",
      order: 1
    },
    bar_color: {
      type: "string",
      label: "Cor das Barras",
      default: "#36a2eb",
      display: "color",
      section: "Style"
    }
  },

  // 1. Setup inicial e carregamento de dependências em cascata
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .chart-container { position: relative; height: 100%; width: 100%; }
      </style>
      <div class="chart-container">
          <canvas id="myChart"></canvas>
      </div>
    `;

    // Função auxiliar para carregar scripts sequencialmente
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    };

    // Carrega Chart.js V4 e depois o Plugin de Annotation V3
    loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js')
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js'))
      .then(() => {
        console.log("Chart.js e Annotation Plugin carregados!");
        // Registra o plugin globalmente
        if (window.Chart && window['chartjs-plugin-annotation']) {
             // O Chart.js 4+ geralmente auto-registra, mas garantimos aqui
        }
      })
      .catch(err => console.error("Erro ao carregar Chart.js", err));
  },

  // 2. Renderização
  updateAsync: function(data, element, config, queryResponse, details, done) {
    
    // Verifica se a lib já carregou
    if (typeof Chart === "undefined" || typeof window['chartjs-plugin-annotation'] === "undefined") {
      setTimeout(() => { this.updateAsync(data, element, config, queryResponse, details, done) }, 200);
      return;
    }

    this.clearErrors();

    // --- LIMPEZA DO GRÁFICO ANTERIOR ---
    // Chart.js exige destruir a instância antiga antes de criar uma nova no mesmo canvas
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    var ctx = document.getElementById('myChart').getContext('2d');
    
    // --- PREPARAÇÃO DOS DADOS ---
    
    var labels = [];
    var values = [];
    var isDemo = false;
    var targetValue = config.target_line_value || 50;

    var all_fields = queryResponse.fields.dimensions.concat(queryResponse.fields.measures);

    // MODO DEMO: Se não houver 2 campos (1 dim, 1 measure) ou sem dados
    if (all_fields.length < 2 || data.length === 0) {
        isDemo = true;
        
        // Dados estáticos de exemplo (Igual ao link que você mandou)
        labels = ['January', 'February', 'March', 'April', 'May', 'June', 'July'];
        values = [65, 59, 80, 81, 56, 55, 40];
        targetValue = 45; // Valor fixo para o demo

        if (typeof this.addWarning === "function") {
            this.addWarning({
                title: "Modo Demonstração", 
                message: "Selecione 1 Dimensão e 1 Medida para ver seus dados."
            });
        }
    } else {
        // MODO REAL
        var fieldX = all_fields[0].name; // Dimensão
        var fieldY = all_fields[1].name; // Medida

        data.forEach(function(row) {
             labels.push(row[fieldX].value);
             values.push(row[fieldY].value);
        });
    }

    // --- CONFIGURAÇÃO DO CHART.JS ---

    var chartConfig = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: isDemo ? 'Vendas Demo' : (all_fields[1]?.label_short || 'Valor'),
          data: values,
          backgroundColor: isDemo ? 'rgba(255, 99, 132, 0.2)' : (config.bar_color || '#36a2eb'),
          borderColor: isDemo ? 'rgb(255, 99, 132)' : (config.bar_color || '#36a2eb'),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
             display: true,
             position: 'top'
          },
          title: {
            display: true,
            text: isDemo ? 'Chart.js Bar Chart - Demonstração' : ''
          },
          // AQUI ESTÁ A MÁGICA DA ANOTAÇÃO
          annotation: {
            annotations: {
              line1: {
                type: 'line',
                yMin: targetValue,
                yMax: targetValue,
                borderColor: 'rgb(255, 99, 132)',
                borderWidth: 2,
                borderDash: [6, 6], // Linha tracejada
                label: {
                  display: true,
                  content: isDemo ? 'Meta (Demo)' : 'Meta Definida',
                  position: 'end',
                  backgroundColor: 'rgba(255, 99, 132, 0.8)'
                }
              },
              // Exemplo de caixa de destaque (Box Annotation)
              box1: {
                 type: 'box',
                 xMin: -0.5,
                 xMax: 0.5, // Destaca a primeira barra
                 yMin: 0,
                 yMax: values[0], // Altura da primeira barra
                 backgroundColor: 'rgba(255, 99, 132, 0.25)',
                 borderWidth: 0,
                 display: isDemo // Só mostra no demo pra não poluir o real
              }
            }
          }
        },
        scales: {
            y: {
                beginAtZero: true
            }
        }
      }
    };

    // Cria o novo gráfico e salva a instância no objeto 'this' para poder destruir depois
    this.chartInstance = new Chart(ctx, chartConfig);

    done();
  }
});