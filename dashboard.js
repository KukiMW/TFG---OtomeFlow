// ============================================================
//               DASHBOARD REAL (CON SUPABASE)
// ============================================================

// Verificar sesión al inicio
async function checkAuth() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
        window.location.href = 'index.html'; // Si no hay sesión, fuera
    } else {
        loadProjects();
        document.getElementById('userAvatar').innerText = session.user.email[0].toUpperCase();
    }
}

// 1. CARGAR PROYECTOS DE LA DB
async function loadProjects() {
    const grid = document.getElementById('gamesGrid');
    grid.innerHTML = '<p>Cargando...</p>';

    const { data: { user } } = await sb.auth.getUser();

    // SELECT * FROM projects WHERE user_id = current_user
    const { data: projects, error } = await sb
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        grid.innerHTML = '<p style="color:red">Error al cargar proyectos.</p>';
        return;
    }

    renderGrid(projects);
}

// 2. RENDERIZAR TARJETAS

let currentRole = 'teacher'; // Estado local

// Evento cambio de rol
document.getElementById('roleSwitch').addEventListener('change', (e) => {
    currentRole = e.target.value;
    
    // Ocultar/Mostrar botón crear según rol
    document.getElementById('fabAdd').style.display = (currentRole === 'teacher') ? 'flex' : 'none';
    
    // Recargar tarjetas
    loadProjects(); 
});

function renderGrid(projects) {
    const grid = document.getElementById('gamesGrid');
    grid.innerHTML = "";

    if (projects.length === 0) {
        grid.innerHTML = "<p>No tienes proyectos aún.</p>";
        return;
    }

    projects.forEach(proj => {
        const card = document.createElement('div');
        card.className = 'class-card';
        
        let footerButtons = '';

        if (currentRole === 'teacher') {
            // VISTA PROFESOR: Editar y Menú completo
            footerButtons = `
                <button onclick="window.location.href='editor.html?id=${proj.id}'" class="icon-btn" title="Editar">
                    <span class="material-icons">edit</span> EDITAR
                </button>
                <button onclick="window.location.href='game.html?id=${proj.id}'" class="btn-play">PROBAR</button>
            `;
        } else {
            // VISTA ALUMNO: Solo Jugar
            footerButtons = `
                <div style="font-size:0.8rem; color:green; font-weight:bold; margin-right:auto;">Asignada</div>
                <button onclick="window.location.href='game.html?id=${proj.id}'" class="btn-play" style="width:100%">JUGAR</button>
            `;
        }

        // El menú de 3 puntos solo sale si eres profesor
        const menuHtml = (currentRole === 'teacher') ? `
            <div class="dropdown">
                <span class="material-icons dropbtn" onclick="toggleMenu(${proj.id})">more_vert</span>
                <div id="menu-${proj.id}" class="dropdown-content">
                    <a onclick="deleteProject(${proj.id})" style="color:red;">🗑️ Borrar</a>
                </div>
            </div>` : '';

        card.innerHTML = `
            <div class="card-header">
                <div class="card-title">${proj.title}</div>
                <div class="card-subtitle">ID: ${proj.id}</div>
                ${menuHtml}
            </div>
            <div class="card-body">
                ${proj.description || "Sin descripción."}
            </div>
            <div class="card-footer">
                ${footerButtons}
            </div>
        `;
        grid.appendChild(card);
    });
}

// 3. CREAR PROYECTO NUEVO
document.getElementById('fabAdd').onclick = () => document.getElementById('createModal').style.display = 'flex';
document.getElementById('closeModal').onclick = () => document.getElementById('createModal').style.display = 'none';

document.getElementById('createForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('newTitle').value;
    const desc = document.getElementById('newDesc').value;
    const { data: { user } } = await sb.auth.getUser();

    // INSERT en Supabase
    const { data, error } = await sb
        .from('projects')
        .insert([{ 
            title: title, 
            description: desc,
            user_id: user.id,
            project_data: {}, // Vacío al principio
            story_data: {}    // Vacío
        }])
        .select();

    if (error) {
        alert("Error al crear: " + error.message);
    } else {
        document.getElementById('createModal').style.display = 'none';
        // Redirigir directamente al editor con el ID del nuevo proyecto
        window.location.href = `editor.html?id=${data[0].id}`;
    }
});

// 4. FUNCIONES AUXILIARES
window.toggleMenu = (id) => {
    document.getElementById(`menu-${id}`).classList.toggle("show");
};

// Cerrar menús si clicas fuera
window.onclick = function(event) {
    if (!event.target.matches('.dropbtn')) {
        var dropdowns = document.getElementsByClassName("dropdown-content");
        for (var i = 0; i < dropdowns.length; i++) {
            var openDropdown = dropdowns[i];
            if (openDropdown.classList.contains('show')) {
                openDropdown.classList.remove('show');
            }
        }
    }
}

window.deleteProject = async (id) => {
    if(confirm("¿Seguro que quieres borrar este proyecto? No se puede deshacer.")) {
        const { error } = await sb.from('projects').delete().eq('id', id);
        if(!error) loadProjects();
        else alert("Error al borrar");
    }
};

window.exportZip = (id) => {
    alert("Funcionalidad de Exportar ZIP en proceso de migración al backend.");
    // Aquí iría la lógica de descargar los datos de supabase y generar el zip
};

document.getElementById('logoutBtn').addEventListener('click', async () => {
    await sb.auth.signOut();
    window.location.href = 'index.html';
});

// Arrancar
checkAuth();