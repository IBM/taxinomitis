angular.module('app')
    .directive('mlcanvas', function () {
        return {
            template: '<div class="mlcanvas">' +
                        '<canvas width="500" height="300" ' +
                        '   ng-mousedown="handleMouseDown($event)"' +
                        '   ng-mousemove="handleMouseMove($event)"' +
                        '    ></canvas>' +
                        '<div class="canvastools">' +
                        '    <div class="toolslabel">Tools</div>' +
                        '    <div class="btn-group" data-toggle="buttons">' +
                        '        <label class="btn btn-default" ng-class="{ \'active\' : canvastool === \'tooldraw\' }">' +
                        '            <input type="radio" value="tooldraw" name="drawtooloptions" ng-model="canvastool"> Draw' +
                        '        </label>' +
                        '        <label class="btn btn-default" ng-class="{ \'active\' : canvastool === \'toolerase\' }">' +
                        '            <input type="radio" value="toolerase" name="drawtooloptions" ng-model="canvastool"> Erase' +
                        '        </label>' +
                        '    </div>' +
                        '    <div class="btn btn-default" ng-click="reset()">Reset</div> ' +
                        '</div>' +
                      '</div>',

            restrict: 'E',

            link: function ($scope, element, attrs, controller, transcludeFn) {

                $scope.canvastool = 'tooldraw';

                var mousex = 0;
                var mousey = 0;

                var last_mousex = 0;
                var last_mousey = 0;

                $scope.canvas = element.find('canvas')[0];
                var ctx = $scope.canvas.getContext('2d');

                function isMouseButtonDown(mouseevt) {
                    if (mouseevt.buttons !== undefined) {
                        return mouseevt.buttons === 1;
                    }
                    // for Safari support, which doesn't support
                    //  'which' for mouseevnets
                    return mouseevt.which === 1;
                }

                $scope.handleMouseDown = function(e) {
                    last_mousex = mousex = e.offsetX;
                    last_mousey = mousey = e.offsetY;
                };
                $scope.handleMouseMove = function handleMouseMove(e) {
                    mousex = e.offsetX;
                    mousey = e.offsetY;

                    if (isMouseButtonDown(e)) {
                        ctx.beginPath();
                        ctx.globalCompositeOperation = 'source-over';
                        if ($scope.canvastool == 'tooldraw') {
                            ctx.strokeStyle = 'black';
                            ctx.lineWidth = 5;
                        }
                        else {
                            ctx.strokeStyle = 'white';
                            ctx.lineWidth = 20;
                        }
                        ctx.moveTo(last_mousex, last_mousey);
                        ctx.lineTo(mousex, mousey);

                        ctx.lineJoin = ctx.lineCap = 'round';
                        ctx.stroke();
                    }
                    last_mousex = mousex;
                    last_mousey = mousey;
                };

                $scope.reset = function reset() {
                    ctx.fillStyle = "rgb(255,255,255)";
                    ctx.fillRect(0,0,500,300);
                };

                $scope.reset();
            }
        };
    });




