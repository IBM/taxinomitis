# core dependencies
from logging import info, exception
from os.path import join, isfile
from os import listdir
from itertools import chain
from traceback import format_exc
# external dependencies
from pandas import DataFrame
import dtreeviz
from tensorflow_decision_forests.keras import pd_dataframe_to_tf_dataset, RandomForestModel
from tensorflowjs.converters.tf_saved_model_conversion_v2 import convert_tf_saved_model
# local dependencies
from app.savedmodels import get_location, update_status_file, cleanup
from app.payloads import ModelInfo
from app.utils import create_zip



def create_visualisation(key: str, model: RandomForestModel, dataframe: DataFrame, outcome_label: str, classes: list[any], download_folder: str, attempt=0):
    try:
        model_features = [f.name for f in model.make_inspector().features()]
        viz = dtreeviz.model(model,
                             tree_index=0,
                             X_train=dataframe[model_features],
                             y_train=dataframe[outcome_label],
                             feature_names=model_features,
                             target_name=outcome_label,
                             class_names=classes)
        viz.view(fancy=True, fontname="Liberation Sans Narrow").save(join(download_folder, "dtreeviz-tree-0.svg"))
    except Exception as vizerr:
        exception("%s : Failed to train model", key)
        if attempt == 0:
            create_visualisation(key, model, dataframe, outcome_label, classes, download_folder, 1)
        else:
            exception("%s : Second attempt to generate visualisation failed", key)


def sanitize_feature_names(key: str, dataframe: DataFrame):
    info("%s : Renaming features for use with saved models", key)
    rename_mapping = {}
    new_names = set()

    for column in dataframe:
        new_name = column

        # replace forbidden characters with _
        for forbidden_character in " \t?%,@.-":
            if forbidden_character in new_name:
                new_name = new_name.replace(forbidden_character, "_")

        # lower-case
        new_name = new_name.lower()

        # remove preceeding underscores
        new_name = new_name.lstrip("_")

        # remove forbidden names
        if new_name == "self":
            new_name = "self_"

        # make names unique by appending underscores
        while new_name in new_names:
            new_name += "_"

        rename_mapping[column] = new_name
        new_names.add(new_name)

    dataframe = dataframe.rename(columns=rename_mapping, inplace=True)
    return rename_mapping


def train_model(modelinfo: ModelInfo, dataframe: DataFrame):
    key = modelinfo["key"]
    info("%s : Training model", key)
    model_folder = get_location(key)
    download_folder = join(model_folder, "download")

    try:
        # Identify feature types for preparing test data
        modelinfo["features"] = {}
        for feature, type in dataframe.dtypes.items():
            modelinfo["features"][feature] = { "type" : type.name }

        # Sanitize feature names to be safe for use with tf
        feature_names = sanitize_feature_names(key, dataframe)
        for name in feature_names:
            modelinfo["features"][name]["name"] = feature_names[name]

        # Identify classification target label
        info("%s : Identifying target label", key)
        outcome_label = "mlforkids_outcome_label"
        classes = list(dataframe[outcome_label].unique())
        modelinfo["labels"] = classes
        info("%s : classes in target label : %s", key, classes)
        dataframe[outcome_label] = dataframe[outcome_label].map(classes.index)

        # Convert to tensorflow data sets
        info("%s : Converting to tensorflow data set", key)
        train_ds = pd_dataframe_to_tf_dataset(dataframe, label=outcome_label, fix_feature_names=False)

        # Train a Random Forest model
        info("%s : Training a model", key)
        model = RandomForestModel(verbose=1)
        model.fit(train_ds)

        # save model
        info("%s : Saving the model", key)
        model.save(model_folder, overwrite=True)
        info("%s : Converting model to tensorflowjs", key)
        convert_tf_saved_model(model_folder, download_folder)

        # create a visualisation
        info("%s : Creating the visualisation", key)
        create_visualisation(key, model, dataframe, outcome_label, classes, download_folder)

        # update status
        info("%s : Updating the status", key)
        modelinfo["status"] = "Available"
        update_status_file(model_folder, modelinfo)

        # save Python version of the model
        python_files = chain(
            [
                join(model_folder, "saved_model.pb"),
                join(model_folder, "keras_metadata.pb"),
                join(model_folder, "fingerprint.pb")
            ],
            [   join(model_folder, "variables", f) for f in listdir(join(model_folder, "variables")) if isfile(join(model_folder, "variables", f))],
            [   join(model_folder, "assets", f) for f in listdir(join(model_folder, "assets")) if isfile(join(model_folder, "assets", f))]
        )
        create_zip(python_files, model_folder, join(download_folder, "python.zip"))

        # delete the working files to save space
        cleanup(model_folder)

        # training complete
        info("%s : Training complete", key)

    except Exception as trainerr:
        exception("%s : Failed to train model", key)

        # update status
        modelinfo["status"] = "Failed"
        modelinfo["error"] = {
            "message": str(trainerr),
            "stack": format_exc()
        }
        update_status_file(model_folder, modelinfo)
