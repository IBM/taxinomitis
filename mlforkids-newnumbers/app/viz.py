# core dependencies
from logging import info, exception
from io import BytesIO
from os.path import join, exists
from os import mkdir
from json import dump
# external dependencies
from sklearn.tree import DecisionTreeClassifier, export_graphviz
from sklearn.feature_extraction import DictVectorizer
from pydotplus import graph_from_dot_data
from pandas import DataFrame
# internal dependencies
from app.utils import json_serializer




def create_visualisation(key: str, dataframe: DataFrame, outcome_label: str, download_folder: str):
    info("%s : Creating visualisation of a decision tree", key)

    try:
        target = dataframe[outcome_label]

        features = dataframe.drop(columns=[outcome_label])
        vec = DictVectorizer(sparse=False)
        features_dict = features.to_dict(orient="records")
        features_encoded = vec.fit_transform(features_dict)

        tree = DecisionTreeClassifier()
        tree.fit(features_encoded, target)

        dot_data = export_graphviz(tree,
                                feature_names=vec.feature_names_,
                                class_names=tree.classes_,
                                impurity=False,
                                filled=True,
                                rounded=True)

        graph = graph_from_dot_data(dot_data)
        graph.del_node("\"\\n\"")

        if not exists(download_folder):
            info("%s : Creating download folder", key)
            mkdir(download_folder)


        with open(join(download_folder, "vocab.json"), "w") as vocabfile:
            vocab = list(vec.vocabulary_)
            dump(vocab, vocabfile, default=json_serializer)
        with open(join(download_folder, "tree.svg"), "w") as svgfile:
            svgbuffer = BytesIO()
            graph.write_svg(svgbuffer)
            svgbuffer.seek(0)
            svg = svgbuffer.getvalue().decode().replace('\n', '')
            del svgbuffer
            svgfile.write(svg)
        with open(join(download_folder, "tree.dot"), "w") as dotfile:
            dotbuffer = BytesIO()
            graph.write(dotbuffer)
            dotbuffer.seek(0)
            dot = dotbuffer.getvalue().decode()
            del dotbuffer
            dotfile.write(dot)

    except:
        exception("%s : Visualisation failed", key)
