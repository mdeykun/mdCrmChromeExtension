var loadedSubjects = null;
var defaultColor = 'blue';

chrome.runtime.sendMessage(
    {
        title: 'content',
    },
    content => {
        if (content?.subjects?.length > 0) { 
            loadedSubjects = content?.subjects;
            defaultColor ??= content?.defaultColor;
            showSubjects(loadedSubjects, false, "");
        } 
        else {
            //workflowsTable.style.display = 'none';
            //let div = getNothingFoundDiv(content?.subjectsMessage);
            //workflowsTable.parentNode.insertBefore(div, workflowsTable);
        }

        let searchInput = document.getElementById('search');
        //searchInput.onchange = search;
        searchInput.oninput = search;

        document.getElementById('showGuids').onchange = search;
        document.getElementById('clearSearch').onclick = clearSearch;
    }
);

function clearSearch() {
    let el = document.getElementById('search');
    el.value = null;

    let showGuids = document.getElementById('showGuids');
    showSubjects(loadedSubjects, showGuids.checked, "");
}

function showSubjects(subjects, showGuids, searchValue) {
    let subjectsDiv = document.getElementById('subjects');

    while (subjectsDiv.lastElementChild) {
        subjectsDiv.removeChild(subjectsDiv.lastElementChild);
    }

    let rootSubjects = subjects.filter(x => x._parentsubject_value == null);
    rootSubjects.forEach((subject) => {
        displaySubject(subjectsDiv, 0, subject, subjects, showGuids, searchValue);
    });
}

function getA(text, color, searchValue) {
    let a = document.createElement('a');

    let aText = document.createTextNode(text);
    if(searchValue != null && searchValue != "" && text.toLowerCase().includes(searchValue)) {
        let b = document.createElement('b');
        b.appendChild(aText);
        aText = b;
    }
    
    a.appendChild(aText);
    a.setAttribute('style', `cursor:pointer;color:${color ?? defaultColor};`);
    a.onclick = async function(e) {
        await navigator.clipboard.writeText(text);
    };

    return a;
}

function displaySubject(container, level, subject, subjects, showGuids, searchValue) {
    let p = document.createElement('p');
    container.appendChild(p);

    p.appendChild(getA(subject.title, null, searchValue));
    if (showGuids) {
        p.appendChild(document.createTextNode(' / '));
        p.appendChild(getA(subject.subjectid, "gray", searchValue));
    }

    let levelSubjects = subjects.filter(x => x._parentsubject_value == subject.subjectid);
    if(levelSubjects.length > 0)
    {
        let nextContainer = document.createElement('div');
        nextContainer.style.paddingLeft = `${20*(level + 1)}px`;
        container.appendChild(nextContainer);

        levelSubjects.forEach((childSubject) => {
            displaySubject(nextContainer, level + 1, childSubject, subjects, showGuids, searchValue);
        });
    }
}

function search() {
    if (loadedSubjects == null) {
        return;
    }
    let showGuids = document.getElementById('showGuids');

    let el = document.getElementById('search');
    if(el.value == null || el.value == '') {
        showSubjects(loadedSubjects, showGuids.checked);
    }

    var searchValue = el.value.toLowerCase();

    var subjectsToShow = loadedSubjects.filter(x => 
        x.title.toLowerCase().includes(searchValue) || 
        x.subjectid.toLowerCase().includes(searchValue));

    for(let i = 0; i < subjectsToShow.length; i++) {
        let subject = subjectsToShow[i];
        let subjectToAdd = loadedSubjects.filter(x => x._parentsubject_value == subject.subjectid);
        for(let j = 0; j < subjectToAdd.length; j++) {
            let added = subjectsToShow.filter(x => x.subjectid == subjectToAdd[j].subjectid);
            if(added.length == 0) {
                subjectsToShow.push(subjectToAdd[j]);
            }
        }   
    }

    for(let i = 0; i < subjectsToShow.length; i++) {
        let subject = subjectsToShow[i];
        if(subject._parentsubject_value != null) {
            let addedSubject = subjectsToShow.filter(x => x.subjectid == subject._parentsubject_value);
            if(addedSubject.length == 0) {
                let subjectToAdd = loadedSubjects.filter(x => x.subjectid == subject._parentsubject_value);
                if(subjectToAdd.length > 0) {
                    subjectsToShow.push(subjectToAdd[0]);
                }
            }
        }
    }

    showSubjects(subjectsToShow, showGuids.checked, searchValue);
}