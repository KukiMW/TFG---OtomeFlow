// ============================================================
//               DASHBOARD REAL FINAL
// ============================================================

let currentUser = null;
let currentProfile = null; // { role: 'teacher' | 'student' }
let editingProjectId = null;
let currentAssignId = null; // ID del proyecto que estamos asignando

// 1. INICIO Y AUTENTICACIÓN
async function initDashboard() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    currentUser = session.user;

    // Obtener rol real
    const { data: profile } = await sb
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    currentProfile = profile || { role: 'student' };
    
    setupUIByRole();
    loadProjects();
}

function setupUIByRole() {
    // Avatar
    document.getElementById('userAvatar').innerText = currentUser.email[0].toUpperCase();
    
    // Etiqueta de Rol
    const roleLabel = document.getElementById('roleLabel');
    if (currentProfile.role === 'teacher') {
        roleLabel.innerText = "👨‍🏫 Profesor";
        document.getElementById('fabAdd').style.display = 'flex';
        document.getElementById('headerTitle').innerText = "Gestión de Clases";
    } else {
        roleLabel.innerText = "🎓 Alumno";
        document.getElementById('fabAdd').style.display = 'none';
        document.getElementById('headerTitle').innerText = "Mis Tareas";
    }
}

// 2. CARGAR PROYECTOS
async function loadProjects() {
    const grid = document.getElementById('gamesGrid');
    grid.innerHTML = '<p>Cargando...</p>';

    let projects = [];
    let myProgress = [];

    // --- PROFESOR: Sus proyectos ---
    if (currentProfile.role === 'teacher') {
        const { data } = await sb
            .from('projects')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        projects = data || [];
    } 
    
    // --- ALUMNO: Proyectos asignados ---
    else {
        // 1. Buscar asignaciones
        const { data: assignments } = await sb
            .from('assignments')
            .select('project_id')
            .eq('student_email', currentUser.email);
        
        if (assignments && assignments.length > 0) {
            const projectIds = assignments.map(a => a.project_id);
            // 2. Cargar detalles (GRACIAS A LA NUEVA POLÍTICA SQL, AHORA ESTO FUNCIONARÁ)
            const { data } = await sb
                .from('projects')
                .select('*')
                .in('id', projectIds);
            projects = data || [];
        }

        // 3. Cargar progreso
        const { data: progress } = await sb
            .from('student_progress')
            .select('project_id')
            .eq('user_id', currentUser.id);
        myProgress = progress || [];
    }

    renderGrid(projects, myProgress);
}

// 3. RENDERIZAR
function renderGrid(projects, myProgress = []) {
    const grid = document.getElementById('gamesGrid');
    grid.innerHTML = "";

    if (!projects || projects.length === 0) {
        grid.innerHTML = "<p>No hay historias disponibles.</p>";
        return;
    }

    const completedIds = new Set(myProgress.map(p => p.project_id));

    projects.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'class-card';
        let footerContent = '';
        let headerExtra = '';

        if (currentProfile.role === 'teacher') {
            // PROFESOR
            headerExtra = `
                <div class="dropdown">
                    <span class="material-icons dropbtn" onclick="toggleMenu(${proj.id})">more_vert</span>
                    <div id="menu-${proj.id}" class="dropdown-content">
                        <a onclick="deleteProject(${proj.id})" style="color:red;">🗑️ Borrar</a>
                    </div>
                </div>`;
            
            footerContent = `
                <button onclick="openAssignModal(${proj.id})" class="icon-btn" title="Asignar Alumnos"><span class="material-icons">group_add</span></button>
                <button onclick="openScoresModal(${proj.id})" class="icon-btn" title="Ver Notas"><span class="material-icons">analytics</span></button>
                <button onclick="window.location.href='editor.html?id=${proj.id}'" class="icon-btn" title="Editar"><span class="material-icons">edit</span></button>
                <button onclick="window.location.href='game.html?id=${proj.id}'" class="btn-play">PROBAR</button>
            `;
        } else {
            // ALUMNO
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

// 4. LÓGICA DE ASIGNACIÓN (PROFESOR)

window.openAssignModal = async (id) => {
    currentAssignId = id;
    document.getElementById('assignModal').style.display = 'flex';
    await loadAssignedStudents(id);
};

// Cargar lista de alumnos ya asignados
async function loadAssignedStudents(projectId) {
    const list = document.getElementById('assignedList');
    list.innerHTML = "<li>Cargando...</li>";

    const { data } = await sb
        .from('assignments')
        .select('student_email, created_at')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    list.innerHTML = "";
    if (!data || data.length === 0) {
        list.innerHTML = "<li>Aún no hay alumnos asignados.</li>";
        return;
    }

    data.forEach(a => {
        const li = document.createElement('li');
        li.innerHTML = `👤 ${a.student_email}`;
        li.style.padding = "5px 0";
        li.style.borderBottom = "1px solid #eee";
        list.appendChild(li);
    });
}

document.getElementById('assignForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('studentEmail').value.trim();
    
    if(!email) return;

    // Insertar en assignments
    const { error } = await sb.from('assignments').insert([{
        project_id: currentAssignId,
        student_email: email,
        assigned_by: currentUser.id
    }]);

    if(error) {
        // Código de error para "Unique Violation" en Postgres
        if(error.code === '23505') {
            alert("⚠️ Este alumno ya tiene asignada esta tarea.");
        } else {
            alert("Error: " + error.message);
        }
    } else {
        // Éxito
        document.getElementById('studentEmail').value = '';
        await loadAssignedStudents(currentAssignId); // Recargar la lista
    }
});

// 5. VER NOTAS
window.openScoresModal = async (id) => {
    document.getElementById('scoresModal').style.display = 'flex';
    const list = document.getElementById('scoresList');
    list.innerHTML = "Cargando...";

    const { data: scores } = await sb
        .from('student_progress')
        .select('*')
        .eq('project_id', id)
        .order('score', { ascending: false });

    if(!scores || scores.length === 0) {
        list.innerHTML = "<p>Nadie ha completado esta historia aún.</p>";
        return;
    }

    let html = '<table style="width:100%; text-align:left; border-collapse: collapse;">';
    html += '<tr style="border-bottom:2px solid #ddd;"><th>Alumno</th><th>Nota</th><th>Fecha</th></tr>';
    
    scores.forEach(s => {
        const date = new Date(s.completed_at).toLocaleDateString();
        html += `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px;">${s.user_email || 'Anónimo'}</td>
            <td style="padding:8px; font-weight:bold; color:#711651;">${s.score}</td>
            <td style="padding:8px; color:#666;">${date}</td>
        </tr>`;
    });
    html += '</table>';
    list.innerHTML = html;
};

// 6. GESTIÓN PROYECTOS (CREAR/EDITAR/BORRAR)

document.getElementById('fabAdd').onclick = () => {
    editingProjectId = null;
    document.getElementById('createForm').reset();
    document.querySelector('#createModal h2').innerText = "Nueva Historia";
    document.querySelector('#createForm button[type="submit"]').innerText = "Crear";
    document.getElementById('createModal').style.display = 'flex';
};

document.getElementById('closeModal').onclick = () => document.getElementById('createModal').style.display = 'none';

window.editProjectMetadata = (id, title, desc) => {
    editingProjectId = id;
    document.getElementById('newTitle').value = title;
    document.getElementById('newDesc').value = desc === 'undefined' ? '' : desc; 
    
    document.querySelector('#createModal h2').innerText = "Editar Información";
    document.querySelector('#createForm button[type="submit"]').innerText = "Guardar Cambios";
    document.getElementById('createModal').style.display = 'flex';
};

document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('newTitle').value;
    const desc = document.getElementById('newDesc').value;

    if (editingProjectId) {
        // UPDATE
        const { error } = await sb
            .from('projects')
            .update({ title: title, description: desc })
            .eq('id', editingProjectId);

        if (error) alert(error.message);
        else {
            loadProjects();
            document.getElementById('createModal').style.display = 'none';
        }
    } else {
        // INSERT
        const { data, error } = await sb
            .from('projects')
            .insert([{ 
                title: title, description: desc, user_id: currentUser.id,
                project_data: {}, story_data: {}    
            }])
            .select();

        if (error) alert(error.message);
        else window.location.href = `editor.html?id=${data[0].id}`; 
    }
});

// Helpers Menú
window.toggleMenu = (id) => {
    document.getElementById(`menu-${id}`).classList.toggle("show");
};

window.onclick = function(event) {
    if (!event.target.matches('.dropbtn')) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        for (var i = 0; i < dropdowns.length; i++) {
            if (dropdowns[i].classList.contains('show')) dropdowns[i].classList.remove('show');
        }
    }
}

window.deleteProject = async (id) => {
    if(confirm("¿Seguro? Esto borrará el proyecto y sus asignaciones.")) {
        // Primero borrar asignaciones relacionadas para evitar error de Foreign Key
        await sb.from('assignments').delete().eq('project_id', id);
        await sb.from('student_progress').delete().eq('project_id', id);
        // Luego borrar el proyecto
        const { error } = await sb.from('projects').delete().eq('id', id);
        if(!error) loadProjects();
        else alert("Error al borrar: " + error.message);
    }
};

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await sb.auth.signOut();
    window.location.href = 'index.html';
});

// Arrancar
initDashboard();