// ============================================================
//      OTOME ENGINE
//      BackgroundManager.js - Gestor de renderizado de fondos
// ============================================================

export class BackgroundManager {
    
    // Inyeccion de la dependencia del nodo DOM correspondiente a la capa de fondo
    constructor(backgroundElement) {
        this.element = backgroundElement;
    }

    /**
     * Realiza la carga asincrona de una nueva imagen de fondo.
     * Genera una pausa no bloqueante en el motor para evitar que la narrativa
     * continue antes de que el escenario este visualmente listo.
     * 
     * @param {string} src - URL o ruta del recurso grafico.
     * @returns {Promise} - Promesa que se resuelve al finalizar la carga en el DOM.
     */
    set(src) {
        return new Promise(resolve => {
            
            // PREVENCION DE CONDICION DE CARRERA:
            // El evento 'onload' se suscribe estrictamente ANTES de mutar el atributo 'src'.
            // Si la imagen se encuentra en la cache del navegador, la carga es casi instantanea.
            // Si el 'src' se asignara primero, el evento de carga podria dispararse antes 
            // de registrar el listener, dejando la Promesa sin resolver y deteniendo el Engine.
            this.element.onload = () => resolve();
            
            // Dispara la peticion de red (o recuperacion de cache) para renderizar la imagen
            this.element.src = src;
        });
    }
}