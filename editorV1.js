
// ============================================================
//               1. ESTADO GLOBAL (MEMORIA RAM)
// ============================================================
const assetState = {
    backgrounds: [], 
    characters: {},
    scenes: {} 
};

let workspace = null;
let currentSceneId = null;
// ID del proyecto en la URL
let projectDBId = new URLSearchParams(window.location.search).get('id');

// ============================================================
//               2. INICIALIZACIÓN
// ============================================================
function initEditor() {
    console.log("Iniciando Editor Otome Flow...");

    // Validación de Supabase
    if (!window.sb) {
        alert("Error Crítico: Supabase no está conectado. Revisa supabaseClient.js");
        return;
    }

    if (!projectDBId) {
        if(confirm("⚠️ No hay proyecto seleccionado. ¿Volver al Dashboard?")) {
            window.location.href = "dashboard.html";
        }
        return;
    }

    if (!Blockly.JavaScript) { alert("Error: Falta JS Compressed"); return; }

    // 1. Definir Bloques
    defineStaticBlocks();
    registerStaticGenerators();

    // 2. Inyectar Blockly
    const initialToolbox = `
    <xml>
        <category name="Cargando..." colour="290"></category>
    </xml>`;

    workspace = Blockly.inject('blocklyDiv', {
        toolbox: initialToolbox, 
        scrollbars: true, 
        trashcan: true,
        media: 'https://cdn.jsdelivr.net/npm/blockly/media/'
    });

    Blockly.JavaScript.init(workspace);

    // 3. Configurar UI
    setupEventListeners();

    // 4. Cargar Toolbox BASE inmediatamente
    refreshBlocklyEnv(); 
    
    // 5. Descargar datos de la nube
    loadProjectFromCloud();
}

// ============================================================
//               3. CONEXIÓN NUBE
// ============================================================

async function loadProjectFromCloud() {
    console.log("Cargando proyecto ID:", projectDBId);
    
    const { data, error } = await window.sb
        .from('projects')
        .select('project_data, title')
        .eq('id', projectDBId)
        .single();

    if (error) {
        console.error("Error carga:", error);
        alert("Error cargando proyecto. Revisa consola.");
        return;
    }

    // Restaurar estado
    if (data.project_data && data.project_data.scenes && Object.keys(data.project_data.scenes).length > 0) {
        console.log("Proyecto existente detectado.");
        assetState.scenes = data.project_data.scenes;
        assetState.backgrounds = data.project_data.assets?.backgrounds || [];
        assetState.characters = data.project_data.assets?.characters || {};
        
        //const startScene = data.project_data.startScene || "inicio";
        //const startInput = document.getElementById('startSceneInput');
        //if(startInput) startInput.value = startScene;

        // Actualizar UI
        refreshBlocklyEnv();
        renderAssetList();
        renderSceneList();
        
        // Actualizar el desplegable de personajes con los cargados
        updateCharDropdown();

        const scenes = Object.keys(assetState.scenes);
        switchToScene(scenes[0]);
    } else {
        console.log("Proyecto nuevo: Creando escena 'inicio'...");
        refreshBlocklyEnv(); 
        createNewScene("inicio");
    }
}

async function uploadAssetToCloud(file, folder) {
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${folder}/${Date.now()}_${cleanName}`;

    console.log(`Subiendo a Supabase: ${filePath}`);

    const { data, error } = await window.sb.storage
        .from('otome-assets')
        .upload(filePath, file);

    if (error) {
        console.error("Error subida:", error);
        alert(`❌ Error al subir imagen: ${error.message}`);
        return null;
    }

    const { data: publicData } = window.sb.storage.from('otome-assets').getPublicUrl(filePath);
    
    console.log("Subida exitosa:", publicData.publicUrl);
    
    return {
        name: file.name,
        url: publicData.publicUrl
    };
}

async function saveProjectToCloud() {
    saveCurrentWorkspaceToMemory(); 
    
    const btn = document.getElementById('saveCloudBtn');
    btn.innerText = "⏳ Guardando...";
    btn.disabled = true;

    const editorData = {
        startScene: "inicio",
        //startScene: document.getElementById('startSceneInput').value,
        scenes: assetState.scenes,
        assets: {
            backgrounds: assetState.backgrounds,
            characters: assetState.characters
        }
    };

    const keys = Object.keys(assetState.scenes);
    let allCodes = [];
    keys.forEach(k => {
        if(assetState.scenes[k].code) allCodes.push(assetState.scenes[k].code);
    });

    const jsonStr = `{"start": "${editorData.startScene}", "scenes": { ${allCodes.join(",\n")} }}`;
    
    try {
        const storyData = JSON.parse(jsonStr); 

        const { error } = await window.sb
            .from('projects')
            .update({
                project_data: editorData,
                story_data: storyData
            })
            .eq('id', projectDBId);

        if (error) throw error;

        btn.innerText = "Guardado";
        setTimeout(() => { btn.innerText = "GUARDAR EN LA NUBE"; btn.disabled = false; }, 2000);

    } catch (e) {
        console.error(e);
        alert("Error al guardar: " + e.message);
        btn.innerText = "❌ Error";
        btn.disabled = false;
    }
}

// ============================================================
//               4. GESTIÓN DE ESCENAS
// ============================================================
async function createNewScene(forceName = null) {
    if (currentSceneId) saveCurrentWorkspaceToMemory();

    let name = forceName;
    if (!name) {
        if (typeof Swal !== 'undefined') {
            const { value } = await Swal.fire({
                title: 'Nueva Escena',
                input: 'text',
                inputPlaceholder: 'Nombre de nueva escena',
                showCancelButton: true,
                confirmButtonColor: '#711651',
                confirmButtonText: 'Crear',
                cancelButtonText: 'Cancelar'
            });
            if (!value) return; // Si cancela, no hace nada
            name = value.trim().replace(/\s+/g, '_');
        } else {
            // Fallback por si falla la librería
            name = prompt("Nombre de la nueva escena:");
            if (!name) return;
            name = name.trim().replace(/\s+/g, '_');
        }
    }
    
    // Proteger la escena "inicio"
    if (name.toLowerCase() === "inicio" && assetState.scenes["inicio"]) {
        switchToScene("inicio");
        return;
    }

    if (assetState.scenes[name]) {
        if (typeof Swal !== 'undefined') {
            Swal.fire("Aviso", "Esa escena ya existe. Te llevamos a ella.", "info");
        } else {
            alert("Esa escena ya existe. Te llevamos a ella.");
        }
        switchToScene(name);
        return;
    }

    currentSceneId = name;
    workspace.clear();
    spawnDefaultBlock(name);
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
            console.error("Error restaurando bloques", e);
            spawnDefaultBlock(targetId);
        }
    } else {
        spawnDefaultBlock(targetId);
    }
    renderSceneList();
}

function saveCurrentWorkspaceToMemory() {
    if (!currentSceneId) return;

    // Asegurar inicialización del generador
    Blockly.JavaScript.init(workspace);

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
    block.initSvg(); block.render(); workspace.scrollCenter();
}

// ============================================================
//               5. EVENTOS UI
// ============================================================
function setupEventListeners() {
    
    // --- COLAPSAR BARRA IZQUIERDA ---
    const sidebarLeft = document.getElementById('sidebar-left');
    const toggleLeftBtn = document.getElementById('sidebarToggle');
    
    if (toggleLeftBtn) {
        const toggleLeftIcon = toggleLeftBtn.querySelector('.material-icons');
        toggleLeftBtn.addEventListener('click', () => {
            sidebarLeft.classList.toggle('closed');
            
            // Lógica simétrica:
            if (sidebarLeft.classList.contains('closed')) {
                toggleLeftIcon.innerText = 'chevron_right'; // Si está cerrada, apunta a la derecha para "tirar" de ella
            } else {
                toggleLeftIcon.innerText = 'chevron_left';  // Si está abierta, apunta a la izquierda para "empujarla"
            }
            
            setTimeout(() => Blockly.svgResize(workspace), 350);
        });
    }

    // --- COLAPSAR BARRA DERECHA ---
    const sidebarRight = document.getElementById('sidebar-right');
    const toggleRightBtn = document.getElementById('sidebarRightToggle');
    
    if (toggleRightBtn) {
        const toggleRightIcon = toggleRightBtn.querySelector('.material-icons');
        toggleRightBtn.addEventListener('click', () => {
            sidebarRight.classList.toggle('closed');
            
            // Lógica simétrica:
            if (sidebarRight.classList.contains('closed')) {
                toggleRightIcon.innerText = 'chevron_left';  // Si está cerrada, apunta a la izquierda para "tirar" de ella
            } else {
                toggleRightIcon.innerText = 'chevron_right'; // Si está abierta, apunta a la derecha para "empujarla"
            }
            
            setTimeout(() => Blockly.svgResize(workspace), 350);
        });
    }

    // --- ANADIR FONDO ---
    document.getElementById('bgInput').addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;

        // Comprobar si ya existe
        const existingIndex = assetState.backgrounds.findIndex(b => b.name === file.name);
        
        if (existingIndex !== -1) {
            const { isConfirmed } = await Swal.fire({
                title: 'Fondo Duplicado',
                text: `Ya existe un fondo llamado "${file.name}". ¿Quieres reemplazarlo?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#711651',
                confirmButtonText: 'Sí, reemplazar',
                cancelButtonText: 'Cancelar'
            });

            if (!isConfirmed) {
                e.target.value = '';
                return;
            }
        }

        // Subir a la nube
        const asset = await uploadAssetToCloud(file, 'backgrounds');
        if (asset) {
            if (existingIndex !== -1) {
                // Si existía, lo reemplazamos (actualiza la URL)
                assetState.backgrounds[existingIndex] = asset;
            } else {
                // Si es nuevo, lo añadimos
                assetState.backgrounds.push(asset);
            }
            refreshBlocklyEnv(); 
            renderAssetList();
        }
        e.target.value = '';
    });

    //--- ANADIR SPRITE ---
    document.getElementById('spriteInput').addEventListener('change', async e => {
        const char = document.getElementById('charSelector').value;
        const file = e.target.files[0];
        
        if (!char || !file) return;

        const existingIndex = assetState.characters[char].findIndex(s => s.name === file.name);
        
        if (existingIndex !== -1) {
            const { isConfirmed } = await Swal.fire({
                title: 'Sprite Duplicado',
                text: `Ya existe un sprite llamado "${file.name}" para ${char}. ¿Quieres reemplazarlo?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#711651',
                confirmButtonText: 'Sí, reemplazar',
                cancelButtonText: 'Cancelar'
            });

            if (!isConfirmed) {
                e.target.value = '';
                return;
            }
        }

        const asset = await uploadAssetToCloud(file, 'characters');
        if (asset) {
            if (existingIndex !== -1) assetState.characters[char][existingIndex] = asset;
            else assetState.characters[char].push(asset);
            refreshBlocklyEnv(); renderAssetList();
        }
        e.target.value = '';
    });

    document.getElementById('addCharBtn').addEventListener('click', () => {
        const val = document.getElementById('newCharName').value.trim();
        if(val) { 
            if (!assetState.characters[val]) assetState.characters[val] = [];
            document.getElementById('newCharName').value = ''; 
            refreshBlocklyEnv(); renderAssetList(); updateCharDropdown(val); 
        }
    });

    document.getElementById('charSelector').addEventListener('change', (e) => {
        if(e.target.value) { 
            document.getElementById('spriteUploadSection').style.display = 'block'; 
            document.getElementById('displayCharName').innerText = e.target.value; 
        }
    });

    document.getElementById('newSceneBtn').addEventListener('click', () => createNewScene());
    
    document.getElementById('saveSceneBtn').addEventListener('click', () => {
        saveCurrentWorkspaceToMemory();
        renderSceneList();
        const btn = document.getElementById('saveSceneBtn');
        const old = btn.innerText; btn.innerText = "✔"; setTimeout(()=>btn.innerText=old, 500);
    });

    document.getElementById('saveCloudBtn').addEventListener('click', saveProjectToCloud);
    
    document.getElementById('viewTreeBtn').addEventListener('click', generateStoryTree);
    document.getElementById('closeTreeBtn').addEventListener('click', () => document.getElementById('treeModal').style.display = 'none');
}

// ============================================================
//               6. ÁRBOL VISUAL (MERMAID)
// ============================================================
async function generateStoryTree() {
    saveCurrentWorkspaceToMemory(); 

    // 1. CONFIGURACIÓN MÁGICA: Desactivamos htmlLabels y forzamos la fuente
    let graphDefinition = "%%{init: {'flowchart': {'htmlLabels': false, 'padding': 10}, 'themeVariables': {'fontFamily': 'Poppins, sans-serif'}}}%%\n";
    graphDefinition += "graph TD;\n";
    graphDefinition += "classDef default fill:#fff,stroke:#b48de3,stroke-width:2px;\n";
    graphDefinition += "classDef start fill:#d1e7dd,stroke:#0f5132,stroke-width:3px;\n";
    graphDefinition += "classDef logic fill:#fff3cd,stroke:#ffc107,stroke-width:2px,stroke-dasharray: 5 5;\n";

    const sceneIds = Object.keys(assetState.scenes);
    const startScene = "inicio"; 
    //const startScene = document.getElementById('startSceneInput').value;

    if (sceneIds.length === 0) {
        if (typeof Swal !== 'undefined') Swal.fire("Aviso", "No hay escenas para visualizar.", "info");
        else alert("No hay escenas para visualizar.");
        return;
    }

    sceneIds.forEach(id => {
        const styleClass = (id === startScene) ? ":::start" : "";
        const safeId = id.replace(/[^a-zA-Z0-9]/g, '_');
        
        graphDefinition += `${safeId}["<div style='padding: 0px 25px;'>${id}&nbsp&nbsp&nbsp&nbsp&nbsp</div>"]${styleClass};\n`;        
        
        try {
            const jsonStr = `{ ${assetState.scenes[id].code} }`;
            const sceneObj = JSON.parse(jsonStr);
            const actions = sceneObj[Object.keys(sceneObj)[0]]; 

            actions.forEach(action => {
                if (action.action === "choice") {
                    action.options.forEach(opt => {
                        if (opt.goto) {
                            const safeDest = opt.goto.replace(/[^a-zA-Z0-9]/g, '_');
                            let label = opt.text.substring(0, 15) + (opt.text.length>15?"...":"");
                            if(opt.varVal && opt.varVal != 0) label += ` [${opt.varName} +${opt.varVal}]`;
                            label = label.replace(/"/g, "'");
                            graphDefinition += `${safeId} -->|"${label}"| ${safeDest};\n`;
                        }
                    });
                }
                if (action.action === "check_variable") {
                    const safeTrue = action.goto_true.replace(/[^a-zA-Z0-9]/g, '_');
                    const safeFalse = action.goto_false.replace(/[^a-zA-Z0-9]/g, '_');
                    const logicNode = `${safeId}_LOG_${Math.floor(Math.random()*1000)}`;
                    let opSymbol = action.operator;
                    graphDefinition += `${safeId} -.-> ${logicNode}{{"<div style='padding: 0px 30px;'>¿${action.variable} ${opSymbol} ${action.value}?&nbsp&nbsp&nbsp&nbsp&nbsp</div>"}}:::logic;\n`;
                    graphDefinition += `${logicNode} -->|Sí| ${safeTrue};\n`;
                    graphDefinition += `${logicNode} -->|No| ${safeFalse};\n`;
                }
                if (action.action === "jump") {
                    const safeDest = action.goto.replace(/[^a-zA-Z0-9]/g, '_');
                    graphDefinition += `${safeId} -->|Salto| ${safeDest};\n`;
                }
            });
        } catch (e) { console.error("Error Mermaid:", e); }
    });

    // 2. ABRIMOS EL MODAL PRIMERO PARA QUE EL NAVEGADOR CALCULE EL ESPACIO
    const modal = document.getElementById('treeModal');
    modal.style.display = 'flex';
    
    // Forzamos al navegador a repintar la pantalla (Truco Reflow)
    void modal.offsetWidth;

    // 3. ESPERAMOS 50 MILISEGUNDOS Y DIBUJAMOS
    setTimeout(async () => {
        const container = document.getElementById('mermaidGraph');
        container.innerHTML = graphDefinition;
        container.removeAttribute('data-processed');
        
        try {
            await mermaid.run({ nodes: [container] });
        } catch(err) {
            console.error("Error renderizando gráfico:", err);
            container.innerHTML = "Error al generar gráfico.";
        }
    }, 50);
}

// ============================================================
//               AUXILIARES UI
// ============================================================

function renderSceneList() {
    const div = document.getElementById('sceneList'); 
    div.innerHTML = '';
    const keys = Object.keys(assetState.scenes);
    
    if (!keys.length) { 
        div.innerHTML = '<p class="empty-msg">Vacío</p>'; 
        return; 
    }

    keys.forEach(id => {
        const item = document.createElement('div');
        item.className = `scene-item ${id === currentSceneId ? 'active' : ''}`;
        item.innerHTML = `<span>🎬 ${id}</span> <button class="delete-btn">✕</button>`;
        
        item.addEventListener('click', (e) => { 
            if (e.target.tagName !== 'BUTTON') switchToScene(id); 
        });
        
        item.querySelector('button').addEventListener('click', async (e) => {
            e.stopPropagation(); // Evita que se cargue la escena al darle a la X
            
            // Protección extra para la escena "inicio"
            if (id.toLowerCase() === "inicio") {
                Swal.fire("Acción bloqueada", "La escena 'inicio' es obligatoria y no se puede borrar.", "error");
                return;
            }

            const { isConfirmed } = await Swal.fire({
                title: '¿Borrar escena?',
                text: `¿Estás seguro de que quieres borrar "${id}"? Se perderán todos sus bloques.`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33', // Rojo para peligro
                cancelButtonColor: '#888',
                confirmButtonText: 'Sí, borrar',
                cancelButtonText: 'Cancelar'
            });

            if (isConfirmed) {
                delete assetState.scenes[id]; 
                
                // Si estábamos dentro de esa escena, limpiamos la pantalla y vamos a otra
                if (currentSceneId === id) {
                    currentSceneId = null;
                    workspace.clear();
                    const remaining = Object.keys(assetState.scenes);
                    if (remaining.length > 0) switchToScene(remaining[0]);
                    else createNewScene("inicio");
                } else {
                    renderSceneList(); 
                }

                // Feedback visual de éxito
                Swal.fire({ title: "¡Borrado!", icon: "success", timer: 1500, showConfirmButton: false });
            }
        });
        
        div.appendChild(item);
    });
}

function renderAssetList() {
    const div = document.getElementById('assetList');
    div.innerHTML = ''; 

    // --- RENDERIZAR FONDOS ---
    if(assetState.backgrounds.length > 0){
        const d = document.createElement('div'); 
        d.className = 'tree-category'; 
        d.innerHTML = '<b>Fondos</b>';
        
        const ul = document.createElement('ul'); 
        ul.className = 'tree-list';

        assetState.backgrounds.forEach((f, i) => {
            const li = document.createElement('li'); 
            li.className = 'tree-item';
            
            // Nombre del fondo y botón X
            li.innerHTML = `<span>${f.name}</span><button class="delete-btn" onclick="deleteAsset('bg', null, ${i})">✕</button>`;
            ul.appendChild(li);
        });
        
        d.appendChild(ul); 
        div.appendChild(d);
    }

    // --- RENDERIZAR PERSONAJES Y SUS SPRITES ---
    const charNames = Object.keys(assetState.characters);
    if (charNames.length > 0) {
        const d = document.createElement('div'); 
        d.className = 'tree-category'; 
        d.innerHTML = '<b>Personajes</b>';
        
        charNames.forEach(charName => {
            const charFolder = document.createElement('div'); 
            charFolder.className = 'char-folder';
            
            // Nombre del Personaje y botón X para borrar todo el personaje
            charFolder.innerHTML = `<div class="char-name">${charName} <button class="delete-btn" onclick="deleteAsset('char', '${charName}', null)">✕</button></div>`;
            
            const ul = document.createElement('ul'); 
            ul.className = 'tree-list';
            
            assetState.characters[charName].forEach((f, i) => {
                const li = document.createElement('li'); 
                li.className = 'tree-item';
                
                // Nombre del Sprite y botón X para borrar solo el sprite
                li.innerHTML = `<span>${f.name}</span><button class="delete-btn" onclick="deleteAsset('sprite', '${charName}', ${i})">✕</button>`;
                ul.appendChild(li);
            });
            
            charFolder.appendChild(ul); 
            d.appendChild(charFolder);
        });
        
        div.appendChild(d);
    }
}

// ============================================================
//               BORRAR ASSETS (IMÁGENES Y PERSONAJES)
// ============================================================
// window.deleteAsset = function(type, parentName, index) {
//     if(!confirm("¿Seguro que quieres borrar este elemento? Los bloques que lo usen dejarán de funcionar correctamente.")) {
//         return;
//     }

//     if (type === 'bg') {
//         // Borrar fondo
//         assetState.backgrounds.splice(index, 1);
//     } 
//     else if (type === 'char') {
//         // Borrar personaje completo (carpeta y todos sus sprites)
//         delete assetState.characters[parentName];
//         updateCharDropdown(null); // Actualizar selector izquierdo
//     } 
//     else if (type === 'sprite') {
//         // Borrar un sprite específico dentro de un personaje
//         assetState.characters[parentName].splice(index, 1);
//     }

//     // Al borrar algo, hay que actualizar el menú de Blockly y la lista visual
//     refreshBlocklyEnv(); 
//     renderAssetList();
// };

window.deleteAsset = async function(type, parentName, index) {
    let tituloAlerta = "";
    let textoAlerta = "";

    // 1. Configuramos el texto inteligente según lo que estemos borrando
    if (type === 'bg') {
        const bgName = assetState.backgrounds[index].name;
        tituloAlerta = '¿Borrar Fondo?';
        textoAlerta = `¿Seguro que quieres borrar el fondo "${bgName}"?`;
    } 
    else if (type === 'char') {
        tituloAlerta = '¿Borrar Personaje Completo?';
        textoAlerta = `¿Seguro que quieres borrar a "${parentName}" y todas sus imágenes asociadas?`;
    } 
    else if (type === 'sprite') {
        const spriteName = assetState.characters[parentName][index].name;
        tituloAlerta = '¿Borrar Expresión?';
        textoAlerta = `¿Seguro que quieres borrar la imagen "${spriteName}" de ${parentName}?`;
    }

    // 2. Mostramos el SweetAlert
    const { isConfirmed } = await Swal.fire({
        title: tituloAlerta,
        text: textoAlerta + " Los bloques que lo usen en tus escenas dejarán de funcionar.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33', // Rojo peligro
        cancelButtonColor: '#888',
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar'
    });

    // 3. Si el usuario cancela, no hacemos nada
    if (!isConfirmed) return;

    // 4. Si acepta, borramos los datos de memoria
    if (type === 'bg') {
        assetState.backgrounds.splice(index, 1);
    } 
    else if (type === 'char') {
        delete assetState.characters[parentName];
        updateCharDropdown(null); // Actualizar selector izquierdo
    } 
    else if (type === 'sprite') {
        assetState.characters[parentName].splice(index, 1);
    }

    // 5. Actualizamos el menú de Blockly y la lista visual
    refreshBlocklyEnv(); 
    renderAssetList();

    // 6. Mensaje de éxito
    Swal.fire({
        title: "¡Borrado!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false
    });
};

function updateCharDropdown(sel) {
    const s = document.getElementById('charSelector'); s.innerHTML = '<option disabled>--</option>';
    Object.keys(assetState.characters).forEach(k => s.add(new Option(k,k,false,k===sel)));
    s.dispatchEvent(new Event('change'));
}

// ------------------------------------------------------------------
// BLOQUES ESTÁTICOS
// ------------------------------------------------------------------
function defineStaticBlocks() {
    Blockly.defineBlocksWithJsonArray([
        { type: "def_scene", message0: "Escena ID: %1 %2 Acciones: %3", args0: [{ type: "field_input", name: "SCENE_ID", text: "inicio" }, { type: "input_dummy" }, { type: "input_statement", name: "ACTIONS" }], colour: 290 },
        { type: "action_narrator", message0: "Narrador: %1", args0: [{ type: "field_input", name: "TEXT", text: "..." }], previousStatement: null, nextStatement: null, colour: 160 },
        { type: "choice", message0: "Decisión %1", args0: [{ type: "input_statement", "name": "OPTIONS" }], previousStatement: null, nextStatement: null, colour: 20 },
        { type: "choice_points", message0: "Opción: %1 Efecto: %2 Sumar %3", args0: [{ type: "field_input", name: "TEXT", text: "Respuesta" }, { type: "field_input", name: "VAR_NAME", text: "puntos" }, { type: "field_number", name: "VAR_VAL", value: 1 }], previousStatement: null, nextStatement: null, colour: 45 },
        { type: "choice_option", message0: "Opción: %1 Ir a: %2 %3 Efecto: %4 Sumar %5", args0: [{ type: "field_input", name: "TEXT", text: "Sí" }, { type: "field_input", name: "GOTO", "text": "otra_escena" }, { type: "input_dummy" }, { type: "field_input", name: "VAR_NAME", text: "puntos" }, { type: "field_number", name: "VAR_VAL", value: 0 }], previousStatement: null, nextStatement: null, colour: 45 },
        { type: "logic_check_var", message0: "Juez: Si %1 %2 %3 %4 Ir a: %5 %6 Si no: %7", args0: [{ type: "field_input", name: "VAR", text: "puntos" }, { type: "field_dropdown", name: "OP", options: [["≥", "gte"], [">", "gt"], ["=", "eq"], ["<", "lt"], ["≤", "lte"]] }, { type: "field_number", name: "VAL", value: 5 }, { type: "input_dummy" }, { type: "field_input", name: "GOTO_TRUE", text: "aprobado" }, { type: "input_dummy" }, { type: "field_input", name: "GOTO_FALSE", text: "suspenso" }], previousStatement: null, nextStatement: null, colour: 0 },
        { type: "action_jump", message0: "Ir directamente a escena: %1", args0: [{ type: "field_input", name: "GOTO", "text": "nombre_escena" }], previousStatement: null, nextStatement: null, colour: 210, tooltip: "Cambia de escena automáticamente sin preguntar." }
    ]);
}

function registerStaticGenerators() {
    const generator = Blockly.JavaScript;
    const assign = generator.forBlock ? (k, f) => generator.forBlock[k] = f : (k, f) => generator[k] = f;

    assign('def_scene', b => `${JSON.stringify(b.getFieldValue('SCENE_ID').trim())}: [\n${Blockly.JavaScript.statementToCode(b, 'ACTIONS').replace(/,\s*$/, "")}\n]`);
    assign('action_narrator', b => `{"action": "dialogue", "speaker": "", "text": ${JSON.stringify(b.getFieldValue('TEXT'))}},`);
    assign('choice', b => `{"action": "choice", "options": [${Blockly.JavaScript.statementToCode(b, 'OPTIONS').replace(/,\s*$/, "")}]},`);
    assign('choice_points', b => `{"text": ${JSON.stringify(b.getFieldValue('TEXT'))}, "varName": ${JSON.stringify(b.getFieldValue('VAR_NAME'))}, "varVal": ${b.getFieldValue('VAR_VAL')}},`);
    assign('choice_option', b => {
        const val = b.getFieldValue('VAR_VAL');
        const varJson = (val != 0) ? `, "varName": ${JSON.stringify(b.getFieldValue('VAR_NAME'))}, "varVal": ${val}` : "";
        return `{"text": ${JSON.stringify(b.getFieldValue('TEXT'))}, "goto": ${JSON.stringify(b.getFieldValue('GOTO'))}${varJson}},`;
    });
    assign('logic_check_var', b => JSON.stringify({ action: "check_variable", variable: b.getFieldValue('VAR'), operator: b.getFieldValue('OP'), value: b.getFieldValue('VAL'), goto_true: b.getFieldValue('GOTO_TRUE'), goto_false: b.getFieldValue('GOTO_FALSE') }) + ",");
    assign('action_jump', (b) => {
        const dest = JSON.stringify(b.getFieldValue('GOTO'));
        return `{"action": "jump", "goto": ${dest}},`;
    });
}

function refreshBlocklyEnv() {
    const defs = [];
    
    let bgOpts = assetState.backgrounds.map(f => [f.name, f.url]);
    if(!bgOpts.length) bgOpts=[["(Sin fondos)",""]];

    defs.push({
        "type": "action_set_background", "message0": "Fondo: %1",
        "args0": [{"type": "field_dropdown", "name": "BG_IMAGE", "options": bgOpts}],
        "previousStatement": null, "nextStatement": null, "colour": 230
    });

    const gen = Blockly.JavaScript;
    const assign = gen.forBlock ? (k,f)=>gen.forBlock[k]=f : (k,f)=>gen[k]=f;
    assign('action_set_background', b => `{"action": "set_background", "value": "${b.getFieldValue('BG_IMAGE')}"},`);

    let charXml = '';
    const charNames = Object.keys(assetState.characters);
    
    if (charNames.length > 0) {
        charNames.forEach(k => {
            const safe = k.replace(/[^a-zA-Z0-9]/g, '_');
            let opts = assetState.characters[k].map(f=>[f.name, f.url]);
            if(!opts.length) opts=[["(Sin img)",""]];

            const charDef = {
                "type": `char_${safe}`,
                "message0": `${k} %1 Expr: %2 %3 Dice: %4`,
                "args0": [{"type":"input_dummy"}, {"type":"field_dropdown","name":"SPRITE","options":opts}, {"type":"input_dummy"}, {"type":"field_input","name":"TEXT","text":"..."}],
                "previousStatement": null, "nextStatement": null, "colour": 120
            };
            
            try { Blockly.defineBlocksWithJsonArray([charDef]); } catch(e) {}
            
            assign(`char_${safe}`, b => {
                const sprite = b.getFieldValue('SPRITE');
                const safeText = JSON.stringify(b.getFieldValue('TEXT')); 
                return `{"action": "show_character", "sprite": "${sprite}", "position": "center"}, {"action": "dialogue", "speaker": "${k}", "text": ${safeText}},`;
            });
            charXml += `<block type="char_${safe}"></block>`;
        });
    }

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
            <block type="action_jump"></block>
        </category>
    </xml>`);
}

window.addEventListener('load', initEditor);
