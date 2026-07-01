// ============================================================
//                  OtomeFlow - Server.js
//                  Adriana MW - 2026
// ============================================================

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Servir archivos estáticos (editor, css, imagenes)
app.use(express.static('.'));

// Devolver lista de fondos y personajes
app.get('/api/assets', (req, res) => {
    const assets = {
        backgrounds: [],
        characters: {}
    };

    // Leer Fondos
    const bgPath = path.join(__dirname, 'assets', 'backgrounds');
    if (fs.existsSync(bgPath)) {
        assets.backgrounds = fs.readdirSync(bgPath).filter(file => /\.(png|jpg|jpeg)$/i.test(file));
    }

    // Leer Personajes (Carpetas)
    const charPath = path.join(__dirname, 'assets', 'characters');
    if (fs.existsSync(charPath)) {
        const chars = fs.readdirSync(charPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        chars.forEach(charName => {
            const charDir = path.join(charPath, charName);
            const sprites = fs.readdirSync(charDir).filter(file => /\.(png|jpg|jpeg)$/i.test(file));
            assets.characters[charName] = sprites;
        });
    }

    res.json(assets);
});

app.listen(PORT, () => {
    console.log(`Editor corriendo en http://localhost:${PORT}/editor.html`);
});