// ============================================================
//      analytics.js        Adriana MW
// ============================================================

let allData =[]; // Tabla resumen (1 fila por alumno/proyecto)
let allProgressHistory =[]; // TODO el historial crudo de la BD
// CHECKEAR - añadir por nombre de alumno

async function initAnalytics() {
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }

    const teacherId = session.user.id;

    // Obtener proyectos
    const { data: myProjects } = await window.sb.from('projects').select('id, title').eq('user_id', teacherId);
    if (!myProjects || myProjects.length === 0) {
        document.querySelector('tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;">No has creado ningún proyecto aún.</td></tr>';
        return;
    }
    const projectMap = {};
    myProjects.forEach(p => projectMap[p.id] = p.title);

    const filterProject = document.getElementById('filterProject');
    myProjects.forEach(p => filterProject.innerHTML += `<option value="${p.id}">${p.title}</option>`);

    // Obtener asignaciones
    const projectIds = myProjects.map(p => p.id);
    const { data: assignments } = await window.sb.from('assignments').select('*').in('project_id', projectIds);

    if (!assignments || assignments.length === 0) {
        document.querySelector('tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;">No has asignado tareas a ningún alumno.</td></tr>';
        return;
    }

    // Obtener perfiles
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

    // Obtener progresos (TODOS LOS INTENTOS)
    const { data: progress } = await window.sb
        .from('student_progress')
        .select('*, path')
        .in('project_id', projectIds)
        .order('completed_at', { ascending: false }); // Más recientes primero
    
    allProgressHistory = progress ||[];
    
    const progressMap = {}; // Guarda el MEJOR intento para la tabla principal
    
    allProgressHistory.forEach(p => {
        const key = `${p.user_email}_${p.project_id}`;
        if (!progressMap[key] || p.score > progressMap[key].score) {
            progressMap[key] = p;
        }
    });

    // Construir la tabla principal (Resumen)
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

    // Aplicar filtro si venimos de la URL - CHECKEAR
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
        const timeStr = d.time_spent > 0 ? `<span class="time-badge">⏱ ${mins}m ${secs}s</span>` : '-';

        const statusStr = d.score >= 0 
            ? `<span class="status-done">✔ Completado (${d.score} pts)</span>` 
            : `<span class="status-pending">Pendiente</span>`;

        // Botón de Historial si ha jugado al menos una vez
        const actionBtn = d.score >= 0 
            ? `<button class="btn-history" onclick="openHistoryModal('${d.email}', ${d.projectId}, '${d.studentName}')">Ver Historial</button>`
            : `-`;

        tbody.innerHTML += `
            <tr>
                <td><b>${d.studentName}</b><br><small style="color:#888">${d.email}</small></td>
                <td>${d.className}</td>
                <td>${d.projectName}</td>
                <td>${statusStr}</td>
                <td>${timeStr}</td>
                <td>${actionBtn}</td>
            </tr>
        `;
    });
}

// -----------------------------------------
//      HISTORIAL Y RUTAS
// -----------------------------------------

// Abrir Modal de Historial
window.openHistoryModal = (email, projectId, studentName) => {
    document.getElementById('historyTitle').innerText = `Intentos de ${studentName}`;
    const list = document.getElementById('historyList');
    
    // Filtrar intentos por tarea
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
        
        // Acceso a ruta - Codificar datos
        const pathJson = att.path ? encodeURIComponent(JSON.stringify(att.path)) : null;

        let pathBtn = "-";
        if (pathJson && att.path.length > 0) {
            pathBtn = `<button onclick="drawPath('${pathJson}')" style="background:none; border:1px solid #711651; color:#711651; padding:2px 8px; border-radius:4px; cursor:pointer;">Ver Ruta</button>`;
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

// -----------------------------------------
//      VER RUTA DEL ALUMNO
// -----------------------------------------
window.drawPath = async (pathJsonEncoded) => {
    // Decodificar datos - Acceso a ruta
    const pathArray = JSON.parse(decodeURIComponent(pathJsonEncoded));
    
    if (!pathArray || pathArray.length === 0) {
        alert("No hay datos de ruta guardados para este intento.");
        return;
    }

    // Preparar el lienzo de Mermaid
    let graph = "%%{init: {'flowchart': {'htmlLabels': true, 'padding': 35px}, 'themeVariables': {'fontFamily': 'Poppins, sans-serif'}}}%%\n";
    graph += "graph TD;\n";
    graph += "classDef default fill:#fff,stroke:#b48de3,stroke-width:2px;\n";
    
    for(let i = 0; i < pathArray.length; i++) {
        const step = pathArray[i];
        const sceneName = typeof step === 'string' ? step : step.scene;

        graph += `S${i}["<div style='padding: 10px 30px;'>${sceneName}</div>"];\n`;
        
        // Si no es la primera escena, dibujamos la flecha desde la anterior
        if (i > 0) {
            const prevStep = pathArray[i-1];
            let arrowLabel = `Paso ${i}`; // Texto por defecto si fue salto automático
            
            // Si el paso anterior tiene una respuesta guardada, la ponemos en la flecha
            if (typeof prevStep === 'object' && prevStep.choice) {
                // Limpiamos comillas dobles para que no rompan el gráfico de Mermaid
                arrowLabel = prevStep.choice.replace(/"/g, "'");
            }
            
            const formattedLabel = `<div style='white-space: nowrap; padding: 6px 14px; font-size: 13px;'>${arrowLabel}&nbsp;</div>`;
            // Conectamos la escena anterior con la actual, poniendo la respuesta en medio
            graph += `S${i-1} -->|"${formattedLabel}"| S${i};\n`;
            
        }
    }

    // Inyectar y mostrar en el Modal
    const container = document.getElementById('mermaidPath');
    container.innerHTML = graph;
    document.getElementById('pathModal').style.display = 'flex';
    
    // Si estaba abierto el modal de notas, lo ocultamos para que no se superpongan
    const scoresModal = document.getElementById('scoresModal');
    if (scoresModal) scoresModal.style.display = 'none';
    
    // Forzar el renderizado del gráfico
    container.removeAttribute('data-processed');
    try {
        await mermaid.run({ nodes: [container] });
    } catch (e) {
        console.error("Error Mermaid:", e);
        container.innerHTML = "Error dibujando la ruta. Puede contener caracteres no válidos.";
    }
};

// -----------------------------------------
//      CSV
// -----------------------------------------
document.getElementById('filterProject').addEventListener('change', renderTable);
document.getElementById('filterClass').addEventListener('change', renderTable);

document.getElementById('downloadCsvBtn').addEventListener('click', () => {
    let csv = "DNI,Nombre,Apellidos,Email,Clase,Tarea,Estado,Nota_Maxima,Tiempo,Fecha_Ultimo_Intento\n";
    
    // Obtener los datos filtrados
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