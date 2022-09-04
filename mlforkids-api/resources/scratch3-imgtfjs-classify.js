class MachineLearningImagesTfjs {

    constructor() {
        this._labels = {
            items : [ {{#labels}} '{{name}}', {{/labels}} ],
            acceptReporters: true
        };

        this._statuses = [
            { value : 'Ready', text : 'ready to use' },
            { value : 'Training', text : 'still training' },
            { value : 'Model Failed', text : 'ERROR - broken' }
        ];

        this._icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gwIFCspuPG7bgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAElUlEQVRIx62WW2xUVRSGv73PmTOdmZbS9AYtlEsGW8qlKlqjhhjEK6gxGhJBn3zQBB9QMcREjEaCjRofeBKNkHgJRX3AiNGIpAmKgSYNkIgIba20FAq9wXTazsw5c/byoS1Q2mnHwHrZOefstf6z/rXWv7cigy17fX9ubNjd46VNuZCdKaWwtBqqnpO/5sDbDw1OtsfO5Oz7xooNe8t2v3Lf/GhpLkYgYClCQRsRQaEQhOGUj28MCsWJ9su88UXToDFiZYprZ/5d8I2RqrIZVM/JB+DTX1vY3dDKQMLDGGFmxOG952p4tKYMgMFUGhHMVCzYWbLFhh2HcWxNY93jbN17grKZYTY+dhu1b/7M0eZe3lm3PKs40wJqrfjkl2YsrejoGeKZjw4RcmyOtfXT1NaHbwxfHmrj7mghhXnBmwdUQMPJi9Q9fwcdPUMcae7h4/2n2LR2MauWzqLrchm2VtT/cZZX1yyeFlBPt0GApRUzqdt3ki1fH6OyPJ+XH6mkbzDFSzuPUBstpK17kNqFhRiRW5PhpViS2mgRyysK+KGpk0tXEjxQXcrcwggtF+P8cylOUV4QlUUNs8qwIOwQG3LZtLaKo809hByLYMCiqjyfXQdb2dfYgW+ya75pAY0Rtm+4nd/PdLOroZXK8hnkhQLsPHCG8/3D3F9VzD2Liti+vgY3bW6e0jFbsaCQU+di1FQUYFuKlVUl9MZTXIwlyI84aKWQWzEWY7b12WX8eKyTbd/9CQiptCEvFODddcu5t7I42zCZAdNGo1D0D7n0xVMYEVZWlfDTWw/ijVIXsBWW0qQ8n17PEBtyQYGRzMnamWunyA0F5IUdh9FajevasVXGuuqqFAqOZWGmIFfFG9f9jVJVN/aPQgjZPkpN4iwu7+s6QtpDTTIMnmcm7XZfpNEGM5yz8DV0uCLjWIx7Tg+QPL0NY8ET8xZQEAxmcWxBXzJJfXPLsA2CzilFO8WIpEEplBW+jjxB/ASIjHyzZ4ysQEEwSHEoB4BEOo1SIz6O1mg1PnMjI4UdqaFycDv34PX+Bgih6m3oUMVoRoMkTm5G/BRWbpRgdPPEegvsPn2aVNonEgjw5Px5lEUiUwy+uDjzXkQ5BVi5UbyehmsHcew4yikBhJxFW8C4E4Mo2LhkCUaE9YuiGcFuUBoB4xIoWkW6++DVt+65egLFq8F4iPEyBvJGhTs9jYBPGAvlFKGcQtLdB1HhCsRPoMPzuVU2UUu1Q6BkNW7X97jnvyFQ8jDKDv/vwJ4xHO7qyka8DYFZT2ES7fj9jThz14Pxx099FmZEaI0NZKJUY5IXEONiEufQkSiB0jWIPwRo/EQ7gmCG29GhuZMC9CeTiMCVVAoFpHx/ihrqAF7nXiQdJ9XxFTqvmsDspxEvhnhXSJ39HKU07r87CS35cNJsPvvrFDmWxbctrVfFoiIvNwOgcQlGNzNBM3JmAxC5c9e1XvYGxinIyFgott61YgLl18ueugaoMMkLoLM8qdJxGFWNvmQyq3uMAnqTSTQoG2U3JZo/iCNZXhKUQlthjDHUN7cgIlm6KRWy7eP/AR5T4+fuc4K4AAAAAElFTkSuQmCC';

        this.training = false;
        this.modelReady = false;
        this.modelError = false;



        var encodedProjectData = JSON.stringify({
            labels : this._labels.items,
            projectid : '{{{projectid}}}'
        });
        postMessage({
            mlforkidsimage : {
                command : 'init',
                data : encodedProjectData
            }
        });
        var that = this;
        addEventListener('message', function (evt) {
            that.receiveListenEvents(evt, that);
        });


        // the number of times that the 'recognise image' block has been used
        // incorrectly (this will be reset when the Help page is displayed)
        this.numIncorrectUses = 0;

        // the number of times that the 'recognise image' block should be used
        // incorrectly before the Help page is shown
        this.MAX_INCORRECT_USES = 2;



        this.nextClassifyRequest = 1;
        this.classifyRequests = {};
    }


    getInfo() {

        return {
            // making the id unique to allow multiple instances
            id: 'mlforkidsimages{{{ projectid }}}',
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
                        default: 'recognise image [IMAGE] (label)',
                        id: 'mlforkids.images.recogniseLabel'
                    },
                    arguments: {
                        IMAGE: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'image'
                        }
                    }
                },

                // classify the image and return the confidence score
                {
                    opcode: 'confidence',
                    blockType: Scratch.BlockType.REPORTER,
                    text: {
                        default: 'recognise image [IMAGE] (confidence)',
                        id: 'mlforkids.images.recogniseConfidence'
                    },
                    arguments: {
                        IMAGE: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'image'
                        }
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

                // add training data to the project
                {
                    opcode: 'addTraining',
                    blockType: Scratch.BlockType.COMMAND,
                    text: {
                        default: 'add training data [TEXT] [LABEL]',
                        id: 'mlforkids.images.addTraining'
                    },
                    arguments: {
                        TEXT: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: 'image'
                        },
                        LABEL: {
                            type: Scratch.ArgumentType.STRING,
                            defaultValue: this._labels.items[0],
                            menu: 'labels'
                        }
                    }
                },

                {
                    opcode: 'trainNewModel',
                    blockType: Scratch.BlockType.COMMAND,
                    text: {
                        default: 'train new machine learning model',
                        id: 'mlforkids.text.trainNewModel'
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
                statuses: this._statuses
            }
        };
    }


    label({ IMAGE }) {
        return new Promise(resolve => this.getImageClassificationResponse(IMAGE, 'class_name', resolve));
    }
    confidence({ IMAGE }) {
        return new Promise(resolve => this.getImageClassificationResponse(IMAGE, 'confidence', resolve));
    }


    {{#labels}}
    return_label_{{idx}} () {
        return '{{name}}';
    }
    {{/labels}}


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

    addTraining({ TEXT, LABEL }) {
        if (TEXT === '' || TEXT === 'image') {
            // The student has left the default text in the image block
            //  so there is no point in submitting an xhr request
            return;
        }

        var url = new URL('{{{ storeurl }}}');

        var options = {
            headers : {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-User-Agent': 'mlforkids-scratch3-images'
            },
            method : 'POST',
            body : JSON.stringify({
                data : TEXT,
                label : LABEL
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
    }



    receiveListenEvents (msg, that) {
        if (msg && msg.data && msg.data.mlforkidsimage && msg.data.data.projectid === '{{{projectid}}}')
        {
            if (that && msg.data.mlforkidsimage === 'modelready')
            {
                console.log('model ready for use');
                that.modelReady = true;
                that.training = false;
            }
            else if (that && msg.data.mlforkidsimage === 'modelfailed')
            {
                console.log('model FAILED');
                that.modelError = true;
                that.training = false;
            }
            else if (that && msg.data.mlforkidsimage === 'modelinit')
            {
                console.log('ready to train a new model');

                // to avoid the user needing to do this, we'll
                //  try to train a model automatically
                that.trainNewModel();
            }
            else if (that && msg.data.mlforkidsimage === 'classifyresponse')
            {
                var callbackFn = that.classifyRequests[msg.data.data.requestid];
                callbackFn(msg.data.data.matches);
                delete that.classifyRequests[msg.data.data.requestid];
            }
        }
    }




    classifyImage (imagedata, callback) {
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
            imagedata : imagedata
        });
        postMessage({
            mlforkidsimage : {
                command : 'classify',
                data : encodedRequestData
            }
        });
    }


    getImageClassificationResponse (imagedata, valueToReturn, callback) {
        if (imagedata === '' || imagedata === 'image') {
            // The student has left the default text in the image block
            //  so there is no point in submitting an xhr request
            this.registerIncorrectUse();
            return callback('You need to put an image block in here');
        }


        // submit to the model
        this.classifyImage(imagedata, function (result) {
            if (result.random) {
                // We got a randomly selected result (which means we must not
                //  have a working classifier).
                console.log('randomly selected result returned by API');

                postMessage({ mlforkids : 'mlforkids-recogniseimage-nomodel' });
            }

            // return the requested value from the response
            callback(result[valueToReturn]);
        });
    }


    registerIncorrectUse () {
        console.log('recognise image block used incorrectly');
        this.numIncorrectUses += 1;

        if (this.numIncorrectUses >= this.MAX_INCORRECT_USES) {
            postMessage({ mlforkids : 'mlforkids-recogniseimage-help' });
            this.numIncorrectUses = 0;
        }
    }



    trainNewModel () {
        if (this.training) {
            console.log('already training');
            return;
        }

        this.modelReady = false;
        this.training = true;

        var that = this;
        return this._getTrainingData()
            .then((trainingdata) => {
                if (trainingdata && trainingdata.length >= 5) {
                    postMessage({
                        mlforkidsimage : {
                            command : 'train',
                            data : {
                                projectid : '{{{projectid}}}',
                                trainingdata
                            }
                        }
                    });
                }
                else {
                    console.log('not training - need training data', trainingdata);
                    that.training = false;
                }
            })
            .catch((err) => {
                console.log('failed to train model', err);
                that.modelError = true;
                that.training = false;
            });
    }


    _getTrainingImageData (metadata) {
        var that = this;
        return fetch(metadata.imageurl)
            .then((response) => {
                if (response.status !== 200) {
                    console.log('failed to download training image', response.status);
                    that.modelError = true;
                }
                else {
                    return response.arrayBuffer();
                }
            })
            .then((imgdata) => {
                return { imgdata, metadata };
            })
            .catch((err) => {
                console.log('failed to download training image', err);
                that.modelError = true;
            });
    }


    _getTrainingData() {
        var urlstr = '{{{ storeurl }}}?proxy=true';
        var url = new URL(urlstr);
        var options = {

            headers : {
                'Accept': 'application/json',
                'X-User-Agent': 'mlforkids-scratch3-images'
            }
        };

        var that = this;
        return fetch(url, options)
            .then((response) => {
                if (response.status !== 200) {
                    that.modelError = true;
                    return [];
                }
                else {
                    return response.json();
                }
            })
            .then((traininginfo) => {
                return Promise.all(traininginfo.map(trainingitem => {
                    return that._getTrainingImageData(trainingitem);
                }));
            });
    }



}


Scratch.extensions.register(new MachineLearningImagesTfjs());
