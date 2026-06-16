
// ============================================================
//               OTOME ENGINE - CHOICES
// ============================================================

export class ChoiceManager {
    constructor(choicesElement) {
        this.element = choicesElement;
        this.synth = window.speechSynthesis; // Inicializar el lector de voz
    }

    show(options) {
        return new Promise(resolve => {
            this.element.innerHTML = ""; // Limpiar opciones anteriores

            options.forEach(opt => {
                const b = document.createElement("button");
                b.innerText = opt.text;

                // Lee texto de respuestas
                b.onmouseenter = () => {
                    if (this.synth) {
                        this.synth.cancel(); // Corta lo que estuviera diciendo antes
                        const utterance = new SpeechSynthesisUtterance(opt.text);
                        utterance.lang = 'es-ES'; // Idioma español
                        this.synth.speak(utterance);
                    }
                };

                b.onclick = () => {
                    // Callamos a la voz cuando el jugador hace clic para avanzar
                    if (this.synth) this.synth.cancel(); 
                    
                    this.element.innerHTML = ""; // Limpiar al elegir
                    resolve(opt); // Resolvemos la promesa con la opción elegida
                };
                this.element.appendChild(b);
            });
        });
    }
}
