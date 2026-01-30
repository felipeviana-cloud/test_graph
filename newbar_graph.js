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
    
    // Verifica se tem dados suficientes
    var all_dims = queryResponse.fields.dimensions;
    var all_measures = queryResponse.fields.measures;

    // CORREÇÃO AQUI: 
    // Alterado para verificar se NÃO há dimensões (all_dims.length === 0).
    // Se não tiver dimensão, não conseguimos gerar o eixo X, então forçamos o modo Demo ou return.
    if (data.length === 0 || all_dims.length === 0 || config.show_demo) {
        
        // --- DADOS IDÊNTICOS À SUA IMAGEM (DEMO) ---
        labels = ['Label 0', 'Label 1', 'Label 2', 'Label 3', 'Label 4', 'Label 5', 'Label 6', 'Label 7'];
        
        datasets = [
            {
                label: 'Dataset 1',
                data: [58, 92, 45, 65, 45, 88, 31, 28],
                backgroundColor: 'rgba(54, 162, 235, 0.5)', 
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            },
            {
                label: 'Dataset 2',
                data: [20, 76, 70, 52, 51, 20, 32, 75],
                backgroundColor: 'rgba(255, 99, 132, 0.5)', 
                borderColor: 'rgb(255, 99, 132)',
                borderWidth: 1
            },
            {
                label: 'Dataset 3',
                data: [90, 82, 87, 40, 51, 29, 78, 59],
                backgroundColor: 'rgba(255, 205, 86, 0.5)', 
                borderColor: 'rgb(255, 205, 86)',
                borderWidth: 1
            }
        ];

        var annotationsDemo = {
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
        
        // Só mostra aviso se não for apenas o carregamento inicial vazio
        if (data.length === 0 && all_dims.length > 0) {
            // Caso de query vazia
        } else if (all_dims.length === 0 && all_measures.length > 0) {
             if (typeof this.addWarning === "function") {
                 this.addWarning({title: "Dados Incompletos", message: "Selecione pelo menos 1 Dimensão."});
             }
        }

    } else {
        // --- MODO REAL (SEUS DADOS DO LOOKER) ---
        
        // 1. Popula Labels (Eixo X)
        // AGORA SEGURO: Sabemos que all_dims[0] existe por causa do if acima
        var dimName = all_dims[0].name; 
        
        data.forEach(row => {
            // Verifica se o valor existe para evitar erros de null
            let val = row[dimName].value;
            labels.push(val ? val : "Null"); 
        });

        // 2. Cria um Dataset para CADA Medida selecionada
        var colors = ['rgba(54, 162, 235, 0.6)', 'rgba(255, 99, 132, 0.6)', 'rgba(255, 205, 86, 0.6)', 'rgba(75, 192, 192, 0.6)'];
        
        all_measures.forEach((measure, index) => {
            var dsData = data.map(row => row[measure.name].value);
            datasets.push({
                label: measure.label_short || measure.label,
                data: dsData,
                backgroundColor: colors[index % colors.length],
                borderWidth: 1
            });
        });

        // Configura anotações
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
            annotations: annotationsDemo
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