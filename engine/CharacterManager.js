// ============================================================
//               OTOME ENGINE - CHARACTERS
// ============================================================

export class CharacterManager {
    constructor(characterElement, backgroundElement) {
        this.charElement = characterElement;
        this.bgElement = backgroundElement;
    }

    /**
     * Calcula las dimensiones y posición reales de la imagen de fondo visible
     * ignorando las franjas negras (letterboxing/pillarboxing).
     */
    getRenderedBackgroundRect() {
        const containerWidth = this.bgElement.clientWidth;
        const containerHeight = this.bgElement.clientHeight;
        const naturalWidth = this.bgElement.naturalWidth;
        const naturalHeight = this.bgElement.naturalHeight;

        if (naturalWidth === 0 || naturalHeight === 0) {
            return { x: 0, y: 0, width: containerWidth, height: containerHeight };
        }

        const imageAspectRatio = naturalWidth / naturalHeight;
        const containerAspectRatio = containerWidth / containerHeight;

        let renderedWidth, renderedHeight, x, y;

        if (containerAspectRatio > imageAspectRatio) {
            renderedHeight = containerHeight;
            renderedWidth = renderedHeight * imageAspectRatio;
            x = (containerWidth - renderedWidth) / 2;
            y = 0;
        } else {
            renderedWidth = containerWidth;
            renderedHeight = renderedWidth / imageAspectRatio;
            x = 0;
            y = (containerHeight - renderedHeight) / 2;
        }

        return { x, y, width: renderedWidth, height: renderedHeight };
    }

    show(action) {
        return new Promise(resolve => {
            // Caso Narrador (Sin sprite)
            if (!action.sprite || action.sprite.trim() === "") {
                this.charElement.style.opacity = '0';
                resolve(); 
                return;
            }

            this.charElement.style.opacity = '0'; 
            this.charElement.src = action.sprite;

            this.charElement.onload = () => {
                const containerRect = this.bgElement.getBoundingClientRect();
                const renderedBg = this.getRenderedBackgroundRect();

                // --- 1. ESCALADO INTELIGENTE (RESPONSIVE) ---
                // Limitamos el personaje al tamaño del fondo REAL visible
                this.charElement.style.maxHeight = `${renderedBg.height * 0.9}px`;
                this.charElement.style.maxWidth = `${renderedBg.width * 0.6}px`;

                // Forzamos al navegador a aplicar el tamaño para poder leer su anchura real
                void this.charElement.offsetHeight; 
                const charWidth = this.charElement.getBoundingClientRect().width;

                // --- 2. POSICIÓN HORIZONTAL (Ajustada al fondo) ---
                let targetLeft;
                switch(action.position) {
                    case "left":
                        targetLeft = containerRect.left + renderedBg.x + (renderedBg.width * 0.1);
                        break;
                    case "center":
                        targetLeft = containerRect.left + renderedBg.x + (renderedBg.width * 0.5) - (charWidth / 2);
                        break;
                    case "right":
                        targetLeft = containerRect.left + renderedBg.x + (renderedBg.width * 0.9) - charWidth;
                        break;
                    default:
                        targetLeft = containerRect.left + renderedBg.x + (renderedBg.width * 0.5) - (charWidth / 2);
                }
                this.charElement.style.left = `${targetLeft}px`;

                // --- 3. POSICIÓN VERTICAL (El suelo) ---
                const windowHeight = window.innerHeight;
                // Calculamos dónde termina el fondo dibujado
                const bgBottomEdge = containerRect.top + renderedBg.y + renderedBg.height;
                // Espacio negro que queda por debajo del fondo
                const spaceBelowBg = windowHeight - bgBottomEdge;

                // La caja de texto ocupa aprox 150px. 
                // Elevamos al personaje lo necesario para que no lo tape la caja (150)
                // O lo elevamos para que pise el fondo visible si la franja negra es muy grande.
                const targetBottom = Math.max(150, spaceBelowBg);
                
                this.charElement.style.bottom = `${targetBottom}px`;

                // Animación y resolución
                this.charElement.style.transition = "opacity 0.3s";
                this.charElement.style.opacity = '1';

                setTimeout(resolve, 300);
            };

            this.charElement.onerror = () => {
                console.warn("No se pudo cargar la imagen:", action.sprite);
                resolve(); 
            };
        });
    }

    hide() {
        this.charElement.style.opacity = '0';
    }
}