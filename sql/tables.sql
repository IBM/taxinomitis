-- \connect mysql://admin:FEIOHLDSRJHYDHEF@bluemix-sandbox-dal-9-portal.8.dblayer.com:25521/compose
-- \sql

use mkforkidsdb;

CREATE TABLE projects (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    userid VARCHAR(36) NOT NULL,
    classid VARCHAR(36) NOT NULL,
    typeid TINYINT NOT NULL,
    name VARCHAR(36) NOT NULL
);

CREATE TABLE texttraining (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    projectid VARCHAR(36) NOT NULL,
    textdata VARCHAR(1024) NOT NULL, 
    label VARCHAR(100)
);
