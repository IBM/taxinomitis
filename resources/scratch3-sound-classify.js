class MachineLearningSound {

    constructor() {
        this._labels = [ {{#labels}} '{{name}}', {{/labels}} ];

        this._statuses = [
            { value : 'Ready', text : 'ready to use' },
            { value : 'Training', text : 'still training' },
            { value : 'Model Failed', text : 'ERROR - broken' }
        ];

        this._icon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAYAAAByDd+UAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH4gwIFCspuPG7bgAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUHAAAElUlEQVRIx62WW2xUVRSGv73PmTOdmZbS9AYtlEsGW8qlKlqjhhjEK6gxGhJBn3zQBB9QMcREjEaCjRofeBKNkHgJRX3AiNGIpAmKgSYNkIgIba20FAq9wXTazsw5c/byoS1Q2mnHwHrZOefstf6z/rXWv7cigy17fX9ubNjd46VNuZCdKaWwtBqqnpO/5sDbDw1OtsfO5Oz7xooNe8t2v3Lf/GhpLkYgYClCQRsRQaEQhOGUj28MCsWJ9su88UXToDFiZYprZ/5d8I2RqrIZVM/JB+DTX1vY3dDKQMLDGGFmxOG952p4tKYMgMFUGhHMVCzYWbLFhh2HcWxNY93jbN17grKZYTY+dhu1b/7M0eZe3lm3PKs40wJqrfjkl2YsrejoGeKZjw4RcmyOtfXT1NaHbwxfHmrj7mghhXnBmwdUQMPJi9Q9fwcdPUMcae7h4/2n2LR2MauWzqLrchm2VtT/cZZX1yyeFlBPt0GApRUzqdt3ki1fH6OyPJ+XH6mkbzDFSzuPUBstpK17kNqFhRiRW5PhpViS2mgRyysK+KGpk0tXEjxQXcrcwggtF+P8cylOUV4QlUUNs8qwIOwQG3LZtLaKo809hByLYMCiqjyfXQdb2dfYgW+ya75pAY0Rtm+4nd/PdLOroZXK8hnkhQLsPHCG8/3D3F9VzD2Liti+vgY3bW6e0jFbsaCQU+di1FQUYFuKlVUl9MZTXIwlyI84aKWQWzEWY7b12WX8eKyTbd/9CQiptCEvFODddcu5t7I42zCZAdNGo1D0D7n0xVMYEVZWlfDTWw/ijVIXsBWW0qQ8n17PEBtyQYGRzMnamWunyA0F5IUdh9FajevasVXGuuqqFAqOZWGmIFfFG9f9jVJVN/aPQgjZPkpN4iwu7+s6QtpDTTIMnmcm7XZfpNEGM5yz8DV0uCLjWIx7Tg+QPL0NY8ET8xZQEAxmcWxBXzJJfXPLsA2CzilFO8WIpEEplBW+jjxB/ASIjHyzZ4ysQEEwSHEoB4BEOo1SIz6O1mg1PnMjI4UdqaFycDv34PX+Bgih6m3oUMVoRoMkTm5G/BRWbpRgdPPEegvsPn2aVNonEgjw5Px5lEUiUwy+uDjzXkQ5BVi5UbyehmsHcew4yikBhJxFW8C4E4Mo2LhkCUaE9YuiGcFuUBoB4xIoWkW6++DVt+65egLFq8F4iPEyBvJGhTs9jYBPGAvlFKGcQtLdB1HhCsRPoMPzuVU2UUu1Q6BkNW7X97jnvyFQ8jDKDv/vwJ4xHO7qyka8DYFZT2ES7fj9jThz14Pxx099FmZEaI0NZKJUY5IXEONiEufQkSiB0jWIPwRo/EQ7gmCG29GhuZMC9CeTiMCVVAoFpHx/ihrqAF7nXiQdJ9XxFTqvmsDspxEvhnhXSJ39HKU07r87CS35cNJsPvvrFDmWxbctrVfFoiIvNwOgcQlGNzNBM3JmAxC5c9e1XvYGxinIyFgott61YgLl18ueugaoMMkLoLM8qdJxGFWNvmQyq3uMAnqTSTQoG2U3JZo/iCNZXhKUQlthjDHUN7cgIlm6KRWy7eP/AR5T4+fuc4K4AAAAAElFTkSuQmCC';

        this.training = false;
        this.modelReady = false;
        this.modelError = false;
        this.listening = false;

        mlForKidsListenEvents = {};

        var encodedProjectData = JSON.stringify({
            // labels needed to unpack saved models
            labels : this._labels,
            projectid : '{{{projectid}}}'
        });
        postMessage({
            mlforkidssound : {
                command : 'init',
                data : encodedProjectData
            }
        });
        var that = this;
        addEventListener('message', function (evt) {
            that.receiveListenEvents(evt, that);
        });
    }



    getInfo() {
        return {
            // making the id unique to allow multiple instances
            id: 'mlforkidssound{{{ projectid }}}',
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
                {{#labels}}
                {
                    opcode: 'recognise_label_{{idx}}',
                    blockType: Scratch.BlockType.HAT,
                    text: 'when I hear {{name}}'
                },
                {{/labels}}

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
                },
                {
                    opcode: 'startListening',
                    blockType: Scratch.BlockType.COMMAND,
                    text: {
                        default: 'start listening',
                        id: 'mlforkids.sounds.startListening'
                    }
                },
                {
                    opcode: 'stopListening',
                    blockType: Scratch.BlockType.COMMAND,
                    text: {
                        default: 'stop listening',
                        id: 'mlforkids.sounds.stopListening'
                    }
                }
            ],

            menus: {
                labels: this._labels,
                statuses: this._statuses
            }
        };
    }


    trainNewModel () {
        if (this.listening) {
            this.stopListening();
        }

        this.modelReady = false;
        this.training = true;

        var urlstr = '{{{ storeurl }}}';
        urlstr = urlstr.replace('ml-for-kids-local.net', 'localhost');
        var url = new URL(urlstr);
        var options = {
            headers : {
                'Accept': 'application/json',
                'X-User-Agent': 'mlforkids-scratch3-sounds'
            }
        };

        var that = this;
        return fetch(url, options)
            .then((response) => {
                if (response.status !== 200) {
                    that.modelError = true;
                }
                else {
                    return response.json();
                }
            })
            .then((trainingdata) => {
                if (trainingdata) {
                    // start listening for the 'modelready' or 'modelfailed'
                    //  events that will follow the train request we're
                    //  about to send
                    addEventListener('message', function (evt) {
                        that.receiveListenEvents(evt, that);
                    });

                    postMessage({
                        mlforkidssound : {
                            command : 'train',
                            data : trainingdata
                        }
                    });
                }
            });
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


    receiveListenEvents (msg, that) {
        if (msg && msg.data && msg.data.mlforkidssound) {

            if (msg.data.data &&
                msg.data.mlforkidssound === 'recognized')
            {
                var matches = msg.data.data;
                if (matches && matches.length > 0) {
                    var match = matches[0];
                    console.log(match);
                    mlForKidsListenEvents[match.class_name] = true;
                }
            }
            else if (that && msg.data.mlforkidssound === 'modelready')
            {
                that.modelReady = true;
                that.training = false;
            }
            else if (that && msg.data.mlforkidssound === 'modelfailed')
            {
                that.modelError = true;
                that.training = false;
            }
            else if (that && msg.data.mlforkidssound === 'modelinit')
            {
                console.log('sound blocks ready to use');
            }

            // if we're not listening for sounds, then we're assuming that
            //  the event we just heard was modelready or modelfailed
            //  so we don't need to listen for any more events
            //
            // if we are listening for sounds, we need to leave the event
            //  listener for future 'recognized' events
            if (that && !that.listening) {
                removeEventListener('message', that.receiveListenEvents);
            }
        }
    }


    startListening () {
        if (this.modelReady && !this.listening) {
            // start listening for 'recognized' events that
            //  will follow once we start recognizing sounds
            addEventListener('message', this.receiveListenEvents);

            mlForKidsListenEvents = {};

            postMessage({
                mlforkidssound : {
                    command : 'listen'
                }
            });

            this.listening = true;
        }
        else if (!this.modelReady) {
            postMessage({ mlforkids : 'mlforkids-recognisesound-nomodel' });
        }
    }

    stopListening () {
        if (this.modelReady && this.listening) {
            this.listening = false;

            removeEventListener('message', this.receiveListenEvents);

            mlForKidsListenEvents = {};

            postMessage({
                mlforkidssound : {
                    command : 'stoplisten'
                }
            });
        }
    }


    {{#labels}}
    recognise_label_{{idx}} () {
        var recognized = this.modelReady &&
                         this.listening &&
                         '{{name}}' in mlForKidsListenEvents &&
                         mlForKidsListenEvents['{{name}}'];
        mlForKidsListenEvents['{{name}}'] = false;
        return recognized;
    }
    {{/labels}}
}

var mlForKidsListenEvents = {};


Scratch.extensions.register(new MachineLearningSound());
