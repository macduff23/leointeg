// @ts-check

// This script will be run within the webview itself
// It cannot access the main VS Code APIs directly.
// Send message to leoInteg with vscode.postMessage({ keyNameEx1: someValue, ... });
// Receive messages from leoInteg with window.addEventListener('message', event => { ... });
(function () {
    // @ts-expect-error
    const vscode = acquireVsCodeApi();

    let timer; // for debouncing sending the settings from this webview to leointeg
    let dirty = false; // all but nav input
    let navDirty = false; // nav input only

    let firstTabEl = 'searchOptions'; // used to be 'findText' before nav inputs
    let lastTabEl = 'searchBody';

    let navSettings = {
        navText: '',
        showParents: true,
        searchOptions: 0,
    };

    // * LeoSearchSettings Type
    let searchSettings = {
        findText: '',
        replaceText: '',
        wholeWord: false,
        ignoreCase: true,
        regExp: false,
        markFinds: false,
        markChanges: false,
        searchHeadline: true,
        searchBody: true,
        searchScope: 0, // 0 is entire outline (1: sub-outline, 2: node only)
    };

    let inputIds = ['findText', 'replaceText'];
    let checkboxIds = [
        'wholeWord',
        'ignoreCase',
        'regExp',
        'markFinds',
        'markChanges',
        'searchHeadline',
        'searchBody',
    ];
    let radioIds = ['entireOutline', 'subOutlineOnly', 'nodeOnly'];

    function getNavSettings() {
        // getNavSettings
    }
    function setNavSettings(p_settings) {
        // setNavSettings
    }

    /**
     * @param {string} p_id
     */
    function setSearchSetting(p_id) {
        if (checkboxIds.includes(p_id)) {
            toggleCheckbox(p_id);
        } else if (radioIds.includes(p_id)) {
            setRadio(p_id);
        }
    }

    /**
     * @param {any} p_settings
     */
    function setSettings(p_settings) {
        // When opening a Leo document, set default values of fields
        inputIds.forEach((p_inputId) => {
            // @ts-expect-error
            document.getElementById(p_inputId).value = p_settings[p_inputId];
            searchSettings[p_inputId] = p_settings[p_inputId];
        });
        checkboxIds.forEach((p_inputId) => {
            // @ts-expect-error
            document.getElementById(p_inputId).checked = p_settings[p_inputId];
            searchSettings[p_inputId] = p_settings[p_inputId];
        });
        // @ts-expect-error
        document.getElementById(radioIds[p_settings['searchScope']]).checked = true;
        searchSettings.searchScope = p_settings['searchScope'];
    }

    function sendSearchConfig() {
        dirty = false; // clear dirty flag
        vscode.postMessage({ type: 'searchConfig', value: searchSettings });
    }

    function sendNavConfig() {
        navDirty = false; // clear dirty flag
        vscode.postMessage({ type: 'navConfig', value: navSettings });
    }

    function processChange() {
        clearTimeout(timer);
        dirty = true;
        timer = setTimeout(() => {
            sendSearchConfig();
        }, 300);
    }

    /**
     * @param {string} p_inputId
     */
    function toggleCheckbox(p_inputId) {
        let w_checkbox = document.getElementById(p_inputId);
        let w_setTo = true;
        // @ts-expect-error
        if (w_checkbox.checked) {
            w_setTo = false;
        }
        // @ts-expect-error
        w_checkbox.checked = w_setTo;
        searchSettings[p_inputId] = w_setTo;
        if (timer) {
            clearTimeout(timer);
        }
        sendSearchConfig();
    }

    /**
     * @param {string} p_inputId
     */
    function setRadio(p_inputId) {
        // @ts-expect-error
        document.getElementById(p_inputId).checked = true;
        searchSettings['searchScope'] = parseInt(
            // @ts-expect-error
            document.querySelector('input[name="searchScope"]:checked').value
        );
        if (timer) {
            clearTimeout(timer);
        }
        sendSearchConfig();
    }

    /**
     *
     * @param {KeyboardEvent} p_event
     */
    function checkKeyDown(p_event) {
        // @ts-expect-error
        if (!p_event) p_event = window.event;
        var keyCode = p_event.code || p_event.key;

        if (keyCode === 'Tab') {
            var actEl = document.activeElement;
            if (p_event.shiftKey) {
                // shift + tab so if first got last
                var firstEl = document.getElementById(firstTabEl);
                if (actEl === firstEl) {
                    p_event.preventDefault();
                    p_event.stopPropagation();
                    p_event.stopImmediatePropagation();
                    document.getElementById(lastTabEl).focus();
                    return;
                }
            } else {
                // tab, so if last goto first
                var lastEl = document.getElementById(lastTabEl);
                if (actEl === lastEl) {
                    p_event.preventDefault();
                    p_event.stopPropagation();
                    p_event.stopImmediatePropagation();
                    focusOnField(firstTabEl);
                    return;
                }
            }
        }
        // checkOtherKeys(p_event);
    }

    /**
     * @param {string} p_id
     */
    function focusOnField(p_id) {
        const inputField = document.querySelector('#' + p_id);
        // @ts-expect-error
        inputField.select();
        // TODO : TEST IF NEEDED TO PREVENT FLICKER ON FIRST TRY?
        setTimeout(() => {
            // @ts-expect-error
            inputField.select();
        }, 0);
    }

    function getSettings() {
        // clear dirty, clear timer,
        if (dirty) {
            dirty = false;
            clearTimeout(timer);
            sendSearchConfig(); // just trigger send settings
        }
    }

    inputIds.forEach((p_inputId) => {
        document.getElementById(p_inputId).onkeypress = function (p_event) {
            // @ts-expect-error
            if (!p_event) p_event = window.event;
            var keyCode = p_event.code || p_event.key;
            if (keyCode == 'Enter') {
                if (timer) {
                    clearTimeout(timer);
                    sendSearchConfig();
                }
                vscode.postMessage({ type: 'leoFindNext' });
                return false;
            }
        };
        document.getElementById(p_inputId).addEventListener('input', function (p_event) {
            // @ts-expect-error
            searchSettings[p_inputId] = this.value;
            processChange();
        });
    });

    checkboxIds.forEach((p_inputId) => {
        document.getElementById(p_inputId).addEventListener('change', function (p_event) {
            // @ts-expect-error
            searchSettings[p_inputId] = this.checked;
            processChange();
        });
    });

    radioIds.forEach((p_inputId) => {
        document.getElementById(p_inputId).addEventListener('change', function (p_event) {
            searchSettings['searchScope'] = parseInt(
                // @ts-expect-error
                document.querySelector('input[name="searchScope"]:checked').value
            );
            processChange();
        });
    });

    document.onkeydown = checkKeyDown;

    document.addEventListener('focusin', (event) => {
        vscode.postMessage({ type: 'gotFocus' });
    });
    document.addEventListener('focusout', (event) => {
        vscode.postMessage({ type: 'lostFocus' });
    });

    // Handle messages sent from the extension to the webview
    window.addEventListener('message', (event) => {
        const message = event.data; // The json data that the extension sent
        switch (message.type) {
            // * Nav Tab Controls
            // Focus and select all text in 'nav' field
            case 'selectNav': {
                focusOnField('navText');
                break;
            }
            case 'getNavSettings': {
                getNavSettings();
                break;
            }
            case 'setNavSettings': {
                setNavSettings(message.value);
                break;
            }

            // * Find Tab Controls
            // Focus and select all text in 'find' field
            case 'selectFind': {
                focusOnField('findText');
                break;
            }
            // Focus and select all text in 'replace' field
            case 'selectReplace': {
                focusOnField('replaceText');
                break;
            }
            case 'getSettings': {
                getSettings();
                break;
            }
            case 'setSettings': {
                setSettings(message.value);
                break;
            }
            case 'setSearchSetting': {
                setSearchSetting(message.id);
                break;
            }
        }
    });

    vscode.postMessage({ type: 'refreshSearchConfig' });
})();
