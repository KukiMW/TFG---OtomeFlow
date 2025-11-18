let story = null;
let currentScene = "";
let index = 0;
let affinity = {};

// ---- CARGAR HISTORIA ----
async function loadStory() {
    const response = await fetch("historiaEjemplo.json");
    story = await response.json();
    startScene(story.start);
}

// ---- COMENZAR ESCENA ----
function startScene(sceneName) {
    currentScene = sceneName;
    index = 0;
    runAction();
}

// ---- OCULTAR TODOS LOS PERSONAJES ----
function hideCharacters() {
    ["char_left", "char_center", "char_right"].forEach(id => {
        document.getElementById(id).style.opacity = 0;
    });
}

// ---- MOSTRAR PERSONAJE ----
function showCharacter(id, sprite) {
    hideCharacters();
    const img = document.getElementById(id);
    img.src = sprite;
    img.style.opacity = 1;
}

// ---- EJECUTAR ACCIÓN ----
function runAction() {
    const scene = story.scenes[currentScene];
    const action = scene[index];

    if (!action) return;

    const choicesDiv = document.getElementById("choices");
    choicesDiv.innerHTML = "";

    switch (action.action) {

        case "set_background":
            document.getElementById("background").src = action.value;
            index++;
            runAction();
            break;

        case "show_character":
            if (action.position === "left") showCharacter("char_left", action.sprite);
            else if (action.position === "right") showCharacter("char_right", action.sprite);
            else if (action.position === "center") showCharacter("char_center", action.sprite);
            index++;
            runAction();
            break;

        case "dialogue":
            document.getElementById("textbox").innerText =
                `${action.speaker}: ${action.text}`;

            document.getElementById("game").onclick = () => {
                document.getElementById("game").onclick = null;
                index++;
                runAction();
            };
            break;

        case "choice":
            action.options.forEach(opt => {
                const b = document.createElement("button");
                b.innerText = opt.text;

                b.onclick = () => {
                    if (opt.affinity) {
                        const char = opt.affinity.character;
                        const amt = opt.affinity.amount;

                        if (!affinity[char]) affinity[char] = 0;
                        affinity[char] += amt;
                    }
                    startScene(opt.goto);
                };

                choicesDiv.appendChild(b);
            });
            break;

        case "add_affinity":
            if (!affinity[action.character]) affinity[action.character] = 0;
            affinity[action.character] += action.amount;
            index++;
            runAction();
            break;

        case "check_affinity":
            const value = affinity[action.character] || 0;
            const ok = value >= action.minimum;
            startScene(ok ? action.goto : action.else);
            break;
    }
}

loadStory();
