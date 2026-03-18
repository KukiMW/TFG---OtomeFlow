// ============================================================
//               DASHBOARD REAL FINAL
// ============================================================

let currentUser = null;
let currentProfile = null; // Guardará el objeto completo de la BD: { role: 'teacher' | 'student' }
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

    // Obtener rol real de la base de datos
    const { data: profile, error } = await window.sb
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
    
    // Si hay error o no existe, asumimos que es alumno por seguridad
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
    let myProgress =[];

    // --- PROFESOR: Sus proyectos ---
    // USAMOS currentProfile.role
    if (currentProfile.role === 'teacher') {
        const { data, error } = await window.sb
            .from('projects')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (error) console.error("Error cargando proyectos profe:", error);
        projects = data ||[];
    } 
    
    // --- ALUMNO: Proyectos asignados ---
    else {
        // 1. Buscar asignaciones
        const { data: assignments, error: assignError } = await window.sb
            .from('assignments')
            .select('project_id')
            .eq('student_email', currentUser.email);
        
        if (assignments && assignments.length > 0) {
            const projectIds = assignments.map(a => a.project_id);
            // 2. Cargar detalles
            const { data } = await window.sb
                .from('projects')
                .select('*')
                .in('id', projectIds);
            projects = data ||[];
        }

        // 3. Cargar progreso
        const { data: progress } = await window.sb
            .from('student_progress')
            .select('project_id')
            .eq('user_id', currentUser.id);
        myProgress = progress ||[];
    }

    renderGrid(projects, myProgress);
}

// 3. RENDERIZAR
function renderGrid(projects, myProgress =[]) {
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

        // Escapar comillas para evitar errores en el menú
        const safeTitle = proj.title.replace(/'/g, "\\'");
        const safeDesc = (proj.description || "").replace(/'/g, "\\'").replace(/\n/g, " ");

        if (currentProfile.role === 'teacher') {
            // --- VISTA PROFESOR ---
            // MENÚ DE 3 PUNTOS
            headerExtra = `
                <div class="dropdown">
                    <span class="material-icons dropbtn" onclick="toggleMenu(${proj.id})">more_vert</span>
                    <div id="menu-${proj.id}" class="dropdown-content">
                        <a onclick="editProjectMetadata(${proj.id}, '${safeTitle}', '${safeDesc}')">✏️ Editar Info</a>
                        <a onclick="cloneProject(${proj.id})">📑 Duplicar / Copiar</a>
                        <a onclick="deleteProject(${proj.id})" style="color:red;">🗑️ Borrar</a>
                    </div>
                </div>`;
            
            // FOOTER
            footerContent = `
                <button onclick="openAssignModal(${proj.id})" class="icon-btn" title="Asignar Alumnos">
                    <span class="material-icons">group_add</span>
                </button>
                <button onclick="openScoresModal(${proj.id})" class="icon-btn" title="Ver Notas">
                    <span class="material-icons">analytics</span>
                </button>
                <button onclick="window.location.href='editor.html?id=${proj.id}'" class="icon-btn" title="Editar Bloques">
                    <span class="material-icons">edit</span>
                </button>
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

    const { data } = await window.sb
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
    const { error } = await window.sb.from('assignments').insert([{
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

    const { data: scores } = await window.sb
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
        const { error } = await window.sb
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
        const { data, error } = await window.sb
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
        // Primero borrar dependencias para evitar error
        await window.sb.from('assignments').delete().eq('project_id', id);
        await window.sb.from('student_progress').delete().eq('project_id', id);
        
        // Luego borrar el proyecto
        const { error } = await window.sb.from('projects').delete().eq('id', id);
        if(!error) loadProjects();
        else alert("Error al borrar: " + error.message);
    }
};

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await window.sb.auth.signOut();
    window.location.href = 'index.html';
});

// ============================================================
//               CLONAR PROYECTO (COMPARTIR/COPIAR)
// ============================================================
window.cloneProject = async (id) => {
    if(!confirm("¿Crear una copia exacta de este proyecto en tu cuenta?")) return;

    // 1. Obtener el original
    const { data: original } = await window.sb.from('projects').select('*').eq('id', id).single();
    if (!original) return;

    // 2. Insertar copia
    const { error } = await window.sb.from('projects').insert([{
        title: original.title + " (Copia)",
        description: original.description,
        user_id: currentUser.id,
        project_data: original.project_data,
        story_data: original.story_data
    }]);

    if(error) alert("Error al clonar: " + error.message);
    else { alert("¡Proyecto duplicado!"); loadProjects(); }
};

// ============================================================
//               DESCARGAR CSV DE NOTAS
// ============================================================
let currentScoresData =[]; // Guardamos los datos temporalmente para el CSV

window.openScoresModal = async (id) => {
    document.getElementById('scoresModal').style.display = 'flex';
    const list = document.getElementById('scoresList');
    list.innerHTML = "Cargando...";

    // Usamos un JOIN (inner join) para obtener el Nombre, Apellidos y DNI desde la tabla profiles
    const { data: scores } = await window.sb
        .from('student_progress')
        .select(`
            score, completed_at, user_email,
            profiles (first_name, last_name, dni, class_name)
        `)
        .eq('project_id', id)
        .order('score', { ascending: false });

    currentScoresData = scores ||[]; // Guardamos para el CSV

    if(currentScoresData.length === 0) {
        list.innerHTML = "<p>Nadie ha completado esta historia aún.</p>";
        return;
    }

    let html = '<table style="width:100%; text-align:left; border-collapse: collapse;">';
    html += '<tr style="border-bottom:2px solid #ddd;"><th>DNI</th><th>Alumno</th><th>Clase</th><th>Nota</th><th>Fecha</th></tr>';
    
    currentScoresData.forEach(s => {
        const p = s.profiles || {};
        const name = p.first_name ? `${p.first_name} ${p.last_name}` : s.user_email;
        const date = new Date(s.completed_at).toLocaleDateString();
        
        html += `<tr style="border-bottom:1px solid #eee;">
            <td style="padding:8px; font-size:0.85rem;">${p.dni || '-'}</td>
            <td style="padding:8px;">${name}</td>
            <td style="padding:8px;">${p.class_name || '-'}</td>
            <td style="padding:8px; font-weight:bold; color:#711651;">${s.score}</td>
            <td style="padding:8px; color:#666; font-size:0.85rem;">${date}</td>
        </tr>`;
    });
    list.innerHTML = html + '</table>';
};

// Evento Descargar CSV
document.getElementById('downloadCsvBtn').addEventListener('click', () => {
    if (currentScoresData.length === 0) return;

    // Crear cabecera CSV
    let csvContent = "DNI,Nombre,Apellidos,Email,Clase,Puntuacion,Fecha_Completado\n";

    // Añadir filas
    currentScoresData.forEach(s => {
        const p = s.profiles || {};
        const date = new Date(s.completed_at).toLocaleDateString();
        // Envolver en comillas por si hay comas en los nombres
        csvContent += `"${p.dni || ''}","${p.first_name || ''}","${p.last_name || ''}","${s.user_email}","${p.class_name || ''}",${s.score},"${date}"\n`;
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

// ============================================================
//               ASIGNAR POR CLASE ENTERA
// ============================================================

window.openAssignModal = async (id) => {
    currentAssignId = id;
    document.getElementById('assignModal').style.display = 'flex';
    
    // 1. Cargar lista de alumnos ya asignados
    await loadAssignedStudents(id);

    // 2. Cargar la lista de clases disponibles en el Select
    const select = document.getElementById('classSelect');
    select.innerHTML = '<option value="">Cargando clases...</option>';

    // Obtener nombres de clases únicos de los alumnos
    const { data: classes } = await window.sb
        .from('profiles')
        .select('class_name')
        .eq('role', 'student')
        .not('class_name', 'is', null);

    // Filtrar duplicados
    const uniqueClasses =[...new Set(classes.map(c => c.class_name))];

    select.innerHTML = '<option value="" disabled selected>Elige una clase...</option>';
    uniqueClasses.forEach(c => {
        if(c.trim() !== '') select.innerHTML += `<option value="${c}">${c}</option>`;
    });
};

// Evento Asignar a Clase
document.getElementById('assignClassForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const className = document.getElementById('classSelect').value;
    if(!className) return;

    // 1. Obtener todos los correos de los alumnos de esa clase
    const { data: students } = await window.sb
        .from('profiles')
        .select('email')
        .eq('role', 'student')
        .eq('class_name', className);

    if (!students || students.length === 0) {
        alert("No hay alumnos registrados en esa clase.");
        return;
    }

    // 2. Preparar el array para insertar a todos de golpe
    const assignmentsToInsert = students.map(s => ({
        project_id: currentAssignId,
        student_email: s.email,
        assigned_by: currentUser.id
    }));

    // 3. Insertar ignorando los que ya estaban asignados (gracias a ON CONFLICT si usáramos RPC, pero aquí lo haremos simple)
    let addedCount = 0;
    for (let assign of assignmentsToInsert) {
        const { error } = await window.sb.from('assignments').insert([assign]);
        if (!error) addedCount++;
    }

    alert(`¡Asignado! Se han añadido ${addedCount} alumnos nuevos de la clase ${className}.`);
    await loadAssignedStudents(currentAssignId);
});

// Arrancar
initDashboard();