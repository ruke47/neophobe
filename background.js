var tabStates = {};
var notificationStates = {};
var nextNotificationId = 0;

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    var tabState = getTabState(tabId);
    var tabDomain = domainFor(tab.url);
    if (!tabDomain) {
        // this tab has an extension or something in it
        return;
    }

    if (changeInfo.url) {
        if (tabState.notificationId) {
            chrome.notifications.clear(tabState.notificationId);
        }
        tabState.domain = tabDomain;

        checkForPasswordInput(tabId, function (hasPasswordField) {
            if (hasPasswordField) {
                checkDomainTrust(tabDomain, function (trusted) {
                    if (!trusted) {
                        createNotification(tabId, tabState);
                    }
                });
            }
        });
    }
});

chrome.notifications.onButtonClicked.addListener(function (notificationId, buttonIndex) {
    var notificationState = notificationStates[notificationId];
    if (notificationState) {
        switch (buttonIndex) {
            case 0:
                console.log("User clicked YES for " + notificationState.domain);
                trustDomain(notificationState.domain);
                break;
            case 1:
                console.log("User clicked NO for " + notificationState.domain);
                break;
        }
        chrome.notifications.clear(notificationId, function () {
            notificationStates[notificationId] = null;
        });
    }
});

function getTabState(tabId) {
    if (!tabStates[tabId]) {
        tabStates[tabId] = {
            domain: null,
            notificationId: null
        };
    }

    return tabStates[tabId];
}

function domainFor(url) {
    if (!url.startsWith("http")) {
        return false;
    }
    return url.split('//')[1].split('/')[0];
}

function trustDomain(domain) {
    var kvp = {};
    kvp[domainKeyFor(domain)] = true;
    chrome.storage.sync.set(kvp);
}

function checkDomainTrust(domain, callback) {
    var domainKey = domainKeyFor(domain);
    chrome.storage.sync.get(domainKey, function(result) {
        console.log("Storage Results:", result);
        callback(result[domainKey]);
    });
}

function checkForPasswordInput(tabId, callback) {
    chrome.tabs.executeScript(tabId, {
        code: "document.querySelector(\"input[type='password']\")"
    }, function (results) {
        console.log("Script Results:", results);
        callback(!!results[0]);
    });
}

function domainKeyFor(domain) {
    return "DOMAIN_TRUST_" + domain;
}

function createNotification(tabId, tabState) {
    var currentDomain = tabState.domain;
    chrome.notifications.create("NOTIFY_" + nextNotificationId++, {
        type: "basic",
        title: "Neophobe: New Domain Detected",
        iconUrl: "icon.png",
        message: "You've never given a password to '" + currentDomain + "' before. Do you want to trust it?",
        buttons: [
            {title: "Yes"},
            {title: "I'm not sure..."}
        ],
        requireInteraction: true
    }, function (notificationId) {
        tabState.notificationId = notificationId;
        notificationStates[notificationId] = {
            domain: currentDomain,
            tabId: tabId
        };
    });
}