# base layer implements the OpenWhisk specific action wrapper
#  for the function implemented in this project
FROM openwhisk/dockerskeleton

RUN \
    # Install dependencies that we only need for the build stages of the
    #  Python dependency installs
    apk add --no-cache --virtual=.build-dependencies \
        g++ gfortran file binutils \
        musl-dev python3-dev cython openblas-dev \
        libstdc++ && \
    \
    # Install dependencies needed at runtime for generating the visualisation
    apk add --no-cache graphviz font-bitstream-type1 openblas && \
    \
    # Install the Python dependencies
    ln -s locale.h /usr/include/xlocale.h && \
    pip install --no-cache-dir cython numpy scipy sklearn pydotplus && \
    \
    # Cleanup - try to slim down the final Docker image by removing
    #  cache files, test files, libraries we don't need, etc.
    rm -r /root/.cache && \
    find /usr/lib/python3.*/ -name 'tests' -exec rm -r '{}' + && \
    find /usr/lib/python3.*/site-packages/ -name '*.so' -print -exec sh -c 'file "{}" | grep -q "not stripped" && strip -s "{}"' \; && \
    rm /usr/include/xlocale.h && \
    \
    # Remove the install dependencies that were only needed for
    #  building the Python libraries
    apk del .build-dependencies

# Needed for the OpenWhisk wrapper
ENV FLASK_PROXY_PORT 8080

# Add the action implementation to the Docker image
ADD numbers.py /action/exec

# Command copied from the OpenWhisk image
CMD ["/bin/bash", "-c", "cd actionProxy && python -u actionproxy.py"]
