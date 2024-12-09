# core dependencies
from logging import info, exception
from os.path import join
from pathlib import Path
from unicodedata import normalize, combining
from traceback import format_exc
# external dependencies
from pandas import DataFrame
from ydf import GradientBoostedTreesLearner
# local dependencies
from app.savedmodels import get_location, update_status_file, cleanup
from app.payloads import ModelInfo
from app.viz import create_visualisation
from app.utils import create_zip_flat, recursive_delete



def sanitize_feature_names(key: str, dataframe: DataFrame):
    info("%s : Renaming features for use with saved models", key)
    rename_mapping = {}
    new_names = set()

    for column in dataframe:
        new_name = column

        # remove accented characters
        nfkd_form = normalize("NFKD", new_name)
        new_name = "".join([c for c in nfkd_form if not combining(c)])

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
    outcome_label = "mlforkids_outcome_label"

    try:
        # Attempt to create a visualisation of the data
        #  using original feature names
        create_visualisation(key, dataframe, outcome_label, download_folder)

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
        classes = list(dataframe[outcome_label].unique())
        modelinfo["labels"] = classes
        info("%s : classes in target label : %s", key, classes)
        dataframe[outcome_label] = dataframe[outcome_label].map(classes.index)

        # Train a model
        info("%s : Training a model", key)
        model = GradientBoostedTreesLearner(label=outcome_label).train(dataframe)

        # save model
        info("%s : Saving the model", key)
        model_location = join(model_folder, "model")
        # reset in case this model has been trained before
        recursive_delete(Path(model_location))
        model.save(model_location)
        info("%s : Zipping model for browser use", key)
        create_zip_flat(model_location, join(download_folder, "model.zip"))

        # update status
        info("%s : Updating the status", key)
        modelinfo["status"] = "Available"
        update_status_file(model_folder, modelinfo)

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
