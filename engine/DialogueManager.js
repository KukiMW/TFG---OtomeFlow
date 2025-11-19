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
    }

    show(action) {
        return new Promise(resolve => {
            this.resolvePromise = resolve; // Guardamos la función resolve para llamarla al hacer clic
            const fullText = `${action.speaker}: ${action.text}`;

            this.nextArrow.style.display = "none";
            this.typeWriter(fullText);

            // El manejador de clic ahora se gestiona aquí dentro
            this.gameContainer.onclick = () => {
                if (this.isTyping) {
                    this.skipTyping(fullText);
                } else {
                    // El nextArrow.onclick se gestionará dentro del callback de typeWriter
                }
            };
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
                this.typingTimeout = setTimeout(type, 40);
            } else {
                this.isTyping = false;
                this.onTypingFinished();
            }
        };
        type();
    }

    skipTyping(fullText) {
        clearTimeout(this.typingTimeout);
        this.textContent.innerText = fullText;
        this.isTyping = false;
        this.onTypingFinished();
    }

    onTypingFinished() {
        this.nextArrow.style.display = "inline-block";
        this.nextArrow.onclick = () => {
            this.nextArrow.style.display = "none";
            this.gameContainer.onclick = null; // Limpiamos el evento para que no interfiera
            this.nextArrow.onclick = null;
            if (this.resolvePromise) {
                this.resolvePromise(); // Resolvemos la promesa para que el Engine continúe
            }
        };
    }
}