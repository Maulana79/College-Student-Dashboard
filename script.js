// Variable Globall
let globalGrades = [];
let editingId = null;
let myChart = null;

const gradePoints = { 'A': 4.0, 'AB': 3.5, 'B': 3.0, 'BC': 2.5, 'C': 2.0, 'D': 1.0, 'E': 0.0 };

// --- FUNGSI UI FORM ---

function createRowHTML(subject = '', sks = '', grade = 'A') {
    return `
        <div class="input-row flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-200">
            <input type="text" class="inp-subject flex-1 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nama Matkul" value="${subject}">
            <input type="number" class="inp-sks w-16 p-2 border rounded text-sm text-center focus:ring-2 focus:ring-blue-500 outline-none" placeholder="SKS" value="${sks}">
            <select class="inp-grade w-20 p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                ${Object.keys(gradePoints).map(k => `<option value="${k}" ${grade === k ? 'selected' : ''}>${k}</option>`).join('')}
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

// --- FUNGSI DATABASE ---

async function saveGrade() {
    const semester = document.getElementById('globalSemester').value;
    if (!semester) return alert("Isi Semester!");

    const rows = document.querySelectorAll('.input-row');
    const payload = [];
    
    // Ambil data dari form
    rows.forEach(row => {
        const subject = row.querySelector('.inp-subject').value.trim();
        const sks = row.querySelector('.inp-sks').value;
        const grade = row.querySelector('.inp-grade').value;
        
        if (subject && sks) {
            // Kita simpan data mentahnya dulu tanpa user_id
            payload.push({ semester, subject, sks, grade });
        }
    });

    if (payload.length === 0) return alert("Data kosong / belum lengkap!");

    let error;

    if (editingId) {
        // --- MODE EDIT (UPDATE) ---
        // PENTING: Jangan kirim user_id saat update!
        // Ambil data baris pertama (karena edit cuma 1 baris)
        const updateData = payload[0]; 
        
        console.log("Sedang mengupdate ID:", editingId, "Dengan data:", updateData); // Debugging

        const res = await db.from('grades')
            .update(updateData) // user_id tidak ikut dikirim di sini
            .eq('id', editingId);
            
        error = res.error;

    } else {
        // --- MODE TAMBAH (INSERT) ---
        // Kalau tambah baru, WAJIB masukkan user_id
        const insertData = payload.map(item => ({
            ...item, 
            user_id: currentUser.id // Tambahkan user_id manual di sini
        }));

        const res = await db.from('grades').insert(insertData);
        error = res.error;
    }

    if (error) {
        alert("Gagal menyimpan: " + error.message);
        console.error(error);
    } else {
        cancelEdit(); 
        fetchGrades(); 
    }
}

async function fetchGrades() {
    const { data: grades } = await db.from('grades')
        .select('*').eq('user_id', currentUser.id) // Filter by user yang login
        .order('semester', { ascending: true }).order('created_at', { ascending: true });
    
    globalGrades = grades || [];
    renderTable(globalGrades);
}

async function deleteGrade(id) {
    if (confirm('Hapus?')) {
        await db.from('grades').delete().eq('id', id);
        fetchGrades();
    }
}

// --- FUNGSI EDIT & BATAL ---

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

// --- RENDER TABLE & CHART ---

function renderTable(grades) {
    const tbody = document.getElementById('gradeTableBody');
    tbody.innerHTML = '';
    
    document.getElementById('emptyState').className = grades.length ? 'hidden' : 'block p-8 text-center text-slate-400';

    let totalSKS = 0, totalBobot = 0, semGroup = {};

    grades.forEach(item => {
        const bobot = gradePoints[item.grade] || 0;
        const sks = parseInt(item.sks);
        totalSKS += sks;
        totalBobot += (sks * bobot);

        if (!semGroup[item.semester]) semGroup[item.semester] = { sks: 0, bobot: 0 };
        semGroup[item.semester].sks += sks;
        semGroup[item.semester].bobot += (sks * bobot);

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

    document.getElementById('displayIPK').innerText = totalSKS ? (totalBobot / totalSKS).toFixed(2) : '0.00';
    document.getElementById('displaySKS').innerText = totalSKS;

    updateChart(semGroup);
}

function updateChart(semGroup) {
    const labels = Object.keys(semGroup).sort((a,b)=>a-b);
    const dataIPS = labels.map(s => (semGroup[s].bobot / semGroup[s].sks).toFixed(2));
    
    let runSKS = 0, runBobot = 0;
    const dataIPK = labels.map(s => {
        runSKS += semGroup[s].sks; runBobot += semGroup[s].bobot;
        return (runBobot / runSKS).toFixed(2);
    });

    if (myChart) myChart.destroy();
    const ctx = document.getElementById('ipsChart').getContext('2d');
    
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(s => 'Smt '+s),
            datasets: [
                { label: 'IPS', data: dataIPS, borderColor: '#3b82f6', tension: 0.3, fill: false },
                { label: 'IPK', data: dataIPK, borderColor: '#22c55e', borderDash: [5,5], tension: 0.3, fill: false }
            ]
        },
        options: {
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 4 } }
        }
    });
}