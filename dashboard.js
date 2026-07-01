// ============================================================
//                  OtomeFlow - Dashboard.js
//                  Adriana MW      2026
// ============================================================

let currentUser = null;
let currentProfile = null; 
let editingProjectId = null;
let currentAssignId = null;
let currentShareId = null;

const OtomeAlert = Swal.mixin({
    confirmButtonColor: '#711651',
    cancelButtonColor: '#888',
    fontFamily: '"Poppins", sans-serif'
});

// ---------------------------------------------------------------
//  INICIALIZACION
// ---------------------------------------------------------------
async function initDashboard() {
    try {
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
        await loadProjects();
    } catch (e) {
        console.error("Error inicializando:", e);
    }
}

function setupUIByRole() {
    let initials = "U";
    let fullName = currentUser.email;

    if (currentProfile.first_name) {
        initials = currentProfile.first_name[0].toUpperCase();
        fullName = currentProfile.first_name;
        if (currentProfile.last_name) {
            initials += currentProfile.last_name[0].toUpperCase();
            fullName += " " + currentProfile.last_name;
        }
    } else {
        initials = currentUser.email[0].toUpperCase();
    }
    
    const avatarEl = document.getElementById('userAvatar');
    if (avatarEl) avatarEl.innerText = initials;
    
    const menuUserName = document.getElementById('menuUserName');
    if (menuUserName) menuUserName.innerText = fullName;
    const menuUserEmail = document.getElementById('menuUserEmail');
    if (menuUserEmail) menuUserEmail.innerText = currentUser.email;
    
    const roleLabel = document.getElementById('roleLabel');
    const fabAdd = document.getElementById('fabAdd');
    const fabImport = document.getElementById('fabImport'); 
    const headerTitle = document.getElementById('headerTitle');
    const menuAnalytics = document.getElementById('menuAnalytics');

    if (currentProfile.role === 'teacher') {
        if (roleLabel) roleLabel.innerText = "Profesor";
        if (headerTitle) headerTitle.innerText = "Gestión de Clases";
        if (fabAdd) fabAdd.style.display = 'flex';
        if (fabImport) fabImport.style.display = 'flex';
        if (menuAnalytics) menuAnalytics.style.display = 'flex';
    } else {
        if (roleLabel) roleLabel.innerText = "Alumno";
        if (headerTitle) headerTitle.innerText = "Mis Tareas";
        if (fabAdd) fabAdd.style.display = 'none';
        if (fabImport) fabImport.style.display = 'none';
        if (menuAnalytics) menuAnalytics.style.display = 'none';
    }
}

// ---------------------------------------------------------------
//  CARGA DE DATOS
// ---------------------------------------------------------------
async function loadProjects() {
    const grid = document.getElementById('gamesGrid');
    if (grid) grid.innerHTML = '<p style="text-align:center; width:100%;">Cargando...</p>';

    let projects = [];
    let myProgress =[];

    try {
        if (currentProfile.role === 'teacher') {
            const { data, error } = await window.sb
                .from('projects')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            projects = data ||[];
        } 
        else {
            const { data: assignments, error: assignError } = await window.sb
                .from('assignments')
                .select('project_id')
                .eq('student_email', currentUser.email);
            if (assignError) throw assignError;

            if (assignments && assignments.length > 0) {
                const projectIds = assignments.map(a => a.project_id);
                const { data, error: projError } = await window.sb
                    .from('projects')
                    .select('*')
                    .in('id', projectIds);
                if (projError) throw projError;
                projects = data ||[];
            }

            const { data: progress, error: progError } = await window.sb
                .from('student_progress')
                .select('project_id, score')
                .eq('user_id', currentUser.id);
            if (progError) throw progError;
            myProgress = progress ||[];
        }
        renderGrid(projects, myProgress);
    } catch (error) {
        console.error("Error al cargar datos:", error);
        if (grid) grid.innerHTML = '<p style="color:red; text-align:center; width:100%;">Error al cargar. Revisa la consola F12.</p>';
    }
}

// ---------------------------------------------------------------
//  RENDERIZADO DE TARJETAS
// ---------------------------------------------------------------
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
        const maxAttempts = (proj.project_data && proj.project_data.max_attempts) ? proj.project_data.max_attempts : 0;

        // Opciones de la tarjeta
        if (currentProfile.role === 'teacher') {
            headerExtra = `
                <div class="dropdown">
                    <span class="material-icons dropbtn notranslate" translate="no" onclick="toggleMenu(${proj.id})">more_vert</span>
                    <div id="menu-${proj.id}" class="dropdown-content">
                        <a onclick="editProjectMetadata(${proj.id}, '${safeTitle}', '${safeDesc}', ${maxAttempts})">Editar Info</a>
                        <a onclick="openShareModal(${proj.id})">Compartir con Profe</a>
                        <a onclick="cloneProject(${proj.id})">Duplicar</a>
                        <a id="export-btn-${proj.id}" onclick="exportZip(${proj.id})">Exportar ZIP</a>
                        <a onclick="deleteProject(${proj.id})" style="color:red;">Borrar</a>
                    </div>
                </div>`;
            
            footerContent = `
                <button onclick="openAssignModal(${proj.id})" class="icon-btn" title="Asignar Alumnos"><span class="material-icons notranslate" translate="no">group_add</span></button>
                <div class="footer-spacer"></div>
                <button onclick="window.location.href='editor.html?id=${proj.id}'" class="icon-btn" title="Editar Bloques"><span class="material-icons notranslate" translate="no">edit_note</span></button>
                <button onclick="window.location.href='game.html?id=${proj.id}'" class="btn-play">PROBAR</button>
            `;
        } else {
            const myAttempts = myProgress.filter(p => p.project_id === proj.id);
            const attemptsCount = myAttempts.length;
            const hasLimit = maxAttempts > 0;
            const reachedLimit = hasLimit && attemptsCount >= maxAttempts;
            const attemptsText = hasLimit ? `(${attemptsCount}/${maxAttempts})` : `(Intentos: ${attemptsCount})`;

            if (reachedLimit) {
                const maxScore = Math.max(...myAttempts.map(a => a.score || 0));
                footerContent = `
                    <div style="color: #d32f2f; font-weight: bold; width: 100%; text-align: center; font-size: 0.85rem;">
                        LÍMITE ALCANZADO ${attemptsText} <br> Nota: ${maxScore}
                    </div>
                `;
            } else if (attemptsCount > 0) {
                const maxScore = Math.max(...myAttempts.map(a => a.score || 0));
                footerContent = `
                    <div style="color: green; font-weight: bold; font-size: 0.85rem; margin-right:auto;">
                        ✔ COMPLETADO ${attemptsText} <br> Nota más alta: ${maxScore}
                    </div>
                    <button onclick="window.location.href='game.html?id=${proj.id}'" class="icon-btn" title="Repetir">🔄</button>
                `;
            } else {
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

// ---------------------------------------------------------------
//  FUNCIONES GLOBALES (Modales, Clics)
// ---------------------------------------------------------------

window.toggleMenu = (id) => {
    document.getElementById(`menu-${id}`).classList.toggle("show");
};

window.toggleProfileMenu = () => {
    const pMenu = document.getElementById('profileMenu');
    if(pMenu) pMenu.classList.toggle('show');
};

// Cerrar menús al hacer clic fuera
window.onclick = function(event) {
    if (!event.target.matches('.dropbtn')) {
        const dropdowns = document.getElementsByClassName("dropdown-content");
        for (let i = 0; i < dropdowns.length; i++) {
            if (dropdowns[i].classList.contains('show')) dropdowns[i].classList.remove('show');
        }
    }
    if (!event.target.matches('#userAvatar') && !event.target.closest('#profileMenu')) {
        const profileMenu = document.getElementById('profileMenu');
        if (profileMenu && profileMenu.classList.contains('show')) profileMenu.classList.remove('show');
    }
};

// ---------------------------------------------------------------
//  LOGICA DE PROYECTOS (CREAR, EDITAR, BORRAR, CLONAR)
// ---------------------------------------------------------------

const fabAdd = document.getElementById('fabAdd');
if (fabAdd) {
    fabAdd.onclick = () => {
        editingProjectId = null;
        document.getElementById('createForm').reset();
        const maxAttInput = document.getElementById('newMaxAttempts');
        if (maxAttInput) maxAttInput.value = 0; 
        document.querySelector('#createModal h2').innerText = "Nueva Historia";
        document.querySelector('#createForm button[type="submit"]').innerText = "Crear";
        document.getElementById('createModal').style.display = 'flex';
    };
}

// --- CERRAR MODAL DE CREAR/EDITAR ---
const closeModal = document.getElementById('closeModal');
if (closeModal) {
    closeModal.onclick = () => {
        document.getElementById('createModal').style.display = 'none';
    };
}

const createForm = document.getElementById('createForm');
if (createForm) {
    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('newTitle').value.replace(/['"]/g, "");
        const desc = document.getElementById('newDesc').value.replace(/['"]/g, "");
        const maxAttInput = document.getElementById('newMaxAttempts');
        const maxAttempts = maxAttInput ? (parseInt(maxAttInput.value) || 0) : 0;

        if (editingProjectId) {
            const { data: existing } = await window.sb.from('projects').select('project_data').eq('id', editingProjectId).single();
            let pData = existing?.project_data || {};
            pData.max_attempts = maxAttempts;

            const { error } = await window.sb.from('projects').update({ title: title, description: desc, project_data: pData }).eq('id', editingProjectId);
            if (error) OtomeAlert.fire("Error", error.message, "error");
            else { loadProjects(); document.getElementById('createModal').style.display = 'none'; 
                OtomeAlert.fire({title: "Actualizado", icon: "success", timer: 1500, showConfirmButton: false});
            }
        } else {
            const { data, error } = await window.sb.from('projects').insert([{ 
                title: title, description: desc, user_id: currentUser.id, 
                project_data: { max_attempts: maxAttempts }, story_data: {}    
            }]).select();
            if (error) OtomeAlert.fire("Error", error.message, "error");
            else window.location.href = `editor.html?id=${data[0].id}`; 
        }
    });
}

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

window.deleteProject = async (id) => {
    // Pedir confirmacion
    const { isConfirmed } = await OtomeAlert.fire({
        title: '¿Borrar proyecto?',
        text: "Esta acción no se puede deshacer. Se borrarán también las notas y asignaciones de los alumnos.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonText: 'Cancelar',
        confirmButtonText: 'Sí, borrar'
    });

    // Si el usuario confirma, procedemos a borrar
    if (isConfirmed) {
        // Primero borrar dependencias para evitar error de Foreign Key
        await window.sb.from('assignments').delete().eq('project_id', id);
        await window.sb.from('student_progress').delete().eq('project_id', id);
        
        // Luego borrar el proyecto
        const { error } = await window.sb.from('projects').delete().eq('id', id);
        
        if (!error) {
            // Mensaje de exito
            OtomeAlert.fire({
                title: "¡Borrado!",
                text: "El proyecto ha sido eliminado.",
                icon: "success",
                timer: 1500,
                showConfirmButton: false
            });
            loadProjects(); // Recargar la lista
        } else {
            OtomeAlert.fire("Error al borrar", error.message, "error");
        }
    }
};

window.cloneProject = async (id) => {
    // Pedir confirmacion
    const { isConfirmed } = await OtomeAlert.fire({
        title: '¿Duplicar proyecto?',
        text: "Se creará una copia exacta de esta historia en tu cuenta.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, duplicar',
        cancelButtonText: 'Cancelar'
    });

    if (!isConfirmed) return;

    // Obtener el original
    const { data: original } = await window.sb.from('projects').select('*').eq('id', id).single();
    if (!original) {
        OtomeAlert.fire("Error", "No se encontró el proyecto original.", "error");
        return;
    }

    // Crear la copia
    const { error } = await window.sb.from('projects').insert([{
        title: original.title + " (Copia)", 
        description: original.description, 
        user_id: currentUser.id, 
        project_data: original.project_data, 
        story_data: original.story_data
    }]);

    if (error) {
        OtomeAlert.fire("Error al clonar", error.message, "error");
    } else {
        // Mensaje de exito
        OtomeAlert.fire({
            title: "¡Duplicado!",
            text: "El proyecto se ha copiado con éxito.",
            icon: "success",
            timer: 1500,
            showConfirmButton: false
        });
        loadProjects(); // Recargar la lista
    }
};

// ---------------------------------------------------------------
//  ASIGNACIONES A ALUMNOS
// ---------------------------------------------------------------

window.openAssignModal = async (id) => {
    currentAssignId = id;
    document.getElementById('assignModal').style.display = 'flex';
    await loadAssignedStudents(id);

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
        const li = document.createElement('li'); li.innerHTML = `${a.student_email}`;
        li.style.padding = "5px 0"; li.style.borderBottom = "1px solid #eee";
        list.appendChild(li);
    });
}

// Formulario: Asignar por Email
const assignEmailForm = document.getElementById('assignEmailForm');
if (assignEmailForm) {
    assignEmailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('studentEmail').value.trim();
        if(!email) return;

        const { error } = await window.sb.from('assignments').insert([{ 
            project_id: currentAssignId, 
            student_email: email, 
            assigned_by: currentUser.id 
        }]);

        if(error) {
            // Error 23505: "Violacion de unicidad" (ya existe en la base de datos)
            if(error.code === '23505') {
                OtomeAlert.fire("Aviso", "Este alumno ya tiene asignada esta tarea.", "info");
            } else {
                OtomeAlert.fire("Error al asignar", error.message, "error");
            }
        } else {
            // Exito
            document.getElementById('studentEmail').value = '';
            await loadAssignedStudents(currentAssignId);
            
            // Notificacion visual rapida
            OtomeAlert.fire({
                title: "¡Asignado!", 
                text: `Tarea enviada a ${email}`, 
                icon: "success", 
                timer: 1500, 
                showConfirmButton: false
            });
        }
    });
}

// Formulario: Asignar por Clase Completa
const assignClassForm = document.getElementById('assignClassForm');
if (assignClassForm) {
    assignClassForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const className = document.getElementById('classSelect').value;
        if(!className) return;

        // Buscar alumnos en esa clase
        const { data: students } = await window.sb
            .from('profiles')
            .select('email')
            .eq('role', 'student')
            .eq('class_name', className);

        if (!students || students.length === 0) { 
            OtomeAlert.fire("Aviso", `No hay alumnos registrados en la clase "${className}".`, "info"); 
            return; 
        }

        // Feedback visual de que esta procesando
        const btnSubmit = assignClassForm.querySelector('button[type="submit"]');
        const originalText = btnSubmit.innerText;
        btnSubmit.innerText = "Asignando...";
        btnSubmit.disabled = true;

        // Prepara los datos
        const assigns = students.map(s => ({ 
            project_id: currentAssignId, 
            student_email: s.email, 
            assigned_by: currentUser.id 
        }));
        
        let count = 0;
        // Insertamos uno a uno ignorando si ya estaban asignados previamente
        for (let a of assigns) {
            const { error } = await window.sb.from('assignments').insert([a]);
            if (!error) count++;
        }

        // Restaurar boton
        btnSubmit.innerText = originalText;
        btnSubmit.disabled = false;

        // Alerta de exito con el total
        OtomeAlert.fire(
            "¡Completado!", 
            `Se ha asignado la tarea a ${count} alumno(s) nuevo(s) de la clase ${className}.`, 
            "success"
        );
        
        await loadAssignedStudents(currentAssignId);
    });
}

// ---------------------------------------------------------------
//  COMPARTIR
// ---------------------------------------------------------------

window.openShareModal = (id) => {
    currentShareId = id;
    const sm = document.getElementById('shareModal');
    if(sm) sm.style.display = 'flex';
    const em = document.getElementById('teacherEmail');
    if(em) em.value = ''; 
};

// Formulario: Compartir proyecto con otro Profesor
const shareForm = document.getElementById('shareForm');
if (shareForm) {
    shareForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailToShare = document.getElementById('teacherEmail').value.trim();
        if (!emailToShare) return;

        // Feedback visual: Bloquear boton mientras procesa
        const btnSubmit = shareForm.querySelector('button[type="submit"]');
        const originalText = btnSubmit.innerText;
        btnSubmit.innerText = "Buscando...";
        btnSubmit.disabled = true;

        // Comprobar usuario
        const { data: targetProfile, error: searchError } = await window.sb
            .from('profiles')
            .select('id, role')
            .eq('email', emailToShare.toLowerCase())
            .single();

        if (searchError || !targetProfile) { 
            OtomeAlert.fire("No encontrado", "No existe ningún usuario registrado con ese correo.", "error"); 
            btnSubmit.innerText = originalText;
            btnSubmit.disabled = false;
            return; 
        }
        
        if (targetProfile.role !== 'teacher') { 
            OtomeAlert.fire("Acceso Denegado", "El usuario encontrado es un Alumno. Solo puedes compartir proyectos con otros Profesores.", "warning"); 
            btnSubmit.innerText = originalText;
            btnSubmit.disabled = false;
            return; 
        }

        btnSubmit.innerText = "Enviando copia...";

        // Obtener original
        const { data: original } = await window.sb.from('projects').select('*').eq('id', currentShareId).single();
        if (!original) {
            btnSubmit.innerText = originalText;
            btnSubmit.disabled = false;
            return;
        }

        // Crear clon
        const { error: cloneError } = await window.sb.from('projects').insert([{
            title: original.title + " (Compartido por " + currentUser.email + ")",
            description: original.description, 
            user_id: targetProfile.id, 
            project_data: original.project_data, 
            story_data: original.story_data
        }]);

        // Restaurar boton
        btnSubmit.innerText = originalText;
        btnSubmit.disabled = false;

        if (cloneError) {
            OtomeAlert.fire("Error al compartir", cloneError.message, "error");
        } else {
            // Exito
            document.getElementById('shareModal').style.display = 'none';
            document.getElementById('teacherEmail').value = ''; // Limpiar el campo
            
            OtomeAlert.fire({
                title: "¡Enviado!",
                text: `Copia del proyecto enviada a ${emailToShare}`,
                icon: "success",
                timer: 2000,
                showConfirmButton: false
            });
        }
    });
}

// ---------------------------------------------------------------
//  EXPORTAR ZIP
// ---------------------------------------------------------------
window.exportZip = async (id) => {
    const btn = document.getElementById(`export-btn-${id}`);
    const originalText = btn.innerText;
    btn.innerText = "Empaquetando...";
    btn.style.pointerEvents = "none";

    try {
        const { data: project, error } = await window.sb.from('projects').select('*').eq('id', id).single();
        if (error || !project) throw new Error("No se encontró el proyecto.");

        const zip = new JSZip();
        const pData = project.project_data || {};

        zip.file("story.json", JSON.stringify(project.story_data, null, 2));
        zip.file("project_data.json", JSON.stringify(pData, null, 2));

        const bgFolder = zip.folder("assets").folder("backgrounds");
        const charFolder = zip.folder("assets").folder("characters");

        const backgrounds = pData.assets?.backgrounds ||[];
        for (const bg of backgrounds) {
            try {
                const response = await fetch(bg.url);
                const blob = await response.blob();
                bgFolder.file(bg.name, blob);
            } catch (err) {}
        }

        const characters = pData.assets?.characters || {};
        for (const charName of Object.keys(characters)) {
            const sprites = characters[charName];
            const specificCharFolder = charFolder.folder(charName);
            for (const sprite of sprites) {
                try {
                    const response = await fetch(sprite.url);
                    const blob = await response.blob();
                    specificCharFolder.file(sprite.name, blob);
                } catch (err) {}
            }
        }

        const blob = await zip.generateAsync({ type: "blob" });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const safeTitle = project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `otome_${safeTitle}.zip`;
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a);

        btn.innerText = "¡Descargado!";
        setTimeout(() => { btn.innerText = originalText; btn.style.pointerEvents = "auto"; }, 2000);

    } catch (error) {
        console.error(error);
        OtomeAlert.fire("Error al exportar", error.message, "error");
        btn.innerText = originalText; 
        btn.style.pointerEvents = "auto";
    }
};

// ---------------------------------------------------------------
//  IMPORTAR ZIP
// ---------------------------------------------------------------
const fabImport = document.getElementById('fabImport');
const importInput = document.getElementById('importInput');

if (fabImport && importInput) {
    fabImport.addEventListener('click', () => importInput.click());
    
    importInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const originalIcon = fabImport.innerHTML;
        fabImport.innerHTML = '<span class="material-icons">hourglass_empty</span>';
        fabImport.disabled = true;
        fabImport.style.background = "#ccc"; 

        try {
            const zip = await JSZip.loadAsync(file);
            const pDataFile = zip.file("project_data.json");
            const sDataFile = zip.file("story.json");

            if (!pDataFile || !sDataFile) throw new Error("El archivo ZIP no es un proyecto válido de Otome Flow.");

            let pDataStr = await pDataFile.async("string");
            let sDataStr = await sDataFile.async("string");
            const pDataObj = JSON.parse(pDataStr);

            // PREGUNTAR EL NOMBRE PRIMERO
            const { value: newTitle } = await OtomeAlert.fire({
                title: 'Importar Proyecto',
                text: 'Nombre para esta copia:',
                input: 'text',
                inputValue: "Copia - " + (pDataObj.startScene || "Proyecto"),
                showCancelButton: true,
                confirmButtonText: 'Importar',
                cancelButtonText: 'Cancelar'
            });

            if (!newTitle) throw new Error("Cancelado");

            // MOSTRAR POP-UP DE CARGA
            OtomeAlert.fire({
                title: 'Procesando imágenes...',
                text: 'Subiendo los recursos a la nube, por favor espera.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // SUBIR IMAGENES
            const backgrounds = pDataObj.assets?.backgrounds ||[];
            for (let bg of backgrounds) {
                const zipFile = zip.file(`assets/backgrounds/${bg.name}`);
                if (zipFile && bg.url) {
                    const blob = await zipFile.async("blob");
                    const newPath = `backgrounds/${Date.now()}_${bg.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
                    await window.sb.storage.from('otome-assets').upload(newPath, blob);
                    const { data: pubData } = window.sb.storage.from('otome-assets').getPublicUrl(newPath);
                    pDataStr = pDataStr.split(bg.url).join(pubData.publicUrl);
                    sDataStr = sDataStr.split(bg.url).join(pubData.publicUrl);
                }
            }

            const characters = pDataObj.assets?.characters || {};
            for (let charName of Object.keys(characters)) {
                for (let sp of characters[charName]) {
                    const zipFile = zip.file(`assets/characters/${charName}/${sp.name}`);
                    if (zipFile && sp.url) {
                        const blob = await zipFile.async("blob");
                        const newPath = `characters/${Date.now()}_${sp.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
                        await window.sb.storage.from('otome-assets').upload(newPath, blob);
                        const { data: pubData } = window.sb.storage.from('otome-assets').getPublicUrl(newPath);
                        pDataStr = pDataStr.split(sp.url).join(pubData.publicUrl);
                        sDataStr = sDataStr.split(sp.url).join(pubData.publicUrl);
                    }
                }
            }

            // GUARDAR EN BASE DE DATOS
            const { error } = await window.sb.from('projects').insert([{
                title: newTitle, 
                description: "Restaurado desde ZIP", 
                user_id: currentUser.id,
                project_data: JSON.parse(pDataStr), 
                story_data: JSON.parse(sDataStr)
            }]);

            if (error) throw error;
            
            // EXITO
            OtomeAlert.fire({
                title: "¡Completado!",
                text: "El proyecto se ha importado con éxito.",
                icon: "success",
                timer: 2000,
                showConfirmButton: false
            });
            
            loadProjects(); 

        } catch (error) {
            if (error.message !== "Cancelado") {
                OtomeAlert.fire("Error al importar", error.message, "error");
            }
        }

        // Restaurar estado del botón flotante
        fabImport.innerHTML = originalIcon;
        fabImport.disabled = false;
        fabImport.style.background = "#ff9800"; 
        e.target.value = ''; 
    });
}

window.logout = async () => {
    await window.sb.auth.signOut();
    window.location.href = 'index.html';
};

// ---------------------------------------------------------------
// ARRANQUE
// ---------------------------------------------------------------
window.addEventListener('load', initDashboard);