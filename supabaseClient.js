// supabaseClient.js

const PROJECT_URL = 'https://gbnnzbehlctprgxaskwm.supabase.co'; 
const PROJECT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdibm56YmVobGN0cHJneGFza3dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTc1ODEsImV4cCI6MjA4NzU5MzU4MX0.gutyZ5bbz-U8eu66rE0gKE5vwrOUOZoKbxMMiCn6CAI';

// Comprobar si la librería cargó
if (typeof window.supabase === 'undefined') {
    console.error("❌ La librería de Supabase no se ha cargado. Revisa el HTML.");
} else {
    // Crear cliente
    const createClient = window.supabase.createClient;
    
    // ASIGNAR A WINDOW PARA QUE SEA GLOBAL
    window.sb = createClient(PROJECT_URL, PROJECT_KEY);
    
    console.log("Supabase inicializado globalmente como 'window.sb'");
}