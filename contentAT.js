console.log("Registering listener in content script");
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.action === "getDetails") {
            let cars = callBilBasen();
            sendResponse(cars);
            return true;
        }
    }
);

function callBilBasen() {
    let pageCount = document.getElementsByClassName('paginationMini__count')[0].lastElementChild.innerText;
    console.log("Page Count", pageCount);
    let cars = [];
    if (pageCount < 28) {
        for (i = 1; i <= pageCount; i++) {
            console.log("In loop", i);
            let xhr = new XMLHttpRequest();
            xhr.open("GET", location.href.concat('&page=', i), false);
            xhr.send();
            cars = cars.concat(parseResponse(xhr.responseText, i));
        }
    }
    console.log('cars', cars);
    return cars;
}

function parseResponse(responseText, pageCount) {
    let doc = new DOMParser().parseFromString(responseText, 'text/html');

    let carPrices = doc.getElementsByClassName('advert-card-pricing__price');
    let carTitles = doc.getElementsByClassName('advert-card-details__title');
    let carSpecs = doc.getElementsByClassName('listing-key-specs');

    let cars = [];
    for (var i = 0; i < carPrices.length; i++) {
        try {
            let carPrice = parseInt(carPrices[i].firstElementChild.innerText.split('£')[1].split(',').join(''));

            let spec = carSpecs[i].firstElementChild.innerText.trim();
            let reg = spec.slice(6, 8);
            let [regFirstChar, regSecondChar] = reg.split("");
            if (regFirstChar === undefined || Number.isNaN(regFirstChar)) {
                var carYear = new Date(spec.split(" ")[0]).getTime();
            }
            else {
                if (regFirstChar === "0" || regFirstChar === "5") {
                    var regYear = "200".concat(regSecondChar);
                } else if (regFirstChar === "1" || regFirstChar === "6") {
                    var regYear = "201".concat(regSecondChar);
                } else if (regFirstChar === "2" || regFirstChar === "7") {
                    var regYear = "202".concat(regSecondChar);
                }

                if (parseInt(regFirstChar) < 5) {
                    var regMonthDay = "06-01";
                } else {
                    var regMonthDay = "12-01";
                }

                var carYear = new Date(regYear.concat("-", regMonthDay)).getTime();
            }

            if (Number.isNaN(carPrice) || Number.isNaN(carYear)) {
                continue;
            }

            let carTitle = carTitles[i].innerText.trim();
            let car = { id: parseInt(''.concat(pageCount, i)), title: carTitle, year: carYear, price: carPrice };
            cars.push(car);
        } catch (ex) {
            continue;
        }
    };
    return cars;
}
