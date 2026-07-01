// ============================================================
//      OTOME ENGINE
//      Engine.js - Control principal del juego
// ============================================================

import { BackgroundManager } from './BackgroundManager.js';
import { CharacterManager } from './CharacterManager.js';
import { DialogueManager } from './DialogueManager.js';
import { ChoiceManager } from './ChoiceManager.js';

export class Engine {
    
    // Inicializa el estado del juego y vincula los elementos del DOM con sus respectivos gestores.
    constructor() {
        this.story = null;
        this.assetMap = {}; 

        // Estado global de la partida en curso
        this.gameState = {
            currentScene: null,
            actionQueue: [], // Cola de ejecucion de acciones para permitir anidamiento
            path: [],        // Registro secuencial de escenas y decisiones (Telemetria)
            variables: {}    // Diccionario de variables dinamicas (puntuaciones)
        };

        this.startTime = null;

        // Referencias al DOM
        const backgroundEl = document.getElementById("background");
        const characterEl = document.getElementById("character");
        const textboxEl = document.getElementById("textbox");
        const choicesEl = document.getElementById("choices");
        const gameEl = document.getElementById("game");

        // Instanciacion de los modulos de renderizado
        this.backgroundManager = new BackgroundManager(backgroundEl);
        this.characterManager = new CharacterManager(characterEl, backgroundEl);
        this.dialogueManager = new DialogueManager(textboxEl, gameEl);
        this.choiceManager = new ChoiceManager(choicesEl);
    }

    // Metodos de configuracion inicial e inyeccion de dependencias
    loadStoryFromData(storyData) { this.story = storyData; }
    setAssetMap(map) { this.assetMap = map; }
    
    // Resuelve la URL del recurso: si existe en el mapa (Supabase Storage), devuelve la URL publica; si no, devuelve la ruta original.
    getAssetUrl(path) { return (this.assetMap && this.assetMap[path]) ? this.assetMap[path] : path; }
    
    // Punto de entrada del motor. Reinicia metricas y lanza la escena inicial definida en el JSON.
    start() {
        if (!this.story) return;
        this.gameState.variables = {};
        this.gameState.path = []; 
        this.startTime = Date.now(); 
        
        this.startScene(this.story.start);
    }

    // Prepara el entorno para una nueva escena y vuelca sus acciones en la cola de ejecucion.
    startScene(sceneName) {
        if (!this.story.scenes[sceneName]) {
            console.error(`Error: La escena "${sceneName}" no existe.`);
            return;
        }
        
        // Registra la entrada a la escena en el historial de telemetria (arbol)
        this.gameState.path.push({ scene: sceneName, choice: null });
        this.gameState.currentScene = sceneName;
        
        // Clona el array de acciones del JSON a la cola de memoria (cola de ejecucion)
        this.gameState.actionQueue = [...this.story.scenes[sceneName]];
        
        this.runNextAction(); 
    }

    // Bucle principal asincrono. Extrae la primera accion de la cola y la ejecuta.
    async runNextAction() {
        // Condicion de salida: si no hay mas acciones en la cola, finaliza la partida
        if (!this.gameState.actionQueue || this.gameState.actionQueue.length === 0) {
            this.finishGame(); 
            return; 
        }

        // Extrae el primer elemento de la cola (FIFO)
        const action = this.gameState.actionQueue.shift();

        // Enrutador de acciones
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
                // Detiene el bucle asincrono hasta que el usuario resuelve la promesa (hace clic)
                const chosenOption = await this.choiceManager.show(action.options);
                this.handleChoice(chosenOption);
                return; // Corta el flujo recursivo local; handleChoice lo retomara
            case "check_variable":
                this.handleCheck(action);
                return; 
            case "jump":
                this.startScene(action.goto);
                return; 
            case "modify_variable":
                this.modifyVariable(action.varName, action.value);
                break; // No requiere interaccion, continua el flujo
        }

        // Llamada recursiva para procesar la siguiente accion en la cola
        this.runNextAction();
    }

    // ============================================================
    //              LOGICA INTERNA Y PROCESAMIENTO
    // ============================================================

    // Inicializa o actualiza una variable numerica en el estado global.
    modifyVariable(varName, amount) {
        if (!varName) return;
        if (!this.gameState.variables[varName]) {
            this.gameState.variables[varName] = 0;
        }
        this.gameState.variables[varName] += parseFloat(amount);
        console.log(`Variable '${varName}' actualizada a: ${this.gameState.variables[varName]}`);
    }

    // Procesa el resultado de un bloque de decision.
    handleChoice(option) {
        // Registra el texto del boton pulsado en la telemetria (arbol)
        if (this.gameState.path.length > 0) {
            this.gameState.path[this.gameState.path.length - 1].choice = option.text;
        }

        // Si la opcion seleccionada contiene acciones anidadas, se inyectan al principio de la cola
        if (option.actions && option.actions.length > 0) {
            this.gameState.actionQueue.unshift(...option.actions);
        }

        // Retoma el bucle de ejecucion con la cola actualizada
        this.runNextAction();
    }

    // Evalua operadores logicos (condicionales) y bifurca la ejecucion.
    handleCheck(action) {
        const varName = action.variable;
        const valueToCheck = parseFloat(action.value);
        const currentVal = this.gameState.variables[varName] || 0;
        let conditionMet = false;

        // Evaluacion matematica
        switch (action.operator) {
            case "eq": conditionMet = (currentVal === valueToCheck); break;
            case "gt": conditionMet = (currentVal > valueToCheck); break;
            case "gte": conditionMet = (currentVal >= valueToCheck); break;
            case "lt": conditionMet = (currentVal < valueToCheck); break;
            case "lte": conditionMet = (currentVal <= valueToCheck); break;
        }

        // Inyecta las acciones de la rama correspondiente (verdadera o falsa) al inicio de la cola
        const nestedActions = conditionMet ? action.actions_true : action.actions_false;
        if (nestedActions && nestedActions.length > 0) {
            this.gameState.actionQueue.unshift(...nestedActions);
        }

        this.runNextAction();
    }

    // ============================================================
    //              PANTALLA FINAL Y TELEMETRIA
    // ============================================================

    // Detiene el motor, calcula metricas, renderiza los resultados y envia el payload a la base de datos.
    async finishGame() {
        const gameDiv = document.getElementById('game');
        
        // Calculo de duracion de la sesion
        const timeSpentSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(timeSpentSeconds / 60);
        const seconds = timeSpentSeconds % 60;
        const timeString = `${minutes}m ${seconds}s`;

        // Procesamiento visual de las variables acumuladas para la pantalla final
        let varsHtml = "";
        for (const [key, val] of Object.entries(this.gameState.variables)) {
            varsHtml += `<span style="display:inline-block; margin:5px; background:white; color:#711651; padding:5px 15px; border-radius:20px; font-weight:bold;">${key}: ${val}</span>`;
        }
        if (varsHtml === "") varsHtml = `<span style="color:#aaa;">Sin puntuación</span>`;

        // Inyeccion dinamica de la pantalla de resultados en el DOM
        const endScreen = document.createElement('div');
        endScreen.style.cssText = `position: absolute; top:0; left:0; width:100%; height:100%; background: rgba(0,0,0,0.85); color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100;`;
        
        endScreen.innerHTML = `
            <h1 style="font-size: 3rem; margin-bottom: 10px; text-align:center;">¡Fin de la Historia!</h1>
            <div style="margin-bottom: 20px;">${varsHtml}</div>
            <p style="font-size: 1.2rem; color:#d8a4ff;">Tiempo: ${timeString}</p>
            <button id="backDashBtn" style="margin-top: 30px; padding: 15px 30px; font-size: 1.2rem; background: #711651; color: white; border: none; border-radius: 8px; cursor: pointer; transition: 0.2s;">Volver al Dashboard</button>
        `;

        gameDiv.appendChild(endScreen);

        // Envio de telemetria a Supabase
        const projectId = new URLSearchParams(window.location.search).get('id');
        if (window.sb && projectId) {
            const { data: { user } } = await window.sb.auth.getUser();
            if (user) {
                // Determina la metrica de calificacion primaria (Si hay una variable llamada "puntos", usamos esa. Si no, sumamos todo.)
                const dbScore = this.gameState.variables['puntos'] !== undefined 
                    ? this.gameState.variables['puntos'] 
                    : Object.values(this.gameState.variables).reduce((a, b) => a + b, 0);

                // Insercion en la tabla de progresos
                await window.sb.from('student_progress').insert([{
                    user_id: user.id, 
                    user_email: user.email, 
                    project_id: projectId, 
                    score: dbScore, 
                    time_spent: timeSpentSeconds, 
                    path: this.gameState.path
                }]);
            }
        }

        // Asignacion de evento de salida
        document.getElementById('backDashBtn').onclick = () => window.location.href = 'dashboard.html';
    }
}