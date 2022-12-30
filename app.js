var app = {
    start: async function() {

        this.injectScriptFromFile('/libs/dateformat.js');
        this.injectScriptFromFile('mdceutility.js');

        chrome.storage.onChanged.addListener(changes => {
            var settings = changes.settings?.newValue;
            if (settings) {
                this.updateSettings(settings);
            }
        });

        document.addEventListener('mdch.updateSettingsRequest', async () => {
            let data = await chrome.storage.sync.get("settings");
            if(data?.settings) {
                this.updateSettings(data.settings);
            }
            else {
                let settings = {
                    isEnabled: true
                };
                chrome.storage.sync.set({ settings: settings });
            }
        });

        document.addEventListener('mdch.foundWorkflows', async e => {
            chrome.runtime.sendMessage({ title: "foundWorkflows", content: e.detail });
        });
    },

    updateSettings: function(settings) {
        document.dispatchEvent(new CustomEvent('mdch.settings', { detail: settings }));
    },

    injectScriptFromFile: function(fileName) {
        let file = chrome.runtime.getURL(fileName);
        let tag = document.createElement('script');
        tag.setAttribute('type', 'text/javascript');
        tag.setAttribute('src', file);
        
        document.body.appendChild(tag);
    },
};

app.start();