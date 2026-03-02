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
        
        // Guardamos las referencias a las funciones para poder añadir/quitar listeners limpiamente
        this.boundHandleInput = null;
        this.boundHandleKey = null;
    }

    show(action) {
        return new Promise(resolve => {
            this.resolvePromise = resolve; 
            const fullText = `${action.speaker}: ${action.text}`;

            this.nextArrow.style.display = "none";
            this.typeWriter(fullText);

            // --- NUEVA LÓGICA DE CONTROL ---
            
            // 1. Definir qué pasa al interactuar (Clic o Tecla)
            this.boundHandleInput = () => {
                if (this.isTyping) {
                    // Si escribe: Completar texto de golpe
                    this.skipTyping(fullText);
                } else {
                    // Si terminó: Avanzar
                    this.advance();
                }
            };

            // 2. Definir detector de teclas (Espacio y Enter)
            this.boundHandleKey = (e) => {
                if (e.code === "Space" || e.code === "Enter") {
                    e.preventDefault(); // Evitar scroll de la página con espacio
                    this.boundHandleInput();
                }
            };

            // 3. Activar los "oídos" (Listeners)
            // Clic en cualquier parte del juego
            this.gameContainer.onclick = this.boundHandleInput;
            // Tecla presionada
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
                this.typingTimeout = setTimeout(type, 30); // Velocidad de escritura
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
        // Nota: Ya no necesitamos asignar onclick a la flecha aquí, 
        // porque el click en gameContainer captura todo.
    }

    // Función para limpiar y terminar
    advance() {
        this.nextArrow.style.display = "none";
        
        // ¡IMPORTANTE! Limpiar los eventos para que no se disparen en la siguiente escena por error
        this.gameContainer.onclick = null;
        document.removeEventListener('keydown', this.boundHandleKey);
        
        if (this.resolvePromise) {
            this.resolvePromise(); // Avisar al Engine para seguir
            this.resolvePromise = null;
        }
    }
}