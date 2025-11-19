    // ============================================================
    //                     OTOME ENGINE
    //             Engine.js - control principal del juego
    // ============================================================

    import { BackgroundManager } from './BackgroundManager.js';
    import { CharacterManager } from './CharacterManager.js';
    import { DialogueManager } from './DialogueManager.js';
    import { ChoiceManager } from './ChoiceManager.js';

    export class Engine {
        constructor() {
            // Estado del juego, ahora encapsulado
            this.story = null;
            this.gameState = {
                currentScene: null,
                currentIndex: 0,
                affinity: {}
            };

            // Referencias a los elementos del DOM
            const backgroundEl = document.getElementById("background");
            const characterEl = document.getElementById("character");
            const textboxEl = document.getElementById("textbox");
            const choicesEl = document.getElementById("choices");
            const gameEl = document.getElementById("game");

            // Instancias de los managers
            this.backgroundManager = new BackgroundManager(backgroundEl);
            this.characterManager = new CharacterManager(characterEl, backgroundEl);
            this.dialogueManager = new DialogueManager(textboxEl, gameEl);
            this.choiceManager = new ChoiceManager(choicesEl);
        }

        async loadStory(storyUrl) {
            const response = await fetch(storyUrl);
            this.story = await response.json();
        }

        start() {
            if (!this.story) {
                console.error("La historia no ha sido cargada.");
                return;
            }
            this.startScene(this.story.start);
        }

        startScene(sceneName) {
            this.gameState.currentScene = sceneName;
            this.gameState.currentIndex = 0;
            this.runNextAction(); // Inicia el bucle de acciones para la nueva escena
        }

        async runNextAction() {
            const scene = this.story.scenes[this.gameState.currentScene];
            if (!scene || this.gameState.currentIndex >= scene.length) {
                console.log("Fin de la escena.");
                // Aquí podrías decidir qué hacer, ¿ir a la siguiente escena o al menú?
                return;
            }

            const action = scene[this.gameState.currentIndex];

            // El bucle principal ahora es mucho más limpio con async/await
            switch (action.action) {
                case "set_background":
                    await this.backgroundManager.set(action.value);
                    break;

                case "show_character":
                    await this.characterManager.show(action);
                    break;

                case "dialogue":
                    await this.dialogueManager.show(action);
                    break;

                case "choice":
                    const chosenOption = await this.choiceManager.show(action.options);
                    this.handleChoice(chosenOption);
                    // choiceManager se encarga de cambiar de escena, no necesitamos hacer nada más aquí.
                    return; // Cortamos el bucle, ya que la elección nos llevará a otro lugar.

                case "add_affinity":
                    this.addAffinity(action.character, action.amount);
                    break;

                case "check_affinity":
                    const val = this.gameState.affinity[action.character] || 0;
                    const nextScene = val >= action.minimum ? action.goto : action.else;
                    this.startScene(nextScene);
                    return; // Cortamos el bucle para empezar la nueva escena.
            }

            // Avanzar a la siguiente acción y continuar el bucle
            this.gameState.currentIndex++;
            this.runNextAction();
        }

        addAffinity(character, amount) {
            if (!this.gameState.affinity[character]) {
                this.gameState.affinity[character] = 0;
            }
            this.gameState.affinity[character] += amount;
            console.log(`Afinidad con ${character}: ${this.gameState.affinity[character]}`);
        }

        handleChoice(option) {
            if (option.affinity) {
                this.addAffinity(option.affinity.character, option.affinity.amount);
            }
            this.startScene(option.goto);
        }
    }