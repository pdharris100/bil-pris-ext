

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    console.log("Sending message to content script");
    chrome.tabs.sendMessage(tabs[0].id, { action: "getDetails" }, function (details) {
        console.log("Details", details);
        var regressionResult = doRegression(details);
        generateChart(details, regressionResult.points);
    });
});

function doRegression(data) {
  let result = regression.exponential(data, {order: 2, precision: 14});
  return result;    
}

function generateChart(data, regressionResult) {
     // this.chart.destroy()
  
    var chart = new Chart(document.getElementById('scatter'), {
      type: 'line',
      data: {
        datasets: [{
          label: 'Sales price',
          type: 'scatter',
          fill: false,
          data: enrichData(data),
          backgroundColor: "rgba(56, 128, 255, .7)",
          borderColor: "transparent"
        },
        {
          label: 'Trend',
          type: 'line',
          fill: false,
          data: enrichData(regressionResult.sort(function(a, b){return a[0] - b[0]})),
          backgroundColor: "rgba(218,83,79, .7)",
          borderColor: "rgba(218,83,79, .7)",
        }]
      },
      options: {
        legend: {
          display: false,
          labels: {
            padding: 30,
            usePointStyle: true
          }
        },
        scales: {
          yAxes: [{
            ticks: {
              callback: function (value, index, values) {
                //return value.toLocaleString();
                if (value==0) return 0;
                return (value/1000) + "K";
              },
              beginAtZero: true,
              },
            scaleLabel: {
              display: true,
              labelString: 'kr',
              padding: 0
            }
          }],
          xAxes: [{
            type: 'time',
            position: 'bottom',
            time: {
              unit: 'year',
              stepSize: 2,
            }
          }]
        }
      }
    })

    function enrichData(data) {
        var result = [];
        for (let index = 0; index < data.length; index++) {
          var element = { x: data[index][0], y: data[index][1] };
          result.push(element);
        }
        return result;
      }
  }


