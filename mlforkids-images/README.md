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
        - Resized version of the image, suitable for use with ML model tasks

