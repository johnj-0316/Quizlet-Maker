// ===== CLEANUP: Removed myQMData functions replaced by Chrome extension logic =====
// myQMData_addEvents, myQMData_openQuizlet, myQMData_shareQuizletData, and myQMData_postQuizletLink have been removed.
// Only box-filling and DOM logic remains below.

function myQMData_getBoxes() {
    const possibleBoxes = Array.from(document.getElementsByClassName('ProseMirror'));
    return possibleBoxes.filter(a => a.outerHTML.includes('Enter'));
}

function myQMData_addBoxes() {
    const buttons = Array.from(document.querySelectorAll('button'));
    const addElement = buttons.find(a => a.children[0]?.innerText?.includes('Add'));
    if (!addElement) return;
    addElement.click();
}

function myQMData_focusBoxes() {
    const boxes = myQMData_getBoxes();
    for (let A = 0; A < boxes.length - 2; A++) {
        let box = boxes[A];
        box.focus();
    }
}

function myQMData_focusTitle() {
    const title = Array.from(document.querySelectorAll('input')).find(a => a.placeholder.includes('title'));
    if (!title) return;
    title.onblur = title.onfocus = function() {
        title.value = (myQMData_data || [])[0];
    };
    title.focus();
}

function myQMData_fillTitle() {
    const title = Array.from(document.querySelectorAll('input')).find(a => a.placeholder.includes('title'));
    if (!title) return;
    title.value = myQMData_data[0];
}

function myQMData_fillInTerms() {
    const getType = (box, type) => box.parentElement?.parentElement?.innerHTML.includes(type);
    const terms = myQMData_getBoxes().filter(a => getType(a, 'TERM'));
    for (let A = 0; A < Math.min(terms.length - 1, 100); A++) {
        let term = terms[A];
        term.innerHTML = `${myQMData_data[A + 1].term}\n`;
    }
}

function myQMData_fillInDefinitions() {
    const getType = (box, type) => box.parentElement?.parentElement?.innerHTML.includes(type);
    const definitions = myQMData_getBoxes().filter(a => getType(a, 'DEFINITION'));
    for (let A = 0; A < definitions.length - 1; A++) {
        let definition = definitions[A], data = myQMData_data[A + 1].definitions;
        if (data.length > 1) {
            for (let B = 0; B < data.length; B++) {
                if (typeof data[B] !== 'string') continue;
                definition.innerHTML += `<p>• ${data[B]}</p>`;
            }
        } else {
            definition.innerHTML = `${typeof data[0] !== 'string' ? data[0].join('; ') : data[0]}\n`;
        }
    }
}

function myQMData_structureBoxes() {
    let boxes = myQMData_getBoxes();
    if (!boxes.length || !myQMData_data.length) return alert('Failed to fill in quizlet terms.');
    let clicksLeft = myQMData_data.length - 1 - (boxes.length / 2 >= 100 ? myQMData_boxCounter : (boxes.length / 2));
    if (!myQMData_clickingInterval)
        myQMData_clickingInterval = setInterval(function() {
            boxes = myQMData_getBoxes();
            clicksLeft = myQMData_data.length - 1 - (boxes.length / 2 >= 100 ? myQMData_boxCounter : (boxes.length / 2));
            if (clicksLeft <= 0 || !opener) {
                const functions = [myQMData_fillInTerms, myQMData_focusBoxes, myQMData_fillInDefinitions, myQMData_focusBoxes, myQMData_fillTitle, myQMData_focusTitle, myQMData_fillTitle, myQMData_finishQuizlet];
                clearInterval(myQMData_clickingInterval);
                myQMData_clickingInterval = undefined;
                for (let A = 0; A < functions.length; A++) {
                    if (!opener) break;
                    setTimeout(functions[A], A * 2000);
                }
            }
            myQMData_addBoxes();
            myQMData_boxCounter++;
        }, 100);
}

function myQMData_finishQuizlet() {
    const buttons = Array.from(document.querySelectorAll('button'));
    const createButton = buttons.find(a => a.children[0]?.innerText === 'Create');
    if (!createButton) return;
    createButton.click();
}

// ===== END myQMData LOGIC (EASY TO REMOVE) =====
const DMS = {
    '-': '- | -',
    ':': ': | :',
    '|': '\\|',
    '=': '=',
    '': ''
};
const button = document.getElementById("create");
const input = document.getElementById("definitions");
let delimeter = '';
let qmDocument = input.value;
let decision = '';
let dupeCases = {};
let lines = [];


button.addEventListener("click", async function(event) {
    // 1. Parse definitions from textarea
    qmDocument = (input && input.value) || '';
    if (!qmDocument.trim()) {
        alert('Nothing entered.');
        return;
    }
    lines = qmDocument.split(/\r?\n/);
    if (!getFixedSplits().length || !getFixedLists().length) {
        alert('There were no terms to be found. Please try again and check your input.');
        return;
    }
    const definitions = getDefinitions();
    // Log definitions to the console
    console.log('Quizlet definitions:', definitions);

    // 2. Open Quizlet tab and send definitions with retry logic
    chromeQM_openQuizlet(function(tab) {
        let attempts = 0;
        const maxAttempts = 10;
        const interval = 800;
        function trySend() {
            chrome.tabs.sendMessage(tab.id, { type: 'quizletData', data: definitions }, function(response) {
                if (response && response.status === 'filled') {
                    const quizletUrl = tab.pendingUrl || tab.url || 'https://quizlet.com/create-set';
                    document.getElementById('response').innerHTML = `<a href="${quizletUrl}" target="_blank">Quizlet Created: ${quizletUrl}</a>`;
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(trySend, interval);
                } else {
                    document.getElementById('response').textContent = 'Failed to fill Quizlet.';
                }
            });
        }
        setTimeout(trySend, 1200);
    });
});

function promptDelimeterIndex() {
    let d = prompt('Please enter your desired separator for your terms. If you do not enter anything, lines will separate based on what is seen.') || '';
    d = d.trim();

    if (DMS[d] == void 0) {
        const delimeters = getSaved() || [];
        delimeters.push(d);
        delimeter = d;
        return delimeter;
    } else {
        delimeter = DMS[d];
        return delimeter;
    }
}

function promptDecisionIndex() {
    decision = prompt('Please enter your decision in how to read the document. Choices:\n\n(separate)\nBorgor - Very nom nom\n\n(list)\nBorgor\nVery nom nom\nVery yum') || '';
    decision = decision.trim();

    if (decision === 'separate')
        promptDelimeterIndex();

    if (decision)
        return;

    alert('Nothing entered. Decision will be done automatically based on what is seen, but accuracy is not guaranteed.');
}

function createQuizlet() {
    qmDocument = (input && input.value) || '';

    if (qmDocument.trim()) {
        if (lowerTrim(qmDocument) === 'choose') {
            promptDecisionIndex();
            return createQuizlet();
        }

        lines = qmDocument.split(/\r?\n/);

        if (!getFixedSplits().length || !getFixedLists().length) {
            alert('There were no terms to be found. Please try again and check your input.');
            return;
        }

        // Instead of creating a quizlet, just log the array returned
        const result = getDefinitions();
        open('', '_blank').document.write('<pre>' + JSON.stringify(result, null, 2) + '</pre>');
        console.log(result);
        return;
    }

    alert('Nothing entered.');
}

// Standalone utility functions mirroring myQM helpers
function lowerTrim(str) {
    return str?.toLowerCase()?.trim();
}

function isSentence(line) {
    return line && line.endsWith('.');
}

function isLink(line) {
    return line && (line.startsWith('https://') || line.startsWith('http://') || line.endsWith('| Quizlet'));
}

function uniqueArray(arr) {
    return [...new Set(arr)];
}

function getTypo(line) {
    return (/^[\\%*^)}\]|,.&:;?!@+=-]/.test(line)) ? 2 : (/[-\\$^&(*|{[]$/.test(line) ? 1 : 0);
}

function getInParenthesis(line) {
    return line ? line.match(/\(([^)]+)\)/g) : [];
}

function getValid() {
    return ['previous', 'combine', 'combinefin', 'remove', 'nothing'];
}

function getSaved() {
    return localStorage.delimeters && JSON.parse(localStorage.delimeters);
}

function getDupes(arr) {
    return arr.reduce((list, item, index, array) => {
        if (array.indexOf(item, index + 1) !== -1 && !list.includes(item))
            list.push(item);

        return list;
    }, []);
}

function getDelimeters() {
    return uniqueArray(['- ', ': ', ' -', ' :', '\\|', '='].concat(getSaved() || []));
}

function removeTypo(line) {
    while (getTypo(line))
        switch (getTypo(line)) {
            case 0:
                break;
            case 1:
                line = line.slice(0, line.length - 1);
                break;
            case 2:
                line = line.slice(1);
        }

    return line;
}

function resetCombine() {
    if (!dupeCases) return;
    for (let A in dupeCases) {
        let dupeCase = dupeCases[A];

        if (dupeCase !== 'combinefin')
            continue;

        dupeCases[A] = 'combine';
    }
}

function canSplit(line) {
    const pattern = `(${delimeter || getDelimeters().join('|')})`;
    return line.match(new RegExp(pattern, 'g')) ?? [];
}

function getSplit(line) {
    const delimeter = canSplit(line)[0];
    const termCorrection = line.indexOf(delimeter) === -1 ? Infinity : line.indexOf(delimeter);

    return [
        line.slice(0, termCorrection),
        line.slice(line.indexOf(delimeter) + 1)
    ].map(A => removeTypo(A).trim());
}

// Remaining myQM logic ported as standalone functions.
function getPossibleLists() {
    const srcLines = (lines && lines.length ? lines : (input && input.value.split(/\r?\n/)) || []);
    const list = [];

    for (let A = 0, B = true, C = []; A < srcLines.length; A++) {
        let line = (srcLines[A] || '').trim();

        if (!line && !isLink(line)) {
            if (B && C.length) {
                B = false;
                list.push(C);
                C = [];
            }
            continue;
        } else {
                    if ((!B && !isLink(line)) || (!B && A + 1 === srcLines.length)) B = true;

            if (!isLink(line)) C.push({ line, order: A });

            if (B && A + 1 === srcLines.length) {
                B = false;
                list.push(C);
                C = [];
            }
        }
    }

    return list;
}

function getFixedLists(safe) {
    const lists = getPossibleLists();
    const newList = [];
    const form = list => ({ term: removeTypo(list[0].line), definitions: list.slice(1).map(a => a.line), order: list[0].order });

    for (let A = 0; A < lists.length; A++) {
        let currentList = lists[A], [currentTitle] = currentList, nextList = lists[A + 1], nextTitle = nextList && nextList[0];

        if (currentList.length === 1) {
            if (canSplit(currentTitle.line).length) {
                let [term, definition] = getSplit(currentTitle.line);
                newList.push([ { line: term, order: currentTitle.order - 0.5 }, { line: definition, order: currentTitle.order } ]);
                continue;
            }

            if (nextTitle && isSentence(nextTitle.line)) {
                currentTitle.order++;
                nextList.unshift(currentTitle);
            }

            lists.splice(A, 1);
            A--;
            continue;
        }

        newList.push(form(currentList));
    }

    const terms = newList.map(a => lowerTrim(a.term));
    const duplicates = getDupes(terms);

    for (let A = 0, B = ''; A < newList.length; A++) {
        let line = newList[A], term = lowerTrim(line.term), choice = -1;

        if (!duplicates.includes(term)) continue;

        do {
            if (!getValid().includes(dupeCases[line.term] || '') && !safe)
                B = prompt(`There seems to be a duplicate list:   ${line.term}\n\nWhat would like to do?\n\n(combine) Combines the dupe lists into one\n\n(remove) Remove all dupe lists\n\n(nothing) Nothing will be done with the dupe lists`).trim();

            dupeCases[line.term] = lowerTrim(B) || dupeCases[line.term] || '';

            switch (dupeCases[line.term]) {
                case 'combine':
                    newList.push({ term: line.term, definitions: newList.filter(a => a.term === line.term).map(b => b.definitions).flat(), immutable: true, order: line.order });
                    B = 'combinefin';
                    choice = 1;
                    break;
                case 'combinefin':
                    choice = 1;
                    break;
                case 'remove':
                    choice = 2;
            }
        } while (!getValid().includes(dupeCases[line.term]) && !safe);

        if (choice === 2 || (choice === 1 && !line.immutable)) {
            newList.splice(A, 1);
            A--;
            continue;
        }
    }

    newList.sort((a,b) => a.order - b.order);
    resetCombine();
    return newList;
}

function getPossibleSplits() {
    const srcLines = (lines && lines.length ? lines : (input && input.value.split(/\r?\n/)) || []);
    const colonError = (canSplitArr, line) => line.indexOf(';') !== -1 && line.indexOf(';') < line.indexOf(canSplitArr[0]);
    const list = [];

    for (let A = 0, B = []; A < srcLines.length; A++) {
        let line = (srcLines[A] || '').trim();
        let can = canSplit(line);
        let format = { line, order: A, delim: can[0] };

        if (line.length <= 1) continue;

        if (can[0]?.trim() === ':' && colonError(can, line)) {
            format.delim = undefined;
            B.push(format);
            continue;
        }

        let previousLine = (srcLines[A-1] || '').trim();

        if (!isLink(line)) {
            if (can.length) {
                let split = getSplit(line);
                if (!split[1]) continue;

                if (B.length) { list.push(B); B = []; }
                B.push(format);
            } else if (A && previousLine && B.length) {
                B.push(format);
            }
        }

        if (B.length && A + 1 === srcLines.length) list.push(B);
    }

    return list;
}

function getFixedSplits(safe) {
    const splits = getPossibleSplits();
    const newSplit = [];
    const form = key => ({ term: getSplit(key.line)[0], definitions: [getSplit(key.line)[1]], delim: key.delim, order: key.order });

    for (let A = 0; A < splits.length; A++) {
        let line = splits[A], [keyLine] = line;
        newSplit.push(form(keyLine));

        if (line.length > 1 && newSplit.length) newSplit[newSplit.length - 1].definitions.push(...line.slice(1).map(a => a.line));
    }

    const terms = newSplit.map(a => lowerTrim(a.term));
    const duplicates = getDupes(terms);

    for (let A = 0, B = ''; A < newSplit.length; A++) {
        let line = newSplit[A], term = lowerTrim(line.term), choice = -1;
        if (!duplicates.includes(term)) continue;
        let previousLine = newSplit[A - 1];
        if (!previousLine) continue;

        do {
            if (!getValid().includes(dupeCases[line.term] || '') && !safe)
                B = prompt(`There seems to be a duplicate term:   ${line.term}\n\nWhat would like to do?\n\n(previous) Join all of the dupe terms to the previous terms\n\n(combine) Combines the dupe terms into one\n\n(remove) Remove all dupe terms\n\n(nothing) Nothing will be done with the dupe terms`);

            dupeCases[line.term] = lowerTrim(B) || dupeCases[line.term] || '';

            switch (dupeCases[line.term]) {
                case 'previous':
                    previousLine.definitions.push(line.term + line.delim + line.definitions.join('; '));
                    choice = 1;
                    break;
                case 'combine':
                    newSplit.push({ term: line.term, definitions: newSplit.filter(a => a.term === line.term).map(b => b.definitions.join('; ')), delim: line.delim, immutable: true, order: line.order });
                    B = 'combinefin';
                    choice = 1;
                    break;
                case 'combinefin':
                    choice = 1;
                    break;
                case 'remove':
                    choice = 2;
            }
        } while (!getValid().includes(dupeCases[line.term]) && !safe);

        if (choice === 2 || (choice === 1 && !line.immutable)) {
            newSplit.splice(A, 1);
            A--;
            continue;
        }
    }

    newSplit.sort((a,b) => a.order - b.order);
    resetCombine();
    return newSplit;
}

function getDefinitions() {
    const doc = (qmDocument) || ((input && input.value) || '');
    if (!doc) { alert('Your document has not been uploaded yet.'); return []; }

    const splits = getFixedSplits('safe');
    const lists = getFixedLists('safe');
    const splitLength = splits.length, listLength = lists.length;
    const dilemma = 0.75 < Math.min(splitLength, listLength) / Math.max(splitLength, listLength);

    const decisionVal = (typeof decision !== 'undefined' && decision) || '';

    switch (decisionVal) {
        case 'seperate':
        case 'separate':
            return getFixedSplits();
        case 'list':
        case 'lists':
            return getFixedLists();
        default:
            if (dilemma) {
                alert('ALERT: The system has found no clear way to break up this document. Please input your decision to prevent a loss of accuracy.');
                if (globalThis.myQM && typeof globalThis.myQM.promptDecision === 'function') globalThis.myQM.promptDecision();
                return getDefinitions();
            }
            return splitLength > listLength ? getFixedSplits() : getFixedLists();
    }
}

function getTitle() {
    const title = document.getElementsByClassName('docs-title-input');
    return title[0].value;
}

// ===== BEGIN Chrome Extension Functions (inlined from chrome.js) =====
// Content script logic to fill boxes when receiving quizletData
window.chromeQM_fillQuizletBoxes = function(data) {
    // Use the logic from structureBoxes, fillInTerms, fillInDefinitions, etc.
    window.myQMData_data = data;
    if (typeof myQMData_structureBoxes === 'function') {
        myQMData_structureBoxes();
    }
};
// Save/get delimeters using chrome.storage
function chromeQM_saveDelimeters(delimeters) {
    chrome.storage.local.set({ delimeters });
}
function chromeQM_getDelimeters(callback) {
    chrome.storage.local.get(['delimeters'], result => {
        callback(result.delimeters || []);
    });
}
// Open Quizlet in a new tab
function chromeQM_openQuizlet(callback) {
    chrome.tabs.create({ url: 'https://quizlet.com/create-set', active: true }, tab => {
        if (callback) callback(tab);
    });
}
// Send data to a Quizlet tab
function chromeQM_sendQuizletData(tabId, data) {
    chrome.tabs.sendMessage(tabId, { type: 'quizletData', data });
}
// Listen for messages from content scripts or other extension parts
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'getDefinitions') {
            // Example: get definitions and send back
            const result = getDefinitions();
            sendResponse({ result });
        }
        // Add more handlers as needed
        return true; // Keep the message channel open for async sendResponse
    });
}
// Listen for quizletData messages and run the box-filling logic
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'quizletData') {
            // Call a function to fill the Quizlet boxes with the received data
            if (typeof window.chromeQM_fillQuizletBoxes === 'function') {
                window.chromeQM_fillQuizletBoxes(message.data);
            }
            sendResponse({ status: 'filled' });
        }
        // ...existing code...
    });
}
// ===== END Chrome Extension Functions =====