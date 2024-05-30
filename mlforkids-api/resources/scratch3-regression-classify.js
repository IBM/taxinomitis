class MachineLearningRegression {

    constructor() {
        this._statuses = [
            { value : 'Ready', text : 'ready to use' },
            { value : 'Training', text : 'still training' },
            { value : 'Model Failed', text : 'ERROR - broken' }
        ];
        this._outputvalues = {
            items : [ {{#outputcolumns}} '{{name}}', {{/outputcolumns}} ],
            acceptReporters: true
        };

        this._icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gwIFCspuPG7bgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAElUlEQVRIx62WW2xUVRSGv73PmTOdmZbS9AYtlEsGW8qlKlqjhhjEK6gxGhJBn3zQBB9QMcREjEaCjRofeBKNkHgJRX3AiNGIpAmKgSYNkIgIba20FAq9wXTazsw5c/byoS1Q2mnHwHrZOefstf6z/rXWv7cigy17fX9ubNjd46VNuZCdKaWwtBqqnpO/5sDbDw1OtsfO5Oz7xooNe8t2v3Lf/GhpLkYgYClCQRsRQaEQhOGUj28MCsWJ9su88UXToDFiZYprZ/5d8I2RqrIZVM/JB+DTX1vY3dDKQMLDGGFmxOG952p4tKYMgMFUGhHMVCzYWbLFhh2HcWxNY93jbN17grKZYTY+dhu1b/7M0eZe3lm3PKs40wJqrfjkl2YsrejoGeKZjw4RcmyOtfXT1NaHbwxfHmrj7mghhXnBmwdUQMPJi9Q9fwcdPUMcae7h4/2n2LR2MauWzqLrchm2VtT/cZZX1yyeFlBPt0GApRUzqdt3ki1fH6OyPJ+XH6mkbzDFSzuPUBstpK17kNqFhRiRW5PhpViS2mgRyysK+KGpk0tXEjxQXcrcwggtF+P8cylOUV4QlUUNs8qwIOwQG3LZtLaKo809hByLYMCiqjyfXQdb2dfYgW+ya75pAY0Rtm+4nd/PdLOroZXK8hnkhQLsPHCG8/3D3F9VzD2Liti+vgY3bW6e0jFbsaCQU+di1FQUYFuKlVUl9MZTXIwlyI84aKWQWzEWY7b12WX8eKyTbd/9CQiptCEvFODddcu5t7I42zCZAdNGo1D0D7n0xVMYEVZWlfDTWw/ijVIXsBWW0qQ8n17PEBtyQYGRzMnamWunyA0F5IUdh9FajevasVXGuuqqFAqOZWGmIFfFG9f9jVJVN/aPQgjZPkpN4iwu7+s6QtpDTTIMnmcm7XZfpNEGM5yz8DV0uCLjWIx7Tg+QPL0NY8ET8xZQEAxmcWxBXzJJfXPLsA2CzilFO8WIpEEplBW+jjxB/ASIjHyzZ4ysQEEwSHEoB4BEOo1SIz6O1mg1PnMjI4UdqaFycDv34PX+Bgih6m3oUMVoRoMkTm5G/BRWbpRgdPPEegvsPn2aVNonEgjw5Px5lEUiUwy+uDjzXkQ5BVi5UbyehmsHcew4yikBhJxFW8C4E4Mo2LhkCUaE9YuiGcFuUBoB4xIoWkW6++DVt+65egLFq8F4iPEyBvJGhTs9jYBPGAvlFKGcQtLdB1HhCsRPoMPzuVU2UUu1Q6BkNW7X97jnvyFQ8jDKDv/vwJ4xHO7qyka8DYFZT2ES7fj9jThz14Pxx099FmZEaI0NZKJUY5IXEONiEufQkSiB0jWIPwRo/EQ7gmCG29GhuZMC9CeTiMCVVAoFpHx/ihrqAF7nXiQdJ9XxFTqvmsDspxEvhnhXSJ39HKU07r87CS35cNJsPvvrFDmWxbctrVfFoiIvNwOgcQlGNzNBM3JmAxC5c9e1XvYGxinIyFgott61YgLl18ueugaoMMkLoLM8qdJxGFWNvmQyq3uMAnqTSTQoG2U3JZo/iCNZXhKUQlthjDHUN7cgIlm6KRWy7eP/AR5T4+fuc4K4AAAAAElFTkSuQmCC';

        this.training = false;
        this.modelReady = false;
        this.modelError = false;

        postMessage({
            mlforkidsstorage : {
                command : 'init'
            }
        });
        postMessage({
            mlforkidsregression : {
                command : 'init',
                data : '{{{projectid}}}'
            }
        });

        var that = this;
        addEventListener('message', function (evt) {
            that.receiveListenEvents(evt, that);
        });

        this.nextClassifyRequest = 1;
        this.classifyRequests = {};
    }


    getInfo() {

        return {
            // making the id unique to allow multiple instances
            id: 'mlforkidsregression{{{ projectid }}}',
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
                {
                    opcode: 'predict',
                    blockType: Scratch.BlockType.REPORTER,
                    text: 'predict [ML4KREGRESSIONOUTPUT] from {{#inputcolumns}} {{name}}[INFIELD{{idx}}] {{/inputcolumns}}',
                    arguments: {
                        {{#inputcolumns}}
                        INFIELD{{idx}}: {
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        {{/inputcolumns}}
                        ML4KREGRESSIONOUTPUT: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: this._outputvalues.items[0],
                            menu: 'outputvalues'
                        }
                    }
                },

                // add training data to the project
                {
                    opcode: 'addTraining',
                    blockType: Scratch.BlockType.COMMAND,
                    text: 'add training data {{#inputcolumns}} {{name}}[INFIELD{{idx}}] {{/inputcolumns}} is {{#outputcolumns}} {{name}}[OUTFIELD{{idx}}] {{/outputcolumns}}',
                    arguments: {
                        {{#inputcolumns}}
                        INFIELD{{idx}}: {
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        {{/inputcolumns}}
                        {{#outputcolumns}}
                        OUTFIELD{{idx}}: {
                            type: Scratch.ArgumentType.NUMBER,
                            defaultValue: 0
                        },
                        {{/outputcolumns}}
                        lastfield: null
                    }
                },

                // train a new machine learning model
                {
                    opcode: 'trainNewModel',
                    blockType: Scratch.BlockType.COMMAND,
                    text: {
                        default: 'train new machine learning model',
                        id: 'mlforkids.text.trainNewModel'
                    }
                },

                // get the status of the machine learning model
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
                outputvalues: this._outputvalues,
                statuses: this._statuses
            }
        };
    }


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

    trainNewModel () {
        if (this.training) {
            console.log('already training');
            return;
        }

        this.modelReady = false;
        this.training = true;

        postMessage({
            mlforkidsregression : {
                command : 'train',
                data : '{{{projectid}}}'
            }
        });
    }


    receiveListenEvents (msg, that) {
        if (msg && msg.data && msg.data.mlforkidsregression && msg.data.data.projectid == '{{{projectid}}}')
        {
            if (that && msg.data.mlforkidsregression === 'modelready')
            {
                console.log('model ready for use');
                that.modelReady = true;
                that.training = false;
            }
            else if (that && msg.data.mlforkidsregression === 'modelfailed')
            {
                console.log('model FAILED');
                that.modelError = true;
                that.training = false;
            }
            else if (that && msg.data.mlforkidsregression === 'modelinit')
            {
                console.log('ready to train a new model');
            }
            else if (that && msg.data.mlforkidsregression === 'modelretrain')
            {
                console.log('model was retrained outside of Scratch');

                // to keep the performance in Scratch at a similar
                //  level, we'll try to train a model automatically
                that.trainNewModel();
            }
            else if (that && msg.data.mlforkidsregression === 'classifyresponse')
            {
                var callbackFn = that.classifyRequests[msg.data.data.requestid];
                callbackFn(msg.data.data.prediction);
                delete that.classifyRequests[msg.data.data.requestid];
            }
        }
    }


    predict(args) {
        if (!this.modelReady) {
            console.log('model not ready to make predictions');
            return;
        }

        return new Promise((resolve) => {
            var requestId = this.nextClassifyRequest;
            this.nextClassifyRequest += 1;

            this.classifyRequests[requestId] = function (prediction) {
                return resolve(prediction[args.ML4KREGRESSIONOUTPUT]);
            };

            postMessage({
                mlforkidsregression : {
                    command : 'predict',
                    data : {
                        projectid : '{{{projectid}}}',
                        requestid : requestId,
                        data : getFieldValues(args)
                    }
                }
            });
        });
    }


    addTraining(args) {
        try {
            postMessage({
                mlforkidsstorage : {
                    command : 'storeregression',
                    data : {
                        projectid : '{{{projectid}}}',
                        values : getFieldValues(args, true)
                    }
                }
            });
        }
        catch (err) {
            console.log('data not suitable for training', err);
        }
    }
}

function getFieldValues(args, includeOutput) {
    var values = {};
    {{#inputcolumns}}
    values['{{name}}'] = parseFloat(args['INFIELD' + {{idx}}]);
    if (isNaN(values['{{name}}'])) {
        throw new Error('invalid value for {{name}}');
    }
    {{/inputcolumns}}
    if (includeOutput) {
        {{#outputcolumns}}
        values['{{name}}'] = parseFloat(args['OUTFIELD' + {{idx}}]);
        if (isNaN(values['{{name}}'])) {
            throw new Error('invalid value for {{name}}');
        }
        {{/outputcolumns}}
    }
    return values;
}



Scratch.extensions.register(new MachineLearningRegression());
