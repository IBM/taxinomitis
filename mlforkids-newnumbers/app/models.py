# core dependencies
from logging import info, exception
from os.path import join, isfile
from os import listdir
from unicodedata import normalize, combining
from itertools import chain
from traceback import format_exc
# external dependencies
from pandas import DataFrame
from tensorflow_decision_forests.keras import pd_dataframe_to_tf_dataset, RandomForestModel
from tensorflowjs.converters.tf_saved_model_conversion_v2 import convert_tf_saved_model
# local dependencies
from app.savedmodels import get_location, update_status_file, cleanup
from app.payloads import ModelInfo
from app.viz import create_visualisation
from app.utils import create_zip



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
        # Attempt to create a visualisation of the data using original
        #  feature names before making any changes needed for TFDF
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
