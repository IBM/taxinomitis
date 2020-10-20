(function () {
    // angular-ized service implementation of https://github.com/alexlenail/NN-SVG
    //  with some additional functions to add extra annotations and text to the NN visualisation


    // MIT License
    //      from https://github.com/alexlenail/NN-SVG/blob/master/LICENSE
    //
    // Copyright (c) 2018 Alexander Lenail
    //
    // Permission is hereby granted, free of charge, to any person obtaining a copy
    // of this software and associated documentation files (the "Software"), to deal
    // in the Software without restriction, including without limitation the rights
    // to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    // copies of the Software, and to permit persons to whom the Software is
    // furnished to do so, subject to the following conditions:
    //
    // The above copyright notice and this permission notice shall be included in all
    // copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    // FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    // OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    // SOFTWARE.

    angular
        .module('app')
        .service('fcnnVisualisationService', fcnnVisualisationService);

    fcnnVisualisationService.$inject = [
    ];

    function fcnnVisualisationService() {

        var ID_PREFIX = 'ml4kids_nn_';

        var NS_SVG  = 'http://www.w3.org/2000/svg';
        var NS_HTML = 'http://www.w3.org/1999/xhtml';


        //-------------------------------------------------------------------------
        // utility functions
        //  adapted from https://github.com/alexlenail/NN-SVG/blob/master/util.js
        //-------------------------------------------------------------------------

        function nWise(n, array) {
            var iterators = Array(n).fill().map(function () {
                return array[Symbol.iterator]();
            });
            iterators.forEach(function (it, index) {
                Array(index).fill().forEach(function () {
                    return it.next();
                });
            });
            return Array(array.length - n + 1).fill().map(function () {
                return iterators.map(function (it) {
                    return it.next().value;
                });
            });
        }

        function pairWise(array) {
            return nWise(2, array);
        }

        function range(n) {
            return Array(n).fill(0).map(function (v, idx) {
                return idx;
            });
        }

        function flatten(array) {
            return array.reduce(function (flat, toFlatten) {
                return flat.concat(Array.isArray(toFlatten) ? flatten(toFlatten) : toFlatten);
            }, []);
        }


        //-------------------------------------------------------------------------
        // fcnn generator
        //  adapted from https://github.com/alexlenail/NN-SVG/blob/master/FCNN.js
        //-------------------------------------------------------------------------

        var w, h, svg, g, graph, layer_offsets, link, node;

        var architecture = [];
        var betweenNodesInLayer = [];

        var largest_layer_width = 0;

        var edgeWidth = 0.5;
        var edgeOpacity = 1.0;

        var defaultEdgeColor = '#505050';

        var nodeDiameter = 50;
        var nodeColor = '#ffffff';
        var nodeBorderColor = '#333333';

        var betweenLayers = 160;

        function init(containerId) {
            w = window.innerWidth;
            h = window.innerHeight;

            svg = d3.select('#' + containerId)
                .append('svg')
                .attr('xmlns', NS_SVG);
            g = svg.append('g');

            graph = {};
            layer_offsets = [];

            link = g.selectAll('.link');
            node = g.selectAll('.node');

            resize();
        }

        function prepareNN(arch, spacing) {
            architecture = arch;
            betweenNodesInLayer = spacing;
        }

        function returnId(item) {
            return item.id;
        }

        function redraw() {
            graph.nodes = architecture.map(function (layer_width, layer_index) {
                return range(layer_width).map(function (node_index) {
                    return {
                        id: ID_PREFIX + getNodeId(layer_index) + getNodeId(node_index),
                        layer: layer_index,
                        node_index: node_index
                    };
                });
            });
            graph.links = pairWise(graph.nodes).map(function (nodes) {
                return nodes[0].map(function (left) {
                    return nodes[1].map(function (right) {
                        if (right.node_index < 0) {
                            return null;
                        }
                        return {
                            id: ID_PREFIX + left.id + '-' + right.id,
                            source: left.id,
                            target: right.id
                        };
                    });
                });
            });
            graph.nodes = flatten(graph.nodes);
            graph.links = flatten(graph.links);

            link = link.data(graph.links, returnId);
            link.exit().remove();
            link = link.enter()
                       .insert('path', '.node')
                       .attr('class', 'link')
                       // additional ML4K attribute
                       .attr('id', returnId)
                       .merge(link);

            node = node.data(graph.nodes, returnId);
            node.exit().remove();
            node = node.enter()
                       .append('circle')
                       .attr('r', nodeDiameter/2)
                       .attr('class', function(d) { return 'node nnlayer' + d.layer; })
                       .attr('id', returnId)
                       .on("mousedown", set_focus)
                       .on("mouseup", remove_focus)
                       .merge(node);

            style();
        }

        function redistribute() {
            var layer_widths = architecture.map(function (layer_width, i) {
                return layer_width * nodeDiameter + (layer_width - 1) * betweenNodesInLayer[i];
            });

            largest_layer_width = Math.max.apply(null, layer_widths);

            layer_offsets = layer_widths.map(function (layer_width) {
                return (largest_layer_width - layer_width) / 2;
            });

            var indices_from_id = function (id) {
                return id.substr(ID_PREFIX.length).split('_').map(function (x) {
                    return parseInt(x);
                });
            };

            var x = function (layer) {
                return layer * (betweenLayers + nodeDiameter) + w/2 - (betweenLayers * layer_offsets.length/3);
            };
            var y = function (layer, node_index) {
                return layer_offsets[layer] + node_index * (nodeDiameter + betweenNodesInLayer[layer]) + h/2 - largest_layer_width/2;
            };

            node.attr('cx', function(d) { return x(d.layer); })
                .attr('cy', function(d) { return y(d.layer, d.node_index); });

            link.attr('d', function (d) {
                var sourceIndices = indices_from_id(d.source);
                var targetIndices = indices_from_id(d.target);

                return 'M' +
                       x(sourceIndices[0]) + ',' + y(sourceIndices[0], sourceIndices[1]) + ', ' +
                       x(targetIndices[0]) + ',' + y(targetIndices[0], targetIndices[1]);
            });
        }

        function style() {
            link.style('stroke-width', edgeWidth);
            link.style('stroke-opacity', edgeOpacity);
            link.style('stroke', defaultEdgeColor);

            node.attr('r', nodeDiameter/2);
            node.style('fill', nodeColor);
            node.style('stroke', nodeBorderColor);

            // ml4k-specific
            removeAnnotations();
        }

        function resize() {
            w = window.innerWidth;
            h = window.innerHeight;
            svg.attr('viewBox', '0 0 ' + w + ' ' + h);
        }

        function set_focus(d) {
            d3.event.stopPropagation();
            node.style('opacity', function(o) { return (d == o || o.layer == d.layer - 1) ? 1 : 0.1; });
            link.style('opacity', function(o) { return (o.target == d.id) ? 1 : 0.02; });

            // ml4k-specific
            setAnnotationsFocus(d);
        }

        function remove_focus() {
            d3.event.stopPropagation();
            node.style('opacity', 1);
            link.style('opacity', function () { return edgeOpacity; });

            // ml4k-specific
            removeAnnotationsFocus();
        }


        //-----------------------------------------------------------------
        // additional MLforKids-specific functions
        //-----------------------------------------------------------------

        var ELEMENT_IDS = {
            INPUT_TEXT_CONTAINER : 'input_text_container',
            INPUT_TEXT           : 'input_text',
            BIAS                 : 'bias',
            WEIGHT               : 'weight',
            NODE_VALUE           : 'value',
            PATH_TEXT            : 'text',
            SEPARATOR            : 'separator',
            ANNOTATION           : 'annotation'
        };
        var LAYER_IDS = {
            INPUT_TEXT  : 0,
            INPUT_LAYER : 1
        };

        function getNodeId(layerIdx, nodeIdx) {
            return layerIdx + '_' + nodeIdx;
        }

        function getNNNode(layerIdx, nodeIdx) {
            return document.getElementById(ID_PREFIX + getNodeId(layerIdx, nodeIdx));
        }

        function addInputExample() {
            var inputDataNode = getNNNode(LAYER_IDS.INPUT_TEXT, 0);
            var inputLayerX = parseFloat(inputDataNode.getAttribute('cx'));
            var inputLayerY = parseFloat(inputDataNode.getAttribute('cy'));

            var inputDataWidth = 90;
            var inputDataHeight = 70;

            var exampleTextX = inputLayerX - (inputDataWidth / 2);
            var exampleTextY = inputLayerY;

            var exampleTextContainer = createSvgElement(NS_SVG, 'foreignObject', {
                'id': ID_PREFIX + ELEMENT_IDS.INPUT_TEXT_CONTAINER,
                'x': exampleTextX,
                'y': exampleTextY,
                'width': inputDataWidth,
                'height': inputDataHeight,
                'dominant-anchor': 'middle',
                'text-anchor': 'middle',
                'fill': nodeColor,
                'style': 'overflow:visible'
            }, inputDataNode.parentNode);

            var exampleText = createSvgElement(NS_HTML, 'div', {
                'id': ID_PREFIX + ELEMENT_IDS.INPUT_TEXT,
                'class': 'inputdata'
            }, exampleTextContainer);

            exampleText.textContent = 'input text';
            exampleTextContainer.setAttributeNS(null, 'y', exampleTextY - (exampleText.clientHeight / 2));
        }

        function addLabels() {
            var largestLayer = {
                idx : 0,
                size : 0
            };

            addInputExample();

            for (var layerIdx = LAYER_IDS.INPUT_LAYER; layerIdx < architecture.length; layerIdx++) {
                if (architecture[layerIdx] > largestLayer.size) {
                    largestLayer = {
                        idx : layerIdx,
                        size : architecture[layerIdx]
                    };
                }

                if (layerIdx === LAYER_IDS.INPUT_LAYER) {
                    for (var i = 0; i < architecture[layerIdx]; i++) {
                        addInputOutputLabel(layerIdx, i, getNodeId(layerIdx, i), true);
                    }
                }
                else if (layerIdx === (architecture.length - 1)) {
                    for (var j = 0; j < architecture[layerIdx]; j++) {
                        addInputOutputLabel(layerIdx, j, getNodeId(layerIdx, j), false);
                    }
                }
                else {
                    for (var k = 0; k < architecture[layerIdx]; k++) {
                        addLabel(layerIdx, k, getNodeId(layerIdx, k));
                    }
                }
            }
            setViewBox(largestLayer);
        }

        function addWeights() {
            var parentNode = getNNNode(LAYER_IDS.INPUT_TEXT, 0).parentNode;

            for (var layerIdx = LAYER_IDS.INPUT_LAYER; layerIdx < (architecture.length - 2); layerIdx++) {
                var nextLayerIdx = layerIdx + 1;
                var nextLayerNumNodes = architecture[nextLayerIdx];

                var numNodes = architecture[layerIdx];
                for (var idx = 0; idx < numNodes; idx++) {
                    var nodeId = ID_PREFIX + getNodeId(layerIdx, idx);

                    for (var nextIdx = 0; nextIdx < nextLayerNumNodes; nextIdx++) {
                        var pathId = ID_PREFIX +
                                     nodeId + '-' +
                                     ID_PREFIX + getNodeId(nextLayerIdx, nextIdx);

                        var pathText = createSvgElement(NS_SVG, 'text', {
                            'text-anchor' : 'middle'
                        }, parentNode);

                        createSvgElement(NS_SVG, 'textPath', {
                            'id' : pathId + ELEMENT_IDS.PATH_TEXT,
                            'href' : '#' + pathId,
                            'startOffset' : '70%',
                            'class' : 'nodeweight'
                        }, pathText);
                    }
                }
            }
        }

        function addInputOutputLabel(layerIdx, nodeIdx, nodeid, isInput) {
            var mynode = getNNNode(layerIdx, nodeIdx);
            var mynodex = parseFloat(mynode.getAttribute('cx'));
            var mynodey = parseFloat(mynode.getAttribute('cy'));

            createSvgElement(NS_SVG, 'text', {
                'id': ID_PREFIX + ELEMENT_IDS.NODE_VALUE + nodeid,
                'x': mynodex,
                'y': mynodey + 5,
                'dominant-anchor': 'middle',
                'text-anchor': 'middle',
                'class': 'nodevalue'
            }, mynode.parentNode);

            if (isInput) {
                var annotationContainer = createSvgElement(NS_SVG, 'foreignObject', {
                    'x' : mynodex + 20,
                    'y' : mynodey - 25,
                    'width' : 150,
                    'height': 70,
                    'dominant-anchor' : 'text-top',
                    'text-anchor' : 'start'
                }, mynode.parentNode);

                createSvgElement(NS_HTML, 'div', {
                    'id' : ID_PREFIX + ELEMENT_IDS.ANNOTATION + nodeid,
                    'class' : 'inputannotation hiddendiagramelement'
                }, annotationContainer);
            }
        }

        function createSvgElement(ns, type, attrs, parent) {
            var elem = document.createElementNS(ns, type);
            for (var attrname in attrs) {
                elem.setAttributeNS(null, attrname, attrs[attrname]);
            }
            parent.appendChild(elem);
            return elem;
        }

        function addLabel(layerIdx, nodeIdx, nodeid) {
            var mynode = getNNNode(layerIdx, nodeIdx);
            var mynodex = parseFloat(mynode.getAttribute('cx'));
            var mynodey = parseFloat(mynode.getAttribute('cy'));

            createSvgElement(NS_SVG, 'text', {
                'id': ID_PREFIX + ELEMENT_IDS.BIAS + nodeid,
                'x': mynodex,
                'y': mynodey - 8,
                'dominant-anchor': 'middle',
                'text-anchor': 'middle',
                'class': 'nodedata'
            }, mynode.parentNode);

            createSvgElement(NS_SVG, 'line', {
                'id': ID_PREFIX + ELEMENT_IDS.SEPARATOR + nodeid,
                'x1': mynodex - 20,
                'x2': mynodex + 20,
                'y1': mynodey - 4,
                'y2': mynodey - 4,
                'class': 'nodeseparator'
            }, mynode.parentNode);

            createSvgElement(NS_SVG, 'text', {
                'id': ID_PREFIX + ELEMENT_IDS.NODE_VALUE + nodeid,
                'x': mynodex,
                'y': mynodey + 14,
                'dominant-anchor': 'middle',
                'text-anchor': 'middle',
                'class': 'nodevalue'
            }, mynode.parentNode);

            var annotationContainer = createSvgElement(NS_SVG, 'foreignObject', {
                'x' : mynodex + 25,
                'y' : mynodey - 30,
                'width'  : 150,
                'height' : 70,
                'dominant-anchor' : 'text-top',
                'text-anchor' : 'start',
                'style' : 'overflow: visible'
            }, mynode.parentNode);
            createSvgElement(NS_HTML, 'div', {
                'id' : ID_PREFIX + ELEMENT_IDS.ANNOTATION + nodeid,
                'class' : 'hiddenlayerfunction hiddendiagramelement'
            }, annotationContainer);
        }

        function updateLabels(nodevalues) {
            for (var nodename  in nodevalues) {
                var values = nodevalues[nodename];

                if ('bias' in values) {
                    document.getElementById(ID_PREFIX + ELEMENT_IDS.BIAS + ID_PREFIX + nodename).textContent = 'b=' + values.bias;
                }
                if ('value' in values) {
                    document.getElementById(ID_PREFIX + ELEMENT_IDS.NODE_VALUE + ID_PREFIX + nodename).textContent = values.value;
                }
            }
        }

        function updateInputText(inputtext) {
            var exampleText = document.getElementById(ID_PREFIX + ELEMENT_IDS.INPUT_TEXT);
            exampleText.textContent = inputtext;

            var inputDataNode = getNNNode(LAYER_IDS.INPUT_TEXT, 0);
            var inputLayerY = parseFloat(inputDataNode.getAttribute('cy'));
            var exampleTextY = inputLayerY;

            var exampleTextContainer = document.getElementById(ID_PREFIX + ELEMENT_IDS.INPUT_TEXT_CONTAINER);
            exampleTextContainer.setAttributeNS(null, 'y', exampleTextY - (exampleText.clientHeight / 2));
        }

        function showAnnotation(nodeid, annotation) {
            var annotationId = ID_PREFIX + ELEMENT_IDS.ANNOTATION + nodeid;
            var annotationElement = document.getElementById(annotationId);
            annotationElement.textContent = annotation;
            annotationElement.classList.remove('hiddendiagramelement');
        }
        function hideAnnotation(nodeid) {
            var annotationId = ID_PREFIX + ELEMENT_IDS.ANNOTATION + nodeid;
            var annotationElement = document.getElementById(annotationId);
            annotationElement.classList.add('hiddendiagramelement');
        }

        function toggleLayerHighlight(layeridx) {
            var nodesinlayer = document.getElementsByClassName('nnlayer' + layeridx);
            for (var i = 0; i < nodesinlayer.length; i++) {
                nodesinlayer[i].classList.toggle('highlightedlayer');
            }
        }

        function setViewBox(largestLayerIdx) {
            var left = parseFloat(getNNNode(LAYER_IDS.INPUT_TEXT, 0).getAttribute('cx')) - 50;
            var top = parseFloat(getNNNode(largestLayerIdx.idx, 0).getAttribute('cy')) - 50;

            w = window.innerWidth;
            h = window.innerHeight;
            svg.attr('viewBox', left + ' ' + top + ' ' + w + ' ' + h);
        }

        function removeAnnotations() {
            var elems = document.querySelectorAll('.nodedata, .nodevalue, .nodeseparator');
            for (var i = 0; i < elems.length; i++) {
                elems[i].remove();
            }
        }

        function setAnnotationsFocus(d) {
            var selectedSeparatorId = ID_PREFIX + ELEMENT_IDS.SEPARATOR + d.id;
            var selectedBiasId      = ID_PREFIX + ELEMENT_IDS.BIAS + d.id;
            var selectedValueId     = ID_PREFIX + ELEMENT_IDS.NODE_VALUE + d.id;

            var elems = document.querySelectorAll('.nodeseparator');
            for (var i = 0; i < elems.length; i++) {
                var o = elems[i];
                o.style.opacity = (o.id === selectedSeparatorId) ? 1 : 0.1;
            }

            elems = document.querySelectorAll('.nodedata');
            for (var j = 0; j < elems.length; j++) {
                var p = elems[j];
                p.style.opacity = (p.id === selectedBiasId) ? 1 : 0.1;
            }

            elems = document.querySelectorAll('.nodevalue');
            for (var k = 0; k < elems.length; k++) {
                var q = elems[k];
                var shouldDisplay = q.id === selectedValueId ||
                                    q.id.startsWith(ID_PREFIX + ELEMENT_IDS.NODE_VALUE + ID_PREFIX + (d.layer - 1));
                q.style.opacity = shouldDisplay ? 1 : 0.1;
            }

            var prevLayerIdx = d.layer - 1;
            var prevLayerNumNodes = architecture[prevLayerIdx];

            for (var idx = 0; idx < prevLayerNumNodes; idx++) {
                var nodeId = ID_PREFIX + getNodeId(prevLayerIdx, idx);

                var pathId = ID_PREFIX +
                             nodeId + '-' +
                             d.id;

                var textId = pathId + ELEMENT_IDS.PATH_TEXT;

                document.getElementById(textId).textContent = "w = 123 >>>";
            }
        }

        function restoreOpacity(elems) {
            for (var i = 0; i < elems.length; i++) {
                elems[i].style.opacity = 1;
            }
        }
        function emptyTextContent(elems) {
            for (var i = 0; i < elems.length; i++) {
                elems[i].textContent = '';
            }
        }

        function removeAnnotationsFocus() {
            restoreOpacity(document.querySelectorAll('.nodeseparator, .nodedata, .nodevalue'));
            emptyTextContent(document.querySelectorAll('.nodeweight'));
        }





        return {
            init : init,
            prepareNN : prepareNN,

            redraw : redraw,
            redistribute : redistribute,

            addLabels : addLabels,
            addWeights : addWeights,

            updateLabels : updateLabels,
            updateInputText : updateInputText,

            showAnnotation : showAnnotation,
            hideAnnotation : hideAnnotation,

            toggleLayerHighlight : toggleLayerHighlight
        };
    }
})();
