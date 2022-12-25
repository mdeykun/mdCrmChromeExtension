chrome.runtime.sendMessage(
    {
        title: 'content',
    },
    (content) => {
        let workflowsTable = document.getElementById('workflows');
        if (content?.workflows?.length > 0) { 
            content?.workflows?.forEach((row) => insertRow(workflowsTable, row.workflowid, row.name));
        } 
        else {
            workflowsTable.style.display = 'none';
            let div = getNothingFoundDiv();
            workflowsTable.parentNode.insertBefore(div, workflowsTable);
        }
        
        let flowsTable = document.getElementById('flows');
        if (content?.flows?.length > 0) {
            content?.flows?.forEach((row) => insertRow(flowsTable, row.workflowid, row.name));
        }
        else {
            flowsTable.style.display = 'none';
            let div = getNothingFoundDiv();
            flowsTable.parentNode.insertBefore(div, flowsTable);
        }
    }
);

function getNothingFoundDiv() {
    let div = document.createElement('div');
    div.innerHTML = 'Nothing was found';
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