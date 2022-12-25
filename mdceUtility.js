let tools = {
    userSettings: null,
    toolSettings: null,

    init: function() {
        document.addEventListener('mdch.settings', e => {
            document.dispatchEvent(new CustomEvent('mdch.internal.settings', { detail: { toolSettings: e.detail, oldSettings: this.toolSettings }} ));
            this.toolSettings = e.detail;
        });
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

    getCrmUserSettings: async function() {
        if (this.userSettings == null) {
            this.userSettings = {
                color: "#0078D4",
                dateFormat: "yyyy/MM/dd h:mm:ss tt",
                timeZoneCode: null, 
                dateseparator: "-"
            };

            var themes = await Xrm.WebApi.retrieveMultipleRecords('theme', '?$filter=isdefaulttheme eq true&$select=globallinkcolor');
            if (!!themes && !!themes.entities && themes.entities.length > 0 && !!themes.entities[0].globallinkcolor) {
                this.userSettings.color = themes.entities[0].globallinkcolor;
            }

            var userId = Xrm.Utility.getGlobalContext()?.userSettings?.userId;
            if (userId) {
                var usersSettings = await Xrm.WebApi.retrieveMultipleRecords('usersettings', `?$select=timezonecode,dateformatstring,timeformatstring,dateseparator&$filter=systemuserid eq ${userId.replace(/[{|}]/g, '')}`);
                if (!!usersSettings && !!usersSettings.entities && usersSettings.entities.length > 0) {
                    var userSettings = usersSettings.entities[0];
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

    searchWorkflows: async function() {
        if (!window.Xrm) {
            return;
        }

        let searchPhrase = prompt("Workflows/Flows search. Enter text (entity name, field name, field value) or entity id (without {}):");
        if (!!searchPhrase) {
            Xrm.Utility.showProgressIndicator('Searching workflows...');
            try {
                let workflows = await Xrm.WebApi.retrieveMultipleRecords('workflow', `?$select=name,workflowid&$filter=contains(xaml,'${searchPhrase}') and parentworkflowid eq null and statecode eq 1 and category ne 2`);
                let flows = await Xrm.WebApi.retrieveMultipleRecords('workflow', `?$select=name,workflowid&$filter=contains(clientdata,'${searchPhrase}') and category eq 5`);
                document.dispatchEvent(new CustomEvent('mdch.foundWorkflows', { detail: {workflows: workflows?.entities, flows: flows?.entities} }));
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
    
        Xrm.Page.ui.controls.forEach(c => {
            let controlName = c.getName();

            if (!c.getAttribute) {
                this.internal.addSchemaName(controlName, document.getElementById(`${controlName}_d`, 'insertafter', "/"));
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
                this.internal.addSchemaName(attributeName, controlNode, 'insertafter', "/");
            }
        });
    
        Xrm.Page.ui.tabs.forEach(t => {
            if (!t.getVisible()) {
                return;
            }

            var tabNode = document.querySelector(`li[data-id$="tablist-${t.getName()}"]`);
            this.internal.addSchemaName(tabName, tabNode.firstElementChild, 'insertbefore', "/");
            
            t.sections.forEach(s => {
                if (!s.getVisible()) {
                    return;
                }
                this.internal.addSchemaName(sectionName, document.querySelector(`section[data-id$="${s.getName()}"]`), 'insertbefore');
            });
        });
    },

    internal: {
        addSchemaName: function(schemaName, controlNode, insertionType, divider) {
            if (controlNode && controlNode.parentNode) {
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
        }
    }
}

let infoBar = {
    currentId: null,
    currentEntityName: null,
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
                if (!window.Xrm) {
                    this.divWrapper.setVisibile(false);
                    continue;
                }

                var settings = tools.getToolSettings();
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

                    await this.showRecordInfo(settings);
                }

                this.divWrapper.setVisibile(true);
            }
            catch(e) {
                this.divWrapper.setVisibile(false);
                console.error(e);
            }
            finally {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    },

    showRecordInfo: async function(settings) {
        let us = await tools.getCrmUserSettings();

        let html = ''
        if(this.currentId != null) {
            html += `<a id="recordinfo:showAll" style="color:${us.color};cursor:pointer" href="javascript:void(0)"><i class="fa-solid fa-eye"></i></a>`;
            html += ` <a id="recordinfo:showSchemaNames" style="color:${us.color};cursor:pointer" href="javascript:void(0)"><i class="fa-solid fa-highlighter"></i></a>`;
            html += ` <a id="recordinfo:copyid" style="color:${us.color};cursor:pointer" href="javascript:void(0)"><i class="fa-solid fa-copy"></i></a>`;
        }
        html += ` <a id="recordinfo:searchWorkflows" style="margin-left:10px;color:${us.color};cursor:pointer" href="javascript:void(0)"><i class="fa-solid fa-magnifying-glass"></i></a>`;

        if(this.currentId != null) {
            let record = await Xrm.WebApi.retrieveRecord(this.currentEntityName, this.currentId);

            let createdOnFormmated = await this.formatDate(record.createdon);
            let modifiedOnFormmated = await this.formatDate(record.modifiedon);
            
            html += ` | <b>Created</b> ${createdOnFormmated} <span style="color:${us.color};font-style: italic;">${record["_createdby_value@OData.Community.Display.V1.FormattedValue"]}</span>`;
            html += ` | <b>Modified</b> ${modifiedOnFormmated} <span style="color:${us.color};font-style: italic;">${record["_modifiedby_value@OData.Community.Display.V1.FormattedValue"]}</span>`;
            if (settings?.showOwner == true && record._ownerid_value != null) {
                html += ` | <b>Owner</b> <span style="color:${us.color};font-style: italic;">${record["_ownerid_value@OData.Community.Display.V1.FormattedValue"]}</span>`;
            }
            if (settings?.showOverridden == true && record.overriddencreatedon != null) {
                let overriddenCreatedOnFormmated = await this.formatDate(record.overriddencreatedon);
                html += ` | <b>Overridden created on</b> ${overriddenCreatedOnFormmated}`;
            }
        }
        html += ` | <a id="recordinfo:close" style="cursor:pointer;color:black" href="javascript:void(0)"><i class="fa-solid fa-xmark"></i></a>`;

        this.divWrapper.setHtml(html.trim());
        this.divWrapper.setVisibile(true);
        
        document.querySelector("#recordinfo\\:copyid").addEventListener('click', async () => {
            await commands.copyId();
        });

        document.querySelector("#recordinfo\\:close").addEventListener('click', async () => {
            this.enabled = false;
        });

        document.querySelector("#recordinfo\\:showAll").addEventListener('click', async () => {
            commands.showAll();
        });

        document.querySelector("#recordinfo\\:showSchemaNames").addEventListener('click', async () => {
            await commands.showSchemaNames();
        });

        document.querySelector("#recordinfo\\:searchWorkflows").addEventListener('click', async () => {
            commands.searchWorkflows();
        });
    },

    formatDate: async function(dateTimeString) {
        if (!!!dateTimeString) {
            return null;
        }

        let date = (await this.convertToUserDateTime(dateTimeString)) ?? new Date(dateTimeString);
        let us = await tools.getCrmUserSettings();
        if (us!=null) { 
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
                div.style.position = "fixed";
                div.style.bottom = "0";
                div.style.right = "0";
                div.style.background = "#FFF";
                div.style.lineHeight = "40px";
                div.style.padding = "0 13px";
                div.style.color = "#000";
                div.style.display = 'none';
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