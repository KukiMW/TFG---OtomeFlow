// ============================================================
//               OTOME ENGINE - DIALOGUE
// ============================================================
export class DialogueManager {
    constructor(textboxElement, gameContainer) {
        this.textContent = textboxElement.querySelector("#text-content");
        this.nextArrow = textboxElement.querySelector("#next-arrow");
        this.gameContainer = gameContainer;

        this.typingTimeout = null;
        this.isTyping = false;
        this.resolvePromise = null;
        
        this.boundHandleInput = null;
        this.boundHandleKey = null;

        // Configuración de la voz
        this.synth = window.speechSynthesis;
    }

    show(action) {
        return new Promise(resolve => {
            this.resolvePromise = resolve; 
            
            // Si el speaker es vacío (Narrador), no ponemos los dos puntos
            const prefix = action.speaker ? `${action.speaker}: ` : "";
            const fullText = `${prefix}${action.text}`;

            this.nextArrow.style.display = "none";
            this.typeWriter(fullText);

            // --- NUEVO: SÍNTESIS DE VOZ (TEXT-TO-SPEECH) ---
            if (this.synth) {
                // Cancelamos cualquier voz anterior que estuviera hablando
                this.synth.cancel();
                
                // Creamos el nuevo audio solo con el texto (sin leer el nombre del personaje)
                const utterance = new SpeechSynthesisUtterance(action.text);
                utterance.lang = 'es-ES'; // Idioma español
                utterance.rate = 1.0;     // Velocidad normal
                utterance.pitch = 1.0;    // Tono normal

                // Opcional: Si quieres cambiar la voz según el personaje, podrías hacerlo aquí
                // if (action.speaker === 'Saiki') utterance.pitch = 0.5; // Voz más grave

                this.synth.speak(utterance);
            }
            // ----------------------------------------------

            // Lógica de avance
            this.boundHandleInput = () => {
                if (this.isTyping) {
                    this.skipTyping(fullText);
                } else {
                    this.advance();
                }
            };

            this.boundHandleKey = (e) => {
                if (e.code === "Space" || e.code === "Enter") {
                    e.preventDefault(); 
                    this.boundHandleInput();
                }
            };

            this.gameContainer.onclick = this.boundHandleInput;
            document.addEventListener('keydown', this.boundHandleKey);
        });
    }

    typeWriter(text) {
        this.textContent.innerText = "";
        this.isTyping = true;
        let i = 0;

        const type = () => {
            if (i < text.length) {
                this.textContent.innerText = text.substring(0, i + 1);
                i++;
                this.typingTimeout = setTimeout(type, 30);
            } else {
                this.onTypingFinished();
            }
        };
        type();
    }

    skipTyping(fullText) {
        clearTimeout(this.typingTimeout);
        this.textContent.innerText = fullText;
        this.onTypingFinished();
    }

    onTypingFinished() {
        this.isTyping = false;
        this.nextArrow.style.display = "inline-block";
    }

    advance() {
        this.nextArrow.style.display = "none";
        this.gameContainer.onclick = null;
        document.removeEventListener('keydown', this.boundHandleKey);
        
        // Cortar la voz si el jugador avanza rápido
        if (this.synth) this.synth.cancel();
        
        if (this.resolvePromise) {
            this.resolvePromise(); 
            this.resolvePromise = null;
        }
    }
}