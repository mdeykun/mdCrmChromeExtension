chrome.runtime.sendMessage(
    {
        title: 'content',
    },
    content => {
        
        let searchPhraseContainer = document.getElementById('searchPhrase');
        if(!!content?.searchPhrase) {
            searchPhraseContainer.innerHTML = content.searchPhrase;
        }
        else {
            searchPhraseContainer.innerHTML = 'Something went wrong. Search Phrase is not defined';
        }

        let workflowsTable = document.getElementById('workflows');
        if (content?.workflows?.length > 0) { 
            content?.workflows?.forEach((row) => {
                let name = !!(content?.clientUrl) ? 
                    `<a target='_blank' href='${content?.clientUrl}/sfa/workflow/edit.aspx?id=${row.workflowid}'>${row.name}</a>` : 
                    row.name;

                insertRow(workflowsTable, row.workflowid, name);
            });
        } 
        else {
            workflowsTable.style.display = 'none';
            let div = getNothingFoundDiv(content?.workflowsMessage);
            workflowsTable.parentNode.insertBefore(div, workflowsTable);
        }
        
        let flowsTable = document.getElementById('flows');
        if (content?.flows?.length > 0) {
            content?.flows?.forEach((row) => {
                let name = !!(content?.environmentId) && !!(content?.defaultSolutionId) ? 
                    `<a target='_blank' href='https://make.powerautomate.com/environments/${content?.environmentId}/solutions/${content?.defaultSolutionId}/flows/${row.workflowidunique}/details'>${row.name}</a>` : 
                    row.name;

                insertRow(flowsTable, row.workflowid, name);
            });
        }
        else {
            flowsTable.style.display = 'none';
            let div = getNothingFoundDiv(content?.flowMessage);
            flowsTable.parentNode.insertBefore(div, flowsTable);
        }
    }
);

function getNothingFoundDiv(message) {
    let div = document.createElement('div');
    
    if (!!message) {
        div.innerHTML = message;
    }
    else {
        div.innerHTML = 'Nothing was found';
    }

    return div;
}

function insertRow() {
    let table = arguments[0];
    let row = table.insertRow(-1);

    for (let i = 1; i < arguments.length; i++) {
        let cell = row.insertCell(i - 1);
        cell.innerHTML = arguments[i];
    }
}