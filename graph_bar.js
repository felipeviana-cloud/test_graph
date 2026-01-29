looker.plugins.visualizations.add({
  id: "chartjs_box_annotation_v2",
  label: "Chart.js Bar + Box Annotation",
  options: {
    // --- OPÇÕES PARA O USUÁRIO CONTROLAR A ANOTAÇÃO ---
    annotation_box_start: {
      type: "string",
      label: "Box Start (Categoria/Index)",
      default: "2.5",
      section: "Annotations",
      order: 1
    },
    annotation_box_end: {
      type: "string",
      label: "Box End (Categoria/Index)",
      default: "3.5",
      section: "Annotations",
      order: 2
    },
    annotation_line_x: {
      type: "string",
      label: "Vertical Line X (Categoria/Index)",
      default: "0.5",
      section: "Annotations",
      order: 3
    },
    show_demo: {
      type: "boolean",
      label: "Forçar Demo Mode",
      default: false,
      section: "Dev"
    }
  },

  // 1. Setup e Carregamento
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .chart-container { position: relative; height: 100%; width: 100%; }
      </style>
      <div class="chart-container">
          <canvas id="myChart"></canvas>
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

    // Carrega Chart.js e o Plugin
    loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js')
      .then(() => loadScript('https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js'))
      .then(() => { console.log("Libs Carregadas"); })
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

    var ctx = document.getElementById('myChart').getContext('2d');
    
    // --- LOGICA: DEMO vs DADOS REAIS ---
    
    var labels = [];
    var datasets = [];
    var isDemo = false;
    
    // Verifica se tem dados suficientes (1 Dimensão + N Medidas)
    var all_dims = queryResponse.fields.dimensions;
    var all_measures = queryResponse.fields.measures;

    // Se não tiver dados ou o usuário forçar o Demo
    if (data.length === 0 || (all_dims.length === 0 && all_measures.length === 0) || config.show_demo) {
        isDemo = true;
        
        // --- DADOS IDÊNTICOS À SUA IMAGEM (DEMO) ---
        labels = ['Label 0', 'Label 1', 'Label 2', 'Label 3', 'Label 4', 'Label 5', 'Label 6', 'Label 7'];
        
        // Simulando 3 séries de dados
        datasets = [
            {
                label: 'Dataset 1',
                data: [58, 92, 45, 65, 45, 88, 31, 28],
                backgroundColor: 'rgba(54, 162, 235, 0.5)', // Azul
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            },
            {
                label: 'Dataset 2',
                data: [20, 76, 70, 52, 51, 20, 32, 75],
                backgroundColor: 'rgba(255, 99, 132, 0.5)', // Rosa
                borderColor: 'rgb(255, 99, 132)',
                borderWidth: 1
            },
            {
                label: 'Dataset 3',
                data: [90, 82, 87, 40, 51, 29, 78, 59],
                backgroundColor: 'rgba(255, 205, 86, 0.5)', // Laranja
                borderColor: 'rgb(255, 205, 86)',
                borderWidth: 1
            }
        ];

        // Configuração Hardcoded para ficar IGUAL à imagem
        var annotationsDemo = {
            // Linha Vertical 1
            line1: {
                type: 'line',
                xMin: 0.5,
                xMax: 0.5,
                borderColor: 'black',
                borderWidth: 2,
                label: {
                    display: true,
                    content: 'Line annotation at x=0.5',
                    position: 'center',
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    color: 'white'
                }
            },
            // Linha Vertical 2 (Na Label 5)
            line2: {
                type: 'line',
                xMin: 5, // Index da Label 5
                xMax: 5,
                borderColor: 'black',
                borderWidth: 2,
                label: {
                    display: true,
                    content: 'Line at x = Label 5',
                    rotation: 90,
                    position: 'start',
                    backgroundColor: 'black',
                    color: 'white'
                }
            },
            // CAIXA AMARELA (BOX)
            box1: {
                type: 'box',
                xMin: 2.5, // Começa depois da Label 2
                xMax: 3.5, // Termina depois da Label 3
                yMin: 0,
                yMax: 100, // Altura total
                backgroundColor: 'rgba(255, 255, 0, 0.25)', // Amarelo Transparente
                borderWidth: 0
            }
        };

        if (typeof this.addWarning === "function") {
             this.addWarning({title: "Modo Demo", message: "Mostrando gráfico de exemplo igual à imagem solicitada."});
        }

    } else {
        // --- MODO REAL (SEUS DADOS DO LOOKER) ---
        
        // 1. Popula Labels (Eixo X)
        var dimName = all_dims[0].name;
        data.forEach(row => {
            labels.push(row[dimName].value);
        });

        // 2. Cria um Dataset para CADA Medida selecionada
        var colors = ['rgba(54, 162, 235, 0.6)', 'rgba(255, 99, 132, 0.6)', 'rgba(255, 205, 86, 0.6)', 'rgba(75, 192, 192, 0.6)'];
        
        all_measures.forEach((measure, index) => {
            var dsData = data.map(row => row[measure.name].value);
            datasets.push({
                label: measure.label_short || measure.label,
                data: dsData,
                backgroundColor: colors[index % colors.length], // Cicla cores
                borderWidth: 1
            });
        });

        // Configura anotações baseadas no Menu do Looker (Options)
        // O usuário digita "2.5" ou o nome da categoria
        var boxStart = isNaN(config.annotation_box_start) ? config.annotation_box_start : parseFloat(config.annotation_box_start);
        var boxEnd = isNaN(config.annotation_box_end) ? config.annotation_box_end : parseFloat(config.annotation_box_end);
        var lineX = isNaN(config.annotation_line_x) ? config.annotation_line_x : parseFloat(config.annotation_line_x);

        var annotationsDemo = {
            userBox: {
                type: 'box',
                xMin: boxStart,
                xMax: boxEnd,
                backgroundColor: 'rgba(255, 255, 0, 0.25)',
                borderWidth: 0
            },
            userLine: {
                type: 'line',
                scaleID: 'x',
                value: lineX,
                borderColor: 'black',
                borderWidth: 2,
                label: {
                    display: true,
                    content: 'Alvo',
                    backgroundColor: 'black',
                    color: 'white'
                }
            }
        };
    }

    // --- RENDERIZAÇÃO FINAL ---

    var chartConfig = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true },
          annotation: {
            annotations: annotationsDemo // Usa o objeto de anotações que criamos acima
          }
        },
        scales: {
            y: { beginAtZero: true }
        }
      }
    };

    this.chartInstance = new Chart(ctx, chartConfig);
    done();
  }
});