# Functions for Machine Learning for Kids

Some computationally expensive operations can be offloaded to an OpenWhisk serverless platform.

## mltraining-images

- CreateZip
    - Input:
        - Credentials for cloud object storage
        - List of images
    - Output:
        - Zip file containing all images

- ResizeImage
    - Input:
        - URL of an image
    - Output:
        - Resized version of the image, suitable for use with Visual Recognition

## mltraining-numbers

- DescribeModel
    - Input:
        - Training data for numbers ML project
    - Output:
        - JSON object containing representations of the decision tree classifier (png, dot, svg)
