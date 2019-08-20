# Developer's Guide

These instructions should let you get a copy of the code running.

They are:
1. Get the dependencies
2. Get the source code
3. Prepare a MySQL database
4. Prepare environment variables
5. Build the code
6. Run the code


## Step 1 - Get the dependencies

To run the site, you need:
- Node.js version 10
- MySQL version 5.7

## Step 2 - Get the code

`git clone git@github.com:IBM/taxinomitis.git`

## Step 3 - Create your database

The site stores information in a MySQL database. An SQL script is provided in `sql/tables.sql` to set up the expected database tables.

You can use it like this:
```
mysql -u YOUR-MYSQL-USERNAME --password=YOUR-MYSQL-PASSWORD -e 'DROP DATABASE IF EXISTS mlforkidsdb;'
mysql -u YOUR-MYSQL-USERNAME --password=YOUR-MYSQL-PASSWORD -e 'CREATE DATABASE mlforkidsdb CHARACTER SET latin1 COLLATE latin1_swedish_ci;'
mysql -u YOUR-MYSQL-USERNAME --password=YOUR-MYSQL-PASSWORD < sql/tables.sql
```

Or use your own preferred MySQL client.

## Step 4 - Set up your environment variables

There are a few environment variables required to enable connections to the database.

|                 | Used for | Example |
| --------------- | -------- | ------- |
| `MYSQLHOST`     | Hostname/address of the database server | `localhost`     |
| `MYSQLPORT`     | Port number for the database server     | `3306`          |
| `MYSQLUSER`     | Username to connect to the database as  | `mlforkidsuser` |
| `MYSQLPASSWORD` | Password for connecting to the database. Optional. Don't set this if you don't have a password | `mlforkidspassword` |
| `MYSQLDATABASE` | Name of the database you are using      | `mlforkidsdb` |

There are also a couple of environment variables used by the web server.

|                 | Used for | Example |
| --------------- | -------- | ------- |
| `PORT`          | Port number for the web site and admin API | `3000`      |
| `HOST`          | Hostname / address                         | `localhost` |

So, you could do something like this:

```
export MYSQLHOST=localhost
export MYSQLPORT=3306
export MYSQLUSER=dbuser
export MYSQLPASSWORD=dbpass
export MYSQLDATABASE=mlforkidsdb

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
