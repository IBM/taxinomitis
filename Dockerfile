FROM postgres

RUN curl -sL https://deb.nodesource.com/setup_12.x | bash -
RUN apt-get install -y nodejs

RUN psql -c "CREATE USER ml4kdbuser WITH PASSWORD 'ml4kdbpwd' LOGIN;"
RUN psql -c "CREATE DATABASE mlforkidsdb OWNER ml4kdbuser;"
RUN psql -U ml4kdbuser -f sql/postgresql.sql -d mlforkidsdb

ENV POSTGRESQLHOST=localhost
ENV POSTGRESQLPORT=5432
ENV POSTGRESQLUSER=ml4kdbuser
ENV POSTGRESQLPASSWORD=ml4kdbpwd
ENV POSTGRESQLDATABASE=mlforkidsdb

ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

RUN npm install
RUN npm run build_notest

CMD ["npm", "start"]
