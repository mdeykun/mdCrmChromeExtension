let tools = {
    userSettings: null,
    toolSettings: null,
    currentOrgDetails: null,
    defaultSolution: null,

    init: function() {
        document.addEventListener('mdch.settings', e => {
            document.dispatchEvent(new CustomEvent('mdch.internal.settings', { detail: { toolSettings: e.detail, oldSettings: this.toolSettings }} ));
            this.toolSettings = e.detail;
        });
    },

    isMain: function() {
        return location.pathname.endsWith('main.aspx');
    },

    getEntityReference: function() {
        let entityIdMatch = location.search.match(/[&?]id=([^&]+)/);
        let entityNameMatch = location.search.match(/etn=([^&]+)/);

        if (entityIdMatch != null && entityNameMatch != null) {    
            let entityId = entityIdMatch[1];
            let entityName = entityNameMatch[1];

            return { entityId: entityId, entityName: entityName };
        }

        return { entityId: null, entityName: null };
    },

    getToolSettings: function() {
        if (this.toolSettings == null) {
            document.dispatchEvent(new CustomEvent('mdch.updateSettingsRequest'));
            return null;
        }

        return this.toolSettings;
    },

    getCurrentOrgDetails: async function() {
        if (this.currentOrgDetails == null) {
            let response = await Xrm.WebApi.online.execute({
                getMetadata: function () {
                    return {
                        boundParameter: null,
                        parameterTypes: {
                            "AccessType": { 
                                typeName: "Microsoft.Dynamics.CRM.EndpointAccessType", 
                                structuralProperty: 3 ,
                                enumProperties: [
                                {
                                    name: "Default",
                                    value: 0,
                                }],                            
                            }
                        },
                        operationType: 1,
                        operationName: "RetrieveCurrentOrganization",
                    };
                },
                AccessType: 0 //Default
            });

            if (response.ok) {
                let responseJson = await response.json();
                if (responseJson?.Detail) {
                    this.currentOrgDetails = responseJson?.Detail;
                }
            }
        }
        return this.currentOrgDetails;
    },

    getCrmUserSettings: async function() {
        if (this.userSettings == null) {
            this.userSettings = {
                color: "#0078D4",
                dateFormat: "yyyy/MM/dd h:mm:ss tt",
                timeZoneCode: null, 
                dateseparator: "-"
            };

            let themes = await Xrm.WebApi.retrieveMultipleRecords('theme', '?$filter=isdefaulttheme eq true&$select=globallinkcolor');
            if (!!themes && !!themes.entities && themes.entities.length > 0 && !!themes.entities[0].globallinkcolor) {
                this.userSettings.color = themes.entities[0].globallinkcolor;
            }

            let userId = Xrm.Utility.getGlobalContext()?.userSettings?.userId;
            if (userId) {
                let usersSettings = await Xrm.WebApi.retrieveMultipleRecords('usersettings', `?$select=timezonecode,dateformatstring,timeformatstring,dateseparator&$filter=systemuserid eq ${userId.replace(/[{|}]/g, '')}`);
                if (!!usersSettings && !!usersSettings.entities && usersSettings.entities.length > 0) {
                    let userSettings = usersSettings.entities[0];
                    if (!!userSettings.dateformatstring && !!userSettings.timeformatstring) {
                        this.userSettings.dateFormat = `${userSettings.dateformatstring} ${userSettings.timeformatstring}`;
                    }
                    if (!!userSettings.timezonecode) {
                        this.userSettings.timeZoneCode = userSettings.timezonecode;
                    }
                    if (!!userSettings.dateseparator) {
                        this.userSettings.dateseparator = userSettings.dateseparator;
                    }
                }
            }
        }

        return this.userSettings;
    },

    getVersion: async function() {
        let details = await this.getCurrentOrgDetails();
        let matches = details.OrganizationVersion.match(/^(\d+.\d+).\d+.\d+$/);
        if (matches.length >= 2) {
            return matches[1];
        }
        
        return null;
    },

    formatId: id => id.replace(/[{}]/g, ''),

    isOnline: () => 
        !!window.Xrm &&
        typeof(Xrm.Page.context.isOnPremises) == 'function' &&
        !Xrm.Page.context.isOnPremises(),

    getDefaultSolution: async function() {
        if(this.defaultSolution == null) {
            try {
                let response = await Xrm.WebApi.retrieveMultipleRecords('solution', `?$select=solutionid&$filter=uniquename eq 'default'`);
                this.defaultSolution = response.entities[0];
            }
            catch(e) {
                console.error(e);
            }
        }

        return this.defaultSolution;
    },
}

tools.init();

let commands = {
    showAll: function() {
        if (!window.Xrm) {
            return;
        }

        Xrm.Page.ui.tabs.get().forEach(tab => {
            tab.setVisible(true);
            tab.sections.forEach(section => {
                section.setVisible(true)
            });
        });

        Xrm.Page.data.entity.attributes.get().forEach(attribute => attribute.setRequiredLevel('none'));

        Xrm.Page.ui.controls.get().forEach(control => {
            if (typeof control.setVisible === 'function') {
                control.setVisible(true);
            }

            if (typeof control.setDisabled === 'function') {
                control.setDisabled(false);
            }

            if (typeof control.clearNotification === 'function') {
                control.clearNotification();
            }
        });
    },

    showSubjects: async function() {
        if (!window.Xrm) {
            return;
        }

        Xrm.Utility.showProgressIndicator('Retrieving subjects...');
        try {
            let subjects = null;
            let subjectsMessage = null;
            try {
                subjects = await Xrm.WebApi.retrieveMultipleRecords('subject', `?$select=subjectid,title,_parentsubject_value`);
            }
            catch(e) {
                subjectsMessage = e.message;
                console.error(e);
            }

            document.dispatchEvent(
                new CustomEvent('mdch.subjects', 
                { 
                    detail: 
                    {
                        clientUrl: Xrm.Page.context.getClientUrl(),
                        subjects: subjects?.entities, 
                        subjectsMessage: subjectsMessage,
                    }
                })
            );
        }
        catch(ex) {
            alert(ex.message)
        }
        finally {
            Xrm.Utility.closeProgressIndicator();
        }
    },

    searchWorkflows: async function() {
        if (!window.Xrm) {
            return;
        }

        let searchPhrase = prompt("Workflows/Flows search. Enter text (entity name, field name, field value) or entity id (without {}):");
        if (!!searchPhrase) {
            Xrm.Utility.showProgressIndicator('Searching workflows...');
            try {

                let workflows = null;
                let workflowsMessage = null;
                try {
                    workflows = await Xrm.WebApi.retrieveMultipleRecords('workflow', `?$select=name,workflowid&$filter=contains(xaml,'${searchPhrase}') and parentworkflowid eq null and statecode eq 1 and category ne 2`);
                }
                catch(e) {
                    workflowsMessage = e.message;
                    console.error(e);
                }

                let flows = null;
                let flowMessage = null;
                try {
                    flows = await Xrm.WebApi.retrieveMultipleRecords('workflow', `?$select=name,workflowidunique&$filter=contains(clientdata,'${searchPhrase}') and category eq 5`);
                }
                catch(e) {
                    flowMessage = e.message;
                    console.error(e);
                }

                let details = await tools.getCurrentOrgDetails();
                let defaultSolution = await tools.getDefaultSolution();

                document.dispatchEvent(
                    new CustomEvent('mdch.foundWorkflows', 
                    { 
                        detail: 
                        {
                            clientUrl: Xrm.Page.context.getClientUrl(),
                            environmentId: details?.EnvironmentId,
                            defaultSolutionId: defaultSolution?.solutionid,
                            workflows: workflows?.entities, 
                            workflowsMessage: workflowsMessage, 
                            flows: flows?.entities, 
                            flowMessage: flowMessage 
                        }
                    })
                );
            }
            catch(ex) {
                alert(ex.message)
            }
            finally {
                Xrm.Utility.closeProgressIndicator();
            }
        }
    },

    copyId: async function() {
        let { entityId, entityName } = tools.getEntityReference();
        await navigator.clipboard.writeText(entityId);
    },

    showSchemaNames: async function() {
        if (!window.Xrm) {
            return;
        }

        let labelsContols = document.querySelectorAll('.mdceExtension');
        if (labelsContols.length > 0) {
            labelsContols.forEach((x) => x.remove());
            return;
        }
    
        Xrm.Page.ui.controls.forEach(async c => {
            let controlName = c.getName();

            if (!c.getAttribute) {
                await this.internal.addSchemaName(controlName, document.getElementById(`${controlName}_d`, 'insertafterBr'));
            } 
            else {
                if(!c.getVisible()) {
                    return;
                }

                let controlNode = document.getElementById(controlName) || document.querySelector(`label[id$="${controlName}-field-label"]`);
                if (!controlNode) {
                    return;
                }

                let attributeName = c.getAttribute().getName();
                await this.internal.addSchemaName(attributeName, controlNode, 'insertafterBr');
            }
        });
    
        Xrm.Page.ui.tabs.forEach(async t => {
            if (!t.getVisible()) {
                return;
            }

            let tabName = t.getName();
            let tabNode = document.querySelector(`li[data-id$="tablist-${tabName}"]`);
            await this.internal.addSchemaName(tabName, tabNode.firstElementChild, 'insertbefore', '/');
            
            t.sections.forEach(async s => {
                if (!s.getVisible()) {
                    return;
                }
                let name = s.getName();
                await this.internal.addSchemaName(name, document.querySelector(`section[data-id$="${name}"]`), 'insertbefore');
            });
        });
    },

    openRecordInWebapi: async function() {
        let entityId = Xrm.Page.data.entity.getId();
        let version = await tools.getVersion();

        if (entityId && version) {
            let entityName = Xrm.Page.data.entity.getEntityName();
            let entityDefinition = await Xrm.Utility.getEntityMetadata(entityName, 'EntitySetName');
            let url = `${Xrm.Page.context.getClientUrl()}/api/data/v${version}/${entityDefinition.EntitySetName}(${tools.formatId(entityId)})`;
            window.open(url, '_blank');
        }
    },

    openSolutions: async function() {
        if (tools.isOnline()) {
            let details = await tools.getCurrentOrgDetails();
            window.open(`https://make.powerapps.com/environments/${details.EnvironmentId}/solutions`, '_blank');
        }
    },

    openAdvancedFind: function() {
        let entityName = Xrm.Page?.data?.entity?.getEntityName();
        let url = `${Xrm.Page.context.getClientUrl()}/main.aspx?pagetype=advancedfind`;
        if (!!entityName) {
            url += `&extraqs=EntityCode%3d${Xrm.Internal.getEntityCode(entityName)}`;
        }

        window.open(url, '_blank');
    },

    openRecord: function() {
        let entityName = prompt("Entity name:");
        if (!!entityName) {
            let entityId = null;

            if(entityName.trim().indexOf(',') >= 0) {
                let parts = entityName.split(',');
                if(parts.length == 2) {
                    entityName = parts[0];
                    entityId = parts[1];
                }
            }
            else {
                entityId = prompt("Entity id:");
            }

            if (!!entityId) {
                window.open(`${Xrm.Page.context.getClientUrl()}/main.aspx?etn=${entityName}&id=${entityId}&newWindow=true&pagetype=entityrecord`, '_blank');
            }
        }
    },

    openList: function() {
        let entityName = prompt("Entity name:");
        if (!!entityName) {
            window.open(`${Xrm.Page.context.getClientUrl()}/main.aspx?etn=${entityName}&pagetype=entitylist`, '_blank');
        }
    },

    internal: {
        addSchemaName: async function(schemaName, controlNode, insertionType, divider) {
            if (controlNode && controlNode.parentNode) {
                let us = await tools.getCrmUserSettings();
                let a = document.createElement('a');
                let aText = document.createTextNode(schemaName);
                a.appendChild(aText);
                a.setAttribute('class', 'mdceExtension');
                a.setAttribute('style', `cursor:pointer; color: ${us.color};`);
                a.onclick = async function(e) {
                    await navigator.clipboard.writeText(e.target.innerHTML);
                };

                if(!!!insertionType) {
                    insertionType = 'insertbefore';
                }

                if(insertionType == 'insertafterBr') {
                    let br = document.createElement('br');
                    br.setAttribute('class', 'mdceExtension');
                    controlNode.parentNode.insertBefore(br, controlNode.nextSibling);
                    controlNode.parentNode.insertBefore(a, br.nextSibling);
                }

                if(insertionType == 'insertbefore' || insertionType == 'insertafter') {
                    let elementToAddBefore = insertionType == 'insertbefore' ? controlNode : controlNode.nextSibling;
                    controlNode.parentNode.insertBefore(a, elementToAddBefore);
                }
                
                if(!!divider) {
                    let span = document.createElement('span');
                    span.setAttribute('class', 'mdceExtension');
                    span.innerHTML = ` ${divider} `;
                    controlNode.parentNode.insertBefore(span, a);
                }
            }
        },
    }
}

let infoBar = {
    currentId: "00000000-0000-0000-0000-000000000000",
    currentEntityName: "none",
    enabled: true,
    
    start: async function() {
        document.addEventListener('mdch.internal.settings', e => {
            if (e.detail.toolSettings.isEnabled !== true && e.detail.oldSettings.isEnabled === true) {
                this.enabled = true;
            }

            this.currentId = null;
        });

        await this.refreshingRecordInfo();
    },

    refreshingRecordInfo: async function() {
        while (true) {
            try {
                if (!tools.isMain()) {
                    continue;
                }

                if (!window.Xrm) {
                    this.divWrapper.setVisibile(false);
                    continue;
                }

                let settings = tools.getToolSettings();
                if (settings?.isEnabled !== true) {
                    this.divWrapper.setVisibile(false);
                    continue;
                }

                if (this.enabled !== true) {
                    this.divWrapper.setVisibile(false);
                    continue;
                }

                let { entityId, entityName } = tools.getEntityReference();
                if (this.currentId != entityId || this.currentEntityName != entityName) {
                    this.currentId = entityId;
                    this.currentEntityName = entityName;

                    await this.showRecordInfo();
                }

                this.divWrapper.setVisibile(true);
            }
            catch(e) {
                this.divWrapper.setVisibile(false);
                console.error(e);
            }
            finally {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    },

    showRecordInfo: async function() {
        let html = '';
        if(this.currentId != null) {
            html += await this.createMenuItem('showAll', 'Show All', 'fas fa-eye');
            html += await this.createMenuItem('showSchemaNames', 'Show Schema Names', 'fas fa-highlighter');
            html += await this.createMenuItem('copyid', 'Copy Id', 'fas fa-copy');
            html += await this.createMenuItem('openRecordInWebapi', 'Open Record in WebApi', 'fas fa-globe');
            html += '<span style="margin:0 15px 0 0">&nbsp;</span>';
        }

        html += await this.createMenuItem('openAdvancedFind', 'Advanced Find', 'fas fa-filter');
        html += await this.createMenuItem('openRecord', 'Open Record', 'fas fa-arrow-up-right-from-square');
        html += await this.createMenuItem('openList', 'Open List', 'fas fa-folder-open');

        if (tools.isOnline()) {
            html += await this.createMenuItem('openSolutions', 'Solutions', 'fas fa-cubes');
        }
        html += await this.createMenuItem('searchWorkflows', 'Search Workflows', 'fas fa-magnifying-glass');

        if(this.currentId != null) {
            html += await this.createRecordInfo();
        }

        html += ` | <a id="recordinfo:close" style="margin-left:15px;cursor:pointer;color:rgb(51,51,51)" href="javascript:void(0)"><i class="fas fa-xmark"></i></a>`;

        this.divWrapper.setHtml(html.trim());
        this.divWrapper.setVisibile(true);


        this.attachEvent("showAll", true, async () => {
            commands.showAll();
        });

        this.attachEvent("showSchemaNames", true, async () => {
            commands.showSchemaNames();
        });

        this.attachEvent("copyid", true, async () => {
            await commands.copyId();
        });

        this.attachEvent("openRecordInWebapi", false, async () => {
            await commands.openRecordInWebapi();
        });

        this.attachEvent("openAdvancedFind", false, async () => {
            await commands.openAdvancedFind();
        });

        this.attachEvent("openRecord", false, async () => {
            await commands.openRecord();
        });

        this.attachEvent("openList", false, async () => {
            await commands.openList();
        });

        this.attachEvent("openSolutions", false, async () => {
            await commands.openSolutions();
        });

        this.attachEvent("searchWorkflows", false, async () => {
            await commands.searchWorkflows();
        });

        this.attachEvent("close", false, async () => {
            this.enabled = false;
        });
    },

    attachEvent: async function(id, anymate, eventHandler) {
        let element = document.querySelector(`#recordinfo\\:${id}`);
        if (element) {
            let icon = element.innerHTML;

            element.addEventListener('click', async () => {
                if(eventHandler.constructor.name === 'AsyncFunction') {
                    await eventHandler();
                }
                else {
                    eventHandler();
                }
                if(anymate) {
                    element.innerHTML = `<i style="color:green" class="fa-solid fa-circle-check"></i>`;
                    setTimeout(()=>{
                        element.innerHTML = icon;
                    }, 500);
                }
            });
        }
    },

    createMenuItem: async function(id, title, icon) {
        let us = await tools.getCrmUserSettings();
        let style = `color:${us.color};cursor:pointer;margin-right:15px`;
        return ` <a id='recordinfo:${id}' title='${title}' style='${style}' href='javascript:void(0)'><i class='${icon}'></i></a>`;
    },

    createRecordInfo: async function() {
        let record = await Xrm.WebApi.retrieveRecord(this.currentEntityName, this.currentId);

        let createdOnFormmated = await this.formatDate(record.createdon);
        let modifiedOnFormmated = await this.formatDate(record.modifiedon);
        
        let us = await tools.getCrmUserSettings();

        let html = '';
        html += ` | <span style="margin:0 15px"><b>Created</b> ${createdOnFormmated} <span style="color:${us.color};font-style: italic;margin-left:8px">${record["_createdby_value@OData.Community.Display.V1.FormattedValue"]}</span></span>`;
        html += ` | <span style="margin:0 15px"><b>Modified</b> ${modifiedOnFormmated} <span style="color:${us.color};font-style: italic;margin-left:8px">${record["_modifiedby_value@OData.Community.Display.V1.FormattedValue"]}</span></span>`;

        let settings = tools.getToolSettings();

        if (settings?.showOwner == true && record._ownerid_value != null) {
            html += ` | <span style="margin:0 15px"><b>Owner</b> <span style="color:${us.color};font-style: italic;">${record["_ownerid_value@OData.Community.Display.V1.FormattedValue"]}</span></span>`;
        }

        if (settings?.showOverridden == true && record.overriddencreatedon != null) {
            let overriddenCreatedOnFormmated = await this.formatDate(record.overriddencreatedon);
            html += ` | <span style="margin:0 15px"><b>Overridden created on</b> ${overriddenCreatedOnFormmated}</span>`;
        }

        return html;
    },

    formatDate: async function(dateTimeString) {
        if (!!!dateTimeString) {
            return null;
        }

        let date = (await this.convertToUserDateTime(dateTimeString)) ?? new Date(dateTimeString);
        let us = await tools.getCrmUserSettings();
        if (us != null) { 
            let formattedDate = date.format(us.dateFormat);
            return formattedDate.replace(/\//g, us.dateseparator);
        }
    },

    convertToUserDateTime: async function(isoDateString) {
        let userSettings = tools.getCrmUserSettings();
        if (!!userSettings?.timeZoneCode) {
            let result = await Xrm.WebApi.online.execute({
                TimeZoneCode: this.userSettings.timeZoneCode,
                UtcTime: isoDateString,
                getMetadata: function () {
                    return {
                        boundParameter: null,
                        parameterTypes: {
                            "TimeZoneCode": {
                                "typeName": "Edm.Int32",
                                "structuralProperty": 1
                            },
                            "UtcTime": {
                                "typeName": "Edm.DateTimeOffset",
                                "structuralProperty": 1
                            }
                        },
                        operationType: 1,
                        operationName: "LocalTimeFromUtcTime"
                    }
                }
            });

            if (result.ok) {
                let resultData = await result.json();
                let parts = resultData.LocalTime.split(/\D/);
                return new Date(parts[0], parts[1]-1, parts[2], parts[3], parts[4], parts[5]);
            }
        }

        return null;
    },

    divWrapper: {
        getDiv: function() {

            let div = document.querySelector("#recordinfo");

            if (div == null) {
                div = document.createElement('div');
                div.setAttribute("id", "recordinfo");
                div.style.background = "#FFF";
                div.style.lineHeight = "40px";
                div.style.padding = "0 20px";
                div.style.color = "rgb(51,51,51)";
                div.style.display = 'none';
                div.style.position = "fixed";
                div.style.bottom = "0px";
                div.style.right = "0px";
                document.body.appendChild(div);
            }
    
            return div;
        },
    
        setVisibile: function(isVisible) {
            this.getDiv().style.display = isVisible !== true ? 'none' : '';
        },
    
        setHtml: function(html) {
            this.getDiv().innerHTML = html;
        }
    },
};

infoBar.start();