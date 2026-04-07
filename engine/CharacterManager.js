// ============================================================
//               OTOME ENGINE - CHARACTERS
// ============================================================

export class CharacterManager {
    constructor(characterElement, backgroundElement) {
        this.charElement = characterElement;
        this.bgElement = backgroundElement;
    }

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

                // --- 1. ESCALADO (RESPONSIVE) ---
                // Nunca será más alto que el 95% del fondo, ni más ancho que el 60%
                this.charElement.style.maxHeight = `${renderedBg.height * 0.95}px`;
                this.charElement.style.maxWidth = `${renderedBg.width * 0.6}px`;

                // Obligamos al navegador a recalcular el tamaño real de la imagen ahora mismo
                const charRect = this.charElement.getBoundingClientRect();
                const charHeight = charRect.height;

                // --- 2. POSICIÓN HORIZONTAL ---
                // Como en CSS pusimos translateX(-50%), el 'left' marca el centro exacto del personaje.
                let targetLeft;
                switch(action.position) {
                    case "left":
                        targetLeft = containerRect.left + renderedBg.x + (renderedBg.width * 0.20); // 20%
                        break;
                    case "center":
                        targetLeft = containerRect.left + renderedBg.x + (renderedBg.width * 0.50); // 50%
                        break;
                    case "right":
                        targetLeft = containerRect.left + renderedBg.x + (renderedBg.width * 0.80); // 80%
                        break;
                    default:
                        targetLeft = containerRect.left + renderedBg.x + (renderedBg.width * 0.50);
                }
                this.charElement.style.left = `${targetLeft}px`;

                // --- 3. POSICIÓN VERTICAL (INTELIGENCIA DE SUELO) ---
                const windowHeight = window.innerHeight;
                const bgBottomEdge = containerRect.top + renderedBg.y + renderedBg.height;
                
                // Distancia desde el borde inferior de la ventana hasta el borde inferior de la imagen de fondo
                const spaceBelowBg = windowHeight - bgBottomEdge;

                let targetBottom = spaceBelowBg;

                // LÓGICA: Si la imagen es bajita (mide menos del 45% de la pantalla),
                // la subimos unos 150px para que se apoye en la caja de diálogo y no se tape.
                // Si es alta (cuerpo entero), la dejamos tocando el suelo del fondo para que no flote.
                if (charHeight < (windowHeight * 0.45)) {
                    targetBottom = Math.max(spaceBelowBg, 150);
                }

                this.charElement.style.bottom = `${targetBottom}px`;

                // Animación final
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