(async function() {
    let data = await chrome.storage.sync.get("settings");
    
    document.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener("change", async event => {
            let data = await chrome.storage.sync.get("settings");
            let settings = !!data?.settings ? data.settings : {};
            settings[event.target.name] = event.target.checked;
            chrome.storage.sync.set({ settings: settings });

            //if(event.target.name == "showRecordInfo" && event.target.checked == false) {
            //    
            //}
        });

        cb.checked = !!data?.settings && data.settings[cb.name] === true;
    });

    this.executeFunction = function(id, func) {
        let btn = document.getElementById(id);
        btn.addEventListener("click", async () => {
            let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: func,
                world: "MAIN"
            });
        });    
    }

    this.executeFunction("searchWorkflows", function() {
        commands.searchWorkflows();
    });

    this.executeFunction("showSubjects", function() {
        commands.showSubjects();
    });

    var submitIssueA = document.getElementById('submitIssue');
    submitIssueA.addEventListener("click", function() {
        chrome.tabs.create({
            url: 'https://github.com/mdeykun/mdCrmChromeExtension/issues'//$(this).attr('href')
        });
        return false;
    });

}).call();