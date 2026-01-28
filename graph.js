looker.plugins.visualizations.add({
  // Metadados da visualização
  id: "plotly_3d_scatter",
  label: "Plotly 3D Scatter",
  options: {
    // Opção para controlar o tamanho do ponto, por exemplo
    marker_size: {
      type: "number",
      label: "Marker Size",
      default: 5,
      section: "Style"
    }
  },

  // Configuração inicial (carrega a biblioteca Plotly)
  create: function(element, config) {
    element.innerHTML = "";
    
    // Cria um container para o gráfico
    var container = element.appendChild(document.createElement("div"));
    container.id = "plotly-container";
    container.style.width = "100%";
    container.style.height = "100%";

    // Carrega o Plotly via CDN se ainda não estiver carregado
    if (typeof Plotly === "undefined") {
      var script = document.createElement("script");
      script.src = "https://cdn.plot.ly/plotly-latest.min.js";
      script.async = true;
      script.onload = () => { this.chart = true; }; // Flag para indicar carregamento
      document.head.appendChild(script);
    }
  },

  // Renderização (chamada sempre que os dados mudam)
  updateAsync: function(data, element, config, queryResponse, details, done) {
    
    // Verifica se o Plotly carregou e se há dados
    if (typeof Plotly === "undefined" || !data.length) {
      if(details.print == false) { // Se não for PDF, espera um pouco e tenta de novo
         setTimeout(() => { this.updateAsync(data, element, config, queryResponse, details, done) }, 100);
      }
      return;
    }

    // Verifica erros nos dados
    this.clearErrors();
    if (queryResponse.fields.dimensions.length < 3) {
      this.addError({title: "Dados Insuficientes", message: "Este gráfico requer 3 dimensões/medidas (X, Y, Z)."});
      return;
    }

    // 1. TRANSFORMAÇÃO DE DADOS (Looker JSON -> Plotly Arrays)
    // O Looker manda um array de objetos. O Plotly quer arrays separados para X, Y, Z.
    
    // Pega os nomes das colunas (fields)
    var dimX = queryResponse.fields.dimensions[0].name;
    var dimY = queryResponse.fields.dimensions[1].name;
    var dimZ = queryResponse.fields.dimensions[2].name; // Ou pode ser uma measure

    var xData = [], yData = [], zData = [];

    // Itera sobre o JSON do Looker e preenche os arrays
    data.forEach(function(row) {
      xData.push(row[dimX].value);
      yData.push(row[dimY].value);
      zData.push(row[dimZ].value);
    });

    // 2. CONFIGURAÇÃO DO PLOTLY (Baseado no seu link)
    var trace1 = {
      x: xData,
      y: yData,
      z: zData,
      mode: 'markers',
      marker: {
        size: config.marker_size || 5,
        line: {
          color: 'rgba(217, 217, 217, 0.14)',
          width: 0.5
        },
        opacity: 0.8
      },
      type: 'scatter3d'
    };

    var plotData = [trace1];

    var layout = {
      margin: { l: 0, r: 0, b: 0, t: 0 },
      scene: {
        xaxis: { title: queryResponse.fields.dimensions[0].label_short },
        yaxis: { title: queryResponse.fields.dimensions[1].label_short },
        zaxis: { title: queryResponse.fields.dimensions[2].label_short },
      }
    };

    // 3. PLOTAGEM
    Plotly.newPlot('plotly-container', plotData, layout);

    // Avisa o Looker que terminou de renderizar
    done();
  }
});