// ============================================================
//               ANALÍTICAS Y CALIFICACIONES
// ============================================================

let allData =[]; // Tabla resumen (1 fila por alumno/proyecto)
let allProgressHistory =[]; // TODO el historial crudo de la BD

async function initAnalytics() {
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }

    const teacherId = session.user.id;

    // 1. Obtener proyectos
    const { data: myProjects } = await window.sb.from('projects').select('id, title').eq('user_id', teacherId);
    if (!myProjects || myProjects.length === 0) {
        document.querySelector('tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;">No has creado ningún proyecto aún.</td></tr>';
        return;
    }
    const projectMap = {};
    myProjects.forEach(p => projectMap[p.id] = p.title);

    const filterProject = document.getElementById('filterProject');
    myProjects.forEach(p => filterProject.innerHTML += `<option value="${p.id}">${p.title}</option>`);

    // 2. Obtener asignaciones
    const projectIds = myProjects.map(p => p.id);
    const { data: assignments } = await window.sb.from('assignments').select('*').in('project_id', projectIds);

    if (!assignments || assignments.length === 0) {
        document.querySelector('tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;">No has asignado tareas a ningún alumno.</td></tr>';
        return;
    }

    // 3. Obtener perfiles
    const studentEmails = [...new Set(assignments.map(a => a.student_email))];
    const { data: profiles } = await window.sb.from('profiles').select('email, first_name, last_name, class_name').in('email', studentEmails);
    const profileMap = {};
    const classSet = new Set();
    
    profiles.forEach(p => {
        profileMap[p.email] = p;
        if (p.class_name) classSet.add(p.class_name);
    });

    const filterClass = document.getElementById('filterClass');
    classSet.forEach(c => filterClass.innerHTML += `<option value="${c}">${c}</option>`);

    // 4. Obtener progresos (TODOS LOS INTENTOS)
    // Asegurarnos de traer el 'path' de la base de datos
    const { data: progress } = await window.sb
        .from('student_progress')
        .select('*, path')
        .in('project_id', projectIds)
        .order('completed_at', { ascending: false }); // Más recientes primero
    
    allProgressHistory = progress ||[]; // Guardamos globalmente
    
    const progressMap = {}; // Guardará solo el MEJOR intento para la tabla principal
    
    allProgressHistory.forEach(p => {
        const key = `${p.user_email}_${p.project_id}`;
        // Si es la primera vez que lo vemos, o tiene mejor nota, lo guardamos como "el mejor"
        if (!progressMap[key] || p.score > progressMap[key].score) {
            progressMap[key] = p;
        }
    });

    // 5. Construir la tabla principal (Resumen)
    allData = assignments.map(assign => {
        const email = assign.student_email;
        const prof = profileMap[email] || {};
        const bestProg = progressMap[`${email}_${assign.project_id}`];

        return {
            email: email,
            studentName: prof.first_name ? `${prof.first_name} ${prof.last_name || ''}` : email,
            className: prof.class_name || 'Sin clase',
            projectId: assign.project_id,
            projectName: projectMap[assign.project_id],
            score: bestProg ? bestProg.score : -1,
            time_spent: bestProg ? bestProg.time_spent : 0,
            date: bestProg ? new Date(bestProg.completed_at).toLocaleDateString() : '-'
        };
    });

    // Aplicar filtro si venimos de la URL
    const urlParams = new URLSearchParams(window.location.search);
    const filterId = urlParams.get('project');
    if (filterId) filterProject.value = filterId;

    renderTable();
}

function renderTable() {
    const tbody = document.querySelector('tbody');
    const filterP = document.getElementById('filterProject').value;
    const filterC = document.getElementById('filterClass').value;

    tbody.innerHTML = "";

    const filtered = allData.filter(d => {
        const passProject = filterP === 'all' || d.projectId.toString() === filterP;
        const passClass = filterC === 'all' || d.className === filterC;
        return passProject && passClass;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No hay datos para este filtro.</td></tr>';
        return;
    }

    filtered.forEach(d => {
        const mins = Math.floor(d.time_spent / 60);
        const secs = d.time_spent % 60;
        const timeStr = d.time_spent > 0 ? `<span class="time-badge">⏱️ ${mins}m ${secs}s</span>` : '-';

        const statusStr = d.score >= 0 
            ? `<span class="status-done">✅ Completado (${d.score} pts)</span>` 
            : `<span class="status-pending">Pendiente</span>`;

        // Botón de Historial si ha jugado al menos una vez
        const actionBtn = d.score >= 0 
            ? `<button class="btn-history" onclick="openHistoryModal('${d.email}', ${d.projectId}, '${d.studentName}')">Ver Historial</button>`
            : `-`;

        tbody.innerHTML += `
            <tr>
                <td><b>${d.studentName}</b><br><small style="color:#888">${d.email}</small></td>
                <td>${d.className}</td>
                <td>Historial${d.projectName}</td>
                <td>${statusStr}</td>
                <td>${timeStr}</td>
                <td>${actionBtn}</td>
            </tr>
        `;
    });
}

// ============================================================
//               HISTORIAL Y RUTAS
// ============================================================

// 1. Abrir Modal de Historial
window.openHistoryModal = (email, projectId, studentName) => {
    document.getElementById('historyTitle').innerText = `Intentos de ${studentName}`;
    const list = document.getElementById('historyList');
    
    // Filtrar todos los intentos de este alumno para esta tarea
    const attempts = allProgressHistory.filter(p => p.user_email === email && p.project_id === projectId);
    
    if (attempts.length === 0) {
        list.innerHTML = "<p>No hay intentos registrados.</p>";
        return;
    }

    let html = `<table class="styled-table" style="margin:0; box-shadow:none;">
        <thead><tr><th>Fecha y Hora</th><th>Nota</th><th>Tiempo</th><th>Ruta</th></tr></thead><tbody>`;
    
    attempts.forEach((att, index) => {
        const date = new Date(att.completed_at).toLocaleString();
        const mins = Math.floor(att.time_spent / 60);
        const secs = att.time_spent % 60;
        
        // Escapamos el array de la ruta para pasarlo al botón HTML de forma segura
        const pathJson = att.path ? encodeURIComponent(JSON.stringify(att.path)) : null;

        let pathBtn = "-";
        if (pathJson && att.path.length > 0) {
            pathBtn = `<button onclick="drawPath('${pathJson}')" style="background:none; border:1px solid #711651; color:#711651; padding:2px 8px; border-radius:4px; cursor:pointer;">🗺️ Ver</button>`;
        }

        html += `<tr>
            <td>${date}</td>
            <td><b>${att.score}</b></td>
            <td>${mins}m ${secs}s</td>
            <td>${pathBtn}</td>
        </tr>`;
    });

    html += `</tbody></table>`;
    list.innerHTML = html;
    
    document.getElementById('historyModal').style.display = 'flex';
};

// 2. Dibujar el Árbol del Intento con Mermaid
window.drawPath = async (pathJsonEncoded) => {
    const pathArray = JSON.parse(decodeURIComponent(pathJsonEncoded));
    
    let graph = "graph TD;\nclassDef default fill:#fff,stroke:#b48de3,stroke-width:2px;\n";
    
    for(let i = 0; i < pathArray.length; i++) {
        // Limpiamos los IDs de espacios para Mermaid
        const safeId = pathArray[i].replace(/[^a-zA-Z0-9]/g, '_');
        
        // Nodo (añadimos un índice i para evitar conflictos si pasa por la misma escena 2 veces)
        graph += `S${i}["${pathArray[i]}"];\n`;
        
        // Conexión con el anterior
        if (i > 0) {
            graph += `S${i-1} -->|Paso ${i}| S${i};\n`;
        }
    }

    const container = document.getElementById('mermaidPath');
    container.innerHTML = graph;
    document.getElementById('pathModal').style.display = 'flex';
    
    // Forzar el renderizado de Mermaid
    container.removeAttribute('data-processed');
    try {
        await mermaid.run({ nodes: [container] });
    } catch (e) {
        console.error("Error Mermaid:", e);
        container.innerHTML = "Error dibujando la ruta.";
    }
};

// ============================================================
//               FILTROS Y CSV
// ============================================================
document.getElementById('filterProject').addEventListener('change', renderTable);
document.getElementById('filterClass').addEventListener('change', renderTable);

document.getElementById('downloadCsvBtn').addEventListener('click', () => {
    let csv = "DNI,Nombre,Apellidos,Email,Clase,Tarea,Estado,Nota_Maxima,Tiempo,Fecha_Ultimo_Intento\n";
    
    // Obtener los datos filtrados actuales
    const filterP = document.getElementById('filterProject').value;
    const filterC = document.getElementById('filterClass').value;
    const filtered = allData.filter(d => {
        return (filterP === 'all' || d.projectId.toString() === filterP) && 
               (filterC === 'all' || d.className === filterC);
    });

    filtered.forEach(d => {
        const estado = d.score >= 0 ? 'Completado' : 'Pendiente';
        const nota = d.score >= 0 ? d.score : '';
        // Separar nombre y apellidos si se puede (para el Excel)
        const nameParts = d.studentName.split(' ');
        const nombre = nameParts[0] || '';
        const apellidos = nameParts.slice(1).join(' ') || '';
        
        csv += `"", "${nombre}", "${apellidos}", "${d.email}", "${d.className}", "${d.projectName}", "${estado}", "${nota}", "${d.time_spent}", "${d.date}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "calificaciones_otomeflow.csv";
    link.click();
});

window.onload = initAnalytics;