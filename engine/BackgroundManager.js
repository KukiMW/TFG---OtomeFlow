// ============================================================
//                 OTOME ENGINE – BACKGROUND
// ============================================================

export class BackgroundManager {
    constructor(backgroundElement) {
        this.element = backgroundElement;
    }

    set(src) {
        return new Promise(resolve => {
            // El onload debe asignarse ANTES de cambiar el src
            this.element.onload = () => resolve();
            this.element.src = src;
        });
    }
}