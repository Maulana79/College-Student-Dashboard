let globalGrades = [];
let editingId = null;
let myChart = null;

const GRADE_POINTS = { 'A': 4.0, 'AB': 3.5, 'B': 3.0, 'BC': 2.5, 'C': 2.0, 'D': 1.0, 'E': 0.0 };
const MAX_IPK_SCORE = 4.0; 

function createRowHTML(subject = '', sks = '', grade = 'A') {
    return `
        <div class="input-row flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-200">
            <input type="text" class="inp-subject flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nama Matkul" value="${subject}">
            <input type="number" class="inp-sks w-16 p-2 border rounded text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" placeholder="SKS" value="${sks}">
            <select class="inp-grade w-20 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                ${Object.keys(GRADE_POINTS).map(k => `<option value="${k}" ${grade === k ? 'selected' : ''}>${k}</option>`).join('')}
            </select>
            <button onclick="removeRow(this)" class="text-slate-400 hover:text-red-500 text-xl font-bold px-2">&times;</button>
        </div>
    `;
}

function addNewRow() {
    document.getElementById('inputContainer').insertAdjacentHTML('beforeend', createRowHTML());
}

function removeRow(btn) {
    const rows = document.querySelectorAll('.input-row');
    if (rows.length > 1 || editingId) btn.closest('.input-row').remove();
}

function getFormData() {
    const semester = document.getElementById('globalSemester').value;
    const rows = document.querySelectorAll('.input-row');
    const payload = [];
    
    rows.forEach(row => {
        const subject = row.querySelector('.inp-subject').value.trim();
        const sks = row.querySelector('.inp-sks').value;
        const grade = row.querySelector('.inp-grade').value;
        
        if (subject && sks) {
            payload.push({ semester, subject, sks, grade });
        }
    });

    return { semester, payload };
}

async function insertNewGrades(payload) {
    const insertData = payload.map(item => ({
        ...item, 
        user_id: currentUser.id 
    }));
    return await db.from('grades').insert(insertData);
}

async function updateExistingGrade(updateData, id) {
    return await db.from('grades').update(updateData).eq('id', id);
}

async function saveGrade() {
    const { semester, payload } = getFormData();

    if (!semester) return alert("Isi Semester!");
    if (payload.length === 0) return alert("Data kosong / belum lengkap!");

    let response;

    if (editingId) {
        const updateData = payload[0]; 
        response = await updateExistingGrade(updateData, editingId);
    } else {
        response = await insertNewGrades(payload);
    }

    if (response.error) {
        alert("Gagal menyimpan: " + response.error.message);
        console.error(response.error);
    } else {
        cancelEdit(); 
        fetchGrades(); 
    }
}

async function fetchGrades() {
    const { data: grades } = await db.from('grades')
        .select('*').eq('user_id', currentUser.id)
        .order('semester', { ascending: true })
        .order('created_at', { ascending: true });
    
    globalGrades = grades || [];
    renderTable(globalGrades);
}

async function deleteGrade(id) {
    if (confirm('Hapus?')) {
        await db.from('grades').delete().eq('id', id);
        fetchGrades();
    }
}

function startEdit(id) {
    const data = globalGrades.find(item => item.id === id);
    if (!data) return;

    document.getElementById('globalSemester').value = data.semester;
    document.getElementById('inputContainer').innerHTML = createRowHTML(data.subject, data.sks, data.grade);
    
    editingId = id;
    document.getElementById('btnSave').innerText = "Update";
    document.getElementById('btnCancel').classList.remove('hidden');
}

function cancelEdit() {
    editingId = null;
    document.getElementById('globalSemester').value = '';
    document.getElementById('inputContainer').innerHTML = '';
    addNewRow();
    document.getElementById('btnSave').innerText = "Simpan Semua";
    document.getElementById('btnCancel').classList.add('hidden');
}

function calculateAcademicStats(grades) {
    let totalSks = 0;
    let totalGradePoints = 0;
    let gradesGroupedBySemester = {};

    grades.forEach(item => {
        const weight = GRADE_POINTS[item.grade] || 0;
        const sks = parseInt(item.sks);
        
        totalSks += sks;
        totalGradePoints += (sks * weight);

        if (!gradesGroupedBySemester[item.semester]) {
            gradesGroupedBySemester[item.semester] = { sks: 0, bobot: 0 };
        }
        gradesGroupedBySemester[item.semester].sks += sks;
        gradesGroupedBySemester[item.semester].bobot += (sks * weight);
    });

    const ipk = totalSks ? (totalGradePoints / totalSks).toFixed(2) : '0.00';

    return { totalSks, ipk, gradesGroupedBySemester };
}

function renderTable(grades) {
    const tbody = document.getElementById('gradeTableBody');
    tbody.innerHTML = '';
    
    document.getElementById('emptyState').className = grades.length ? 'hidden' : 'block p-8 text-center text-slate-400';

    grades.forEach(item => {
        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50">
                <td class="p-4 text-center font-bold text-slate-500">${item.semester}</td>
                <td class="p-4 font-medium">${item.subject}</td>
                <td class="p-4 text-center">${item.sks}</td>
                <td class="p-4 text-center"><span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">${item.grade}</span></td>
                <td class="p-4 text-center">
                    <button onclick="startEdit(${item.id})" class="text-yellow-600 hover:text-yellow-800 mr-2">✎</button>
                    <button onclick="deleteGrade(${item.id})" class="text-red-500 hover:text-red-700">🗑</button>
                </td>
            </tr>
        `;
    });

    const stats = calculateAcademicStats(grades);
    
    document.getElementById('displayIPK').innerText = stats.ipk;
    document.getElementById('displaySKS').innerText = stats.totalSks;

    updateChart(stats.gradesGroupedBySemester);
}

function updateChart(gradesGroupedBySemester) {
    const labels = Object.keys(gradesGroupedBySemester).sort((a,b) => a - b);
    
    const dataIPS = labels.map(semester => {
        const data = gradesGroupedBySemester[semester];
        return (data.bobot / data.sks).toFixed(2);
    });
    
    let cumulativeSks = 0;
    let cumulativeGradePoints = 0;
    
    const dataIPK = labels.map(semester => {
        const data = gradesGroupedBySemester[semester];
        cumulativeSks += data.sks; 
        cumulativeGradePoints += data.bobot;
        return (cumulativeGradePoints / cumulativeSks).toFixed(2);
    });

    if (myChart) myChart.destroy();
    const ctx = document.getElementById('ipsChart').getContext('2d');
    
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(s => 'Smt ' + s),
            datasets: [
                { label: 'IPS', data: dataIPS, borderColor: '#3b82f6', tension: 0.3, fill: false },
                { label: 'IPK', data: dataIPK, borderColor: '#22c55e', borderDash: [5,5], tension: 0.3, fill: false }
            ]
        },
        options: {
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: MAX_IPK_SCORE } }
        }
    });
}