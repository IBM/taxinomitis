#!/usr/bin/env python

# reading the action input
import sys
import json
# building the decision tree
from sklearn.feature_extraction import DictVectorizer
from sklearn import tree
# visualising the decision tree
from pydotplus import graph_from_dot_data
# preparing the output for returning
from io import BytesIO
from base64 import b64encode



def main():
    # processing parameters
    params = json.loads(sys.argv[1])
    outputformats = params.get('formats', [])

    # decompress the training data
    examplesCompressionKey = params.get('examplesKey', [])
    compressedexamples = params.get('examples', [])
    examples = []
    for compressedexample in compressedexamples:
        example = {}
        for idx, key in enumerate(examplesCompressionKey):
            example[key] = compressedexample[idx]
        examples.append(example)
    del compressedexamples
    del examplesCompressionKey

    # decompress the output labels
    labelsCompressionKey = params.get('labelsKey', [])
    compressedlabels = params.get('labels', [])
    labels = []
    for compressedlabel in compressedlabels:
        labels.append(labelsCompressionKey[compressedlabel])
    del compressedlabels
    del labelsCompressionKey

    # building decision tree classifier
    vec = DictVectorizer(sparse=False)
    dt = tree.DecisionTreeClassifier(random_state=42)
    dt.fit(vec.fit_transform(examples), labels)

    # creating decision tree visualization
    dot_data = tree.export_graphviz(dt,
                                    feature_names=vec.feature_names_,
                                    class_names=dt.classes_,
                                    impurity=False,
                                    filled=True,
                                    rounded=True)
    graph = graph_from_dot_data(dot_data)
    graph.set_size('"70"')

    response = { 'vocabulary' : list(vec.vocabulary_) }

    # generating output in requested formats
    if 'png' in outputformats:
        pngbuffer = BytesIO()
        graph.write_png(pngbuffer)
        pngbuffer.seek(0)
        response['png'] = b64encode(pngbuffer.getvalue()).decode()
        del pngbuffer
    if 'dot' in outputformats:
        dotbuffer = BytesIO()
        graph.write(dotbuffer)
        dotbuffer.seek(0)
        response['dot'] = dotbuffer.getvalue().decode()
        del dotbuffer
    if 'svg' in outputformats:
        svgbuffer = BytesIO()
        graph.write_svg(svgbuffer)
        svgbuffer.seek(0)
        response['svg'] = svgbuffer.getvalue().decode().replace('\n', '')
        del svgbuffer

    print(json.dumps(response))

if __name__ == "__main__":
    main()
