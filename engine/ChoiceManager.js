// ============================================================
//               OTOME ENGINE - CHOICES
// ============================================================

export class ChoiceManager {
    constructor(choicesElement) {
        this.element = choicesElement;
    }

    show(options) {
        return new Promise(resolve => {
            this.element.innerHTML = ""; // Limpiar opciones anteriores

            options.forEach(opt => {
                const button = document.createElement("button");
                button.innerText = opt.text;
                button.onclick = () => {
                    this.element.innerHTML = ""; // Limpiar al elegir
                    resolve(opt); // Resolvemos la promesa con la opción elegida
                };
                this.element.appendChild(button);
            });
        });
    }
}