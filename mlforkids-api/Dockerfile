# ###############################################
# build the app
# ###############################################

FROM node:19 AS builder

# don't run as root
USER node

# run the app in a folder owned by the node user
WORKDIR /usr/src/build

# install build dependencies
COPY --chown=node:node *.json ./
RUN npm install

# get the build source
COPY --chown=node:node *.js ./
COPY --chown=node:node custom_typings custom_typings
COPY --chown=node:node src src
COPY --chown=node:node public public

# confirm the source
RUN ls -l /usr/src/build

# customize build for use with machinelearningforkids.co.uk
# TODO - how can this be provided to buildruns dynamically?
ENV DEPLOYMENT=machinelearningforkids.co.uk

# run the build
RUN ./node_modules/.bin/gulp buildprod

# confirm the built app details
RUN ls -l /usr/src/build


# ###############################################
# prepare app image
# ###############################################

FROM node:19

# don't run as root
USER node

# run the app in a folder owned by the node user
WORKDIR /usr/src/app

# install runtime dependencies
COPY --chown=node:node package*.json ./
RUN npm clean-install --omit=dev

# setup supporting files
RUN mkdir logs
COPY --chown=node:node resources resources

# copy across built front-end code
RUN mkdir web
COPY --from=builder --chown=node:node /usr/src/build/web/static web/static
COPY --from=builder --chown=node:node /usr/src/build/web/dynamic web/dynamic

# copy across built back-end code
RUN mkdir dist
COPY --from=builder --chown=node:node /usr/src/build/dist/lib dist/lib

# confirm prepared app
RUN ls -l /usr/src/app

CMD ["npm", "start"]
