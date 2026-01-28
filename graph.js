looker.plugins.visualizations.add({
  id: "plotly_3d_scatter_demo",
  label: "Plotly 3D (Com Demo)",
  options: {
    marker_size: {
      type: "number",
      label: "Tamanho do Ponto",
      default: 4,
      section: "Style"
    },
    opacity_level: {
      type: "number",
      label: "Opacidade",
      default: 0.7,
      min: 0.1,
      max: 1.0,
      step: 0.1,
      section: "Style"
    }
  },

  // 1. Criação do container e carregamento da biblioteca
  create: function(element, config) {
    element.innerHTML = `
      <style>
        .plotly-graph-div { width: 100%; height: 100%; }
      </style>
      <div id="plotly-chart-container" class="plotly-graph-div">
          <div style="display:flex; height:100%; align-items:center; justify-content:center; color:#999;">
              Carregando Plotly...
          </div>
      </div>
    `;

    // Carrega a biblioteca Plotly v2.x via CDN
    if (typeof Plotly === "undefined") {
      var script = document.createElement("script");
      // Usando uma versão fixa e recente para evitar avisos
      script.src = "https://cdn.plot.ly/plotly-2.27.1.min.js";
      script.async = true;
      script.onload = () => {
          // Limpa a mensagem de carregamento quando o script termina
          var container = document.getElementById('plotly-chart-container');
          if(container) container.innerHTML = "";
      };
      document.head.appendChild(script);
    }
  },

  // 2. Atualização dos dados (Renderização)
  updateAsync: function(data, element, config, queryResponse, details, done) {
    
    // Verifica se Plotly carregou. Se não, tenta de novo em 200ms.
    if (typeof Plotly === "undefined") {
      setTimeout(() => { this.updateAsync(data, element, config, queryResponse, details, done) }, 200);
      return;
    }

    this.clearErrors();
    this.clearWarnings();

    var xData = [], yData = [], zData = [];
    var labelX = "", labelY = "", labelZ = "";
    var isDemoMode = false;

    // --- LÓGICA HÍBRIDA: DADOS REAIS vs DADOS DEMO ---

    var all_fields = queryResponse.fields.dimensions.concat(queryResponse.fields.measures);

    // VERIFICAÇÃO: Se temos menos de 3 campos, ativamos o MODO DEMO
    if (all_fields.length < 3 || data.length === 0) {
        
        isDemoMode = true;
        this.addWarning({
            title: "Modo Demonstração", 
            message: "Nenhum dado selecionado. Exibindo gráfico de exemplo. Selecione 3 campos para ver seus dados."
        });

        labelX = "Eixo X (Exemplo)";
        labelY = "Eixo Y (Exemplo)";
        labelZ = "Eixo Z (Exemplo)";

        // Gerando dados falsos (uma espiral 3D)
        for (var i = 0; i < 200; i++) {
            var t = i / 20;
            xData.push(t * Math.cos(t)); // X = t*cos(t)
            yData.push(t * Math.sin(t)); // Y = t*sin(t)
            zData.push(t);                // Z = t
        }

    } else {
        // MODO DADOS REAIS (Se o usuário selecionou campos)
        labelX = all_fields[0].label_short || all_fields[0].label;
        labelY = all_fields[1].label_short || all_fields[1].label;
        labelZ = all_fields[2].label_short || all_fields[2].label;
        var fieldX = all_fields[0].name;
        var fieldY = all_fields[1].name;
        var fieldZ = all_fields[2].name;

        data.forEach(function(row) {
          // Usa 0 se o valor for nulo para não quebrar o gráfico
          xData.push(row[fieldX].value !== null ? row[fieldX].value : 0);
          yData.push(row[fieldY].value !== null ? row[fieldY].value : 0);
          zData.push(row[fieldZ].value !== null ? row[fieldZ].value : 0);
        });
    }

    // --- PLOTAGEM (Comum para ambos os modos) ---

    // Se for modo demo, usa uma cor diferente
    var markerColor = isDemoMode ? (zData.map(z => z)) : '#1f77b4'; // Gradiente no demo, azul sólido no real
    var colorscale = isDemoMode ? 'Viridis' : null;

    var trace = {
      x: xData,
      y: yData,
      z: zData,
      mode: 'markers',
      type: 'scatter3d',
      marker: {
        size: config.marker_size || 4,
        opacity: config.opacity_level || 0.7,
        color: markerColor,
        colorscale: colorscale,
        line: { color: 'rgba(217, 217, 217, 0.14)', width: 0.5 }
      },
      hovertemplate: 
        `<b>${labelX}:</b> %{x:.2f}<br>` +
        `<b>${labelY}:</b> %{y:.2f}<br>` +
        `<b>${labelZ}:</b> %{z:.2f}<extra></extra>`
    };

    var layout = {
      margin: { l: 0, r: 0, b: 0, t: 30 },
      title: isDemoMode ? "Gráfico 3D de Exemplo (Espiral)" : "",
      scene: {
        xaxis: { title: labelX },
        yaxis: { title: labelY },
        zaxis: { title: labelZ },
        camera: { eye: {x: 1.5, y: 1.5, z: 1.5} } // Ajusta a câmera inicial
      },
      autosize: true,
      paper_bgcolor: 'rgba(0,0,0,0)', // Fundo transparente para integrar melhor ao Looker
      plot_bgcolor: 'rgba(0,0,0,0)'
    };
    
    // Configuração para a barra de ferramentas do Plotly
    var configPlotly = { 
        responsive: true, 
        displayModeBar: true,
        displaylogo: false, // Remove o logo do Plotly da barra
        modeBarButtonsToRemove: ['toImage', 'sendDataToCloud']
    };

    // Renderiza o gráfico no elemento principal
    var chartContainer = document.getElementById('plotly-chart-container');
    // Garante que o container existe antes de plotar
    if (chartContainer) {
        Plotly.newPlot(chartContainer, [trace], layout, configPlotly);
    }
    
    done();
  }
});