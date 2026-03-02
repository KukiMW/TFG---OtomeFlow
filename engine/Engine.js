// ============================================================
//                     OTOME ENGINE
//             Engine.js - Control principal del juego
// ============================================================

import { BackgroundManager } from './BackgroundManager.js';
import { CharacterManager } from './CharacterManager.js';
import { DialogueManager } from './DialogueManager.js';
import { ChoiceManager } from './ChoiceManager.js';

export class Engine {
    
    constructor() {
        this.story = null;
        this.assetMap = {}; 

        this.gameState = {
            currentScene: null,
            currentIndex: 0,
            variables: {}        
        };

        const backgroundEl = document.getElementById("background");
        const characterEl = document.getElementById("character");
        const textboxEl = document.getElementById("textbox");
        const choicesEl = document.getElementById("choices");
        const gameEl = document.getElementById("game");

        this.backgroundManager = new BackgroundManager(backgroundEl);
        this.characterManager = new CharacterManager(characterEl, backgroundEl);
        this.dialogueManager = new DialogueManager(textboxEl, gameEl);
        this.choiceManager = new ChoiceManager(choicesEl);
    }

    loadStoryFromData(storyData) {
        this.story = storyData;
    }
    setAssetMap(map) { this.assetMap = map; }
    getAssetUrl(path) { return (this.assetMap && this.assetMap[path]) ? this.assetMap[path] : path; }
    
    start() {
        if (!this.story) return;
        this.gameState.variables = {};
        this.startScene(this.story.start);
    }

    startScene(sceneName) {
        if (!this.story.scenes[sceneName]) {
            console.error(`Error: La escena "${sceneName}" no existe.`);
            return;
        }
        this.gameState.currentScene = sceneName;
        this.gameState.currentIndex = 0;
        this.runNextAction(); 
    }

    async runNextAction() {
        const scene = this.story.scenes[this.gameState.currentScene];
        
         // --- MODIFICADO: DETECTAR FIN DE JUEGO ---
        if (!scene || this.gameState.currentIndex >= scene.length) {
            console.log("Fin de la historia.");
            this.finishGame(); // <--- LLAMADA NUEVA
            return; 
        }

        const action = scene[this.gameState.currentIndex];

        switch (action.action) {
            
            case "set_background":
                await this.backgroundManager.set(this.getAssetUrl(action.value));
                break;

            case "show_character":
                const charAction = { ...action, sprite: this.getAssetUrl(action.sprite) };
                await this.characterManager.show(charAction);
                break;

            case "dialogue":
                await this.dialogueManager.show(action);
                break;

            case "choice":
                const chosenOption = await this.choiceManager.show(action.options);
                this.handleChoice(chosenOption);
                return; 

            case "check_variable":
                this.handleCheck(action);
                return; 

            case "jump":
                this.startScene(action.goto);
                return;
        }

        this.gameState.currentIndex++;
        this.runNextAction();
    }

    // --- PANTALLA FINAL Y GUARDADO ---
    async finishGame() {
        // 1. Mostrar pantalla de fin (HTML inyectado)
        const gameDiv = document.getElementById('game');
        
        // Crear un overlay de fin
        const endScreen = document.createElement('div');
        endScreen.style.cssText = `
            position: absolute; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.85); color: white;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 100;
        `;

        const totalScore = Object.values(this.gameState.variables).reduce((a, b) => a + b, 0);

        endScreen.innerHTML = `
            <h1 style="font-size: 3rem; margin-bottom: 20px;">🎉 ¡Fin de la Historia!</h1>
            <p style="font-size: 1.5rem;">Puntuación final: ${totalScore}</p>
            <button id="backDashBtn" style="
                margin-top: 30px; padding: 15px 30px; font-size: 1.2rem;
                background: #711651; color: white; border: none; border-radius: 8px; cursor: pointer;
            ">Volver al Dashboard</button>
        `;

        gameDiv.appendChild(endScreen);

        // 2. Guardar progreso en Supabase (Si hay ID de proyecto y usuario logueado)
        // Necesitamos leer el ID del proyecto de la URL de nuevo
        const projectId = new URLSearchParams(window.location.search).get('id');
        
        // Intentar guardar (si el usuario está logueado)
        if (window.sb && projectId) {
            const { data: { user } } = await window.sb.auth.getUser();
            if (user) {
                // GUARDAMOS TAMBIÉN EL EMAIL
                await window.sb.from('student_progress').insert([{
                    user_id: user.id,
                    user_email: user.email, 
                    project_id: projectId,
                    score: totalScore
                }]);
                console.log("Progreso guardado.");
            }
        }

        // 3. Evento botón volver
        document.getElementById('backDashBtn').onclick = () => window.location.href = 'dashboard.html';
    }

    // ============================================================
    //                 MÉTODOS AUXILIARES (LÓGICA)
    // ============================================================

    modifyVariable(varName, amount) {
        if (!varName) return;
        
        if (!this.gameState.variables[varName]) {
            this.gameState.variables[varName] = 0;
        }
        this.gameState.variables[varName] += parseInt(amount);
        console.log(`Variable '${varName}' ahora es: ${this.gameState.variables[varName]}`);
    }

   /**
     * Gestiona la elección del usuario.
     */
    handleChoice(option) {
        // 1. Aplicar variables (puntos, afinidad, etc)
        if (option.varName && option.varVal) {
            this.modifyVariable(option.varName, option.varVal);
        }
        // Soporte legacy (afinidad antigua)
        if (option.affinity) {
            this.modifyVariable(option.affinity.character, option.affinity.amount);
        }

        // 2. Decidir el destino
        if (option.goto) {
            // A) Si hay un destino ("goto"), saltamos a esa escena
            this.startScene(option.goto);
        } else {
            // B) Si NO hay destino (es un bloque de solo puntos), 
            // continuamos con la siguiente acción de la escena actual.
            console.log("Opción sin salto: Continuando en la escena actual...");
            
            // Avanzamos el índice manualmante porque el 'return' del switch detuvo el flujo automático
            this.gameState.currentIndex++;
            this.runNextAction();
        }
    }

    handleCheck(action) {
        const varName = action.variable;
        const valueToCheck = parseInt(action.value);
        const currentVal = this.gameState.variables[varName] || 0;
        
        let conditionMet = false;

        switch (action.operator) {
            case "eq": conditionMet = (currentVal === valueToCheck); break;
            case "gt": conditionMet = (currentVal > valueToCheck); break;
            case "gte": conditionMet = (currentVal >= valueToCheck); break;
            case "lt": conditionMet = (currentVal < valueToCheck); break;
            case "lte": conditionMet = (currentVal <= valueToCheck); break;
        }

        console.log(`Chequeando ${varName}: ${currentVal} ${action.operator} ${valueToCheck} -> ${conditionMet}`);

        if (conditionMet) {
            this.startScene(action.goto_true);
        } else {
            this.startScene(action.goto_false);
        }
    }
}