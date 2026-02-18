// ============================================================
//               ESTADO GLOBAL (MEMORIA RAM)
// ============================================================
const assetState = {
    backgrounds: [], 
    characters: {},
    scenes: {} 
};

let workspace = null;
let currentSceneId = null;

// ============================================================
//               INICIALIZACIÓN
// ============================================================
function initEditor() {
    console.log("🚀 Iniciando Otome Flow...");

    if (!Blockly.JavaScript) {
        alert("ERROR CRÍTICO: Falta librería JS Compressed");
        return;
    }

    // 1. DEFINIR BLOQUES
    Blockly.defineBlocksWithJsonArray([
        {
            "type": "def_scene",
            "message0": "🎬 Escena ID: %1 %2 Acciones: %3",
            "args0": [
                { "type": "field_input", "name": "SCENE_ID", "text": "inicio" },
                { "type": "input_dummy" },
                { "type": "input_statement", "name": "ACTIONS" }
            ],
            "colour": 290
        },
        {
            "type": "action_narrator",
            "message0": "📣 Narrador: %1",
            "args0": [{ "type": "field_input", "name": "TEXT", "text": "..." }],
            "previousStatement": null, "nextStatement": null, "colour": 160
        },
        {
            "type": "choice", "message0": "🔀 Decisión %1",
            "args0": [{ "type": "input_statement", "name": "OPTIONS" }],
            "previousStatement": null, "nextStatement": null, "colour": 20
        },
        {
            "type": "choice_points",
            "message0": "Opción: %1 💡 Efecto: %2 Sumar %3",
            "args0": [
                { "type": "field_input", "name": "TEXT", "text": "Respuesta" },
                { "type": "field_input", "name": "VAR_NAME", "text": "puntos" },
                { "type": "field_number", "name": "VAR_VAL", "value": 1 }
            ],
            "previousStatement": null, "nextStatement": null, "colour": 45
        },
        {
            "type": "choice_option",
            "message0": "Opción: %1 Ir a: %2 %3 💡 Efecto: %4 Sumar %5",
            "args0": [
                { "type": "field_input", "name": "TEXT", "text": "Sí" },
                { "type": "field_input", "name": "GOTO", "text": "otra_escena" },
                { "type": "input_dummy" }, 
                { "type": "field_input", "name": "VAR_NAME", "text": "puntos" },
                { "type": "field_number", "name": "VAR_VAL", "value": 0 }
            ],
            "previousStatement": null, "nextStatement": null, "colour": 45
        },
        {
            "type": "logic_check_var",
            "message0": "⚖️ Juez: Si %1 %2 %3 %4 🟢 Ir a: %5 %6 🔴 Si no: %7",
            "args0": [
                { "type": "field_input", "name": "VAR", "text": "puntos" },
                { "type": "field_dropdown", "name": "OP", "options": [["≥", "gte"], [">", "gt"], ["=", "eq"], ["<", "lt"], ["≤", "lte"]] },
                { "type": "field_number", "name": "VAL", "value": 5 },
                { "type": "input_dummy" },
                { "type": "field_input", "name": "GOTO_TRUE", "text": "aprobado" },
                { "type": "input_dummy" },
                { "type": "field_input", "name": "GOTO_FALSE", "text": "suspenso" }
            ],
            "previousStatement": null, "nextStatement": null, "colour": 0
        }
    ]);

    // 2. GENERADORES (SEGUROS)
    const generator = Blockly.JavaScript;
    const assign = generator.forBlock ? (k, f) => generator.forBlock[k] = f : (k, f) => generator[k] = f;

    assign('def_scene', (b) => {
        const id = b.getFieldValue('SCENE_ID').trim();
        let actions = Blockly.JavaScript.statementToCode(b, 'ACTIONS');
        // Usamos JSON.stringify para el ID también, por si tiene comillas
        return `${JSON.stringify(id)}: [\n${actions.replace(/,\s*$/, "")}\n]`; 
    });
    assign('action_narrator', (b) => {
        const text = JSON.stringify(b.getFieldValue('TEXT'));
        return `{"action": "dialogue", "speaker": "", "text": ${text}},`;
    });
    assign('choice', (b) => `{"action": "choice", "options": [${Blockly.JavaScript.statementToCode(b, 'OPTIONS').replace(/,\s*$/, "")}]},`);
    assign('choice_points', (b) => {
        const txt = JSON.stringify(b.getFieldValue('TEXT'));
        const vName = JSON.stringify(b.getFieldValue('VAR_NAME'));
        return `{"text": ${txt}, "varName": ${vName}, "varVal": ${b.getFieldValue('VAR_VAL')}},`;
    });
    assign('choice_option', (b) => {
        const txt = JSON.stringify(b.getFieldValue('TEXT'));
        const go = JSON.stringify(b.getFieldValue('GOTO'));
        const val = b.getFieldValue('VAR_VAL');
        const vName = JSON.stringify(b.getFieldValue('VAR_NAME'));
        const varJson = (val != 0) ? `, "varName": ${vName}, "varVal": ${val}` : "";
        return `{"text": ${txt}, "goto": ${go}${varJson}},`;
    });
    assign('logic_check_var', (b) => JSON.stringify({
        action: "check_variable", 
        variable: b.getFieldValue('VAR'), 
        operator: b.getFieldValue('OP'), 
        value: b.getFieldValue('VAL'),
        goto_true: b.getFieldValue('GOTO_TRUE'), 
        goto_false: b.getFieldValue('GOTO_FALSE')
    }) + ",");

    // 3. INYECTAR
    workspace = Blockly.inject('blocklyDiv', {
        toolbox: document.getElementById('toolbox'),
        scrollbars: true, trashcan: true
    });

    // 4. CONFIGURAR
    setupEventListeners();
    refreshBlocklyEnv(); 
    renderAssetList();
    
    createNewScene("inicio");
}

// ============================================================
//               LÓGICA CORE DE ESCENAS
// ============================================================

function createNewScene(forceName = null) {
    if (currentSceneId) saveCurrentWorkspaceToMemory();

    let name = forceName;
    if (!name) {
        name = prompt("Nombre de la nueva escena:");
        if (!name) return;
        name = name.trim().replace(/\s+/g, '_');
    }

    if (assetState.scenes[name]) {
        switchToScene(name);
        return;
    }

    currentSceneId = name;
    workspace.clear();
    
    const block = workspace.newBlock('def_scene');
    block.setFieldValue(name, 'SCENE_ID');
    block.initSvg();
    block.render();
    workspace.scrollCenter();

    saveCurrentWorkspaceToMemory();
    renderSceneList();
}

function switchToScene(targetId) {
    if (currentSceneId && currentSceneId !== targetId) saveCurrentWorkspaceToMemory();

    workspace.clear();
    currentSceneId = targetId;

    const sceneData = assetState.scenes[targetId];
    if (sceneData && sceneData.blocklyState) {
        try {
            Blockly.serialization.workspaces.load(sceneData.blocklyState, workspace);
        } catch (e) {
            console.error("Error al restaurar bloques:", e);
            spawnDefaultBlock(targetId);
        }
    } else {
        spawnDefaultBlock(targetId);
    }
    renderSceneList();
}

function saveCurrentWorkspaceToMemory() {
    if (!currentSceneId) return;

    const topBlocks = workspace.getTopBlocks(true);
    const sceneBlock = topBlocks.find(b => b.type === 'def_scene');
    let code = "";
    
    if (sceneBlock) {
        sceneBlock.setFieldValue(currentSceneId, 'SCENE_ID'); 
        code = Blockly.JavaScript.blockToCode(sceneBlock);
    }

    const state = Blockly.serialization.workspaces.save(workspace);
    assetState.scenes[currentSceneId] = { code: code, blocklyState: state };
}

function spawnDefaultBlock(id) {
    const block = workspace.newBlock('def_scene');
    block.setFieldValue(id, 'SCENE_ID');
    block.initSvg();
    block.render();
    workspace.scrollCenter();
}

// ============================================================
//               LÓGICA DEL ÁRBOL VISUAL (MERMAID)
// ============================================================
function generateStoryTree() {
    saveCurrentWorkspaceToMemory(); // Guardar lo último

    let graphDefinition = "graph TD;\n";
    graphDefinition += "classDef default fill:#fff,stroke:#b48de3,stroke-width:2px;\n";
    graphDefinition += "classDef start fill:#d1e7dd,stroke:#0f5132,stroke-width:3px;\n";
    graphDefinition += "classDef logic fill:#fff3cd,stroke:#ffc107,stroke-width:2px,stroke-dasharray: 5 5;\n";

    const sceneIds = Object.keys(assetState.scenes);
    const startScene = document.getElementById('startSceneInput').value;

    if (sceneIds.length === 0) {
        alert("No hay escenas para visualizar.");
        return;
    }

    sceneIds.forEach(id => {
        const styleClass = (id === startScene) ? ":::start" : "";
        const safeId = id.replace(/[^a-zA-Z0-9]/g, '_');
        
        try {
            // Parseamos el código JSON parcial de la escena
            const jsonStr = `{ ${assetState.scenes[id].code} }`;
            const sceneObj = JSON.parse(jsonStr);
            const actions = sceneObj[Object.keys(sceneObj)[0]]; 

            let hasLinks = false;

            actions.forEach(action => {
                // 1. DECISIONES
                if (action.action === "choice") {
                    action.options.forEach(opt => {
                        if (opt.goto) {
                            const safeDest = opt.goto.replace(/[^a-zA-Z0-9]/g, '_');
                            let label = opt.text.substring(0, 15) + (opt.text.length>15?"...":"");
                            // Mostrar si suma puntos
                            if(opt.varVal && opt.varVal != 0) label += ` [${opt.varName} +${opt.varVal}]`;
                            
                            graphDefinition += `${safeId}${styleClass} -->|"${label}"| ${safeDest};\n`;
                            hasLinks = true;
                        }
                    });
                }
                
                // 2. JUEZ / VARIABLES
                if (action.action === "check_variable") {
                    const safeTrue = action.goto_true.replace(/[^a-zA-Z0-9]/g, '_');
                    const safeFalse = action.goto_false.replace(/[^a-zA-Z0-9]/g, '_');
                    const logicNode = `${safeId}_LOGIC_${Math.floor(Math.random()*1000)}`; // ID único para el rombo
                    
                    let opSymbol = action.operator;
                    if(opSymbol === 'gte') opSymbol = '>=';
                    if(opSymbol === 'gt') opSymbol = '>';
                    if(opSymbol === 'eq') opSymbol = '=';
                    if(opSymbol === 'lt') opSymbol = '<';
                    if(opSymbol === 'lte') opSymbol = '<=';

                    graphDefinition += `${safeId} -.-> ${logicNode}{{"¿${action.variable} ${opSymbol} ${action.value}?"}}:::logic;\n`;
                    graphDefinition += `${logicNode} -->|Sí| ${safeTrue};\n`;
                    graphDefinition += `${logicNode} -->|No| ${safeFalse};\n`;
                    hasLinks = true;
                }
            });

            if (!hasLinks) {
                graphDefinition += `${safeId}${styleClass};\n`;
            }

        } catch (e) {
            console.error(`Error analizando escena ${id} para el árbol:`, e);
        }
    });

    // Renderizar en el modal
    const mermaidDiv = document.getElementById('mermaidGraph');
    mermaidDiv.innerHTML = graphDefinition;
    document.getElementById('treeModal').style.display = 'flex';
    
    mermaidDiv.removeAttribute('data-processed');
    mermaid.run({ nodes: [mermaidDiv] });
}

// ============================================================
//               EVENTOS UI
// ============================================================
function setupEventListeners() {
    
    // ASSETS
    const handleAsset = (arr, file) => { arr.push(file); refreshBlocklyEnv(); renderAssetList(); };
    document.getElementById('bgInput').addEventListener('change', e => { if(e.target.files[0]) handleAsset(assetState.backgrounds, e.target.files[0]); });
    document.getElementById('spriteInput').addEventListener('change', e => {
        const char = document.getElementById('charSelector').value;
        if(char && e.target.files[0]) { assetState.characters[char].push(e.target.files[0]); refreshBlocklyEnv(); renderAssetList(); }
    });
    document.getElementById('addCharBtn').addEventListener('click', () => {
        const val = document.getElementById('newCharName').value.trim();
        if(val) { assetState.characters[val] = []; document.getElementById('newCharName').value = ''; refreshBlocklyEnv(); renderAssetList(); updateCharDropdown(val); }
    });
    document.getElementById('charSelector').addEventListener('change', (e) => {
        if(e.target.value) { document.getElementById('spriteUploadSection').style.display = 'block'; document.getElementById('displayCharName').innerText = e.target.value; }
    });

    // ESCENAS
    const btnNew = document.getElementById('newSceneBtn');
    if(btnNew) btnNew.addEventListener('click', () => createNewScene());

    const btnSave = document.getElementById('saveSceneBtn');
    if(btnSave) btnSave.addEventListener('click', () => {
        saveCurrentWorkspaceToMemory();
        renderSceneList();
        const originalText = btnSave.innerText;
        btnSave.innerText = "✅ Guardado";
        setTimeout(() => btnSave.innerText = originalText, 1000);
    });

    // VER ÁRBOL (¡AQUÍ ESTÁ EL LISTENER!)
    const btnTree = document.getElementById('viewTreeBtn');
    if (btnTree) btnTree.addEventListener('click', () => generateStoryTree());

    document.getElementById('closeTreeBtn').addEventListener('click', () => {
        document.getElementById('treeModal').style.display = 'none';
    });

    // IMPORT/EXPORT
    document.getElementById('generateButton').addEventListener('click', async () => {
        saveCurrentWorkspaceToMemory();
        const zip = new JSZip();
        const keys = Object.keys(assetState.scenes);
        if(keys.length === 0) { alert("No hay escenas."); return; }

        try {
            let allCodes = keys.map(k => assetState.scenes[k].code);
            const start = document.getElementById('startSceneInput').value;
            const jsonStr = `{"start": "${start}", "scenes": { ${allCodes.join(",\n")} }}`;
            
            const validJson = JSON.stringify(JSON.parse(jsonStr), null, 2);
            zip.file("story.json", validJson);

            const editorData = { startScene: start, scenes: assetState.scenes };
            zip.file("project_data.json", JSON.stringify(editorData));

            const bgF = zip.folder("assets").folder("backgrounds");
            assetState.backgrounds.forEach(f => bgF.file(f.name, f));
            const chF = zip.folder("assets").folder("characters");
            Object.keys(assetState.characters).forEach(n => {
                const fldr = chF.folder(n);
                assetState.characters[n].forEach(f => fldr.file(f.name, f));
            });

            const blob = await zip.generateAsync({type:"blob"});
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = "otome_project.zip";
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } catch(e) { alert("Error ZIP: " + e.message); }
    });

    document.getElementById('importProjectBtn').addEventListener('click', () => {
        document.getElementById('projectInput').click();
    });

    document.getElementById('projectInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if(!file) return;
        if(!confirm("Importar borrará el proyecto actual. ¿Seguir?")) { e.target.value = ''; return; }

        try {
            const zip = new JSZip();
            const loadedZip = await zip.loadAsync(file);

            workspace.clear();
            assetState.backgrounds = [];
            assetState.characters = {};
            assetState.scenes = {};
            currentSceneId = null;

            // Assets
            const bgFiles = Object.keys(loadedZip.files).filter(path => path.startsWith('assets/backgrounds/') && !loadedZip.files[path].dir);
            for(const path of bgFiles) {
                const blob = await loadedZip.file(path).async("blob");
                blob.name = path.split('/').pop(); 
                assetState.backgrounds.push(blob);
            }
            const charFiles = Object.keys(loadedZip.files).filter(path => path.startsWith('assets/characters/') && !loadedZip.files[path].dir);
            for(const path of charFiles) {
                const parts = path.split('/'); 
                const charName = parts[2];
                const fileName = parts[3];
                if(!assetState.characters[charName]) assetState.characters[charName] = [];
                const blob = await loadedZip.file(path).async("blob");
                blob.name = fileName;
                assetState.characters[charName].push(blob);
            }

            // Datos
            if (loadedZip.file("project_data.json")) {
                const jsonText = await loadedZip.file("project_data.json").async("string");
                const projectData = JSON.parse(jsonText);
                assetState.scenes = projectData.scenes;
                document.getElementById('startSceneInput').value = projectData.startScene || "inicio";
            } else {
                alert("ZIP antiguo. Se importarán assets pero no escenas.");
                createNewScene("inicio");
            }

            refreshBlocklyEnv(); renderAssetList(); renderSceneList();
            const scenes = Object.keys(assetState.scenes);
            if(scenes.length > 0) switchToScene(scenes[0]);
            else createNewScene("inicio");

            alert("✅ Proyecto cargado.");
        } catch(err) { console.error(err); alert("Error importar: " + err.message); }
        e.target.value = ''; 
    });
}

// ============================================================
//               AUXILIARES VISUALES
// ============================================================
function renderSceneList() {
    const div = document.getElementById('sceneList');
    div.innerHTML = '';
    const keys = Object.keys(assetState.scenes);

    if (keys.length === 0) {
        div.innerHTML = '<p style="font-size:0.8rem;text-align:center;">Vacío</p>';
        return;
    }

    keys.forEach(id => {
        const item = document.createElement('div');
        item.className = `scene-item ${id === currentSceneId ? 'active' : ''}`;
        item.innerHTML = `<span>🎬 ${id}</span> <button class="delete-btn">✕</button>`;
        item.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') switchToScene(id); });
        item.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            if(confirm(`¿Borrar "${id}"?`)) { delete assetState.scenes[id]; renderSceneList(); }
        });
        div.appendChild(item);
    });
}

function renderAssetList() {
    const div = document.getElementById('assetList'); div.innerHTML = '';
    if(assetState.backgrounds.length){
        const d=document.createElement('div'); d.className='tree-category'; d.innerHTML='<b>🖼️ Fondos</b>';
        assetState.backgrounds.forEach(f=> d.innerHTML+=`<div class="tree-item">${f.name}</div>`);
        div.appendChild(d);
    }
    Object.keys(assetState.characters).forEach(k=>{
        const d=document.createElement('div'); d.className='tree-category'; 
        d.innerHTML=`<b>👤 ${k}</b>`;
        assetState.characters[k].forEach(f=> d.innerHTML+=`<div class="tree-item" style="padding-left:15px">${f.name}</div>`);
        div.appendChild(d);
    });
}

function updateCharDropdown(sel) {
    const s = document.getElementById('charSelector'); s.innerHTML = '<option disabled>--</option>';
    Object.keys(assetState.characters).forEach(k => s.add(new Option(k,k,false,k===sel)));
    s.dispatchEvent(new Event('change'));
}

// ============================================================
//               GENERACIÓN BLOQUES
// ============================================================
function refreshBlocklyEnv() {
    const defs = [];
    let bgOpts = assetState.backgrounds.map(f=>[f.name, `assets/backgrounds/${f.name}`]);
    if(!bgOpts.length) bgOpts=[["(Sin fondos)",""]];

    defs.push({
        "type": "action_set_background", "message0": "🖼️ Fondo: %1",
        "args0": [{"type": "field_dropdown", "name": "BG_IMAGE", "options": bgOpts}],
        "previousStatement": null, "nextStatement": null, "colour": 230
    });

    const gen = Blockly.JavaScript;
    const assign = gen.forBlock ? (k,f)=>gen.forBlock[k]=f : (k,f)=>gen[k]=f;
    
    assign('action_set_background', b => {
        const val = b.getFieldValue('BG_IMAGE');
        return `{"action": "set_background", "value": "${val}"},`;
    });

    let charXml = '';
    Object.keys(assetState.characters).forEach(k => {
        const safe = k.replace(/[^a-zA-Z0-9]/g, '_');
        let opts = assetState.characters[k].map(f=>[f.name, `assets/characters/${k}/${f.name}`]);
        if(!opts.length) opts=[["(Sin img)",""]];

        defs.push({
            "type": `char_${safe}`,
            "message0": `👤 ${k} %1 Expr: %2 %3 Dice: %4`,
            "args0": [{"type":"input_dummy"}, {"type":"field_dropdown","name":"SPRITE","options":opts}, {"type":"input_dummy"}, {"type":"field_input","name":"TEXT","text":"..."}],
            "previousStatement": null, "nextStatement": null, "colour": 120
        });
        
        assign(`char_${safe}`, b => {
            const sprite = b.getFieldValue('SPRITE');
            const safeText = JSON.stringify(b.getFieldValue('TEXT')); 
            return `{"action": "show_character", "sprite": "${sprite}", "position": "center"}, {"action": "dialogue", "speaker": "${k}", "text": ${safeText}},`;
        });
        charXml += `<block type="char_${safe}"></block>`;
    });

    try { Blockly.defineBlocksWithJsonArray(defs); } catch(e){}

    workspace.updateToolbox(`
    <xml>
        <category name="Estructura" colour="290"><block type="def_scene"></block></category>
        <category name="Fondos" colour="230"><block type="action_set_background"></block></category>
        <category name="Narrativa" colour="160"><block type="action_narrator"></block></category>
        <category name="Personajes" colour="120">${charXml}</category>
        <category name="Lógica" colour="210">
            <block type="choice"></block><block type="choice_option"></block>
            <block type="choice_points"></block><block type="logic_check_var"></block>
        </category>
    </xml>`);
}

window.addEventListener('load', initEditor);