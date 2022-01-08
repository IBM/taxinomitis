# external dependencies
from sklearn import tree
from sklearn.feature_extraction import DictVectorizer
from timeit import default_timer as timer
import os
import shutil
import pylru
import simplejson
import pydotplus
from io import BytesIO
import json
import base64
from re import sub


# how many can we fit into memory?
ML_MODEL_CACHE_SIZE = 50

# cache of previously trained models in memory
models = pylru.lrucache(ML_MODEL_CACHE_SIZE)



def deleteTraining(tenant, student, project):
    training = "./data/" + tenant + "/" + student + "/" + project + ".json"
    if os.path.exists(training):
        os.remove(training)

def deleteStudent(tenant, student):
    training = "./data/" + tenant + "/" + student
    if os.path.exists(training):
        shutil.rmtree(training)

def deleteTenant(tenant):
    training = "./data/" + tenant
    if os.path.exists(training):
        shutil.rmtree(training)



def getTrainingFilePath(tenant, student, project):
    trainingFolder = "./data/" + tenant + "/" + student
    if not os.path.exists(trainingFolder):
        os.makedirs(trainingFolder)
    return trainingFolder + "/" + project + ".json"

def writeTrainingData(tenant, student, project, data):
    filepath = getTrainingFilePath(tenant, student, project)
    with open(filepath, "w") as trainingfile:
        simplejson.dump(data, trainingfile)
    return filepath



#
#
#
def trainNewClassifier(tenant, student, project, data):
    filepath = writeTrainingData(tenant, student, project, data)
    return trainClassifier(filepath)


#
#
#
def trainClassifier(filepath):
    global models

    # start timing, so we know how long we're spending doing training
    start = timer()

    # read data into shape needed for decision tree
    data = []
    target = []
    trainingrecords = 0
    with open(filepath, "r") as trainingfile:
        trainingrows = simplejson.load(trainingfile)
        for trainingrow in trainingrows:
            data.append(trainingrow[0])
            target.append(trainingrow[1])
            trainingrecords += 1

    # used to convert any categorical fields using one-hot encoding
    vec = DictVectorizer(sparse=False)

    # train a decision tree
    dt = tree.DecisionTreeClassifier(random_state=42)
    dt.fit(vec.fit_transform(data), target)

    # stop timing
    end = timer()

    # cache the decision tree so we can reuse it without training
    models[filepath] = { "tree" : dt, "vectorizer" : vec }

    return { "time" : (end - start), "items" : trainingrecords }



#
# generates a graphical representation of the decision tree created for
#  the specified model
# the previously trained model is used if one is available in the cache,
#  or a new one is created otherwise
def describeModel(tenant, student, project, outputformats):
    model = getModel(tenant, student, project)
    if model is None:
        raise RuntimeError('No training data available')

    dot_data = tree.export_graphviz(model["tree"],
                                    feature_names=model["vectorizer"].feature_names_,
                                    class_names=model["tree"].classes_,
                                    impurity=False,
                                    filled=True,
                                    rounded=True)

    graph = pydotplus.graph_from_dot_data(dot_data)
    graph.del_node("\"\\n\"")

    response = { "vocabulary" : list(model["vectorizer"].vocabulary_) }

    # generating output in requested formats
    if "png" in outputformats:
        pngbuffer = BytesIO()
        graph.write_png(pngbuffer)
        pngbuffer.seek(0)
        response["png"] = b64encode(pngbuffer.getvalue()).decode()
        del pngbuffer
    if "dot" in outputformats:
        dotbuffer = BytesIO()
        graph.write(dotbuffer)
        dotbuffer.seek(0)
        response["dot"] = dotbuffer.getvalue().decode()
        del dotbuffer
    if "svg" in outputformats:
        svgbuffer = BytesIO()
        graph.write_svg(svgbuffer)
        svgbuffer.seek(0)
        response["svg"] = svgbuffer.getvalue().decode().replace('\n', '')
        del svgbuffer

    return response


#
# gets the predictive model - fetching a previously trained model
#  if one is available in the cache, or creating a new one otherwise
def getModel (tenant, student, project):
    global models
    filepath = getTrainingFilePath(tenant, student, project)
    try:
        # return a cached model if we've got one
        return models[filepath]
    except KeyError:
        # model isn't in the cache

        # if we have the raw data, we can build the model from it
        if os.path.isfile(filepath):
            trainClassifier(filepath)
            return models[filepath]

        # We don't have a cached model, and we don't have any
        #  training data
        # Give up.
        return None




#
#
#
def classify(tenant, student, project, data):
    model = getModel(tenant, student, project)
    if model is None:
        raise RuntimeError('No training data available')

    # reshaped = np.reshape(data, (1, -1))
    # prediction = model.predict_proba(reshaped)

    prediction = model["tree"].predict_proba(model["vectorizer"].transform(data))

    classes = model["tree"].classes_

    output = {}
    for i, prob in enumerate(prediction[0]):
        output[classes[i]] = prob * 100
    return output




