// ============================================================
//                OTOME ENGINE - script.js
//     Efecto máquina de escribir + flecha + "Fin"
// ============================================================

// -------------------- Variables globales --------------------
let typing = false;               // ¿Se está escribiendo?
let typingTimeout = null;         // timeout del efecto
let finishTypingCallback = null;  // función al terminar

// -------------------- Función máquina de escribir ----------
/**
 * Muestra texto con efecto máquina de escribir
 * @param {string} text - texto completo
 * @param {Function} onFinish - función al terminar
 */
function typeWriter(text, onFinish){
    const box = document.getElementById("text-content");
    const arrow = document.getElementById("next-arrow");

    box.innerText = "";
    box.style.textAlign = "left"; // alineado izquierda por defecto
    arrow.style.display = "none";  // ocultamos flecha
    typing = true;
    let i = 0;
    finishTypingCallback = onFinish;

    function typeChar(){
        if(!typing) return;

        box.innerText = text.substring(0,i);
        i++;
        if(i <= text.length){
            typingTimeout = setTimeout(typeChar, 40);
        } else {
            typing = false;
            if(finishTypingCallback) finishTypingCallback();
        }
    }

    typeChar();
}

// -------------------- Saltar animación --------------------
function skipTyping(fullText){
    const box = document.getElementById("text-content");
    const arrow = document.getElementById("next-arrow");
    typing = false;
    clearTimeout(typingTimeout);
    box.innerText = fullText;
    arrow.style.display = "inline-block";
    if(finishTypingCallback) finishTypingCallback();
}

// -------------------- Integración con engine.js -----------
const originalRunAction = runAction;

runAction = function(){
    const scene = story.scenes[currentScene];
    const action = scene[index];

    if(!action || action.action !== "dialogue"){
        originalRunAction();
        return;
    }

    const fullText = `${action.speaker}: ${action.text}`;
    const box = document.getElementById("text-content");
    const arrow = document.getElementById("next-arrow");

    document.getElementById("game").onclick = null;

    typeWriter(fullText, ()=>{

        const isLastScene = (currentScene === Object.keys(story.scenes).slice(-1)[0]);
        const isLastActionInScene = (index === scene.length - 1);

        // -------------------- Última acción de la última escena ----
        if(isLastScene && isLastActionInScene){
            // Mostramos flecha primero para que el jugador lea
            arrow.style.display = "inline-block";

            arrow.onclick = ()=>{
                arrow.style.display = "none";
                box.innerText = "Fin";
                box.style.textAlign = "center";
            };
        } else {
            // -------------------- Flecha normal ---------------------
            arrow.style.display = "inline-block";
            arrow.onclick = ()=>{
                arrow.style.display = "none";
                index++;
                originalRunAction();
            };
        }
    });

    // -------------------- Clic mientras escribe ----------------
    document.getElementById("game").onclick = ()=>{
        if(typing){
            skipTyping(fullText);
        }
    };
};
