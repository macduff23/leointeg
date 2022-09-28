import { initializeAndWatchThemeColors } from './theme';
import { debounce } from "lodash";
import { ConfigSetting, IVsCodeApi } from '../../types';

declare function acquireVsCodeApi(): IVsCodeApi;

(function () {
    const vscode = acquireVsCodeApi();
    initializeAndWatchThemeColors();

    const toast = document.getElementById("saved-config-toast");
    const dirty = document.getElementById("dirty-config-toast");

    // * TEST
    const oldState = vscode.getState();
    let currentCount: number = (oldState && oldState.count) || 0;
    if (currentCount) {
        // Already opened! Get fresh and recent config!
        vscode.postMessage({
            command: "getNewConfig"
        });
    }
    currentCount = currentCount + 1;
    vscode.setState({ count: currentCount });

    // * SETUP
    // Global variable config
    let frontConfig: { [key: string]: any } = {};
    let vscodeConfig: { [key: string]: any } = {};
    let vscodeFontConfig: { [key: string]: any } = {};
    let frontFontConfig: { [key: string]: any } = {};

    vscodeConfig = (window as any).leoConfig; // ! PRE SET BY leoSettingsWebview
    frontConfig = JSON.parse(JSON.stringify(vscodeConfig));
    vscodeFontConfig = (window as any).fontConfig; // ! PRE SET BY leoSettingsWebview
    frontFontConfig = JSON.parse(JSON.stringify(vscodeFontConfig));

    // Handle messages sent from the extension to the webview
    window.addEventListener("message", event => {
        const message = event.data; // The json data that the extension sent
        if (message.command) {
            switch (message.command) {
                case "test":
                    console.log("got test message");
                    break;
                case "newConfig":
                    vscodeConfig = message.config;
                    frontConfig = JSON.parse(JSON.stringify(message.config));
                    setControls();
                    break;
                case "vscodeConfig":
                    dirty!.className = dirty!.className.replace("show", "");
                    toast!.className = "show";
                    setTimeout(function () { toast!.className = toast!.className.replace("show", ""); }, 1500);
                    vscodeConfig = message.config; // next changes will be confronted to those settings
                    break;
                case "newFontConfig":
                    vscodeFontConfig = message.config;
                    frontFontConfig = JSON.parse(JSON.stringify(message.config));
                    setFontControls();
                    break;
                case "vscodeFontConfig":
                    vscodeFontConfig = message.config; // next changes will be confronted to those settings
                    break;
                case "newEditorPath":
                    const w_element: HTMLElement | null = document.getElementById("leoEditorPath");
                    if (w_element) {
                        (w_element as HTMLInputElement).value = message.editorPath;
                        onInputChanged(w_element as HTMLInputElement);
                    }
                    break;
                default:
                    console.log("got message: ", message.command);
                    break;
            }
        } else {
            console.log('got object without command:', message);
        }
    });

    function listenAll(selector: string, name: string, listener: EventListener) {
        const els = (document.querySelectorAll(selector) as unknown) as Element[];
        for (const el of els) {
            el.addEventListener(name, listener, false);
        }
    }

    function chooseLeoEditorPath() {
        vscode.postMessage({
            command: "chooseLeoEditorPath"
        });
    }

    function onBind() {
        listenAll('input[type=checkbox][data-setting]', 'change', function (this: HTMLInputElement) {
            return onInputChecked(this);
        });
        listenAll('input[type=text][data-setting], input:not([type])[data-setting]', 'blur', function (
            this: HTMLInputElement
        ) {
            return onInputBlurred(this);
        });
        listenAll('input[type=text][data-setting], input:not([type])[data-setting]', 'focus', function (
            this: HTMLInputElement
        ) {
            return onInputFocused(this);
        });
        listenAll('input[type=text][data-setting], input[type=number][data-setting]', 'input', function (
            this: HTMLInputElement
        ) {
            return onInputChanged(this);
        });
        listenAll('select[data-setting]', 'change', function (this: HTMLSelectElement) {
            return onDropdownChanged(this);
        });
        listenAll('input[type=number][data-vscode]', 'input', function (
            this: HTMLInputElement
        ) {
            return onVscodeInputChanged(this);
        });
    }

    function onDropdownChanged(element: HTMLSelectElement) {
        if (element) {
            const w_value = element.options[element.selectedIndex].value;
            frontConfig[element.id] = w_value;
        }
        dirty!.className = "show";
        applyChanges();
    }

    function onInputChecked(element: HTMLInputElement) {
        frontConfig[element.id] = element.checked;
        setVisibility(frontConfig);
        dirty!.className = "show";
        applyChanges();
    }
    function onInputBlurred(element: HTMLInputElement) {
        // console.log('onInputBlurred', element);
    }
    function onInputFocused(element: HTMLInputElement) {
        // console.log('onInputFocused', element);
    }
    function onInputChanged(element: HTMLInputElement) {
        if (element.type === 'number' && Number(element.value) < Number(element.max) && Number(element.value) > Number(element.min)) {
            frontConfig[element.id] = Number(element.value);
            element.classList.remove("is-invalid");
        } else if (element.type === 'number' && (Number(element.value) > Number(element.max) || Number(element.value) < Number(element.min))) {
            // make red
            element.classList.add("is-invalid");
        } else if (element.type === 'text' && element.value.length <= element.maxLength) {
            frontConfig[element.id] = element.value;
        }
        dirty!.className = "show";
        applyChanges();
    }

    function onVscodeInputChanged(element: HTMLInputElement) {
        if (element.id === "zoomLevel") {
            frontFontConfig.zoomLevel = element.valueAsNumber;
        }
        if (element.id === "editorFontSize") {
            frontFontConfig.fontSize = element.valueAsNumber;
        }
        applyFontChanges();
    }

    function setFontControls(): void {
        if (frontFontConfig.zoomLevel || frontFontConfig.zoomLevel === 0) {
            const w_element = document.getElementById("zoomLevel");
            (w_element as HTMLInputElement).valueAsNumber = Number(frontFontConfig.zoomLevel);
        } else {
            console.log('Error : vscode font setting "zoomLevel" is missing');
        }
        if (frontFontConfig.fontSize) {
            const w_element = document.getElementById("editorFontSize");
            (w_element as HTMLInputElement).valueAsNumber = Number(frontFontConfig.fontSize);
        } else {
            console.log('Error : vscode font setting "fontSize" is missing');
        }
    }

    function setControls(): void {
        // 1- Set leointeg's own configuration settings
        for (const key in frontConfig) {
            if (frontConfig.hasOwnProperty(key)) {
                const w_element = document.getElementById(key);
                if (w_element && w_element.getAttribute('type') === 'checkbox') {
                    (w_element as HTMLInputElement).checked = frontConfig[key];
                } else if (w_element) {
                    (w_element as HTMLInputElement).value = frontConfig[key];
                } else {
                    console.log('ERROR : w_element', key, ' is ', w_element);
                }
            }
        }
    }

    function setVisibility(state: { [key: string]: string | boolean }) {
        for (const el of document.querySelectorAll<HTMLElement>('[data-visibility]')) {
            el.classList.toggle('hidden', !evaluateStateExpression(el.dataset.visibility!, state));
        }
    }
    function parseStateExpression(expression: string): [string, string, string | boolean | undefined] {
        const [lhs, op, rhs] = expression.trim().split(/([=+!])/);
        return [lhs.trim(), op !== undefined ? op.trim() : '=', rhs !== undefined ? rhs.trim() : rhs];
    }

    function evaluateStateExpression(expression: string, changes: { [key: string]: string | boolean }): boolean {
        let state = false;

        for (const expr of expression.trim().split('&')) {
            const [lhs, op, rhs] = parseStateExpression(expr);

            switch (op) {
                case '=': {
                    // Equals
                    let value = changes[lhs];
                    if (value === undefined) {
                        value = getSettingValue(lhs) || false;
                    }
                    state = rhs !== undefined ? rhs === String(value) : Boolean(value);
                    break;
                }
                case '!': {
                    // Not equals
                    let value = changes[lhs];
                    if (value === undefined) {
                        value = getSettingValue(lhs) || false;
                    }
                    state = rhs !== undefined ? rhs !== String(value) : !value;
                    break;
                }
                case '+': {
                    // Contains
                    if (rhs !== undefined) {
                        const setting = getSettingValue(lhs);
                        state = setting !== undefined ? setting.includes(rhs.toString()) : false;
                    }
                    break;
                }
            }

            if (!state) { break; }
        }
        return state;
    }

    function getSettingValue(p_setting: string): any {
        return frontConfig[p_setting];
    }

    var applyChanges = debounce(
        function () {
            var w_changes: ConfigSetting[] = [];
            if (frontConfig) {
                for (var prop in frontConfig) {
                    if (Object.prototype.hasOwnProperty.call(frontConfig, prop)) {
                        // console.log(prop);
                        if (frontConfig[prop] !== vscodeConfig[prop]) {
                            w_changes.push({ code: prop, value: frontConfig[prop] });
                        }
                    }
                }
            }
            if (w_changes.length) {
                // ok replace!
                vscodeConfig = frontConfig;
                frontConfig = JSON.parse(JSON.stringify(frontConfig));
                vscode.postMessage({
                    command: "config",
                    changes: w_changes
                });
            } else {
                // Still have to remove 'modified' popup
                dirty!.className = dirty!.className.replace("show", "");
            }
        },
        1500,
        { leading: false, trailing: true }
    );

    var applyFontChanges = debounce(
        function () {
            vscode.postMessage({
                command: "fontConfig",
                changes: frontFontConfig
            });
        },
        800,
        { leading: false, trailing: true }
    );


    // * START
    const w_button: HTMLElement | null = document.getElementById('chooseLeoEditorPath');
    if (w_button) {
        w_button.onclick = chooseLeoEditorPath;
    }
    setControls();
    setFontControls();
    setVisibility(frontConfig);
    onBind();

})();
