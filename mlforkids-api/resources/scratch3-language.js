class Scratch3ML4KSmallLanguageModelBlocks {

    constructor () {
        this._statuses = [
            { value : 'Ready', text : 'ready to use' },
            { value : 'Loading', text : 'still loading' },
            { value : 'Model Failed', text : 'ERROR - broken' }
        ];
        this._modelconfig = [
            { value: '1.0', text: 'high (1.0)' },
            { value: '0.9', text: '     (0.9)' },
            { value: '0.8', text: '     (0.8)' },
            { value: '0.7', text: '     (0.7)' },
            { value: '0.6', text: '     (0.6)' },
            { value: '0.5', text: '     (0.5)' },
            { value: '0.4', text: '     (0.4)' },
            { value: '0.3', text: '     (0.3)' },
            { value: '0.2', text: '     (0.2)' },
            { value: '0.1', text: 'low  (0.1)' }
        ];

        this._icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gwIFCspuPG7bgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAElUlEQVRIx62WW2xUVRSGv73PmTOdmZbS9AYtlEsGW8qlKlqjhhjEK6gxGhJBn3zQBB9QMcREjEaCjRofeBKNkHgJRX3AiNGIpAmKgSYNkIgIba20FAq9wXTazsw5c/byoS1Q2mnHwHrZOefstf6z/rXWv7cigy17fX9ubNjd46VNuZCdKaWwtBqqnpO/5sDbDw1OtsfO5Oz7xooNe8t2v3Lf/GhpLkYgYClCQRsRQaEQhOGUj28MCsWJ9su88UXToDFiZYprZ/5d8I2RqrIZVM/JB+DTX1vY3dDKQMLDGGFmxOG952p4tKYMgMFUGhHMVCzYWbLFhh2HcWxNY93jbN17grKZYTY+dhu1b/7M0eZe3lm3PKs40wJqrfjkl2YsrejoGeKZjw4RcmyOtfXT1NaHbwxfHmrj7mghhXnBmwdUQMPJi9Q9fwcdPUMcae7h4/2n2LR2MauWzqLrchm2VtT/cZZX1yyeFlBPt0GApRUzqdt3ki1fH6OyPJ+XH6mkbzDFSzuPUBstpK17kNqFhRiRW5PhpViS2mgRyysK+KGpk0tXEjxQXcrcwggtF+P8cylOUV4QlUUNs8qwIOwQG3LZtLaKo809hByLYMCiqjyfXQdb2dfYgW+ya75pAY0Rtm+4nd/PdLOroZXK8hnkhQLsPHCG8/3D3F9VzD2Liti+vgY3bW6e0jFbsaCQU+di1FQUYFuKlVUl9MZTXIwlyI84aKWQWzEWY7b12WX8eKyTbd/9CQiptCEvFODddcu5t7I42zCZAdNGo1D0D7n0xVMYEVZWlfDTWw/ijVIXsBWW0qQ8n17PEBtyQYGRzMnamWunyA0F5IUdh9FajevasVXGuuqqFAqOZWGmIFfFG9f9jVJVN/aPQgjZPkpN4iwu7+s6QtpDTTIMnmcm7XZfpNEGM5yz8DV0uCLjWIx7Tg+QPL0NY8ET8xZQEAxmcWxBXzJJfXPLsA2CzilFO8WIpEEplBW+jjxB/ASIjHyzZ4ysQEEwSHEoB4BEOo1SIz6O1mg1PnMjI4UdqaFycDv34PX+Bgih6m3oUMVoRoMkTm5G/BRWbpRgdPPEegvsPn2aVNonEgjw5Px5lEUiUwy+uDjzXkQ5BVi5UbyehmsHcew4yikBhJxFW8C4E4Mo2LhkCUaE9YuiGcFuUBoB4xIoWkW6++DVt+65egLFq8F4iPEyBvJGhTs9jYBPGAvlFKGcQtLdB1HhCsRPoMPzuVU2UUu1Q6BkNW7X97jnvyFQ8jDKDv/vwJ4xHO7qyka8DYFZT2ES7fj9jThz14Pxx099FmZEaI0NZKJUY5IXEONiEufQkSiB0jWIPwRo/EQ7gmCG29GhuZMC9CeTiMCVVAoFpHx/ihrqAF7nXiQdJ9XxFTqvmsDspxEvhnhXSJ39HKU07r87CS35cNJsPvvrFDmWxbctrVfFoiIvNwOgcQlGNzNBM3JmAxC5c9e1XvYGxinIyFgott61YgLl18ueugaoMMkLoLM8qdJxGFWNvmQyq3uMAnqTSTQoG2U3JZo/iCNZXhKUQlthjDHUN7cgIlm6KRWy7eP/AR5T4+fuc4K4AAAAAElFTkSuQmCC';

        this._modelState = 'Loading';

        postMessage({
            mlforkidswebllm : {
                command : 'init',
                data : {
                    modelid : '{{{ modelid }}}',
                    contextwindow : {{{contextwindow}}}
                }
            }
        });

        this.nextPromptRequest = 1;
        this.promptRequests = {};

        var that = this;
        addEventListener('message', function (evt) {
            that.receiveListenEvents(evt, that);
        });
    }


    getInfo () {
        return {
            id: 'mlforkidssmalllangaugemodel',
            name: 'Language model',

            // colour for the blocks
            color1: '#4B4A60',
            // colour for the menus in the blocks
            color2: '#707070',
            // border for blocks and parameter gaps
            color3: '#4c97ff',

            // Machine Learning for Kids site icon
            menuIconURI: this._icon,
            blockIconURI: this._icon,

            blocks: [
                {
                    opcode: 'modelPrompt',
                    blockType: Scratch.BlockType.REPORTER,
                    text: 'submit [PROMPT] using temperature [TEMP] and top-p [TOPP]',
                    arguments: {
                        PROMPT: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'prompt'
                        },
                        TEMP: {
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: this._modelconfig[0].value,
                            menu: 'modelconfig'
                        },
                        TOPP: {
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: this._modelconfig[0].value,
                            menu: 'modelconfig'
                        }
                    }
                },
                {
                    opcode: 'clearContext',
                    blockType: Scratch.BlockType.COMMAND,
                    text: 'clear context'
                },
                {
                    opcode: 'initialContext',
                    blockType: Scratch.BlockType.COMMAND,
                    text: 'use [CONTEXT] for initial context',
                    arguments: {
                        CONTEXT: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'text'
                        }
                    }
                },
                {
                    opcode: 'checkModelStatus',
                    blockType: Scratch.BlockType.BOOLEAN,
                    text: 'Is the langauge model [STATUS] ?',
                    arguments: {
                        STATUS: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: this._statuses[0].value,
                            menu: 'statuses'
                        }
                    }
                }
            ],

            menus: {
                statuses: this._statuses,
                modelconfig: this._modelconfig
            }
        };
    }


    receiveListenEvents (msg, that) {
        if (msg &&
            msg.data &&
            msg.data.mlforkidswebllm &&
            msg.data.data.modelid === '{{{ modelid }}}' &&
            msg.data.data.contextwindow === {{{contextwindow}}})
        {
            if (that && msg.data.mlforkidswebllm === 'modelready') {
                console.log('model ready for use');
                that._modelState = 'Ready';
            }
            else if (that && msg.data.mlforkidswebllm === 'modelfailed') {
                console.log('model failed');
                that._modelState = 'Model Failed';
            }
            else if (that && msg.data.mlforkidswebllm === 'promptresponse') {
                var callbackFn = that.promptRequests[msg.data.data.requestid];
                if (callbackFn) {
                    callbackFn(msg.data.data.response);
                    delete that.promptRequests[msg.data.data.requestid];
                }
            }
        }
    }


    _sanitisedConfig(input) {
        const numericInput = parseFloat(input);
        if (isNaN(numericInput)) {
            return 1.0;
        }
        if (numericInput > 1) {
            return 1.0;
        }
        if (numericInput < 0.1) {
            return 0.1;
        }
        return numericInput;
    }


    clearContext() {
        if (this._modelState === 'Ready') {
            postMessage({
                mlforkidswebllm : {
                    command : 'clear',
                    data : {
                        modelid : '{{{ modelid }}}',
                        contextwindow : {{{contextwindow}}}
                    }
                }
            });
        }
    }


    initialContext({ CONTEXT }) {
        if (this._modelState === 'Ready') {
            postMessage({
                mlforkidswebllm : {
                    command : 'context',
                    data : {
                        modelid : '{{{ modelid }}}',
                        contextwindow : {{{contextwindow}}},
                        initialcontext : CONTEXT
                    }
                }
            });
        }
    }


    modelPrompt({ PROMPT, TEMP, TOPP }) {
        if (this._modelState === 'Ready') {
            return new Promise((resolve) => {
                var requestId = this.nextPromptRequest;
                this.nextPromptRequest += 1;

                this.promptRequests[requestId] = function (response) {
                    return resolve(response);
                };

                postMessage({
                    mlforkidswebllm : {
                        command : 'prompt',
                        data : {
                            modelid : '{{{ modelid }}}',
                            contextwindow : {{{contextwindow}}},
                            requestid : requestId,
                            input : PROMPT,
                            temperature: this._sanitisedConfig(TEMP),
                            top_p: this._sanitisedConfig(TOPP)
                        }
                    }
                });
            });
        }
    }


    checkModelStatus({ STATUS }) {
        return STATUS === this._modelState;
    }
}

Scratch.extensions.register(new Scratch3ML4KSmallLanguageModelBlocks());
