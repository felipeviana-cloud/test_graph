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

    this.clearErrors(); // Limpa erros antigos antes de começar
    if (this.chartInstance) { this.chartInstance.destroy(); }

    var ctx = document.getElementById('myChart').getContext('2d');
    
    var labels = [];
    var datasets = [];
    var annotationsConfig = {};
    
    var all_dims = queryResponse.fields.dimensions;
    var all_measures = queryResponse.fields.measures;

    // --- LÓGICA DE DADOS ---
    
    // Se não houver dimensões, não podemos desenhar o gráfico real corretamente.
    if (data.length === 0 || all_dims.length === 0 || config.show_demo) {
        
        // Se for falta de dimensão (e não apenas modo Demo forçado), avisa o usuário usando addError
        if (!config.show_demo && all_dims.length === 0 && all_measures.length > 0) {
            this.addError({
                title: "Dados Incompletos", 
                message: "Este gráfico precisa de 1 Dimensão (Eixo X) e pelo menos 1 Medida (Eixo Y)."
            });
            done(); // Encerra a execução aqui para não desenhar gráfico quebrado
            return;
        }

        // --- MODO DEMO ---
        labels = ['Label 0', 'Label 1', 'Label 2', 'Label 3', 'Label 4', 'Label 5', 'Label 6', 'Label 7'];
        
        datasets = [
            {
                label: 'Dataset 1 (Demo)',
                data: [58, 92, 45, 65, 45, 88, 31, 28],
                backgroundColor: 'rgba(54, 162, 235, 0.5)', 
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            },
            {
                label: 'Dataset 2 (Demo)',
                data: [20, 76, 70, 52, 51, 20, 32, 75],
                backgroundColor: 'rgba(255, 99, 132, 0.5)', 
                borderColor: 'rgb(255, 99, 132)',
                borderWidth: 1
            },
            {
                label: 'Dataset 3 (Demo)',
                data: [90, 82, 87, 40, 51, 29, 78, 59],
                backgroundColor: 'rgba(255, 205, 86, 0.5)', 
                borderColor: 'rgb(255, 205, 86)',
                borderWidth: 1
            }
        ];

        annotationsConfig = {
            line1: {
                type: 'line',
                xMin: 0.5,
                xMax: 0.5,
                borderColor: 'black',
                borderWidth: 2,
                label: { display: true, content: 'Line annotation at x=0.5', position: 'center', backgroundColor: 'rgba(0,0,0,0.8)', color: 'white' }
            },
            line2: {
                type: 'line',
                xMin: 5,
                xMax: 5,
                borderColor: 'black',
                borderWidth: 2,
                label: { display: true, content: 'Line at x = Label 5', rotation: 90, position: 'start', backgroundColor: 'black', color: 'white' }
            },
            box1: {
                type: 'box',
                xMin: 2.5,
                xMax: 3.5,
                yMin: 0,
                yMax: 100, 
                backgroundColor: 'rgba(255, 255, 0, 0.25)',
                borderWidth: 0
            }
        };

    } else {
        // --- MODO REAL ---
        
        // Seguro acessar [0] pois já validamos all_dims.length > 0
        var dimName = all_dims[0].name; 
        
        data.forEach(row => {
            let val = row[dimName].value;
            labels.push(val !== null && val !== undefined ? val : "Null"); 
        });

        var colors = ['rgba(54, 162, 235, 0.6)', 'rgba(255, 99, 132, 0.6)', 'rgba(255, 205, 86, 0.6)', 'rgba(75, 192, 192, 0.6)'];
        var borderColors = ['rgb(54, 162, 235)', 'rgb(255, 99, 132)', 'rgb(255, 205, 86)', 'rgb(75, 192, 192)'];
        
        all_measures.forEach((measure, index) => {
            var dsData = data.map(row => row[measure.name].value);
            datasets.push({
                label: measure.label_short || measure.label,
                data: dsData,
                backgroundColor: colors[index % colors.length],
                borderColor: borderColors[index % borderColors.length],
                borderWidth: 1
            });
        });

        // Configurações do usuário
        var boxStart = isNaN(config.annotation_box_start) ? config.annotation_box_start : parseFloat(config.annotation_box_start);
        var boxEnd = isNaN(config.annotation_box_end) ? config.annotation_box_end : parseFloat(config.annotation_box_end);
        var lineX = isNaN(config.annotation_line_x) ? config.annotation_line_x : parseFloat(config.annotation_line_x);

        annotationsConfig = {
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
            annotations: annotationsConfig
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