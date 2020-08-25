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
    console.log("Scraping content");
    let carPriceNodes = document.getElementsByClassName('col-xs-3 listing-price ');
    console.log('Car prices', carPriceNodes);
    let cars = [];
    for (var i = 0; i < carPriceNodes.length; i++) {
        let carPrice = parseInt(carPriceNodes[i].innerText.split(' ')[0].split('.').join(''));
        let carYear = new Date(carPriceNodes[i].previousElementSibling.innerText).getTime();
        let car = [carYear, carPrice];
        cars.push(car);
    };
    console.log('Cars', cars);
    return sendResponse(cars);
}
