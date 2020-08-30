var extrapolationYears;
var cars;
var regressionPoints;
var chart;

document.addEventListener('DOMContentLoaded', function () {
  chrome.storage.sync.get(['years'], function (result) {
    console.log("Stored years", result.years);
    if (result.years) {
      extrapolationYears = result.years;
    } else {
      extrapolationYears = 3;
    }
    document.querySelector('#years').options.selectedIndex = extrapolationYears;
  });
  document.querySelector('#years').addEventListener('change', changeHandler);
});

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  console.log("Sending message to content script");
  chrome.tabs.sendMessage(tabs[0].id, { action: "getDetails" }, function (response) {
    cars = response;
    execute();
  });
});

function changeHandler(e) {
  extrapolationYears = e.srcElement.options.selectedIndex
  chrome.storage.sync.set({ 'years': extrapolationYears });
  execute();
}

function execute() {
  console.log("Cars", cars);
  doRegression();
  console.log("DataOut", regressionPoints);
  generateChart();
}

function doRegression() {
  let data = [];
  for (car of cars) {
    data.push([car.year, car.price]);
  };
  let regressionResult = regression.exponential(data, { order: 2, precision: 14 });
  data = data.sort(function (a, b) { return a[0] - b[0] });
  regressionPoints = [];
  let init = new Date(data[0][0]).getUTCFullYear() - extrapolationYears;
  let fin = Math.min(new Date().getUTCFullYear(), (new Date(data[data.length - 1][0]).getUTCFullYear() + extrapolationYears));
  for (let i = init; i <= fin; i++) {
    let year = new Date(i.toString());
    let point = regressionResult.predict(year.getTime());
    regressionPoints.push(point);
  }
}

function generateChart() {
  if (chart) { chart.destroy(); }
  chart = new Chart(document.getElementById('scatter'), {
    type: 'line',
    data: {
      datasets: [{
        label: 'Asking price',
        type: 'scatter',
        fill: false,
        data: buildScatterData(),
        backgroundColor: "rgba(56, 128, 255, .7)",
        borderColor: "transparent"
      },
      {
        label: 'Trend',
        type: 'line',
        fill: false,
        data: enrichRegressionPoints(),
        backgroundColor: "rgba(218,83,79, .7)",
        borderColor: "rgba(218,83,79, .7)",
      }]
    },
    options: {
      tooltips: {
        callbacks: {
          title: function (tooltipItem, data) {
            carIndex = tooltipItem[0].index;
            return cars[carIndex].title;
          }
        }
      },
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
              if (value == 0) return 0;
              return (value / 1000) + "K";
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
  });
  chart.canvas.onclick = function (event) {
    let firstPoint = chart.getElementAtEvent(event)[0];
    if (firstPoint && firstPoint._datasetIndex === 0) {
      let value = chart.data.datasets[firstPoint._datasetIndex].data[firstPoint._index];
      cars.splice(cars.findIndex(function (i) {
        return i.id === value.id;
      }), 1);
      execute();
    }
  }
}

function enrichRegressionPoints() {
  let result = [];
  for (let index = 0; index < regressionPoints.length; index++) {
    var element = { x: regressionPoints[index][0], y: regressionPoints[index][1] };
    result.push(element);
  }
  return result;
}

function buildScatterData() {
  for (car of cars) {
    car.x = car.year;
    car.y = car.price;
  }
  return cars;
}





