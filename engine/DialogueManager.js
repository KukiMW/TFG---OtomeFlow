// ============================================================
//      OTOME ENGINE
//      DialogueManager.js - Gestor de interfaz de texto y voz
// ============================================================

export class DialogueManager {
    
    // Inicializa las referencias del DOM y las variables de estado del modulo
    constructor(textboxElement, gameContainer) {
        // Referencias a los nodos del DOM
        this.textContent = textboxElement.querySelector("#text-content");
        this.nextArrow = textboxElement.querySelector("#next-arrow");
        this.gameContainer = gameContainer;

        // Estado del efecto de maquina de escribir
        this.typingTimeout = null;
        this.isTyping = false;
        
        // Referencia a la funcion resolve de la Promesa actual
        this.resolvePromise = null;
        
        // Referencias persistentes a las funciones manejadoras de eventos 
        // (Necesario para poder usar removeEventListener posteriormente)
        this.boundHandleInput = null;
        this.boundHandleKey = null;

        // Inicializacion de la Web Speech API nativa para accesibilidad
        this.synth = window.speechSynthesis;
    }

    // Metodo principal: Muestra el dialogo y detiene el motor hasta la interaccion del usuario
    show(action) {
        return new Promise(resolve => {
            this.resolvePromise = resolve; 
            
            // Formateo del texto: omite el prefijo si el emisor es el narrador (cadena vacia)
            const prefix = action.speaker ? `${action.speaker}: ` : "";
            const fullText = `${prefix}${action.text}`;

            // Oculta el indicador de avance e inicia la renderizacion del texto
            this.nextArrow.style.display = "none";
            this.typeWriter(fullText);

            // --- SINTESIS DE VOZ (TEXT-TO-SPEECH) ---
            if (this.synth) {
                // Interrumpe cualquier locucion previa encolada o en reproduccion
                this.synth.cancel();
                
                // Configura y lanza la nueva locucion (excluyendo el nombre del personaje)
                const utterance = new SpeechSynthesisUtterance(action.text);
                utterance.lang = 'es-ES'; 
                utterance.rate = 1.0;     
                utterance.pitch = 1.0;    

                this.synth.speak(utterance);
            }

            // --- CONTROL DE FLUJO DE INTERACCION ---
            // Define el comportamiento general al recibir un input (clic o teclado)
            this.boundHandleInput = () => {
                if (this.isTyping) {
                    // Si el texto se esta renderizando, la interaccion fuerza su completado inmediato
                    this.skipTyping(fullText);
                } else {
                    // Si el texto ya esta completo, la interaccion avanza a la siguiente accion
                    this.advance();
                }
            };

            // Define el comportamiento especifico para eventos de teclado
            this.boundHandleKey = (e) => {
                if (e.code === "Space" || e.code === "Enter") {
                    e.preventDefault(); // Previene el scroll por defecto de la barra espaciadora
                    this.boundHandleInput();
                }
            };

            // Vinculacion de los eventos al contenedor global y al documento
            this.gameContainer.onclick = this.boundHandleInput;
            document.addEventListener('keydown', this.boundHandleKey);
        });
    }

    // Ejecuta el efecto visual de aparicion progresiva de caracteres (Maquina de escribir)
    typeWriter(text) {
        this.textContent.innerText = "";
        this.isTyping = true;
        let i = 0;

        // Funcion recursiva mediante setTimeout para control de timing
        const type = () => {
            if (i < text.length) {
                this.textContent.innerText = text.substring(0, i + 1);
                i++;
                this.typingTimeout = setTimeout(type, 30); // Intervalo en milisegundos por caracter
            } else {
                this.onTypingFinished();
            }
        };
        type();
    }

    // Interrumpe el efecto de maquina de escribir y muestra la cadena completa
    skipTyping(fullText) {
        clearTimeout(this.typingTimeout);
        this.textContent.innerText = fullText;
        this.onTypingFinished();
    }

    // Actualiza el estado visual tras renderizar el texto al 100%
    onTypingFinished() {
        this.isTyping = false;
        // Muestra la flecha indicando al jugador que puede avanzar
        this.nextArrow.style.display = "inline-block";
    }

    // Resuelve la accion actual y realiza tareas de limpieza (Garbage Collection & Event Unbinding)
    advance() {
        this.nextArrow.style.display = "none";
        
        // Desvincula los eventos para evitar fugas de memoria y disparos multiples accidentales en escenas futuras
        this.gameContainer.onclick = null;
        document.removeEventListener('keydown', this.boundHandleKey);
        
        // Interrumpe la sintesis de voz en caso de que el usuario avance antes de finalizar la lectura
        if (this.synth) this.synth.cancel();
        
        // Libera el hilo del Engine resolviendo la Promesa
        if (this.resolvePromise) {
            this.resolvePromise(); 
            this.resolvePromise = null;
        }
    }
}