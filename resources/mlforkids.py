import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import tensorflow as tf
tf.get_logger().setLevel('ERROR')

import tensorflow_hub as hub
from tensorflow.keras.preprocessing import image
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras import Sequential
from tensorflow.keras.layers import Dropout, Dense
from tensorflow.keras.layers.experimental.preprocessing import Rescaling

import numpy as np
import urllib.request, urllib.error, json

#
# Helper class for training an image classifier using training data
#  from the Machine Learning for Kids website.
#
class MLforKidsImageProject:

    IMAGESIZE=(224,224)
    INPUTLAYERSIZE=IMAGESIZE + (3,)

    # scratchkey is the secret API key that allows access to training
    #  data from a single project on the MLforKids website
    def __init__(self, scratchkey: str):
        self.scratchkey = scratchkey
        try:
            with urllib.request.urlopen("https://machinelearningforkids.co.uk/api/scratch/" + scratchkey + "/train") as url:
                self.__downloaded_training_images_list = json.loads(url.read().decode())
        except urllib.error.HTTPError:
            raise RuntimeError("Unable to retrieve machine learning project - please check that the key is correct")

    # Generates a name for the local cache file where the downloaded training
    #  image is saved. An image file extension is required, otherwise it will
    #  be ignored by ImageDataGenerator.
    def __get_fname(self, trainingitem):
        extension = ".png" if trainingitem["imageurl"].lower().endswith(".png") else ".jpg"
        return trainingitem["id"] + extension

    # Downloads all of the training images for this project, and sets up an
    #  ImageDataGenerator against the folder where they have been downloaded
    def __get_training_images_generator(self):
        cachedir = "~/.keras/"
        cachelocation = os.path.join("datasets", "mlforkids", self.scratchkey)
        projectcachedir = str(os.path.expanduser(os.path.join(cachedir, cachelocation)))
        for trainingitem in self.__downloaded_training_images_list:
            tf.keras.utils.get_file(origin=trainingitem["imageurl"],
                                    cache_dir=cachedir,
                                    cache_subdir=os.path.join(cachelocation, trainingitem["label"]),
                                    fname=self.__get_fname(trainingitem))
        return ImageDataGenerator().flow_from_directory(str(projectcachedir),
                                                        target_size=MLforKidsImageProject.IMAGESIZE)

    # Creates a lookup table for the classes that this project is being trained
    #  to recognize.
    # TODO : dumb implementation - should rewrite
    def __get_class_lookup(self, training_image_data):
        class_labels = [None]*training_image_data.num_classes
        class_names = training_image_data.class_indices.keys()
        for classname in class_names:
            class_labels[training_image_data.class_indices[classname]] = classname
        return class_labels

    # Defines a simple image classifier based on a mobilenet model from TensorFlow hub
    def __define_model(self):
        model = Sequential([
            # input layer is resizing all images to save having to do that in a manual pre-processing step
            Rescaling(1/127, input_shape=MLforKidsImageProject.INPUTLAYERSIZE),
            # using an existing pre-trained model as an untrainable main layer
            hub.KerasLayer("https://tfhub.dev/google/imagenet/mobilenet_v2_140_224/classification/4"),
            #
            Dropout(rate=0.2),
            #
            Dense(self.num_classes)
        ])
        model.build((None,) + MLforKidsImageProject.INPUTLAYERSIZE)

        # model compile parameters copied from tutorial at https://www.tensorflow.org/hub/tutorials/tf2_image_retraining
        model.compile(
            optimizer=tf.keras.optimizers.SGD(lr=0.005, momentum=0.9),
            loss=tf.keras.losses.CategoricalCrossentropy(from_logits=True, label_smoothing=0.1),
            metrics=['accuracy'])

        return model

    # Runs the model fit function to train the tl model
    def __train_model(self, trainingimagesdata):
        if trainingimagesdata.batch_size > trainingimagesdata.samples:
            trainingimagesdata.batch_size = trainingimagesdata.samples
        steps_per_epoch = trainingimagesdata.samples // trainingimagesdata.batch_size
        epochs = 8
        if trainingimagesdata.samples > 55:
            epochs = 15
        self.ml_model.fit(trainingimagesdata, epochs=epochs, steps_per_epoch=steps_per_epoch, verbose=0)

    #
    # public methods
    #

    # Fetches the training data for this project, and uses it to train a machine learning model
    def train_model(self):
        training_images = self.__get_training_images_generator()
        self.num_classes = training_images.num_classes
        self.ml_class_names = self.__get_class_lookup(training_images)
        self.ml_model = self.__define_model()
        self.__train_model(training_images)

    # Returns a prediction for the image at the specified location
    def prediction(self, image_location: str):
        if hasattr(self, "ml_model") == False:
            raise RuntimeError("Machine learning model has not been trained for this project")
        testimg = image.load_img(image_location, target_size=MLforKidsImageProject.IMAGESIZE)
        testimg = image.img_to_array(testimg)
        testimg = np.expand_dims(testimg, axis=0)
        predictions = self.ml_model.predict(testimg)
        topprediction = predictions[0]
        topanswer = np.argmax(topprediction)
        return {
            "class_name": self.ml_class_names[topanswer],
            "confidence": 100 * np.max(tf.nn.softmax(topprediction))
        }
