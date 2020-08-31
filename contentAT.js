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
        let carId = i;
        let carPrice = parseInt(carPrices[i].firstElementChild.innerText.split('£')[1].split(',').join(''));
        let carYear = new Date(carSpecs[i].firstElementChild.innerText.split(" ")[0]).getTime();
        if (Number.isNaN(carPrice) || Number.isNaN(carYear)) {
            continue;
        }
        let carTitle = carTitles[i].innerText.trim();
        let car = { id: parseInt(''.concat(pageCount, carId)), title: carTitle, year: carYear, price: carPrice };
        cars.push(car);
    };
    return cars;
}
