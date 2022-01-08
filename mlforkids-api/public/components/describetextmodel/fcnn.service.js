
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
        'loggerService'
    ];

    function fcnnVisualisationService(loggerService) {

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

        var container;

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
            container = document.getElementById(containerId);

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

        function returnId(item) {
            return item.id;
        }

        function redraw() {
            graph.nodes = architecture.map(function (layer_width, layer_index) {
                return range(layer_width).map(function (node_index) {
                    return {
                        id: ID_PREFIX + getNodeId(layer_index, node_index),
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
                       .attr('id', returnId)
                       .merge(link);

            node = node.data(graph.nodes, returnId);
            node.exit().remove();
            node = node.enter()
                       .append('circle')
                       .attr('r', nodeDiameter/2)
                       .attr('class', function(d) { return 'node nnlayer' + d.layer; })
                       .attr('id', returnId)
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
            // d3.event.stopPropagation();
            node.style('opacity', function(o) { return (d == o || o.layer == d.layer - 1) ? 1 : 0.1; });
            link.style('opacity', function(o) { return (o.target == d.id) ? 1 : 0.02; });

            // ml4k-specific
            setAnnotationsFocus(d);
        }

        function remove_focus() {
            // d3.event.stopPropagation();
            node.style('opacity', 1);
            link.style('opacity', function () { return edgeOpacity; });

            // ml4k-specific
            removeAnnotationsFocus();
        }


        //-----------------------------------------------------------------
        // additional MLforKids-specific functions
        //-----------------------------------------------------------------

        var ELEMENT_IDS = {
            INPUT_TEXT_CONTAINER   : 'input_text_container',
            INPUT_TEXT             : 'input_text',
            OUTPUT_LAYER_CONTAINER : 'output_layer_container',
            OUTPUT_LAYER           : 'output_layer',
            BIAS                   : 'bias',
            WEIGHT                 : 'weight',
            NODE_VALUE             : 'value',
            PATH_TEXT              : 'text',
            SEPARATOR              : 'separator',
            ANNOTATION             : 'annotation'
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

            var inputDataWidth = 120;
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
                'style': 'overflow:visible',
                'class': 'additionalnndiagramelement'
            }, inputDataNode.parentNode);

            var exampleText = createSvgElement(NS_HTML, 'div', {
                'id': ID_PREFIX + ELEMENT_IDS.INPUT_TEXT,
                'class': 'inputdata hiddendiagramelement additionalnndiagramelement'
            }, exampleTextContainer);

            exampleText.textContent = 'input text';
            exampleTextContainer.setAttributeNS(null, 'y', exampleTextY - (exampleText.clientHeight / 2));
        }

        function addOutputDetail() {
            var layerId = architecture.length - 1;
            var topOutputDataNode = getNNNode(layerId, 0);
            var bottomOutputDataNode = getNNNode(layerId, architecture[layerId] - 1);

            var outputLayerX = parseFloat(topOutputDataNode.getAttribute('cx'));

            var topOutputLayerY = parseFloat(topOutputDataNode.getAttribute('cy'));
            var bottomOutputLayerY = parseFloat(bottomOutputDataNode.getAttribute('cy'));

            var outputDataWidth = 460;
            var outputDataHeight = 120;

            var detailX = outputLayerX + 40;
            var detailY = topOutputLayerY + ((bottomOutputLayerY - topOutputLayerY) / 2) - 60;

            var detailContainer = createSvgElement(NS_SVG, 'foreignObject', {
                'id': ID_PREFIX + ELEMENT_IDS.OUTPUT_LAYER_CONTAINER,
                'x': detailX,
                'y': detailY,
                'width': outputDataWidth,
                'height': outputDataHeight,
                'dominant-anchor': 'middle',
                'text-anchor': 'middle',
                'style': 'overflow:visible',
                'class': 'additionalnndiagramelement'
            }, topOutputDataNode.parentNode);

            createSvgElement(NS_HTML, 'div', {
                'id': ID_PREFIX + ELEMENT_IDS.OUTPUT_LAYER,
                'class': 'outputlayerdetail hiddendiagramelement additionalnndiagramelement'
            }, detailContainer);
        }

        function addLabels() {
            loggerService.debug('[fcnn] Adding labels');

            var largestLayer = {
                idx : 0,
                size : 0
            };

            addInputExample();
            addOutputDetail();

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
            loggerService.debug('[fcnn] Adding weights');

            var parentNode = getNNNode(LAYER_IDS.INPUT_TEXT, 0).parentNode;

            for (var layerIdx = LAYER_IDS.INPUT_LAYER; layerIdx < (architecture.length - 1); layerIdx++) {
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
                            'text-anchor' : 'middle',
                            'class' : 'additionalnndiagramelement'
                        }, parentNode);

                        createSvgElement(NS_SVG, 'textPath', {
                            'id' : pathId + ELEMENT_IDS.PATH_TEXT,
                            'href' : '#' + pathId,
                            'startOffset' : '65%',
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
                    'text-anchor' : 'start',
                    'class' : 'additionalnndiagramelement'
                }, mynode.parentNode);

                createSvgElement(NS_HTML, 'div', {
                    'id' : ID_PREFIX + ELEMENT_IDS.ANNOTATION + nodeid,
                    'class' : 'inputannotation hiddendiagramelement additionalnndiagramelement'
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
                'class': 'nodeseparator hiddendiagramelement'
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
                'style' : 'overflow: visible',
                'class' : 'additionalnndiagramelement'
            }, mynode.parentNode);
            createSvgElement(NS_HTML, 'div', {
                'id' : ID_PREFIX + ELEMENT_IDS.ANNOTATION + nodeid,
                'class' : 'hiddenlayerfunction hiddendiagramelement additionalnndiagramelement'
            }, annotationContainer);
        }

        function updateLabels(nodevalues, highlight) {
            for (var nodename  in nodevalues) {
                var values = nodevalues[nodename];

                if ('bias' in values) {
                    if (highlight) {
                        document.getElementById(ID_PREFIX + nodename).classList.add('highlightedlayer');
                    }
                    else {
                        document.getElementById(ID_PREFIX + nodename).classList.remove('highlightedlayer');
                    }
                    var biasDecoration = values.bias === undefined ? '' : 'b=' + values.bias;
                    document.getElementById(ID_PREFIX + ELEMENT_IDS.BIAS + nodename).textContent = biasDecoration;
                    document.getElementById(ID_PREFIX + ELEMENT_IDS.SEPARATOR + nodename).classList.remove('hiddendiagramelement');
                }
                if ('value' in values) {
                    document.getElementById(ID_PREFIX + nodename).classList.add('highlightedlayer');
                    document.getElementById(ID_PREFIX + ELEMENT_IDS.NODE_VALUE + nodename).textContent = values.value;
                }
            }
        }

        function clearInputLabels() {
            loggerService.debug('[fcnn] Clear input labels');

            for (var nodeIdx = 0; nodeIdx < architecture[LAYER_IDS.INPUT_LAYER]; nodeIdx++) {
                getNNNode(LAYER_IDS.INPUT_LAYER, nodeIdx).classList.remove('highlightedlayer');
                document.getElementById(ID_PREFIX + ELEMENT_IDS.NODE_VALUE + '1_' + nodeIdx).textContent = '';
            }
        }

        function updateInputText(inputtext) {
            loggerService.debug('[fcnn] Updating input text', inputtext);

            var exampleText = document.getElementById(ID_PREFIX + ELEMENT_IDS.INPUT_TEXT);
            exampleText.textContent = inputtext;
            exampleText.classList.remove('hiddendiagramelement');

            var inputDataNode = getNNNode(LAYER_IDS.INPUT_TEXT, 0);
            inputDataNode.classList.add('hiddendiagramelement');
            var inputLayerY = parseFloat(inputDataNode.getAttribute('cy'));
            var exampleTextY = inputLayerY;

            var exampleTextContainer = document.getElementById(ID_PREFIX + ELEMENT_IDS.INPUT_TEXT_CONTAINER);
            exampleTextContainer.setAttributeNS(null, 'y', exampleTextY - (exampleText.clientHeight / 2));
            exampleTextContainer.classList.remove('hiddendiagramelement');
        }

        function updateOutputHtml(outputhtml) {
            loggerService.debug('[fcnn] Updating output detail');

            var exampleText = document.getElementById(ID_PREFIX + ELEMENT_IDS.OUTPUT_LAYER);

            if (outputhtml) {
                exampleText.innerHTML = outputhtml;
                exampleText.classList.remove('hiddendiagramelement');
            }
            else {
                exampleText.classList.add('hiddendiagramelement');
            }
        }


        function showAnnotation(nodeid, annotation) {
            var annotationId = ID_PREFIX + ELEMENT_IDS.ANNOTATION + nodeid;
            var annotationElement = document.getElementById(annotationId);
            annotationElement.innerHTML = annotation;
            annotationElement.classList.remove('hiddendiagramelement');
        }
        function hideAnnotation(nodeid) {
            var annotationId = ID_PREFIX + ELEMENT_IDS.ANNOTATION + nodeid;
            var annotationElement = document.getElementById(annotationId);
            annotationElement.classList.add('hiddendiagramelement');
        }

        function toggleLayerHighlight(layeridx) {
            var nodesinlayer = document.getElementsByClassName('nnlayer' + (layeridx % architecture.length));
            for (var i = 0; i < nodesinlayer.length; i++) {
                nodesinlayer[i].classList.toggle('highlightedlayer');
            }
        }

        function setViewBox(largestLayerIdx) {
            loggerService.debug('[fcnn] Setting the view box based on the location of nodes in layer', largestLayerIdx);

            var inputElem = getNNNode(LAYER_IDS.INPUT_TEXT, 0);
            var outputElem = document.getElementById(ID_PREFIX + ELEMENT_IDS.OUTPUT_LAYER_CONTAINER);
            var topHiddenElem = getNNNode(largestLayerIdx.idx, 0);
            var bottomHiddenElem = getNNNode(largestLayerIdx.idx, architecture[largestLayerIdx.idx - 1]);

            var left = parseFloat(inputElem.getAttribute('cx'));
            var right = parseFloat(outputElem.getAttribute('x'));
            var top = parseFloat(topHiddenElem.getAttribute('cy'));
            var bottom = parseFloat(bottomHiddenElem.getAttribute('cy'));

            if (outputElem) {
                w = right - left + 550;
                h = bottom - top + 400;

                if (h < 500) {
                    h = 900;
                }
            }
            else {
                w = window.innerWidth;
                h = window.innerHeight;
            }



            svg.attr('viewBox', (left - 80) + ' ' + (top - 30) + ' ' + w + ' ' + h);
        }

        function removeAnnotations() {
            var elems = container.querySelectorAll('.nodedata, .nodevalue, .nodeseparator, .nodeweight, .additionalnndiagramelement');
            for (var i = 0; i < elems.length; i++) {
                elems[i].remove();
            }
        }

        function setAnnotationsFocus(d) {
            var selectedSeparatorId = ID_PREFIX + ELEMENT_IDS.SEPARATOR + d.id;
            var selectedBiasId      = ID_PREFIX + ELEMENT_IDS.BIAS + d.id;
            var selectedValueId     = ID_PREFIX + ELEMENT_IDS.NODE_VALUE + d.id;

            var elems = container.querySelectorAll('.nodeseparator');
            for (var i = 0; i < elems.length; i++) {
                var o = elems[i];
                var shouldDisplay = (o.id === selectedSeparatorId);
                if (shouldDisplay) {
                    o.classList.remove('hiddendiagramelement');
                }
                o.style.opacity = shouldDisplay ? 1 : 0.1;
            }

            elems = container.querySelectorAll('.nodedata');
            for (var j = 0; j < elems.length; j++) {
                var p = elems[j];
                var shouldDisplay = (p.id === selectedBiasId);
                p.style.opacity = shouldDisplay ? 1 : 0.1;
            }

            elems = container.querySelectorAll('.nodevalue');
            for (var k = 0; k < elems.length; k++) {
                var q = elems[k];
                var shouldDisplay = q.id === selectedValueId ||
                                    q.id.startsWith(ID_PREFIX + ELEMENT_IDS.NODE_VALUE + (d.layer - 1) + '_');
                q.style.opacity = shouldDisplay ? 1 : 0.1;
            }
        }

        function displayWeights(layerIdx, nodeIdx, weights, highlights) {
            var prevLayerIdx = layerIdx - 1;
            var prevLayerNumNodes = architecture[prevLayerIdx];

            for (var idx = 0; idx < prevLayerNumNodes; idx++) {
                var nodeId = ID_PREFIX + getNodeId(prevLayerIdx, idx);
                var pathId = ID_PREFIX +
                             nodeId + '-' +
                             ID_PREFIX + layerIdx + '_' + nodeIdx;
                var textId = pathId + ELEMENT_IDS.PATH_TEXT;

                var linkElem = document.getElementById(pathId);
                if (highlights.path) {
                    linkElem.classList.add('highlighted');
                }
                else {
                    linkElem.classList.remove('highlighted');
                }

                var labelElem = document.getElementById(textId);
                labelElem.textContent = weights[idx];
                if (highlights.label) {
                    labelElem.classList.add('highlighted');
                }
                else {
                    labelElem.classList.remove('highlighted');
                }
            }
        }

        function highlightInputText() {
            document.getElementById(ID_PREFIX + ELEMENT_IDS.INPUT_TEXT).classList.add('highlightedlayer');
        }

        function highlightHiddenLayerNode(layerIdx, nodeIdx) {
            node.style('opacity', function(o) {
                if (o.layer === 0) {
                    return 0;
                }
                return ((o.layer === layerIdx && o.node_index === nodeIdx) || o.layer == layerIdx - 1) ? 1 : 0.1;
            });
            link.style('opacity', function(o) {
                return (o.target == ID_PREFIX + layerIdx + '_' + nodeIdx) ? 1 : 0.02;
            });
            document.getElementById(ID_PREFIX + ELEMENT_IDS.INPUT_TEXT).style.opacity = 0.1;

            setAnnotationsFocus({ id : layerIdx + '_' + nodeIdx, layer : layerIdx });
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
        function addHiddenClass(elems) {
            for (var i = 0; i < elems.length; i++) {
                elems[i].classList.add('hiddendiagramelement');
            }
        }
        function removeAnnotationsFocus() {
            restoreOpacity(container.querySelectorAll('.nodeseparator, .nodedata, .nodevalue'));
            emptyTextContent(container.querySelectorAll('.nodeweight'));
            addHiddenClass(container.querySelectorAll('.inputannotation'));
            node.classed('highlightedlayer', false);
            var inputTextElement = document.getElementById(ID_PREFIX + ELEMENT_IDS.INPUT_TEXT);
            inputTextElement.classList.remove('highlightedlayer');
            inputTextElement.style.opacity = 1;
        }

        function decorate() {
            addLabels();
            addWeights();

            if (architecture[0] > 1) {
                var inputDataNode = getNNNode(LAYER_IDS.INPUT_TEXT, 0);
                inputDataNode.classList.remove('hiddendiagramelement');
            }
        }

        function removeValues() {
            link.style('opacity', function(o) { return (o.source === ID_PREFIX + '0_0') ? 0.02 : 1; });
            node.style('opacity', function(o) { return (o.layer === 0) ? 0.02 : 1; });

            clearInputLabels();

            document.getElementById(ID_PREFIX + ELEMENT_IDS.INPUT_TEXT).classList.add('hiddendiagramelement');
            document.getElementById(ID_PREFIX + ELEMENT_IDS.INPUT_TEXT_CONTAINER).classList.add('hiddendiagramelement');

            for (var layerIdx = 1; layerIdx < architecture.length; layerIdx++) {
                for (var nodeIdx = 0; nodeIdx < architecture[layerIdx]; nodeIdx++) {
                    document.getElementById(ID_PREFIX + ELEMENT_IDS.NODE_VALUE + layerIdx + '_' + nodeIdx).textContent = '';
                }
            }
        }


        function create(arch, spacing) {
            architecture = arch;
            betweenNodesInLayer = spacing;

            redraw();
            redistribute();
            decorate();
        }



        return {
            init : init,
            create : create,

            updateLabels : updateLabels,
            updateInputText : updateInputText,
            updateOutputHtml : updateOutputHtml,

            displayWeights : displayWeights,

            clearInputLabels : clearInputLabels,

            showAnnotation : showAnnotation,
            hideAnnotation : hideAnnotation,

            highlightHiddenLayerNode : highlightHiddenLayerNode,

            highlightInputText : highlightInputText,
            toggleLayerHighlight : toggleLayerHighlight,

            removeValues : removeValues,

            set_focus : set_focus,
            remove_focus : remove_focus
        };
    }
})();
