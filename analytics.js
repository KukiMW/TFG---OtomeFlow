// ============================================================
//                  OtomeFlow – Analytics
//                  Adriana MW      2026
// ============================================================

// Variables de estado global para la vista actual
let allData = []; // Tabla resumen (1 fila por alumno/proyecto con su mejor nota)
let allProgressHistory = []; // Almacena el historial crudo de todos los intentos de la BD

// ============================================================
//      1. INICIALIZACION Y CARGA DE DATOS RELACIONALES
// ============================================================
async function initAnalytics() {
    // Verificacion de sesion activa
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }

    const teacherId = session.user.id;

    // OBTENER PROYECTOS DEL DOCENTE
    const { data: myProjects } = await window.sb.from('projects').select('id, title').eq('user_id', teacherId);
    if (!myProjects || myProjects.length === 0) {
        document.querySelector('tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;">No has creado ningún proyecto aún.</td></tr>';
        return;
    }
    
    // Mapeo rapido de IDs a Titulos para evitar busquedas costosas en el DOM posteriormente
    const projectMap = {};
    myProjects.forEach(p => projectMap[p.id] = p.title);

    // Poblar filtro de proyectos en la UI
    const filterProject = document.getElementById('filterProject');
    myProjects.forEach(p => filterProject.innerHTML += `<option value="${p.id}">${p.title}</option>`);

    // OBTENER ASIGNACIONES
    const projectIds = myProjects.map(p => p.id);
    const { data: assignments } = await window.sb.from('assignments').select('*').in('project_id', projectIds);

    if (!assignments || assignments.length === 0) {
        document.querySelector('tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;">No has asignado tareas a ningún alumno.</td></tr>';
        return;
    }

    // OBTENER PERFILES DE LOS ALUMNOS ASIGNADOS
    // Se extraen correos unicos para optimizar la consulta SQL (SELECT ... IN)
    const studentEmails = [...new Set(assignments.map(a => a.student_email))];
    const { data: profiles } = await window.sb.from('profiles').select('email, first_name, last_name, class_name').in('email', studentEmails);
    
    const profileMap = {};
    const classSet = new Set();
    
    profiles.forEach(p => {
        profileMap[p.email] = p;
        if (p.class_name) classSet.add(p.class_name);
    });

    // Poblar filtro de clases en la UI dinamicamente
    const filterClass = document.getElementById('filterClass');
    classSet.forEach(c => filterClass.innerHTML += `<option value="${c}">${c}</option>`);

    // OBTENER PROGRESOS (TELEMETRIA CRUDA)
    // Se extraen todos los intentos ordenados de mas reciente a mas antiguo
    const { data: progress } = await window.sb
        .from('student_progress')
        .select('*, path')
        .in('project_id', projectIds)
        .order('completed_at', { ascending: false }); 
    
    allProgressHistory = progress || [];
    
    const progressMap = {}; 
    
    // Agrupar buscando el mejor intento (mayor score) para mostrarlo en la tabla principal
    allProgressHistory.forEach(p => {
        const key = `${p.user_email}_${p.project_id}`;
        // Si no existe, o si la iteracion actual tiene mejor nota, se actualiza el mapa
        if (!progressMap[key] || p.score > progressMap[key].score) {
            progressMap[key] = p;
        }
    });

    // CONSOLIDACION DE DATOS (JOIN CLIENT-SIDE)
    // Se cruzan las asignaciones con los perfiles y el mejor progreso
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

    // Leer parametros GET por si venimos redirigidos desde el Dashboard
    const urlParams = new URLSearchParams(window.location.search);
    const filterId = urlParams.get('project');
    if (filterId) filterProject.value = filterId;

    renderTable();
}

// ============================================================
//      2. RENDERIZADO REACTIVO Y FILTRADO
// ============================================================
function renderTable() {
    const tbody = document.querySelector('tbody');
    const filterP = document.getElementById('filterProject').value;
    const filterC = document.getElementById('filterClass').value;

    tbody.innerHTML = "";

    // Aplicacion de filtros concatenados
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
        // Calculo matematico del formato temporal (Minutos y Segundos)
        const mins = Math.floor(d.time_spent / 60);
        const secs = d.time_spent % 60;
        const timeStr = d.time_spent > 0 ? `<span class="time-badge">⏱ ${mins}m ${secs}s</span>` : '-';

        const statusStr = d.score >= 0 
            ? `<span class="status-done">✔ Completado (${d.score} pts)</span>` 
            : `<span class="status-pending">Pendiente</span>`;

        // Generacion de boton de auditoria si existe al menos un intento
        const actionBtn = d.score >= 0 
            ? `<button class="btn-history" onclick="openHistoryModal('${d.email}', ${d.projectId}, '${d.studentName}')">Ver Historial</button>`
            : `-`;

        // Inyeccion en el DOM
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

// ============================================================
//      3. HISTORIAL Y RUTAS DE NAVEGACION
// ============================================================

// Muestra un listado temporal con todos los intentos de un estudiante especifico en una tarea
window.openHistoryModal = (email, projectId, studentName) => {
    document.getElementById('historyTitle').innerText = `Intentos de ${studentName}`;
    const list = document.getElementById('historyList');
    
    // Filtro sobre el dataset historico global
    const attempts = allProgressHistory.filter(p => p.user_email === email && p.project_id === projectId);
    
    if (attempts.length === 0) {
        list.innerHTML = "<p>No hay intentos registrados.</p>";
        return;
    }

    let html = `<table class="styled-table" style="margin:0; box-shadow:none;">
        <thead><tr><th>Fecha y Hora</th><th>Nota</th><th>Tiempo</th><th>Ruta</th></tr></thead><tbody>`;
    
    attempts.forEach((att) => {
        const date = new Date(att.completed_at).toLocaleString();
        const mins = Math.floor(att.time_spent / 60);
        const secs = att.time_spent % 60;
        
        // Serializacion segura del array de la ruta (path)
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

// ============================================================
//      4. VISUALIZACION DE GRAFOS (MERMAID.JS)
// ============================================================

// Genera un Diagrama de Flujo a partir de los datos telemetricos del alumno
window.drawPath = async (pathJsonEncoded) => {
    // Decodificar el array de ruta
    const pathArray = JSON.parse(decodeURIComponent(pathJsonEncoded));
    
    if (!pathArray || pathArray.length === 0) {
        alert("No hay datos de ruta guardados para este intento.");
        return;
    }

    // Configuracion estricta de Mermaid
    let graph = "%%{init: {'flowchart': {'htmlLabels': true, 'padding': 35}, 'themeVariables': {'fontFamily': 'Poppins, sans-serif'}}}%%\n";
    graph += "graph TD;\n";
    graph += "classDef default fill:#fff,stroke:#b48de3,stroke-width:2px;\n";
    
    // Algoritmo de mapeo: Recorre la ruta de decisiones tomadas
    for(let i = 0; i < pathArray.length; i++) {
        const step = pathArray[i];
        
        // Mantenimiento de compatibilidad estructural
        const sceneName = typeof step === 'string' ? step : step.scene;

        // Declaracion del nodo
        graph += `S${i}["<div style='padding: 10px 30px;'>${sceneName}</div>"];\n`;
        
        // Si existe un nodo anterior, establece la arista
        if (i > 0) {
            const prevStep = pathArray[i-1];
            let arrowLabel = `Paso ${i}`; 
            
            if (typeof prevStep === 'object' && prevStep.choice) {
                // Sanitizacion del texto de la respuesta (reemplazo de comillas) para evitar ruptura sintactica
                arrowLabel = prevStep.choice.replace(/"/g, "'");
            }
            
            // Renderizado de la etiqueta de la arista con nowrap para evitar superposicion en textos largos
            const formattedLabel = `<div style='white-space: nowrap; padding: 6px 14px; font-size: 13px;'>${arrowLabel}&nbsp;</div>`;
            graph += `S${i-1} -->|"${formattedLabel}"| S${i};\n`;
        }
    }

    // Preparacion del DOM para la inyeccion
    const container = document.getElementById('mermaidPath');
    container.innerHTML = graph;
    document.getElementById('pathModal').style.display = 'flex';
    
    // Ocultar modal subyacente para evitar interferencias de Z-Index
    const scoresModal = document.getElementById('scoresModal');
    if (scoresModal) scoresModal.style.display = 'none';
    
    // Forzado de renderizado vectorial asincrono
    container.removeAttribute('data-processed');
    try {
        await mermaid.run({ nodes: [container] });
    } catch (e) {
        console.error("Error Mermaid:", e);
        container.innerHTML = "Error dibujando la ruta. Puede contener caracteres no válidos.";
    }
};

// ============================================================
//      5. EXPORTACION DE DATOS (CSV)
// ============================================================

// Listener de filtrado
document.getElementById('filterProject').addEventListener('change', renderTable);
document.getElementById('filterClass').addEventListener('change', renderTable);

// Listener de descarga
document.getElementById('downloadCsvBtn').addEventListener('click', () => {
    // Declaracion de cabeceras estandarizadas
    let csv = "DNI,Nombre,Apellidos,Email,Clase,Tarea,Estado,Nota_Maxima,Tiempo,Fecha_Ultimo_Intento\n";
    
    // Recuperar el dataset filtrado actual del DOM
    const filterP = document.getElementById('filterProject').value;
    const filterC = document.getElementById('filterClass').value;
    const filtered = allData.filter(d => {
        return (filterP === 'all' || d.projectId.toString() === filterP) && 
               (filterC === 'all' || d.className === filterC);
    });

    // Mapeo iterativo a formato separado por comas
    filtered.forEach(d => {
        const estado = d.score >= 0 ? 'Completado' : 'Pendiente';
        const nota = d.score >= 0 ? d.score : '';
        
        // Split rudimentario para separar nombre y apellido si fue guardado unificado
        const nameParts = d.studentName.split(' ');
        const nombre = nameParts[0] || '';
        const apellidos = nameParts.slice(1).join(' ') || '';
        
        // Envoltorio con comillas dobles para escapar comas internas y evitar rupturas de celda
        csv += `"", "${nombre}", "${apellidos}", "${d.email}", "${d.className}", "${d.projectName}", "${estado}", "${nota}", "${d.time_spent}", "${d.date}"\n`;
    });

    // Generacion de BLOB y forzado de descarga directa
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "calificaciones_otomeflow.csv";
    link.click();
});

// Evento de arranque global
window.onload = initAnalytics;