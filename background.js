let backgroundWorker = {
    content: null,
    
    start: function() {
        chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
            if (message.title === 'foundWorkflows') {
                backgroundWorker.content = message.content;
                chrome.tabs.create({
                    url: `pages/workflows.html`,
                });
            }
        
            if (message.title === 'content') {
                sendResponse(backgroundWorker.content);
            }
        });
    }
}

backgroundWorker.start();