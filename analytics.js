// ============================================================
//               ANALÍTICAS Y CALIFICACIONES
// ============================================================

let allData =[]; // Guardará todas las filas combinadas para filtrar fácilmente

async function initAnalytics() {
    const { data: { session } } = await window.sb.auth.getSession();
    if (!session) { window.location.href = 'index.html'; return; }

    const teacherId = session.user.id;

    // 1. Obtener los proyectos del profesor
    const { data: myProjects } = await window.sb.from('projects').select('id, title').eq('user_id', teacherId);
    if (!myProjects || myProjects.length === 0) {
        document.querySelector('tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;">No has creado ningún proyecto aún.</td></tr>';
        return;
    }
    const projectMap = {};
    myProjects.forEach(p => projectMap[p.id] = p.title);

    // Llenar selector de proyectos
    const filterProject = document.getElementById('filterProject');
    myProjects.forEach(p => filterProject.innerHTML += `<option value="${p.id}">${p.title}</option>`);

    // 2. Obtener todas las asignaciones de esos proyectos
    const projectIds = myProjects.map(p => p.id);
    const { data: assignments } = await window.sb.from('assignments').select('*').in('project_id', projectIds);

    if (!assignments || assignments.length === 0) {
        document.querySelector('tbody').innerHTML = '<tr><td colspan="6" style="text-align:center;">No has asignado tareas a ningún alumno.</td></tr>';
        return;
    }

    // 3. Obtener perfiles de los alumnos asignados
    const studentEmails =[...new Set(assignments.map(a => a.student_email))];
    const { data: profiles } = await window.sb.from('profiles').select('email, first_name, last_name, class_name').in('email', studentEmails);
    const profileMap = {};
    const classSet = new Set();
    
    profiles.forEach(p => {
        profileMap[p.email] = p;
        if (p.class_name) classSet.add(p.class_name);
    });

    // Llenar selector de clases
    const filterClass = document.getElementById('filterClass');
    classSet.forEach(c => filterClass.innerHTML += `<option value="${c}">${c}</option>`);

    // 4. Obtener progresos (notas y tiempos)
    const { data: progress } = await window.sb.from('student_progress').select('*').in('project_id', projectIds);
    const progressMap = {}; // Clave: email_projectId
    
    // Agrupar buscando el mejor intento (mayor nota)
    (progress ||[]).forEach(p => {
        const key = `${p.user_email}_${p.project_id}`;
        if (!progressMap[key] || p.score > progressMap[key].score) {
            progressMap[key] = p;
        }
    });

    // 5. Construir la tabla cruzando los datos
    allData = assignments.map(assign => {
        const email = assign.student_email;
        const prof = profileMap[email] || {};
        const prog = progressMap[`${email}_${assign.project_id}`];

        return {
            studentName: prof.first_name ? `${prof.first_name} ${prof.last_name || ''}` : email,
            className: prof.class_name || 'Sin clase',
            projectId: assign.project_id,
            projectName: projectMap[assign.project_id],
            score: prog ? prog.score : -1,
            time_spent: prog ? prog.time_spent : 0,
            date: prog ? new Date(prog.completed_at).toLocaleDateString() : '-'
        };
    });

    // Leer si venimos redirigidos desde un proyecto específico
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
        // Formatear el tiempo (Ej: 1m 30s)
        const mins = Math.floor(d.time_spent / 60);
        const secs = d.time_spent % 60;
        const timeStr = d.time_spent > 0 ? `<span class="time-badge">⏱️ ${mins}m ${secs}s</span>` : '-';

        // Estado y Nota
        const statusStr = d.score >= 0 ? `<span class="status-done">✅ Completado (Nota: ${d.score})</span>` : `<span class="status-pending">Pendiente</span>`;

        tbody.innerHTML += `
            <tr>
                <td><b>${d.studentName}</b></td>
                <td>${d.className}</td>
                <td>📖 ${d.projectName}</td>
                <td>${statusStr}</td>
                <td>${timeStr}</td>
                <td>${d.date}</td>
            </tr>
        `;
    });
}

// Filtros
document.getElementById('filterProject').addEventListener('change', renderTable);
document.getElementById('filterClass').addEventListener('change', renderTable);

// CSV
document.getElementById('downloadCsvBtn').addEventListener('click', () => {
    let csv = "Alumno,Clase,Tarea,Estado,Nota,Tiempo_Segundos,Fecha\n";
    allData.forEach(d => {
        const estado = d.score >= 0 ? 'Completado' : 'Pendiente';
        const nota = d.score >= 0 ? d.score : '';
        csv += `"${d.studentName}","${d.className}","${d.projectName}","${estado}","${nota}","${d.time_spent}","${d.date}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "calificaciones_otomeflow.csv";
    link.click();
});

window.onload = initAnalytics;