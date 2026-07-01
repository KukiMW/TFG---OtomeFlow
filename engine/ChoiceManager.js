// ============================================================
//      OTOME ENGINE
//      ChoiceManager.js - Gestor de toma de decisiones
// ============================================================

export class ChoiceManager {
    
    // Inicializa el contenedor de los botones y la API de accesibilidad
    constructor(choicesElement) {
        // Referencia al contenedor DOM donde se inyectaran los botones
        this.element = choicesElement;
        
        // Inicializacion de la Web Speech API para lectura de opciones (Accesibilidad)
        this.synth = window.speechSynthesis; 
    }

    // Renderiza las opciones disponibles y detiene el flujo del motor hasta que el usuario interactua
    show(options) {
        return new Promise(resolve => {
            // Limpieza del contenedor previo para evitar duplicidades en el DOM
            this.element.innerHTML = ""; 

            // Iteracion sobre el array de opciones (procedente del JSON) para generar la UI dinamicamente
            options.forEach(opt => {
                // Creacion de nodo boton nativo
                const b = document.createElement("button");
                b.innerText = opt.text;

                // --- EVENTO HOVER (ACCESIBILIDAD) ---
                // Se activa al posicionar el cursor sobre el boton (o hacer focus tactil)
                b.onmouseenter = () => {
                    if (this.synth) {
                        // Interrumpe cualquier locucion activa para evitar solapamientos de audio
                        this.synth.cancel(); 
                        
                        // Configura y lanza la locucion del texto de la opcion actual
                        const utterance = new SpeechSynthesisUtterance(opt.text);
                        utterance.lang = 'es-ES'; 
                        this.synth.speak(utterance);
                    }
                };

                // --- EVENTO CLICK (RESOLUCION) ---
                // Se activa al seleccionar la opcion
                b.onclick = () => {
                    // Silencia el lector de voz inmediatamente tras la confirmacion
                    if (this.synth) this.synth.cancel(); 
                    
                    // Limpieza visual: Elimina todos los botones de la pantalla
                    this.element.innerHTML = ""; 
                    
                    // Libera el hilo del Engine resolviendo la Promesa y devolviendo el objeto de la opcion elegida
                    // (Este objeto contiene el texto, variables a modificar y/o los bloques anidados a ejecutar)
                    resolve(opt); 
                };
                
                // Inyeccion del boton configurado en el arbol DOM
                this.element.appendChild(b);
            });
        });
    }
}