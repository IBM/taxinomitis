# Developer's Guide

These instructions should let you get a copy of the code running.

They are:
1. Get the dependencies
2. Get the source code
3. Prepare a PostgreSQL database
4. Prepare environment variables
5. Build the code
6. Run the code

[![Video walkthrough](https://img.youtube.com/vi/Ss3e6yCWOhU/0.jpg)](https://www.youtube.com/watch?v=Ss3e6yCWOhU "Video walkthrough")

## Step 1 - Get the dependencies

To run the site, you need:
- Node.js version 16
- PostgreSQL version 12

## Step 2 - Get the code

`git clone https://github.com/IBM/taxinomitis.git`

## Step 3 - Create your database

The site stores information in a PostgreSQL database. An SQL script is provided in `sql/postgresql.sql` to set up the expected database tables and indexes.

You can use it like this:
```sh
psql -c "CREATE USER ml4kdbuser WITH PASSWORD 'ml4kdbpwd' LOGIN;"
psql -c "CREATE DATABASE mlforkidsdb OWNER ml4kdbuser;"
psql -U ml4kdbuser -f ./mlforkids-api/sql/postgresql.sql -d mlforkidsdb
```

Or use the sql file with your preferred PostgreSQL client.

## Step 4 - Set up your environment variables

There are a few environment variables required to enable connections to the database.

|                      | Used for                                           | Example         |
| -------------------- | -------------------------------------------------- | --------------- |
| `POSTGRESQLHOST`     | Hostname/address of the database server            | `localhost`     |
| `POSTGRESQLPORT`     | Port number for the database server                | `5432`          |
| `POSTGRESQLUSER`     | Username to connect to the database as             | `ml4kdbuser`    |
| `POSTGRESQLPASSWORD` | Password for connecting to the database. Optional. | `ml4kdbpwd`     |
| `POSTGRESQLDATABASE` | Name of the database you are using                 | `mlforkidsdb`   |

There are also a couple of environment variables used by the web server.

|        | Used for                                   | Example     |
| ------ | ------------------------------------------ | ----------- |
| `PORT` | Port number for the web site and admin API | `3000`      |
| `HOST` | Hostname / address                         | `localhost` |

So, you could do something like this:

```sh
export POSTGRESQLHOST=localhost
export POSTGRESQLPORT=5432
export POSTGRESQLUSER=ml4kdbuser
export POSTGRESQLPASSWORD=ml4kdbpwd
export POSTGRESQLDATABASE=mlforkidsdb

export PORT=3000
export HOST=localhost
```

## Step 5 (option a) - Build the code

This step will require Internet access.

```sh
cd mlforkids-api
npm install
npm run build_notest
```

## Step 5 (option b) - Build the code and run the tests

This step will require Internet access.

First, seed the database with test data.
```sh
psql -U ml4kdbuser -d mlforkidsdb -f ./mlforkids-api/sql/testdata.sql
```

Then build and run the tests
```sh
cd mlforkids-api
npm run build
```

(Note: Test data will be visible in the UI if you use the same database for tests and the live site)


## Step 6 - Run the site!

```sh
cd mlforkids-api
npm start
```

The website should be running at the host and port you requested in the environment variables.
