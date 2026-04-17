// ============================================================
//               DASHBOARD REAL FINAL (CORREGIDO)
// ============================================================

let currentUser = null;
let currentProfile = null; 
let editingProjectId = null;
let currentAssignId = null;

// 1. INICIO Y AUTENTICACIÓN
async function initDashboard() {
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = session.user;

    const { data: profile } = await window.sb
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    currentProfile = profile || { role: 'student' };
    
    setupUIByRole();
    loadProjects();
}

function setupUIByRole() {
    // Avatar: Coger iniciales del nombre o del email
    let initials = "U";
    if (currentProfile.first_name && currentProfile.last_name) {
        initials = currentProfile.first_name[0].toUpperCase() + currentProfile.last_name[0].toUpperCase();
    } else if (currentProfile.first_name) {
        initials = currentProfile.first_name.substring(0, 2).toUpperCase();
    } else if (currentUser.email) {
        initials = currentUser.email[0].toUpperCase();
    }
    
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl) avatarEl.innerText = initials;
    
    // Etiqueta de Rol
    const roleLabel = document.getElementById('roleLabel');
    const fabAdd = document.getElementById('fabAdd');
    const btnImport = document.getElementById('btnImportDash');
    const headerTitle = document.getElementById('headerTitle');

    if (currentProfile.role === 'teacher') {
        if (roleLabel) roleLabel.innerText = "Profesor";
        if (fabAdd) fabAdd.style.display = 'flex';
        if (btnImport) btnImport.style.display = 'inline-block';
        if (headerTitle) headerTitle.innerText = "Gestión de Clases";
    } else {
        if (roleLabel) roleLabel.innerText = "Alumno";
        if (fabAdd) fabAdd.style.display = 'none';
        if (btnImport) btnImport.style.display = 'none';
        if (headerTitle) headerTitle.innerText = "Mis Tareas";
    }
}

// 2. CARGAR PROYECTOS
async function loadProjects() {
    const grid = document.getElementById('gamesGrid');
    if (grid) grid.innerHTML = '<p style="text-align:center; width:100%;">Cargando...</p>';

    let projects = [];
    let myProgress =[];

    try {
        // --- PROFESOR: Sus proyectos ---
        if (currentProfile.role === 'teacher') {
            console.log("Cargando proyectos como Profesor...");
            const { data, error } = await window.sb
                .from('projects')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            projects = data ||[];
        } 
        
        // --- ALUMNO: Proyectos asignados ---
        else {
            console.log("Cargando asignaciones como Alumno para:", currentUser.email);
            
            // 1. Buscar asignaciones para mi email
            const { data: assignments, error: assignError } = await window.sb
                .from('assignments')
                .select('project_id')
                .eq('student_email', currentUser.email);
            
            if (assignError) throw assignError;
            console.log("Asignaciones encontradas:", assignments);

            if (assignments && assignments.length > 0) {
                // 2. Extraer solo los IDs de los proyectos
                const projectIds = assignments.map(a => a.project_id);
                
                // 3. Cargar los detalles de esos proyectos
                const { data: projData, error: projError } = await window.sb
                    .from('projects')
                    .select('*')
                    .in('id', projectIds);
                
                if (projError) throw projError;
                projects = projData ||[];
            }

            // 4. Cargar mi progreso (Importante: pedir project_id y score)
            const { data: progress, error: progError } = await window.sb
                .from('student_progress')
                .select('project_id, score')
                .eq('user_id', currentUser.id);
            
            if (progError) throw progError;
            myProgress = progress ||[];
            console.log("Mi progreso cargado:", myProgress);
        }

        renderGrid(projects, myProgress);

    } catch (error) {
        console.error("❌ Error al cargar datos:", error);
        if (grid) grid.innerHTML = '<p style="color:red; text-align:center; width:100%;">Error al cargar las historias. Revisa la consola.</p>';
    }
}

// 3. RENDERIZAR TARJETAS
function renderGrid(projects, myProgress =[]) {
    const grid = document.getElementById('gamesGrid');
    if (!grid) return;
    
    grid.innerHTML = "";

    if (!projects || projects.length === 0) {
        grid.innerHTML = `<p style="text-align:center; width:100%; color:#666; font-style:italic;">
            ${currentProfile.role === 'teacher' ? 'Aún no has creado ninguna historia.' : 'No tienes tareas asignadas. ¡Tómate un respiro!'}
        </p>`;
        return;
    }

    projects.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'class-card';
        let footerContent = '';
        let headerExtra = '';

        const safeTitle = proj.title.replace(/'/g, "\\'");
        const safeDesc = (proj.description || "").replace(/'/g, "\\'").replace(/\n/g, " ");
        
        // Obtenemos los intentos máximos (0 = sin límite)
        const maxAttempts = (proj.project_data && proj.project_data.max_attempts) ? proj.project_data.max_attempts : 0;

        if (currentProfile.role === 'teacher') {
            // VISTA PROFESOR (Añadido botón Compartir)
            headerExtra = `
                <div class="dropdown">
                    <span class="material-icons dropbtn" onclick="toggleMenu(${proj.id})">more_vert</span>
                    <div id="menu-${proj.id}" class="dropdown-content">
                        <a onclick="editProjectMetadata(${proj.id}, '${safeTitle}', '${safeDesc}', ${maxAttempts})">Editar Info</a>
                        <a onclick="openShareModal(${proj.id})">Compartir con Profe</a>
                        <a onclick="cloneProject(${proj.id})">Duplicar</a>
                        <a id="export-btn-${proj.id}" onclick="exportZip(${proj.id})">Exportar Proyecto</a>
                        <a onclick="deleteProject(${proj.id})" style="color:red;">Borrar</a>
                    </div>
                </div>`;
            
            footerContent = `
                <button onclick="editProjectMetadata(${proj.id}, '${safeTitle}', '${safeDesc}', ${maxAttempts})" class="icon-btn" title="Editar Info" style="background:#e0c3fc; color:#4a148c; border-radius:15px;">
                    Ajustes
                </button>
                <button onclick="openAssignModal(${proj.id})" class="icon-btn" title="Asignar Alumnos"><span class="material-icons">group_add</span></button>
                <button onclick="openScoresModal(${proj.id})" class="icon-btn" title="Ver Notas"><span class="material-icons">analytics</span></button>
                <div class="footer-spacer"></div> <!-- <<--- ESTO EMPUJA LOS BOTONES DE EDICIÓN Y PLAY A LA DERECHA -->
                <button onclick="window.location.href='editor.html?id=${proj.id}'" class="icon-btn" title="Editar Bloques"><span class="material-icons">edit_note</span></button>
                <button onclick="window.location.href='game.html?id=${proj.id}'" class="btn-play">PROBAR</button>
            `;
        } else {
            // --- VISTA ALUMNO ---
            // 1. Buscamos todas las partidas que ha jugado este alumno en este proyecto
            const myAttempts = myProgress.filter(p => p.project_id === proj.id);
            const attemptsCount = myAttempts.length;
            const hasLimit = maxAttempts > 0;
            const reachedLimit = hasLimit && attemptsCount >= maxAttempts;
            const attemptsText = hasLimit ? `(Intentos: ${attemptsCount}/${maxAttempts})` : `(Intentos: ${attemptsCount})`;

            if (reachedLimit) {
                 // Si alcanzó el límite, buscamos su nota más alta
                 const maxScore = Math.max(...myAttempts.map(a => a.score || 0));
                 footerContent = `
                    <div style="color: #d32f2f; font-weight: bold; width: 100%; text-align: center; font-size: 0.85rem;">
                        ⛔ LÍMITE ALCANZADO ${attemptsText} <br> Nota: ${maxScore}
                    </div>
                `;
            } else if (attemptsCount > 0) {
                 // Si lo ha completado pero aún puede repetir, le enseñamos su nota más alta
                 const maxScore = Math.max(...myAttempts.map(a => a.score || 0));
                 footerContent = `
                    <div style="color: green; font-weight: bold; font-size: 0.85rem; margin-right:auto;">
                        ✅ COMPLETADO ${attemptsText} <br> Nota más alta: ${maxScore}
                    </div>
                    <button onclick="window.location.href='game.html?id=${proj.id}'" class="icon-btn" title="Repetir">🔄</button>
                `;
            } else {
                 // Si no lo ha hecho nunca
                 footerContent = `
                    <div style="font-size:0.8rem; color:#d93025; font-weight:bold; margin-right:auto;">Pendiente ${hasLimit ? attemptsText : ''}</div>
                    <button onclick="window.location.href='game.html?id=${proj.id}'" class="btn-play">JUGAR</button>
                `;
            }
        }

        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${proj.title}</div>
                <div class="card-subtitle">ID: ${proj.id}</div>
                ${headerExtra}
            </div>
            <div class="card-body">${proj.description || "Sin descripción."}</div>
            <div class="card-footer">${footerContent}</div>
        `;
        grid.appendChild(card);
    });
}

// ============================================================
//       SEGURIDAD CONTRA ERRORES (TRY/CATCH DE EVENTOS)
// ============================================================

// Asignar form
const assignForm = document.getElementById('assignForm');
if (assignForm) {
    assignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('studentEmail').value.trim();
        if(!email) return;
        const { error } = await window.sb.from('assignments').insert([{
            project_id: currentAssignId, student_email: email, assigned_by: currentUser.id
        }]);
        if(error) {
            if(error.code === '23505') alert("⚠️ Alumno ya asignado.");
            else alert("Error: " + error.message);
        } else {
            document.getElementById('studentEmail').value = '';
            await loadAssignedStudents(currentAssignId);
        }
    });
}

// Crear/Editar form
const createForm = document.getElementById('createForm');
if (createForm) {
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('newTitle').value;
        const desc = document.getElementById('newDesc').value;
        
        // LEER LOS INTENTOS DEL NUEVO INPUT (Si existe, si no, 0)
        const maxAttInput = document.getElementById('newMaxAttempts');
        const maxAttempts = maxAttInput ? (parseInt(maxAttInput.value) || 0) : 0;

        if (editingProjectId) {
            // MODO EDICIÓN: Primero leemos project_data actual para no borrar las escenas guardadas
            const { data: existing } = await window.sb.from('projects').select('project_data').eq('id', editingProjectId).single();
            let pData = existing.project_data || {};
            pData.max_attempts = maxAttempts; // Actualizamos los intentos

            const { error } = await window.sb.from('projects').update({ title: title, description: desc, project_data: pData }).eq('id', editingProjectId);
            
            if (error) alert("Error al editar: " + error.message);
            else { loadProjects(); document.getElementById('createModal').style.display = 'none'; }
        } else {
            // MODO CREACIÓN
            const { data, error } = await window.sb.from('projects').insert([{ 
                title: title, 
                description: desc, 
                user_id: currentUser.id, 
                project_data: { max_attempts: maxAttempts }, 
                story_data: {}    
            }]).select();
            
            if (error) alert("Error al crear: " + error.message);
            else window.location.href = `editor.html?id=${data[0].id}`; 
        }
    });
}

// Botones de Modales
const fabAdd = document.getElementById('fabAdd');
if (fabAdd) fabAdd.onclick = () => {
    editingProjectId = null;
    document.getElementById('createForm').reset();
    
    // Resetear el campo de intentos
    const maxAttInput = document.getElementById('newMaxAttempts');
    if (maxAttInput) maxAttInput.value = 0; 

    document.querySelector('#createModal h2').innerText = "Nueva Historia";
    document.querySelector('#createForm button[type="submit"]').innerText = "Crear";
    document.getElementById('createModal').style.display = 'flex';
};

const closeModal = document.getElementById('closeModal');
if (closeModal) closeModal.onclick = () => document.getElementById('createModal').style.display = 'none';

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await window.sb.auth.signOut();
        window.location.href = 'index.html';
    });
}

// ============================================================
//                   DESCARGAR CSV DE NOTAS
// ============================================================
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
if (downloadCsvBtn) {
    downloadCsvBtn.addEventListener('click', () => {
        if (!window.currentScoresData || window.currentScoresData.length === 0) return;

        // Crear cabecera CSV
        let csvContent = "DNI,Nombre,Apellidos,Email,Clase,Puntuacion_Maxima,Fecha\n";

        // Añadir filas
        window.currentScoresData.forEach(s => {
            // Transformar el -1 a texto "Pendiente" para el Excel
            const scoreStr = s.score === -1 ? 'Pendiente' : s.score;
            
            csvContent += `"${s.dni}","${s.first_name}","${s.last_name}","${s.email}","${s.class_name}","${scoreStr}","${s.date}"\n`;
        });

        // Descargar archivo
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "calificaciones_otomeflow.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

// Asignar por Clase (Si existe)
const assignClassForm = document.getElementById('assignClassForm');
if (assignClassForm) {
    assignClassForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const className = document.getElementById('classSelect').value;
        if(!className) return;

        const { data: students } = await window.sb.from('profiles').select('email').eq('role', 'student').eq('class_name', className);
        if (!students || students.length === 0) { alert("No hay alumnos en esa clase."); return; }

        const assigns = students.map(s => ({ project_id: currentAssignId, student_email: s.email, assigned_by: currentUser.id }));
        let count = 0;
        for (let a of assigns) {
            const { error } = await window.sb.from('assignments').insert([a]);
            if (!error) count++;
        }
        alert(`Asignado a ${count} alumnos de ${className}.`);
        await loadAssignedStudents(currentAssignId);
    });
}

// ============================================================
//               FUNCIONES AUXILIARES GLOBALES
// ============================================================

window.openAssignModal = async (id) => {
    currentAssignId = id;
    document.getElementById('assignModal').style.display = 'flex';
    await loadAssignedStudents(id);
    
    // Cargar clases si existe el select
    const select = document.getElementById('classSelect');
    if (select) {
        const { data: classes } = await window.sb.from('profiles').select('class_name').eq('role', 'student').not('class_name', 'is', null);
        const unique =[...new Set(classes.map(c => c.class_name))];
        select.innerHTML = '<option value="" disabled selected>Elige una clase...</option>';
        unique.forEach(c => { if(c.trim() !== '') select.innerHTML += `<option value="${c}">${c}</option>`; });
    }
};

async function loadAssignedStudents(projectId) {
    const list = document.getElementById('assignedList');
    if (!list) return;
    list.innerHTML = "<li>Cargando...</li>";
    const { data } = await window.sb.from('assignments').select('student_email, created_at').eq('project_id', projectId).order('created_at', { ascending: false });
    list.innerHTML = "";
    if (!data || data.length === 0) { list.innerHTML = "<li>Aún no hay alumnos asignados.</li>"; return; }
    data.forEach(a => {
        const li = document.createElement('li'); li.innerHTML = `👤 ${a.student_email}`;
        li.style.padding = "5px 0"; li.style.borderBottom = "1px solid #eee";
        list.appendChild(li);
    });
}

// ============================================================
//                          VER NOTAS
// ============================================================

window.openScoresModal = async (id) => {
    document.getElementById('scoresModal').style.display = 'flex';
    const list = document.getElementById('scoresList');
    list.innerHTML = "Cargando datos...";

    // 1. Obtener a TODOS los alumnos asignados a este proyecto
    const { data: assignments } = await window.sb
        .from('assignments')
        .select('student_email')
        .eq('project_id', id);

    if (!assignments || assignments.length === 0) {
        list.innerHTML = "<p>No has asignado esta historia a ningún alumno aún.</p>";
        return;
    }

    const assignedEmails = assignments.map(a => a.student_email);

    // 2. Obtener los datos personales de esos alumnos (Nombre, DNI, Clase)
    const { data: profiles } = await window.sb
        .from('profiles')
        .select('email, first_name, last_name, dni, class_name')
        .in('email', assignedEmails);

    // 3. Obtener todo el progreso guardado para este proyecto
    const { data: progress } = await window.sb
        .from('student_progress')
        .select('user_email, score, completed_at')
        .eq('project_id', id);

    // 4. Cruzar datos: Crear un mapa con todos los alumnos asignados
    const studentDataMap = {};
    
    // Inicializamos a todos con nota "-1" (Pendiente)
    if (profiles) {
        profiles.forEach(p => {
            studentDataMap[p.email] = {
                email: p.email,
                first_name: p.first_name || '',
                last_name: p.last_name || '',
                dni: p.dni || '-',
                class_name: p.class_name || '-',
                score: -1, // -1 significa "No completado"
                date: '-'
            };
        });
    }

    // Buscamos la NOTA MÁS ALTA de cada alumno que haya jugado
    if (progress) {
        progress.forEach(p => {
            const email = p.user_email;
            if (studentDataMap[email]) {
                // Si la nota guardada es mayor que la que teníamos registrada, la actualizamos
                if (p.score > studentDataMap[email].score) {
                    studentDataMap[email].score = p.score;
                    studentDataMap[email].date = new Date(p.completed_at).toLocaleDateString();
                }
            }
        });
    }

    // Convertir el mapa a un array para poder ordenarlo
    let finalScores = Object.values(studentDataMap);
    
    // Ordenar: Primero los que tienen nota (de mayor a menor), luego los pendientes (-1)
    finalScores.sort((a, b) => b.score - a.score);

    // Guardar globalmente para poder exportarlo a CSV luego
    window.currentScoresData = finalScores;

    // 5. Dibujar la tabla HTML
    let html = '<table style="width:100%; text-align:left; border-collapse: collapse;">';
    html += '<tr style="border-bottom:2px solid #ddd;"><th>Alumno</th><th>Clase</th><th>Nota</th><th>Fecha</th></tr>';
    
    finalScores.forEach(s => {
        const name = s.first_name ? `${s.first_name} ${s.last_name}` : s.email;
        // Si la nota es -1, mostramos un guion "-"
        const displayScore = s.score === -1 ? '<span style="color:#888; font-weight:normal;">-</span>' : s.score;
        
        html += `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px;">${name}</td>
            <td style="padding:8px; font-size:0.85rem; color:#666;">${s.class_name}</td>
            <td style="padding:8px; font-weight:bold; color:#711651;">${displayScore}</td>
            <td style="padding:8px; color:#666; font-size:0.85rem;">${s.date}</td>
        </tr>`;
    });
    html += '</table>';
    list.innerHTML = html;
};

window.editProjectMetadata = (id, title, desc, maxAtt) => {
    editingProjectId = id;
    document.getElementById('newTitle').value = title;
    document.getElementById('newDesc').value = desc === 'undefined' ? '' : desc; 
    const maxAttInput = document.getElementById('newMaxAttempts');
    if (maxAttInput) maxAttInput.value = maxAtt || 0;
    document.querySelector('#createModal h2').innerText = "Editar Información";
    document.querySelector('#createForm button[type="submit"]').innerText = "Guardar Cambios";
    document.getElementById('createModal').style.display = 'flex';
};

window.cloneProject = async (id) => {
    if(!confirm("¿Crear una copia exacta de este proyecto?")) return;
    const { data: original } = await window.sb.from('projects').select('*').eq('id', id).single();
    if (!original) return;
    const { error } = await window.sb.from('projects').insert([{
        title: original.title + " (Copia)", description: original.description, user_id: currentUser.id, project_data: original.project_data, story_data: original.story_data
    }]);
    if(error) alert("Error: " + error.message);
    else { alert("¡Duplicado!"); loadProjects(); }
};

// ============================================================
//               COMPARTIR PROYECTO CON OTRO PROFESOR
// ============================================================
let currentShareId = null;

// Abrir el Modal
window.openShareModal = (id) => {
    currentShareId = id;
    document.getElementById('shareModal').style.display = 'flex';
    document.getElementById('teacherEmail').value = ''; // Limpiar input
};

// Evento del formulario de compartir
const shareForm = document.getElementById('shareForm');
if (shareForm) {
    shareForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailToShare = document.getElementById('teacherEmail').value.trim();
        if (!emailToShare) return;

        // 1. Buscar al profesor por email
        const { data: targetProfile, error: searchError } = await window.sb
            .from('profiles')
            .select('id, role')
            .eq('email', emailToShare.toLowerCase())
            .single();

        if (searchError || !targetProfile) {
            alert("❌ No se encontró ningún usuario con ese correo registrado.");
            return;
        }
        if (targetProfile.role !== 'teacher') {
            alert("⚠️ El usuario encontrado es un Alumno. Solo puedes compartir con Profesores.");
            return;
        }

        // 2. Obtener el proyecto original
        const { data: original } = await window.sb.from('projects').select('*').eq('id', currentShareId).single();
        if (!original) return;

        // 3. Crear copia para el nuevo profesor (Bypass de RLS con la nueva regla)
        const { error: cloneError } = await window.sb.from('projects').insert([{
            title: original.title + " (Compartido)",
            description: original.description,
            user_id: targetProfile.id, // Asignado al profesor nuevo
            project_data: original.project_data,
            story_data: original.story_data
        }]);

        if (cloneError) {
            alert("Error al compartir: " + cloneError.message);
        } else {
            alert("✅ ¡Proyecto enviado con éxito a " + emailToShare + "!");
            document.getElementById('shareModal').style.display = 'none';
        }
    });
}

// ============================================================
//               EXPORTAR PROYECTO A ZIP DESDE DASHBOARD
// ============================================================
window.exportZip = async (id) => {
    // 1. Mostrar estado de carga
    const btn = document.querySelector(`#menu-${id} a:first-child`); // El botón del menú
    const originalText = btn.innerText;
    btn.innerText = "⏳ Empaquetando...";
    btn.style.pointerEvents = "none";

    try {
        // 2. Obtener los datos del proyecto de Supabase
        const { data: project, error } = await window.sb
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !project) throw new Error("No se encontró el proyecto.");

        const zip = new JSZip();
        const pData = project.project_data || {};

        // 3. Añadir los JSON al ZIP
        zip.file("story.json", JSON.stringify(project.story_data, null, 2));
        zip.file("project_data.json", JSON.stringify(pData, null, 2));

        // 4. Función auxiliar para descargar una imagen de una URL y meterla al ZIP
        const bgFolder = zip.folder("assets").folder("backgrounds");
        const charFolder = zip.folder("assets").folder("characters");

        // Descargar Fondos
        const backgrounds = pData.assets?.backgrounds ||[];
        for (const bg of backgrounds) {
            try {
                const response = await fetch(bg.url);
                const blob = await response.blob();
                bgFolder.file(bg.name, blob);
            } catch (err) {
                console.warn("No se pudo empaquetar el fondo:", bg.name);
            }
        }

        // Descargar Personajes
        const characters = pData.assets?.characters || {};
        for (const charName of Object.keys(characters)) {
            const sprites = characters[charName];
            const specificCharFolder = charFolder.folder(charName);
            
            for (const sprite of sprites) {
                try {
                    const response = await fetch(sprite.url);
                    const blob = await response.blob();
                    specificCharFolder.file(sprite.name, blob);
                } catch (err) {
                    console.warn("No se pudo empaquetar el sprite:", sprite.name);
                }
            }
        }

        // 5. Generar y Descargar el ZIP
        const blob = await zip.generateAsync({ type: "blob" });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        
        // Limpiar título para el nombre del archivo
        const safeTitle = project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `otome_${safeTitle}.zip`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Restaurar botón
        btn.innerText = "✅ ¡Descargado!";
        setTimeout(() => {
            btn.innerText = originalText;
            btn.style.pointerEvents = "auto";
        }, 2000);

    } catch (error) {
        console.error(error);
        alert("Error al exportar el ZIP: " + error.message);
        btn.innerText = originalText;
        btn.style.pointerEvents = "auto";
    }
};

window.deleteProject = async (id) => {
    if(confirm("¿Seguro? Se borrará todo.")) {
        await window.sb.from('assignments').delete().eq('project_id', id);
        await window.sb.from('student_progress').delete().eq('project_id', id);
        await window.sb.from('projects').delete().eq('id', id);
        loadProjects();
    }
};

window.toggleMenu = (id) => { document.getElementById(`menu-${id}`).classList.toggle("show"); };

window.onclick = function(event) {
    if (!event.target.matches('.dropbtn')) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        for (var i = 0; i < dropdowns.length; i++) {
            if (dropdowns[i].classList.contains('show')) dropdowns[i].classList.remove('show');
        }
    }
}

// ============================================================
//               IMPORTAR ZIP COMO PROYECTO NUEVO
// ============================================================

function setupImportButton() {
    const btnImportDash = document.getElementById('btnImportDash');
    const importInput = document.getElementById('importInput');

    if (!btnImportDash || !importInput) {
        console.error("❌ No se encontraron los elementos para importar ZIP en el HTML.");
        return;
    }

    // 1. Al hacer clic en el botón naranja, hacemos clic falso en el input invisible
    btnImportDash.addEventListener('click', () => {
        importInput.click();
    });

    // 2. Cuando el usuario selecciona un archivo, arranca la magia
    importInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const oldText = btnImportDash.innerText;
        btnImportDash.innerText = "⏳ Importando...";
        btnImportDash.disabled = true;

        try {
            const zip = await JSZip.loadAsync(file);

            const pDataFile = zip.file("project_data.json");
            const sDataFile = zip.file("story.json");

            if (!pDataFile || !sDataFile) {
                throw new Error("El ZIP no es válido o no fue generado por Otome Flow.");
            }

            let pDataStr = await pDataFile.async("string");
            let sDataStr = await sDataFile.async("string");
            const pDataObj = JSON.parse(pDataStr);

            // Subir FONDOS
            const backgrounds = pDataObj.assets?.backgrounds ||[];
            for (let bg of backgrounds) {
                const zipFile = zip.file(`assets/backgrounds/${bg.name}`);
                if (zipFile && bg.url) {
                    const blob = await zipFile.async("blob");
                    const cleanName = bg.name.replace(/[^a-zA-Z0-9.-]/g, "_");
                    const newPath = `backgrounds/${Date.now()}_${cleanName}`;
                    
                    await window.sb.storage.from('otome-assets').upload(newPath, blob);
                    const { data: pubData } = window.sb.storage.from('otome-assets').getPublicUrl(newPath);
                    
                    pDataStr = pDataStr.split(bg.url).join(pubData.publicUrl);
                    sDataStr = sDataStr.split(bg.url).join(pubData.publicUrl);
                }
            }

            // Subir PERSONAJES
            const characters = pDataObj.assets?.characters || {};
            for (let charName of Object.keys(characters)) {
                for (let sp of characters[charName]) {
                    const zipFile = zip.file(`assets/characters/${charName}/${sp.name}`);
                    if (zipFile && sp.url) {
                        const blob = await zipFile.async("blob");
                        const cleanName = sp.name.replace(/[^a-zA-Z0-9.-]/g, "_");
                        const newPath = `characters/${Date.now()}_${cleanName}`;
                        
                        await window.sb.storage.from('otome-assets').upload(newPath, blob);
                        const { data: pubData } = window.sb.storage.from('otome-assets').getPublicUrl(newPath);
                        
                        pDataStr = pDataStr.split(sp.url).join(pubData.publicUrl);
                        sDataStr = sDataStr.split(sp.url).join(pubData.publicUrl);
                    }
                }
            }

            // Crear el proyecto
            const newTitle = prompt("Nombre para la copia importada:", "Copia - " + (pDataObj.startScene || "Proyecto"));
            if (!newTitle) throw new Error("Cancelado");

            const { error } = await window.sb.from('projects').insert([{
                title: newTitle,
                description: "Restaurado desde copia de seguridad ZIP",
                user_id: currentUser.id,
                project_data: JSON.parse(pDataStr),
                story_data: JSON.parse(sDataStr)
            }]);

            if (error) throw error;

            alert("✅ ¡Proyecto importado y guardado en la nube con éxito!");
            loadProjects(); 

        } catch (error) {
            if (error.message !== "Cancelado") {
                alert("❌ Error al importar: " + error.message);
            }
        }

        btnImportDash.innerText = oldText;
        btnImportDash.disabled = false;
        e.target.value = ''; 
    });
}

// Arrancamos el listener del botón
setupImportButton();

// Arrancar
initDashboard();