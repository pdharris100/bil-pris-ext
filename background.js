chrome.cookies.onChanged.addListener(
    function (changeInfo) {
        let pageSize = "1000";
        if (!changeInfo.removed && changeInfo.cookie.name === 'PageSize'  && changeInfo.cookie.value.localeCompare(pageSize) != 0) {
            console.log("Cookie", changeInfo.cookie);
            let cookie = changeInfo.cookie;
            delete cookie.hostOnly;
            delete cookie.session;
            cookie.value = pageSize;
            cookie.url = "https://www.bilbasen.dk";
            chrome.cookies.set(cookie);
        }
    }
);