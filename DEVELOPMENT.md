# Developer's Guide

These instructions should let you get a copy of the code running.

They are:
1. Get the dependencies
2. Get the source code
3. Prepare a PostgreSQL database
4. Prepare environment variables
5. Build the code
6. Run the code


## Step 1 - Get the dependencies

To run the site, you need:
- Node.js version 10
- PostgreSQL version 12

## Step 2 - Get the code

`git clone git@github.com:IBM/taxinomitis.git`

## Step 3 - Create your database

The site stores information in a PostgreSQL database. An SQL script is provided in `sql/postgresql.sql` to set up the expected database tables and indexes.

You can use it like this:
```
psql -c "CREATE USER ml4k WITH PASSWORD 'testdbpwd' LOGIN;"
psql -c "CREATE DATABASE mlforkidsdb OWNER ml4k;"
psql -U ml4k -f sql/postgresql.sql mlforkidsdb
```

Or use your own preferred PostgreSQL client.

## Step 4 - Set up your environment variables

There are a few environment variables required to enable connections to the database.

|                 | Used for | Example |
| --------------- | -------- | ------- |
| `POSTGRESQLHOST`     | Hostname/address of the database server | `localhost`     |
| `POSTGRESQLPORT`     | Port number for the database server     | `3306`          |
| `POSTGRESQLUSER`     | Username to connect to the database as  | `mlforkidsuser` |
| `POSTGRESQLPASSWORD` | Password for connecting to the database. Optional. Don't set this if you don't have a password | `mlforkidspassword` |
| `POSTGRESQLDATABASE` | Name of the database you are using      | `mlforkidsdb` |

There are also a couple of environment variables used by the web server.

|                 | Used for | Example |
| --------------- | -------- | ------- |
| `PORT`          | Port number for the web site and admin API | `3000`      |
| `HOST`          | Hostname / address                         | `localhost` |

So, you could do something like this:

```
export POSTGRESQLHOST=localhost
export POSTGRESQLPORT=5432
export POSTGRESQLUSER=dbuser
export POSTGRESQLPASSWORD=dbpass
export POSTGRESQLDATABASE=mlforkidsdb

export PORT=3000
export HOST=localhost
```

## Step 5 - Build the code

This step will require Internet access.

```
npm install
npm run build
```

## Step 6 - Run the site!

```
npm start
```

The website should be running at the host and port you requested in the environment variables.
