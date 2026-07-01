// ================================================================
//      OTOME ENGINE
//      CharacterManager.js - Gestor de renderizado de personajes
// ================================================================

export class CharacterManager {
    
    // Inyeccion de dependencias de los nodos del DOM necesarios
    constructor(characterElement, backgroundElement) {
        this.charElement = characterElement;
        this.bgElement = backgroundElement;
    }

    //  * ALGORITMO DE INTERSECCION VISUAL
    //  * Calcula las dimensiones y coordenadas exactas (offset) de la imagen de fondo renderizada,
    //  * ignorando las franjas negras generadas por la propiedad CSS `object-fit: contain`.
    //  * Es para calcular la posicion relativa del personaje independientemente de la resolucion.
    getRenderedBackgroundRect() {
        // Dimensiones del contenedor
        const containerWidth = this.bgElement.clientWidth;
        const containerHeight = this.bgElement.clientHeight;
        
        // Dimensiones originales del archivo de imagen
        const naturalWidth = this.bgElement.naturalWidth;
        const naturalHeight = this.bgElement.naturalHeight;

        // Fallback preventivo si la imagen aun no se ha cargado en memoria
        if (naturalWidth === 0 || naturalHeight === 0) {
            return { x: 0, y: 0, width: containerWidth, height: containerHeight };
        }

        // Calculo de relaciones de aspecto (Aspect Ratio)
        const imageAspectRatio = naturalWidth / naturalHeight;
        const containerAspectRatio = containerWidth / containerHeight;

        let renderedWidth, renderedHeight, x, y;

        if (containerAspectRatio > imageAspectRatio) {
            // En caso de franjas negras a los lados (El contenedor es mas ancho que la imagen)
            renderedHeight = containerHeight;
            renderedWidth = renderedHeight * imageAspectRatio;
            x = (containerWidth - renderedWidth) / 2; // Offset horizontal
            y = 0;
        } else {
            // En caso de franjas negras arriba y abajo (El contenedor es mas alto que la imagen)
            renderedWidth = containerWidth;
            renderedHeight = renderedWidth / imageAspectRatio;
            x = 0;
            y = (containerHeight - renderedHeight) / 2; // Offset vertical
        }

        return { x, y, width: renderedWidth, height: renderedHeight };
    }

    /**
     * Muestra el sprite del personaje calculando su posicion y escala dinamicamente.
     * @param {Object} action - Objeto con los datos de la accion (sprite, posicion).
     * @returns {Promise} - Promesa que resuelve al terminar la transicion visual.
     */
    show(action) {
        return new Promise(resolve => {
            // CASO 1: Rol "Narrador" o Ausencia de sprite
            // Resuelve la promesa inmediatamente sin bloquear el hilo principal
            if (!action.sprite || action.sprite.trim() === "") {
                this.charElement.style.opacity = '0';
                resolve(); 
                return;
            }

            // Oculta el contenedor mientras procesa la nueva imagen en memoria
            this.charElement.style.opacity = '0'; 
            this.charElement.src = action.sprite;

            // Evento asincrono: Se dispara cuando la imagen se ha descargado completamente
            this.charElement.onload = () => {
                const containerRect = this.bgElement.getBoundingClientRect();
                const renderedBg = this.getRenderedBackgroundRect();

                // --- 1. ESCALADO (DISENO RESPONSIVO) ---
                // Aplica un limite de escala maxima relativa a la porcion visible del fondo
                // Evita que imagenes en alta resolucion desborden el contenedor
                this.charElement.style.maxHeight = `${renderedBg.height * 0.95}px`;
                this.charElement.style.maxWidth = `${renderedBg.width * 0.6}px`;

                // Fuerza un reflow del navegador para leer las dimensiones tras aplicar el escalado
                const charRect = this.charElement.getBoundingClientRect();
                const charHeight = charRect.height;

                // --- 2. POSICIONAMIENTO HORIZONTAL (Eje X) ---
                // Mapea la posicion abstracta (left, center, right) a coordenadas absolutas de pixeles
                // tomando como referencia el offset de la imagen (renderedBg.x)
                // = Marca el centro exacto del personaje.
                let targetLeft;
                switch(action.position) {
                    case "left":
                        targetLeft = containerRect.left + renderedBg.x + (renderedBg.width * 0.20); 
                        break;
                    case "center":
                        targetLeft = containerRect.left + renderedBg.x + (renderedBg.width * 0.50); 
                        break;
                    case "right":
                        targetLeft = containerRect.left + renderedBg.x + (renderedBg.width * 0.80); 
                        break;
                    default:
                        targetLeft = containerRect.left + renderedBg.x + (renderedBg.width * 0.50);
                }
                this.charElement.style.left = `${targetLeft}px`;

                // --- 3. POSICIONAMIENTO VERTICAL (INTELIGENCIA DE Z-INDEX) ---
                // Calcula el limite inferior del escenario virtual
                const windowHeight = window.innerHeight;
                const bgBottomEdge = containerRect.top + renderedBg.y + renderedBg.height;
                const spaceBelowBg = windowHeight - bgBottomEdge;

                let targetBottom = spaceBelowBg;

                // Algoritmo anti-solapamiento (Anti-overlap): 
                // Si la imagen es un "busto" (altura inferior al 45% de la pantalla), 
                // se ancla sobre la caja de texto (150px min) para evitar su ocultacion.
                if (charHeight < (windowHeight * 0.45)) {
                    targetBottom = Math.max(spaceBelowBg, 150);
                }

                this.charElement.style.bottom = `${targetBottom}px`;

                // --- 4. TRANSICION Y RESOLUCION ---
                // Aplica un fundido (fade-in) para suavizar la entrada
                this.charElement.style.opacity = '1';
                setTimeout(resolve, 300); // Resuelve la Promesa tras completar la animacion CSS
            };

            // MANEJO DE EXCEPCIONES: Prevencion de bloqueos (Fail-safe)
            // Si la imagen no existe en la ruta (404), el motor avisa y continua la ejecucion
            this.charElement.onerror = () => {
                console.warn("No se pudo cargar la imagen del personaje (404 Not Found):", action.sprite);
                resolve(); 
            };
        });
    }

    // Metodo auxiliar para limpiar la capa del personaje
    hide() {
        this.charElement.style.opacity = '0';
    }
}