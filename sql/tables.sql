-- \connect mysql://admin:FEIOHLDSRJHYDHEF@bluemix-sandbox-dal-9-portal.8.dblayer.com:25521/compose
-- \sql

use mlforkidsdb;

CREATE TABLE projects (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    userid VARCHAR(36) NOT NULL,
    classid VARCHAR(36) NOT NULL,
    typeid TINYINT NOT NULL,
    name VARCHAR(36) NOT NULL,
    labels VARCHAR(500) NOT NULL
);

CREATE TABLE texttraining (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    projectid VARCHAR(36) NOT NULL,
    textdata VARCHAR(1024) NOT NULL,
    label VARCHAR(100)
);

CREATE TABLE bluemixcredentials (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    classid VARCHAR(36) NOT NULL,
    servicetype VARCHAR(8) NOT NULL,
    url VARCHAR(200) NOT NULL,
    username VARCHAR(36),
    password VARCHAR(36)
);
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('c3680a60-3d98-11e7-a919-92ebcb67fe33', 'apple', 'nlc', 'https://gateway.watsonplatform.net/natural-language-classifier/api', '83b3dd09-ea85-4e77-bc42-b3520d0aaf72', 'WnDv8SB6LyB8');

CREATE TABLE bluemixclassifiers (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    credentialsid VARCHAR(36) NOT NULL,
    userid VARCHAR(36) NOT NULL,
    projectid VARCHAR(36) NOT NULL,
    classid VARCHAR(36) NOT NULL,
    servicetype VARCHAR(8) NOT NULL,
    classifierid VARCHAR(20) NOT NULL,
    url VARCHAR(200) NOT NULL,
    name VARCHAR(100),
    language VARCHAR(5),
    created DATETIME NOT NULL
);
