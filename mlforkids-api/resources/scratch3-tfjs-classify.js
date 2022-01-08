class MachineLearningTfjs {

    constructor() {
        this._labels = {
            items : [ {{#labels}} '{{name}}', {{/labels}} ],
            acceptReporters: true
        };

        this._statuses = [
            { value : 'Ready', text : 'ready to use' },
            { value : 'Loading', text : 'still loading' },
            { value : 'Model Failed', text : 'ERROR - broken' }
        ];

        this._icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gwIFCspuPG7bgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAElUlEQVRIx62WW2xUVRSGv73PmTOdmZbS9AYtlEsGW8qlKlqjhhjEK6gxGhJBn3zQBB9QMcREjEaCjRofeBKNkHgJRX3AiNGIpAmKgSYNkIgIba20FAq9wXTazsw5c/byoS1Q2mnHwHrZOefstf6z/rXWv7cigy17fX9ubNjd46VNuZCdKaWwtBqqnpO/5sDbDw1OtsfO5Oz7xooNe8t2v3Lf/GhpLkYgYClCQRsRQaEQhOGUj28MCsWJ9su88UXToDFiZYprZ/5d8I2RqrIZVM/JB+DTX1vY3dDKQMLDGGFmxOG952p4tKYMgMFUGhHMVCzYWbLFhh2HcWxNY93jbN17grKZYTY+dhu1b/7M0eZe3lm3PKs40wJqrfjkl2YsrejoGeKZjw4RcmyOtfXT1NaHbwxfHmrj7mghhXnBmwdUQMPJi9Q9fwcdPUMcae7h4/2n2LR2MauWzqLrchm2VtT/cZZX1yyeFlBPt0GApRUzqdt3ki1fH6OyPJ+XH6mkbzDFSzuPUBstpK17kNqFhRiRW5PhpViS2mgRyysK+KGpk0tXEjxQXcrcwggtF+P8cylOUV4QlUUNs8qwIOwQG3LZtLaKo809hByLYMCiqjyfXQdb2dfYgW+ya75pAY0Rtm+4nd/PdLOroZXK8hnkhQLsPHCG8/3D3F9VzD2Liti+vgY3bW6e0jFbsaCQU+di1FQUYFuKlVUl9MZTXIwlyI84aKWQWzEWY7b12WX8eKyTbd/9CQiptCEvFODddcu5t7I42zCZAdNGo1D0D7n0xVMYEVZWlfDTWw/ijVIXsBWW0qQ8n17PEBtyQYGRzMnamWunyA0F5IUdh9FajevasVXGuuqqFAqOZWGmIFfFG9f9jVJVN/aPQgjZPkpN4iwu7+s6QtpDTTIMnmcm7XZfpNEGM5yz8DV0uCLjWIx7Tg+QPL0NY8ET8xZQEAxmcWxBXzJJfXPLsA2CzilFO8WIpEEplBW+jjxB/ASIjHyzZ4ysQEEwSHEoB4BEOo1SIz6O1mg1PnMjI4UdqaFycDv34PX+Bgih6m3oUMVoRoMkTm5G/BRWbpRgdPPEegvsPn2aVNonEgjw5Px5lEUiUwy+uDjzXkQ5BVi5UbyehmsHcew4yikBhJxFW8C4E4Mo2LhkCUaE9YuiGcFuUBoB4xIoWkW6++DVt+65egLFq8F4iPEyBvJGhTs9jYBPGAvlFKGcQtLdB1HhCsRPoMPzuVU2UUu1Q6BkNW7X97jnvyFQ8jDKDv/vwJ4xHO7qyka8DYFZT2ES7fj9jThz14Pxx099FmZEaI0NZKJUY5IXEONiEufQkSiB0jWIPwRo/EQ7gmCG29GhuZMC9CeTiMCVVAoFpHx/ihrqAF7nXiQdJ9XxFTqvmsDspxEvhnhXSJ39HKU07r87CS35cNJsPvvrFDmWxbctrVfFoiIvNwOgcQlGNzNBM3JmAxC5c9e1XvYGxinIyFgott61YgLl18ueugaoMMkLoLM8qdJxGFWNvmQyq3uMAnqTSTQoG2U3JZo/iCNZXhKUQlthjDHUN7cgIlm6KRWy7eP/AR5T4+fuc4K4AAAAAElFTkSuQmCC';

        this._modelState = 'Loading';


        var encodedProjectData = JSON.stringify({
            labels : this._labels.items,
            projectid : '{{{projectid}}}',
            dataType : '{{{modeltype}}}',
            modelurl : '{{{modelurl}}}'
        });
        postMessage({
            mlforkidstensorflow : {
                command : 'init',
                data : encodedProjectData
            }
        });
        var that = this;
        addEventListener('message', function (evt) {
            that.receiveListenEvents(evt, that);
        });

        this.nextClassifyRequest = 1;
        this.classifyRequests = {};

        {{^haslabels}}
        postMessage({
            mlforkids: 'mlforkids-tfjs-nolabelnames-help'
        });
        {{/haslabels}}
    }


    getInfo() {

        return {
            // making the id unique to allow multiple instances
            id: 'mlforkidstfjs{{{ projectid }}}',
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
                // classify the image and return the label
                {
                    opcode: 'label',
                    blockType: Scratch.BlockType.REPORTER,
                    text: {
                        default: 'recognise [DATA] (label)',
                        id: 'mlforkids.tensorflow.recogniseLabel'
                    },
                    arguments: {
                        DATA: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'data'
                        }
                    }
                },

                {
                    opcode: 'confidence',
                    blockType: Scratch.BlockType.REPORTER,
                    text: {
                        default: 'recognise [DATA] (confidence)',
                        id: 'mlforkids.tensorflow.recogniseConfidence'
                    },
                    arguments: {
                        DATA: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'data'
                        }
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

                {{#haslabels}}
                ,{
                    opcode: 'labelname',
                    blockType: Scratch.BlockType.REPORTER,
                    text: '[LABEL]',
                    arguments: {
                        LABEL: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: this._labels.items[0].value,
                            menu: 'labels'
                        }
                    }
                }
                {{/haslabels}}
            ],

            menus: {
                labels: this._labels,
                statuses: this._statuses
            }
        };
    }


    label({ DATA }) {
        return new Promise(resolve => this.getClassificationResponse(DATA, 'class_name', resolve));
    }
    confidence({ DATA }) {
        return new Promise(resolve => this.getClassificationResponse(DATA, 'confidence', resolve));
    }
    labelname({ LABEL }) {
        return LABEL;
    }

    checkModelStatus({ STATUS }) {
        return STATUS === this._modelState;
    }

    receiveListenEvents (msg, that) {
        if (msg && msg.data && msg.data.mlforkidstensorflow && msg.data.data.projectid === '{{{projectid}}}')
        {
            if (that && msg.data.mlforkidstensorflow === 'modelready')
            {
                console.log('model ready for use');
                this._modelState = 'Ready';
            }
            else if (that && msg.data.mlforkidstensorflow === 'modelfailed')
            {
                console.log('model FAILED');
                this._modelState = 'Model Failed';
            }
            else if (that && msg.data.mlforkidstensorflow === 'classifyresponse')
            {
                var callbackFn = that.classifyRequests[msg.data.data.requestid];
                callbackFn(msg.data.data.matches);
                delete that.classifyRequests[msg.data.data.requestid];
            }
        }
    }




    classifyData (requestdata, callback) {
        var requestId = this.nextClassifyRequest;
        this.nextClassifyRequest += 1;

        this.classifyRequests[requestId] = function (matches) {
            var response = matches && matches.length > 0 ? matches[0] : {
                class_name: 'Unknown',
                confidence: 0,
                classifierTimestamp: new Date().toISOString(),
                random: true
            };
            return callback(response);
        };

        var encodedRequestData = JSON.stringify({
            projectid : '{{{projectid}}}',
            requestid : requestId,
            requestdata : requestdata
        });
        postMessage({
            mlforkidstensorflow : {
                command : 'classify',
                data : encodedRequestData
            }
        });
    }


    getClassificationResponse (requestdata, valueToReturn, callback) {
        this.classifyData(requestdata, function (result) {
            if (result.random) {
                // We got a randomly selected result (which means we must not
                //  have a working classifier).
                console.log('randomly selected result returned by API');
            }
            callback(result[valueToReturn]);
        });
    }
}


Scratch.extensions.register(new MachineLearningTfjs());
