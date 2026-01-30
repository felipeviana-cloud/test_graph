looker.plugins.visualizations.add({
  id: "plotly_3d_surface_demo",
  label: "Plotly 3D Surface (Com Demo)",
  options: {
    color_scale: {
      type: "string",
      label: "Esquema de Cores",
      display: "select",
      values: [
        {"Padrão (Viridis)": "Viridis"},
        {"Arco-íris (Jet)": "Jet"},
        {"Quente (Hot)": "Hot"},
        {"Frio (YlGnBu)": "YlGnBu"},
        {"Terreno (Earth)": "Earth"}
      ],
      default: "Viridis",
      section: "Style"
    },
    show_contours: {
        type: "boolean",
        label: "Mostrar Contornos na Base",
        default: true,
        section: "Style"
    }
  },

  // --- FUNÇÃO AUXILIAR: Transforma dados tabulares do Looker em Matriz para Superfície ---
  // O Plotly 'surface' precisa de uma grade (matriz Z). O Looker manda uma lista de linhas.
  // Essa função pega os dados e os "pivota" para criar essa grade.
  pivotDataForSurface: function(data, fieldX, fieldY, fieldZ) {
    // 1. Pega valores únicos e ordenados para os eixos X e Y
    let xSet = new Set();
    let ySet = new Set();
    data.forEach(row => {
        if(row[fieldX].value !== null) xSet.add(row[fieldX].value);
        if(row[fieldY].value !== null) ySet.add(row[fieldY].value);
    });
    let xValues = Array.from(xSet).sort((a, b) => a - b);
    let yValues = Array.from(ySet).sort((a, b) => a - b);

    // Se não tiver dados suficientes para formar uma grade mínima
    if (xValues.length < 2 || yValues.length < 2) return null;

    // 2. Cria um mapa para acesso rápido aos valores de Z
    let zMap = {};
    data.forEach(row => {
        let x = row[fieldX].value;
        let y = row[fieldY].value;
        // Armazena Z na chave "x|y"
        if(x !== null && y !== null) zMap[`${x}|${y}`] = row[fieldZ].value;
    });

    // 3. Constrói a Matriz Z (onde Z[linha_y][coluna_x] é o valor)
    let zMatrix = [];
    for (let yVal of yValues) {
        let zRow = [];
        for (let xVal of xValues) {
            // Pega o valor do mapa. Se não existir, usa null (Plotly lida com buracos)
            let val = zMap[`${xVal}|${yVal}`];
            zRow.push(val !== undefined ? val : null);
        }
        zMatrix.push(zRow);
    }

    return { x: xValues, y: yValues, z: zMatrix };
  },
  // ------------------------------------------------------------------------------------


  // 1. Criação do container e carregamento da biblioteca
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .plotly-graph-div { width: 100%; height: 100%; }
      </style>
      <div id="plotly-surface-container" class="plotly-graph-div">
          <div style="display:flex; height:100%; align-items:center; justify-content:center; color:#999;">
              Carregando Plotly Surface...
          </div>
      </div>
    `;

    if (typeof Plotly === "undefined") {
      var script = document.createElement("script");
      script.src = "https://cdn.plot.ly/plotly-2.27.1.min.js";
      script.async = true;
      script.onload = () => { console.log("Plotly v2 carregado."); };
      document.head.appendChild(script);
    }
  },

  // 2. Atualização dos dados (Renderização)
  updateAsync: function(data, element, config, queryResponse, details, done) {
    
    if (typeof Plotly === "undefined") {
      setTimeout(() => { this.updateAsync(data, element, config, queryResponse, details, done) }, 200);
      return;
    }

    this.clearErrors();
    // this.clearWarnings(); // Mantido comentado por segurança

    var xData = [], yData = [], zData = []; // zData será uma matriz (array de arrays)
    var labelX = "", labelY = "", labelZ = "";
    var isDemoMode = false;

    var all_fields = queryResponse.fields.dimensions.concat(queryResponse.fields.measures);

    // --- LÓGICA HÍBRIDA ---

    // Se temos menos de 3 campos OU não há dados, ativamos o MODO DEMO
    if (all_fields.length < 3 || data.length === 0) {
        
        isDemoMode = true;
        if (typeof this.addWarning === "function") this.addWarning({title: "Modo Demo", message: "Mostrando superfície de exemplo. Selecione 2 Dimensões (X, Y) e 1 Medida (Z)."});

        labelX = "Eixo X (Demo)";
        labelY = "Eixo Y (Demo)";
        labelZ = "Eixo Z (Demo)";

        // --- GERAÇÃO DE DADOS DEMO (Função matemática estilo "sela") ---
        let gridSize = 50; // Define a resolução da grade
        let range = 3;     // Vai de -3 a +3
        
        // Gera os valores dos eixos X e Y
        for (let i = 0; i < gridSize; i++) {
            let val = -range + (2 * range * i / (gridSize - 1));
            xData.push(val);
            yData.push(val);
        }

        // Gera a matriz Z usando a função: z = cos(x) * sin(y) + cos(x/2)
        // Essa função cria ondas que se cruzam, similar à imagem de referência.
        for (let j = 0; j < gridSize; j++) { // Loop Y (linhas)
            let zRow = [];
            for (let i = 0; i < gridSize; i++) { // Loop X (colunas)
                let x = xData[i];
                let y = yData[j];
                let zVal = Math.cos(x) * Math.sin(y) + Math.cos(x/1.5); // Função matemática
                zRow.push(zVal);
            }
            zData.push(zRow);
        }

    } else {
        // MODO DADOS REAIS
        labelX = all_fields[0].label_short || all_fields[0].label;
        labelY = all_fields[1].label_short || all_fields[1].label;
        labelZ = all_fields[2].label_short || all_fields[2].label;

        // Tenta transformar os dados tabulares em uma matriz de superfície
        let surfaceData = this.pivotDataForSurface(data, all_fields[0].name, all_fields[1].name, all_fields[2].name);

        if (surfaceData) {
            xData = surfaceData.x;
            yData = surfaceData.y;
            zData = surfaceData.z;
        } else {
            // Se não conseguiu criar a grade (ex: só tem 1 ponto de X), mostra erro.
            this.addError({title: "Dados Incompatíveis", message: "Para um gráfico de superfície, você precisa de uma grade de dados (vários valores de X cruzados com vários valores de Y)."});
            done();
            return;
        }
    }

    // --- PLOTAGEM (TIPO SURFACE) ---

    var trace = {
      x: xData, // Array de valores únicos de X
      y: yData, // Array de valores únicos de Y
      z: zData, // Matriz 2D de valores Z
      type: 'surface', // <--- MUDANÇA PRINCIPAL
      colorscale: config.color_scale || 'Viridis',
      contours: {
        z: {
          show: config.show_contours, // Mostra linhas de contorno
          usecolormap: true, // Usa a mesma cor do gráfico
          project: { z: true } // Projeta os contornos na base ("chão") do gráfico
        }
      },
      hovertemplate: 
        `<b>${labelX}:</b> %{x:.2f}<br>` +
        `<b>${labelY}:</b> %{y:.2f}<br>` +
        `<b>${labelZ}:</b> %{z:.2f}<extra></extra>`
    };

    var layout = {
      margin: { l: 0, r: 0, b: 0, t: 30 },
      title: isDemoMode ? "Superfície de Exemplo (cos(x)sin(y))" : "",
      scene: {
        xaxis: { title: labelX },
        yaxis: { title: labelY },
        zaxis: { title: labelZ },
        camera: { eye: {x: 1.5, y: 1.5, z: 1.2} } // Câmera um pouco mais alta
      },
      autosize: true,
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)'
    };
    
    var configPlotly = { 
        responsive: true, 
        displayModeBar: true,
        displaylogo: false
    };

    var chartContainer = document.getElementById('plotly-surface-container');
    if (chartContainer) {
        chartContainer.innerHTML = ""; 
        Plotly.newPlot(chartContainer, [trace], layout, configPlotly);
    }
    
    done();
  }
});