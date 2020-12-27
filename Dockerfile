FROM node:14-buster-slim

RUN apt-get update && apt-get upgrade -y && apt-get install -y git && apt-get clean && rm -rf /var/lib/apt/lists/*


#ENV POSTGRESQLHOST=127.0.0.1
#ENV POSTGRESQLPORT=5432
#ENV POSTGRESQLUSER=ml4kdbuser
#ENV POSTGRESQLPASSWORD=ml4kdbpwd
#ENV POSTGRESQLDATABASE=mlforkidsdb

#ENV PORT=3000
#ENV HOST=0.0.0.0

EXPOSE 3000

COPY ./ /tmp/ml4k/

WORKDIR /tmp/ml4k

RUN npm install
RUN npm run build_notest

CMD ["npm", "start"]
