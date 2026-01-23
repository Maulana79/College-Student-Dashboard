// config.js
const SUPABASE_URL = 'https://jknmwfxldhqjlyftbjmw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprbm13ZnhsZGhxamx5ZnRiam13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNjc2NjgsImV4cCI6MjA4NDc0MzY2OH0.Vyx7juTT6iwoHYoC0CUGtNkzpjMrP_UoU5vEusrBVuQ'; 

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const CAMPUS_DOMAIN = '@student.kampus.id'; 

// Fungsi Cek Login (Digunakan di halaman Home)
async function requireAuth() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        window.location.href = 'login.html'; // Tendang ke login jika belum masuk
    }
    return session;
}

// Fungsi Cek Tamu (Digunakan di Login/Register)
async function requireGuest() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
        window.location.href = 'index.html'; // Tendang ke home jika sudah login
    }
}