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
    // 1. SOLUCIÓN AL AVATAR: Coger iniciales del nombre o del email
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
    const headerTitle = document.getElementById('headerTitle');

    if (currentProfile.role === 'teacher') {
        if (roleLabel) roleLabel.innerText = "👨‍🏫 Profesor";
        if (fabAdd) fabAdd.style.display = 'flex';
        if (headerTitle) headerTitle.innerText = "Gestión de Clases";
    } else {
        if (roleLabel) roleLabel.innerText = "🎓 Alumno";
        if (fabAdd) fabAdd.style.display = 'none';
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
        if (currentProfile.role === 'teacher') {
            const { data } = await window.sb
                .from('projects')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false });
            projects = data ||[];
        } 
        else {
            const { data: assignments } = await window.sb
                .from('assignments')
                .select('project_id')
                .eq('student_email', currentUser.email);
            
            if (assignments && assignments.length > 0) {
                const projectIds = assignments.map(a => a.project_id);
                const { data } = await window.sb
                    .from('projects')
                    .select('*')
                    .in('id', projectIds);
                projects = data ||[];
            }

            const { data: progress } = await window.sb
                .from('student_progress')
                .select('project_id')
                .eq('user_id', currentUser.id);
            myProgress = progress ||[];
        }

        renderGrid(projects, myProgress);
    } catch (error) {
        console.error("Error al cargar datos:", error);
        if (grid) grid.innerHTML = '<p style="color:red; text-align:center; width:100%;">Error al cargar.</p>';
    }
}

// 3. RENDERIZAR TARJETAS
function renderGrid(projects, myProgress =[]) {
    const grid = document.getElementById('gamesGrid');
    if (!grid) return;
    
    grid.innerHTML = "";

    // 2. SOLUCIÓN "CARGANDO...": Mostrar mensaje correcto si está vacío
    if (!projects || projects.length === 0) {
        grid.innerHTML = `<p style="text-align:center; width:100%; color:#666; font-style:italic;">
            ${currentProfile.role === 'teacher' ? 'Aún no has creado ninguna historia.' : 'No tienes tareas asignadas. ¡Tómate un respiro!'}
        </p>`;
        return;
    }

    const completedIds = new Set(myProgress.map(p => p.project_id));

    projects.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'class-card';
        let footerContent = '';
        let headerExtra = '';

        const safeTitle = proj.title.replace(/'/g, "\\'");
        const safeDesc = (proj.description || "").replace(/'/g, "\\'").replace(/\n/g, " ");

        if (currentProfile.role === 'teacher') {
            headerExtra = `
                <div class="dropdown">
                    <span class="material-icons dropbtn" onclick="toggleMenu(${proj.id})">more_vert</span>
                    <div id="menu-${proj.id}" class="dropdown-content">
                        <a onclick="editProjectMetadata(${proj.id}, '${safeTitle}', '${safeDesc}')">✏️ Editar Info</a>
                        <a onclick="cloneProject(${proj.id})">📑 Duplicar</a>
                        <a onclick="deleteProject(${proj.id})" style="color:red;">🗑️ Borrar</a>
                    </div>
                </div>`;
            
            footerContent = `
                <button onclick="openAssignModal(${proj.id})" class="icon-btn" title="Asignar Alumnos"><span class="material-icons">group_add</span></button>
                <button onclick="openScoresModal(${proj.id})" class="icon-btn" title="Ver Notas"><span class="material-icons">analytics</span></button>
                <div style="flex-grow:1"></div>
                <button onclick="window.location.href='editor.html?id=${proj.id}'" class="icon-btn" title="Editar Bloques"><span class="material-icons">edit_note</span></button>
                <button onclick="window.location.href='game.html?id=${proj.id}'" class="btn-play">PROBAR</button>
            `;
        } else {
            if (completedIds.has(proj.id)) {
                 footerContent = `
                    <div style="color: green; font-weight: bold; width: 100%; text-align: center;">✅ COMPLETADO</div>
                    <button onclick="window.location.href='game.html?id=${proj.id}'" class="icon-btn" title="Repetir">🔄</button>
                `;
            } else {
                 footerContent = `
                    <div style="font-size:0.8rem; color:#d93025; font-weight:bold; margin-right:auto;">Pendiente</div>
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
//               SEGURIDAD CONTRA ERRORES (TRY/CATCH DE EVENTOS)
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

        if (editingProjectId) {
            const { error } = await window.sb.from('projects').update({ title: title, description: desc }).eq('id', editingProjectId);
            if (error) alert("Error al editar: " + error.message);
            else { loadProjects(); document.getElementById('createModal').style.display = 'none'; }
        } else {
            const { data, error } = await window.sb.from('projects').insert([{ 
                title: title, description: desc, user_id: currentUser.id, project_data: {}, story_data: {}    
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

// Botón CSV (Si existe)
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
if (downloadCsvBtn) {
    downloadCsvBtn.addEventListener('click', () => {
        if (!window.currentScoresData || window.currentScoresData.length === 0) return;
        let csvContent = "DNI,Nombre,Apellidos,Email,Clase,Puntuacion,Fecha_Completado\n";
        window.currentScoresData.forEach(s => {
            const p = s.profiles || {};
            const date = new Date(s.completed_at).toLocaleDateString();
            csvContent += `"${p.dni || ''}","${p.first_name || ''}","${p.last_name || ''}","${s.user_email}","${p.class_name || ''}",${s.score},"${date}"\n`;
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.setAttribute("href", URL.createObjectURL(blob));
        link.setAttribute("download", "calificaciones_otomeflow.csv");
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
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

window.openScoresModal = async (id) => {
    document.getElementById('scoresModal').style.display = 'flex';
    const list = document.getElementById('scoresList');
    list.innerHTML = "Cargando...";

    const { data: scores } = await window.sb
        .from('student_progress')
        .select(`score, completed_at, user_email, profiles (first_name, last_name, dni, class_name)`)
        .eq('project_id', id)
        .order('score', { ascending: false });

    window.currentScoresData = scores ||[];

    if(!scores || scores.length === 0) {
        list.innerHTML = "<p>Nadie ha completado esta historia aún.</p>";
        return;
    }

    let html = '<table style="width:100%; text-align:left; border-collapse: collapse;">';
    html += '<tr style="border-bottom:2px solid #ddd;"><th>Alumno</th><th>Nota</th><th>Fecha</th></tr>';
    scores.forEach(s => {
        const p = s.profiles || {};
        const name = p.first_name ? `${p.first_name} ${p.last_name}` : s.user_email;
        const date = new Date(s.completed_at).toLocaleDateString();
        html += `<tr style="border-bottom:1px solid #eee;"><td style="padding:8px;">${name}</td><td style="padding:8px; font-weight:bold; color:#711651;">${s.score}</td><td style="padding:8px; color:#666;">${date}</td></tr>`;
    });
    html += '</table>';
    list.innerHTML = html;
};

window.editProjectMetadata = (id, title, desc) => {
    editingProjectId = id;
    document.getElementById('newTitle').value = title;
    document.getElementById('newDesc').value = desc === 'undefined' ? '' : desc; 
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

// Arrancar
initDashboard();