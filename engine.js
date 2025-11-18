    // ============================================================
    //                     OTOME ENGINE
    //             engine.js - control principal del juego
    // ============================================================

    // -------------------- Variables Globales --------------------
    let story = null;           // historia cargada desde JSON
    let currentScene = "";      // nombre de la escena actual
    let index = 0;              // índice dentro de la escena
    let affinity = {};          // puntos de afinidad por personaje

    // -------------------- Cargar Historia ----------------------
    async function loadStory() {
        const response = await fetch("historiaEjemplo.json");
        story = await response.json();
        startScene(story.start);
    }

    // -------------------- Iniciar Escena -----------------------
    function startScene(sceneName) {
        currentScene = sceneName;
        index = 0;
        runAction();
    }

    // -------------------- Ejecutar Acción ----------------------
    function runAction() {
        const scene = story.scenes[currentScene];
        const action = scene[index];

        if (!action) return; // Fin de escena

        const choicesDiv = document.getElementById("choices");
        choicesDiv.innerHTML = ""; // Limpiar botones de elección

        switch(action.action) {

            // -------------------- Cambiar Fondo --------------------
            case "set_background":
                document.getElementById("background").src = action.value;
                index++;
                runAction();
                break;

            // -------------------- Mostrar Personaje ----------------
            case "show_character":
                const char = document.getElementById("character");

                // Ocultamos la imagen para evitar parpadeo
                char.style.opacity = 0;

                // Cambiamos la posición primero
                char.style.left =
                    action.position === "left" ? "5%" :
                        action.position === "right" ? "75%" :
                            "40%";

                // Cambiamos la imagen
                char.src = action.sprite;

                // Esperamos a que la imagen cargue completamente
                char.onload = () => {
                    // Aplicamos fade in suave
                    char.style.transition = "opacity 0.3s";
                    char.style.opacity = 1;

                    // Avanzamos a la siguiente acción
                    index++;
                    runAction();
                };
                break;

            // -------------------- Mostrar Diálogo ------------------
            case "dialogue":
                // La animación con efecto máquina de escribir
                // se gestiona en script.js
                break;

            // -------------------- Opciones de Elección ------------
            case "choice":
                action.options.forEach(opt => {
                    const b = document.createElement("button");
                    b.innerText = opt.text;

                    b.onclick = () => {
                        // Si la opción altera afinidad
                        if(opt.affinity){
                            const charName = opt.affinity.character;
                            const amt = opt.affinity.amount;
                            if(!affinity[charName]) affinity[charName]=0;
                            affinity[charName]+=amt;
                        }
                        startScene(opt.goto);
                    };

                    choicesDiv.appendChild(b);
                });
                break;

            // -------------------- Afinidad Directa -----------------
            case "add_affinity":
                if(!affinity[action.character]) affinity[action.character]=0;
                affinity[action.character]+=action.amount;
                index++;
                runAction();
                break;

            // -------------------- Comprobación de Afinidad ---------
            case "check_affinity":
                const currentValue = affinity[action.character] || 0;
                const nextScene = currentValue >= action.minimum ? action.goto : action.else;
                startScene(nextScene);
                break;
        }
    }

    // -------------------- Inicializar Juego --------------------
    loadStory();
