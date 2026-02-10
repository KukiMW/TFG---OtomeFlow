// ============================================================
//               OTOME ENGINE - CHARACTERS
// ============================================================

export class CharacterManager {
    constructor(characterElement, backgroundElement) {
        this.charElement = characterElement;
        this.bgElement = backgroundElement;
    }

    /**
     * Calcula las dimensiones y posición reales de la imagen de fondo
     * cuando se usa `object-fit: contain`.
     * @returns {{x: number, y: number, width: number, height: number}}
     */
    getRenderedBackgroundRect() {
        const containerWidth = this.bgElement.clientWidth;
        const containerHeight = this.bgElement.clientHeight;
        const naturalWidth = this.bgElement.naturalWidth;
        const naturalHeight = this.bgElement.naturalHeight;

        if (naturalWidth === 0 || naturalHeight === 0) {
            // Si la imagen no ha cargado, devuelve las dimensiones del contenedor
            return { x: 0, y: 0, width: containerWidth, height: containerHeight };
        }

        const imageAspectRatio = naturalWidth / naturalHeight;
        const containerAspectRatio = containerWidth / containerHeight;

        let renderedWidth, renderedHeight, x, y;

        if (containerAspectRatio > imageAspectRatio) {
            // El contenedor es más ancho que la imagen (pillarboxing)
            renderedHeight = containerHeight;
            renderedWidth = renderedHeight * imageAspectRatio;
            x = (containerWidth - renderedWidth) / 2;
            y = 0;
        } else {
            // El contenedor es más alto que la imagen (letterboxing)
            renderedWidth = containerWidth;
            renderedHeight = renderedWidth / imageAspectRatio;
            x = 0;
            y = (containerHeight - renderedHeight) / 2;
        }

        return { x, y, width: renderedWidth, height: renderedHeight };
    }


    show(action) {
        return new Promise(resolve => {
            this.charElement.style.opacity = '0';
            this.charElement.src = action.sprite;

            this.charElement.onload = () => {
                // Obtenemos el rectángulo del CONTENEDOR del fondo para su posición absoluta
                const containerRect = this.bgElement.getBoundingClientRect();

                // ¡LA MAGIA OCURRE AQUÍ!
                // Calculamos las dimensiones reales de la IMAGEN visible
                const renderedBg = this.getRenderedBackgroundRect();

                const charWidth = this.charElement.width;

                // Ahora, calculamos la posición del personaje relativa a la imagen renderizada
                let targetLeft;

                switch(action.position) {
                    case "left":
                        // Posición = inicio del contenedor + offset de la imagen + 5% del ANCHO de la imagen
                        targetLeft = containerRect.left + renderedBg.x + 0.05 * renderedBg.width;
                        break;
                    case "center":
                        // Posición = inicio del contenedor + offset de la imagen + 50% del ANCHO de la imagen - mitad del personaje
                        targetLeft = containerRect.left + renderedBg.x + 0.5 * renderedBg.width - charWidth / 2;
                        break;
                    case "right":
                        // Posición = inicio del contenedor + offset de la imagen + 95% del ANCHO de la imagen - ancho del personaje
                        targetLeft = containerRect.left + renderedBg.x + 0.95 * renderedBg.width - charWidth;
                        break;
                    default:
                        targetLeft = containerRect.left + renderedBg.x + 0.5 * renderedBg.width - charWidth / 2;
                }

                this.charElement.style.left = `${targetLeft}px`;

                this.charElement.style.transition = "opacity 0.3s";
                this.charElement.style.opacity = '1';

                setTimeout(resolve, 300);
            };
        });
    }

    hide() {
        this.charElement.style.opacity = '0';
    }
}