class MachineLearningNumbers {

    constructor() {
        this._labels = {
            items : [ {{#labels}} '{{name}}', {{/labels}} ],
            acceptReporters : true
        };

        this._statuses = [
            { value : 'Ready', text : 'ready to use' },
            { value : 'Training', text : 'still training' },
            { value : 'Model Failed', text : 'ERROR - broken' }
        ];

        this._icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gwIFCspuPG7bgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAElUlEQVRIx62WW2xUVRSGv73PmTOdmZbS9AYtlEsGW8qlKlqjhhjEK6gxGhJBn3zQBB9QMcREjEaCjRofeBKNkHgJRX3AiNGIpAmKgSYNkIgIba20FAq9wXTazsw5c/byoS1Q2mnHwHrZOefstf6z/rXWv7cigy17fX9ubNjd46VNuZCdKaWwtBqqnpO/5sDbDw1OtsfO5Oz7xooNe8t2v3Lf/GhpLkYgYClCQRsRQaEQhOGUj28MCsWJ9su88UXToDFiZYprZ/5d8I2RqrIZVM/JB+DTX1vY3dDKQMLDGGFmxOG952p4tKYMgMFUGhHMVCzYWbLFhh2HcWxNY93jbN17grKZYTY+dhu1b/7M0eZe3lm3PKs40wJqrfjkl2YsrejoGeKZjw4RcmyOtfXT1NaHbwxfHmrj7mghhXnBmwdUQMPJi9Q9fwcdPUMcae7h4/2n2LR2MauWzqLrchm2VtT/cZZX1yyeFlBPt0GApRUzqdt3ki1fH6OyPJ+XH6mkbzDFSzuPUBstpK17kNqFhRiRW5PhpViS2mgRyysK+KGpk0tXEjxQXcrcwggtF+P8cylOUV4QlUUNs8qwIOwQG3LZtLaKo809hByLYMCiqjyfXQdb2dfYgW+ya75pAY0Rtm+4nd/PdLOroZXK8hnkhQLsPHCG8/3D3F9VzD2Liti+vgY3bW6e0jFbsaCQU+di1FQUYFuKlVUl9MZTXIwlyI84aKWQWzEWY7b12WX8eKyTbd/9CQiptCEvFODddcu5t7I42zCZAdNGo1D0D7n0xVMYEVZWlfDTWw/ijVIXsBWW0qQ8n17PEBtyQYGRzMnamWunyA0F5IUdh9FajevasVXGuuqqFAqOZWGmIFfFG9f9jVJVN/aPQgjZPkpN4iwu7+s6QtpDTTIMnmcm7XZfpNEGM5yz8DV0uCLjWIx7Tg+QPL0NY8ET8xZQEAxmcWxBXzJJfXPLsA2CzilFO8WIpEEplBW+jjxB/ASIjHyzZ4ysQEEwSHEoB4BEOo1SIz6O1mg1PnMjI4UdqaFycDv34PX+Bgih6m3oUMVoRoMkTm5G/BRWbpRgdPPEegvsPn2aVNonEgjw5Px5lEUiUwy+uDjzXkQ5BVi5UbyehmsHcew4yikBhJxFW8C4E4Mo2LhkCUaE9YuiGcFuUBoB4xIoWkW6++DVt+65egLFq8F4iPEyBvJGhTs9jYBPGAvlFKGcQtLdB1HhCsRPoMPzuVU2UUu1Q6BkNW7X97jnvyFQ8jDKDv/vwJ4xHO7qyka8DYFZT2ES7fj9jThz14Pxx099FmZEaI0NZKJUY5IXEONiEufQkSiB0jWIPwRo/EQ7gmCG29GhuZMC9CeTiMCVVAoFpHx/ihrqAF7nXiQdJ9XxFTqvmsDspxEvhnhXSJ39HKU07r87CS35cNJsPvvrFDmWxbctrVfFoiIvNwOgcQlGNzNBM3JmAxC5c9e1XvYGxinIyFgott61YgLl18ueugaoMMkLoLM8qdJxGFWNvmQyq3uMAnqTSTQoG2U3JZo/iCNZXhKUQlthjDHUN7cgIlm6KRWy7eP/AR5T4+fuc4K4AAAAAElFTkSuQmCC';

        this.training = false;
        this.lastModelTrain = 0;
        this.modelReady = false;
        this.modelError = false;

        const that = this;
        addEventListener('message', function (evt) {
            that.receiveListenEvents(evt, that);
        });


        postMessage({
            mlforkidsstorage : {
                command : 'init'
            }
        });

        {{#storeurl}}
        postMessage({
            mlforkidsnumbers : {
                command : 'init',
                data : '{{{modelid}}}'
            }
        });
        {{/storeurl}}
        {{^storeurl}}
        postMessage({
            mlforkidsnumbers : {
                command : 'initlocal',
                data : '{{{modelid}}}'
            }
        });
        {{/storeurl}}

        this.nextClassifyRequest = 1;
        this.classifyRequests = {};
    }


    getInfo() {

        return {
            // making the id unique to allow multiple instances
            id: 'mlforkidsnumbers{{{ projectid }}}',
            // the name of the student project
            name: '{{{ projectname }}}',

            // colour for the blocks
            color1: '#4B4A60',
            // colour for the menus in the blocks
            color2: '#707070',
            // border for blocks and parameter gaps
            color3: '#4c97ff',

            // Machine Learning for Kids site icon
            menuIconURI: this._icon,
            blockIconURI: this._icon,

            // blocks to add to the new section
            blocks: [
                // classify the numbers and return the label
                {
                    opcode: 'label',
                    blockType: Scratch.BlockType.REPORTER,
                    text: 'recognise numbers {{#fields}} {{name}}[FIELD{{idx}}] {{/fields}} (label)',
                    arguments: {
                        {{#fields}}
                        FIELD{{idx}}: {
                            {{#multichoice}}
                            type: Scratch.ArgumentType.STRING,
                            menu: 'choices{{idx}}',
                            defaultValue: '{{default}}'
                            {{/multichoice}}
                            {{^multichoice}}
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: 0
                            {{/multichoice}}
                        },
                        {{/fields}}
                    }
                },

                // classify the numbers and return the confidence score
                {
                    opcode: 'confidence',
                    blockType: Scratch.BlockType.REPORTER,
                    text: 'recognise numbers {{#fields}} {{name}}[FIELD{{idx}}] {{/fields}} (confidence)',
                    arguments: {
                        {{#fields}}
                        FIELD{{idx}}: {
                            {{#multichoice}}
                            type: Scratch.ArgumentType.STRING,
                            menu: 'choices{{idx}}',
                            defaultValue: '{{default}}'
                            {{/multichoice}}
                            {{^multichoice}}
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: 0
                            {{/multichoice}}
                        },
                        {{/fields}}
                    }
                },

                // provide blocks representing each of the labels
                {{#labels}}
                {
                    opcode: 'return_label_{{idx}}',
                    blockType: Scratch.BlockType.REPORTER,
                    text: ' {{name}}'
                },
                {{/labels}}

                // provide blocks representing each of the choices
                {{#choices}}
                {
                    opcode: 'return_choice_{{idx}}',
                    blockType: Scratch.BlockType.REPORTER,
                    text: ' {{name}}'
                },
                {{/choices}}


                // add training data to the project
                {
                    opcode: 'addTraining',
                    blockType: Scratch.BlockType.COMMAND,
                    text: 'add training data {{#fields}} {{name}}[FIELD{{idx}}] {{/fields}} is [LABEL]',
                    arguments: {
                        {{#fields}}
                        FIELD{{idx}}: {
                            {{#multichoice}}
                            type: Scratch.ArgumentType.STRING,
                            menu: 'choices{{idx}}',
                            defaultValue: '{{default}}'
                            {{/multichoice}}
                            {{^multichoice}}
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: 0
                            {{/multichoice}}
                        },
                        {{/fields}}
                        LABEL: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: this._labels.items[0],
                            menu: 'labels'
                        }
                    }
                },

                // train a new machine learning model
                {
                    opcode: 'trainNewModel',
                    blockType: Scratch.BlockType.COMMAND,
                    text: {
                        default: 'train new machine learning model',
                        id: 'mlforkids.numbers.trainNewModel'
                    }
                },
                {
                    opcode: 'checkModelStatus',
                    blockType: Scratch.BlockType.BOOLEAN,
                    text: {
                        default: 'Is the machine learning model [STATUS] ?',
                        id: 'mlforkids.text.checkModelStatus'
                    },
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
                labels: this._labels,

                {{#fields}}
                choices{{idx}} : {
                    items : [
                        {{#menu}}'{{.}}',{{/menu}}
                    ],
                    acceptReporters : true
                },
                {{/fields}}

                statuses: this._statuses
            }
        };
    }




    label(args) {
        return new Promise(resolve => this.prepareArgsGetNumberClassificationResponse('class_name', args, resolve));
    }
    confidence(args) {
        return new Promise(resolve => this.prepareArgsGetNumberClassificationResponse('confidence', args, resolve));
    }


    {{#labels}}
    return_label_{{idx}} () {
        return '{{name}}';
    }
    {{/labels}}

    {{#choices}}
    return_choice_{{idx}} () {
        return '{{name}}';
    }
    {{/choices}}


    checkModelStatus({ STATUS }) {
        switch(STATUS) {
            case 'Ready':
                return this.modelReady;
            case 'Training':
                return this.training;
            default:
                return this.modelError;
        }
    }


    addTraining(args) {
        const numbers = this.getFieldValuesAsAry(args);
        const label = args.LABEL;

        {{#storeurl}}
        const url = new URL('{{{ storeurl }}}');

        const options = {
            headers : {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-User-Agent': 'mlforkids-scratch3-numbers'
            },
            method : 'POST',
            body : JSON.stringify({
                data : numbers,
                label : label
            })
        };

        return fetch(url, options)
            .then((response) => {
                if (response.status !== 200) {
                    return response.json();
                }
                else {
                    console.log('added');
                }
            })
            .then((responseJson) => {
                if (responseJson) {
                    if (responseJson.error === 'Project already has maximum allowed amount of training data') {
                        postMessage({ mlforkids : 'mlforkids-addtraininglimit-help' });
                    }
                    else {
                        console.log(responseJson);
                    }
                }
            });
        {{/storeurl}}
        {{^storeurl}}
        postMessage({
            mlforkidsstorage : {
                command : 'storenumbers',
                data : {
                    projectid : '{{{modelid}}}',
                    numberdata : numbers,
                    label : label
                }
            }
        });
        {{/storeurl}}
    }


    trainNewModel() {
        if (this.trainingModel || // currently submitting a new-model request, OR
            this._lastModelTrainedRecently()) // we very recently submitted one
        {
            console.log('ignoring request - new model requested very recently');
            return;
        }

        this.trainingModel = true;
        this.lastModelTrain = Date.now();

        {{#storeurl}}
        postMessage({
            mlforkidsnumbers : {
                command : 'train',
                data : {
                    projectid : '{{{ modelid }}}',
                    modelurl : '{{{ modelurl }}}'
                }
            }
        });
        {{/storeurl}}
        {{^storeurl}}
        postMessage({
            mlforkidsnumbers : {
                command : 'trainlocal',
                data : {
                    projectid : '{{{modelid}}}',
                    modelurl : '{{{ modelurl }}}'
                }
            }
        });
        {{/storeurl}}
    }


    classifyNumbers(numbers, callback) {
        const requestId = this.nextClassifyRequest;
        this.nextClassifyRequest += 1;

        this.classifyRequests[requestId] = function (response) {
            console.log(response);
            return callback(response);
        };

        postMessage({
            mlforkidsnumbers : {
                command : 'classify',
                data : {
                    projectid : '{{{modelid}}}',
                    requestid : requestId,
                    numbers : numbers
                }
            }
        });
    }

    receiveListenEvents (msg, that) {
        if (msg && msg.data && msg.data.mlforkidsnumbers && msg.data.data.projectid === '{{{modelid}}}')
        {
            if (that && msg.data.mlforkidsnumbers === 'modelready')
            {
                console.log('model ready for use');
                that.modelReady = true;
                that.training = false;
            }
            else if (that && msg.data.mlforkidsnumbers === 'modelfailed')
            {
                console.log('model FAILED');
                that.modelError = true;
                that.training = false;
            }
            else if (that && msg.data.mlforkidsnumbers === 'modelinit')
            {
                console.log('ready to train a new model');

                // to avoid the user needing to do this, we'll
                //  try to train a model automatically
                that.trainNewModel();
            }
            else if (that && msg.data.mlforkidsnumbers === 'classifyresponse')
            {
                const callbackFn = that.classifyRequests[msg.data.data.requestid];
                callbackFn(msg.data.data.result);
                delete that.classifyRequests[msg.data.data.requestid];
            }
        }
    }



    getNumberClassificationResponse (numbers, valueToReturn, callback) {
        this.classifyNumbers(numbers, function (results) {
            callback(results[0][valueToReturn]);
        });
    }


    getFieldValuesAsObj (args) {
        const data = {};
        {{#fields}}
        data['{{name}}'] = args['FIELD{{idx}}'];
        {{/fields}}
        return data;
    }
    getFieldValuesAsAry (args) {
        const data = [];
        let menuChoices = {};
        let menuChoicesIdx = 0;
        {{#fields}}
        const value{{idx}} = args['FIELD{{idx}}'];
        {{#multichoice}}
        menuChoices = {};
        menuChoicesIdx = 0;
        {{#menu}}
        menuChoices['{{.}}'] = menuChoicesIdx++;
        {{/menu}}
        data['{{idx}}'] = menuChoices[value{{idx}}];
        {{/multichoice}}
        {{^multichoice}}
        if (typeof value{{idx}} === 'number') {
            data[{{idx}}] = value{{idx}};
        }
        else if (value{{idx}}.includes('.')) {
            data[{{idx}}] = parseFloat(value{{idx}});
        }
        else {
            data[{{idx}}] = parseInt(value{{idx}});
        }
        {{/multichoice}}
        {{/fields}}
        return data;
    }


    prepareArgsGetNumberClassificationResponse (valueToReturn, args, callback) {
        const numbers = this.getFieldValuesAsObj(args);
        this.getNumberClassificationResponse(numbers, valueToReturn, callback);
    }

    _lastModelTrainedRecently() {
        const ONE_MINUTE = 60 * 1000;
        return (this.lastModelTrain + ONE_MINUTE) > Date.now();
    }
}

Scratch.extensions.register(new MachineLearningNumbers());
