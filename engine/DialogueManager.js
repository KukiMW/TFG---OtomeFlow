// ============================================================
//               OTOME ENGINE - DIALOGUE (CON NOMBRE Y VOZ)
// ============================================================
export class DialogueManager {
    constructor(textboxElement, gameContainer) {
        this.textboxElement = textboxElement; // Referencia al contenedor principal
        this.textContent = textboxElement.querySelector("#text-content");
        this.nextArrow = textboxElement.querySelector("#next-arrow");
        
        // 1. Buscamos la etiqueta del nombre
        this.speakerNameElement = textboxElement.querySelector(".speaker-name");
        
        this.gameContainer = gameContainer;
        this.typingTimeout = null;
        this.isTyping = false;
        this.resolvePromise = null;
        this.boundHandleInput = null;
        this.boundHandleKey = null;
        this.synth = window.speechSynthesis;
    }

    show(action) {
        return new Promise(resolve => {
            this.resolvePromise = resolve; 

            // 2. GESTIÓN DEL NOMBRE DEL PERSONAJE
            if (action.speaker && action.speaker.trim() !== "") {
                // Si hay un nombre, mostramos la pestaña y ponemos el nombre
                this.speakerNameElement.style.display = "block";
                this.speakerNameElement.innerText = action.speaker;
            } else {
                // Si es el Narrador (vacío), ocultamos la pestaña del nombre
                this.speakerNameElement.style.display = "none";
            }

            // El texto a escribir ahora es SOLO el texto (sin el nombre delante)
            const textToType = action.text;

            this.nextArrow.style.display = "none";
            this.typeWriter(textToType);

            // Síntesis de voz
            if (this.synth) {
                this.synth.cancel();
                const utterance = new SpeechSynthesisUtterance(textToType);
                utterance.lang = 'es-ES';
                this.synth.speak(utterance);
            }

            // Controles de avance
            this.boundHandleInput = () => {
                if (this.isTyping) {
                    this.skipTyping(textToType);
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
        
        if (this.synth) this.synth.cancel();
        
        if (this.resolvePromise) {
            this.resolvePromise(); 
            this.resolvePromise = null;
        }
    }
}