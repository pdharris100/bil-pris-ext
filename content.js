console.log("Registering listener in content script");
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.action === "getDetails") {
            getDetails(request, sender, sendResponse);
            // this is required to use sendResponse asynchronously
            return true;
        }
    }
);

function getDetails(request, sender, sendResponse) {
    let carPriceNodes = document.getElementsByClassName('col-xs-3 listing-price ');
    let cars = [];
    for (var i = 0; i < carPriceNodes.length; i++) {
        let carId = i;
        let carPrice = parseInt(carPriceNodes[i].innerText.split(' ')[0].split('.').join(''));
        let carYear = new Date(carPriceNodes[i].previousElementSibling.innerText.concat('-07')).getTime();
        if (Number.isNaN(carPrice) || Number.isNaN(carYear)) {
            continue;
        }
        let carTitle = carPriceNodes[i].parentElement.parentElement.previousElementSibling.getElementsByClassName("listing-heading darkLink")[0].innerText
        let car = {id: carId, title: carTitle, year: carYear, price: carPrice};
        cars.push(car);
    };
    console.log('cars', cars);
    return sendResponse(cars);
}
