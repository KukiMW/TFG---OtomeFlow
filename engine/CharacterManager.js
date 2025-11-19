// ============================================================
//               OTOME ENGINE - CHARACTERS
// ============================================================

export class CharacterManager {
    constructor(characterElement, backgroundElement) {
        this.charElement = characterElement;
        this.bgElement = backgroundElement;
    }

    show(action) {
        return new Promise(resolve => {
            this.charElement.style.opacity = '0';
            this.charElement.src = action.sprite;

            this.charElement.onload = () => {
                const bgRect = this.bgElement.getBoundingClientRect();
                const charWidth = this.charElement.width;

                switch(action.position) {
                    case "left":
                        this.charElement.style.left = `${bgRect.left + 0.05 * bgRect.width}px`;
                        break;
                    case "center":
                        this.charElement.style.left = `${bgRect.left + 0.5 * bgRect.width - charWidth / 2}px`;
                        break;
                    case "right":
                        this.charElement.style.left = `${bgRect.left + 0.9 * bgRect.width - charWidth}px`;
                        break;
                    default:
                        this.charElement.style.left = `${bgRect.left + 0.5 * bgRect.width - charWidth / 2}px`;
                }

                this.charElement.style.transition = "opacity 0.3s";
                this.charElement.style.opacity = '1';
                // Damos un pequeño tiempo para que la transición se vea
                setTimeout(resolve, 300);
            };
        });
    }
    // Podrías añadir un método hide() en el futuro
    hide() {
        this.charElement.style.opacity = '0';
    }
}