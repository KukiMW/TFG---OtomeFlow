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

    // 2. GENERADORES
    const generator = Blockly.JavaScript;
    const assign = generator.forBlock ? (k, f) => generator.forBlock[k] = f : (k, f) => generator[k] = f;

    assign('def_scene', (b) => {
        const id = b.getFieldValue('SCENE_ID').trim();
        let actions = Blockly.JavaScript.statementToCode(b, 'ACTIONS');
        return `"${id}": [\n${actions.replace(/,\s*$/, "")}\n]`; 
    });
    assign('action_narrator', (b) => `{"action": "dialogue", "speaker": "", "text": "${b.getFieldValue('TEXT')}"},`);
    assign('choice', (b) => `{"action": "choice", "options": [${Blockly.JavaScript.statementToCode(b, 'OPTIONS').replace(/,\s*$/, "")}]},`);
    assign('choice_points', (b) => `{"text": "${b.getFieldValue('TEXT')}", "varName": "${b.getFieldValue('VAR_NAME')}", "varVal": ${b.getFieldValue('VAR_VAL')}},`);
    assign('choice_option', (b) => {
        const val = b.getFieldValue('VAR_VAL');
        const varJson = (val != 0) ? `, "varName": "${b.getFieldValue('VAR_NAME')}", "varVal": ${val}` : "";
        return `{"text": "${b.getFieldValue('TEXT')}", "goto": "${b.getFieldValue('GOTO')}"${varJson}},`;
    });
    assign('logic_check_var', (b) => JSON.stringify({
        action: "check_variable", variable: b.getFieldValue('VAR'), operator: b.getFieldValue('OP'), value: b.getFieldValue('VAL'),
        goto_true: b.getFieldValue('GOTO_TRUE'), goto_false: b.getFieldValue('GOTO_FALSE')
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
    
    // Crear escena inicial
    createNewScene("inicio");
}

// ============================================================
//               LÓGICA DE PESTAÑAS (SERIALIZACIÓN MODERNA)
// ============================================================

function createNewScene(forceName = null) {
    if (currentSceneId) {
        saveCurrentWorkspaceToMemory();
    }

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

    // Guardamos inmediatamente la nueva escena
    saveCurrentWorkspaceToMemory();
    renderSceneList();
}

function switchToScene(targetId) {
    console.log(`Intentando cambiar a: ${targetId}`);
    
    // 1. Guardar lo actual antes de irnos
    if (currentSceneId) {
        saveCurrentWorkspaceToMemory();
    }

    // 2. Limpiar
    workspace.clear();
    currentSceneId = targetId;

    // 3. Cargar datos
    const sceneData = assetState.scenes[targetId];
    
    if (sceneData && sceneData.blocklyState) {
        console.log("Cargando bloques guardados...");
        // ESTA ES LA CLAVE: Cargar el estado visual (JSON del editor, no del juego)
        Blockly.serialization.workspaces.load(sceneData.blocklyState, workspace);
    } else {
        console.log("Escena vacía o corrupta, creando bloque por defecto.");
        const block = workspace.newBlock('def_scene');
        block.setFieldValue(targetId, 'SCENE_ID');
        block.initSvg();
        block.render();
        workspace.scrollCenter();
    }

    renderSceneList();
}

function saveCurrentWorkspaceToMemory() {
    if (!currentSceneId) return;

    // Sincronizar ID
    const topBlocks = workspace.getTopBlocks(true);
    const sceneBlock = topBlocks.find(b => b.type === 'def_scene');
    let code = "";
    
    if (sceneBlock) {
        sceneBlock.setFieldValue(currentSceneId, 'SCENE_ID'); 
        code = Blockly.JavaScript.blockToCode(sceneBlock);
    }

    // GUARDADO MODERNO: Usamos serialization.save
    const state = Blockly.serialization.workspaces.save(workspace);

    assetState.scenes[currentSceneId] = {
        code: code,
        blocklyState: state // Guardamos el objeto de estado, no XML
    };
    
    console.log(`Guardada escena ${currentSceneId}`);
}

// ============================================================
//               EVENTOS UI
// ============================================================
function setupEventListeners() {
    
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
            a.download = "otome_game.zip";
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } catch(e) { alert("Error ZIP: " + e.message); }
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
        
        const label = document.createElement('span');
        label.innerText = `🎬 ${id}`;
        
        const btnDel = document.createElement('button');
        btnDel.className = 'delete-btn';
        btnDel.innerHTML = '✕';
        btnDel.onclick = (e) => {
            e.stopPropagation();
            deleteScene(id);
        };

        item.onclick = () => switchToScene(id);
        item.appendChild(label);
        item.appendChild(btnDel);
        div.appendChild(item);
    });
}

function deleteScene(id) {
    if (!confirm(`¿Borrar escena "${id}"?`)) return;
    delete assetState.scenes[id];
    if (currentSceneId === id) {
        currentSceneId = null;
        workspace.clear();
        const remaining = Object.keys(assetState.scenes);
        if (remaining.length > 0) switchToScene(remaining[0]);
        else createNewScene("inicio");
    } else {
        renderSceneList();
    }
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
    assign('action_set_background', b => `{"action": "set_background", "value": "${b.getFieldValue('BG_IMAGE')}"},`);

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
        assign(`char_${safe}`, b => `{"action": "show_character", "sprite": "${b.getFieldValue('SPRITE')}", "position": "center"}, {"action": "dialogue", "speaker": "${k}", "text": "${b.getFieldValue('TEXT')}"},`);
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