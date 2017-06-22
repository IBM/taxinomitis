-- \connect mysql://admin:FEIOHLDSRJHYDHEF@bluemix-sandbox-dal-9-portal.8.dblayer.com:25521/compose
-- \sql

use mlforkidsdb;

-- ------------------------------------------------------------------

CREATE TABLE projects (
    id CHAR(36) NOT NULL PRIMARY KEY,
    userid CHAR(36) NOT NULL,
    classid CHAR(36) NOT NULL,
    typeid TINYINT NOT NULL,
    name VARCHAR(36) NOT NULL,
    labels VARCHAR(500) NOT NULL,
    fields VARCHAR(128)
);

CREATE INDEX projects_getCurrentLabels on projects(id, userid, classid) using HASH;
CREATE INDEX projects_getProjectsByUserId on projects(classid, userid) using HASH;


-- ------------------------------------------------------------------

CREATE TABLE texttraining (
    id CHAR(36) NOT NULL PRIMARY KEY,
    projectid CHAR(36) NOT NULL,
    textdata VARCHAR(1024) NOT NULL,
    label VARCHAR(100)
);

CREATE INDEX texttraining_renameTextTraining on texttraining(projectid, label) using HASH;
CREATE INDEX texttraining_getTextTraining on texttraining(projectid, label, textdata) using BTREE;
CREATE INDEX texttraining_getTrainingLabels on texttraining(projectid) using HASH;


CREATE TABLE numbertraining (
    id CHAR(36) NOT NULL PRIMARY KEY,
    projectid CHAR(36) NOT NULL,
    numberdata VARCHAR(1024) NOT NULL,
    label VARCHAR(100)
);

CREATE INDEX numbertraining_getNumberTraining on numbertraining(projectid, label) using BTREE;


-- ------------------------------------------------------------------

CREATE TABLE bluemixcredentials (
    id CHAR(36) NOT NULL PRIMARY KEY,
    classid CHAR(36) NOT NULL,
    servicetype VARCHAR(8) NOT NULL,
    url VARCHAR(200) NOT NULL,
    username VARCHAR(36),
    password VARCHAR(36)
);
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('c3680a60-3d98-11e7-a919-92ebcb67fe33', 'apple', 'nlc', 'https://gateway.watsonplatform.net/natural-language-classifier/api', '83b3dd09-ea85-4e77-bc42-b3520d0aaf72', 'WnDv8SB6LyB8');

CREATE INDEX bluemixcredentials_getBluemixCredentials on bluemixcredentials(classid, servicetype) using HASH;


-- ------------------------------------------------------------------

CREATE TABLE bluemixclassifiers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    credentialsid VARCHAR(36) NOT NULL,
    userid CHAR(36) NOT NULL,
    projectid CHAR(36) NOT NULL,
    classid CHAR(36) NOT NULL,
    servicetype VARCHAR(8) NOT NULL,
    classifierid VARCHAR(20) NOT NULL,
    url VARCHAR(200) NOT NULL,
    name VARCHAR(100),
    language VARCHAR(5),
    created DATETIME NOT NULL
);

CREATE INDEX bluemixclassifiers_getServiceCredentials on bluemixclassifiers(servicetype, classifierid, projectid, classid, userid) using HASH;
CREATE INDEX bluemixclassifiers_deleteNLCClassifier on bluemixclassifiers(projectid, userid, classid, classifierid) using HASH;
CREATE INDEX bluemixclassifiers_countNLCClassifiers on bluemixclassifiers(classid) using HASH;


-- ------------------------------------------------------------------

CREATE TABLE scratchkeys (
    id CHAR(72) NOT NULL PRIMARY KEY,
    projectname VARCHAR(36) NOT NULL,
    projecttype VARCHAR(8) NOT NULL,
    serviceurl VARCHAR(200),
    serviceusername VARCHAR(36),
    servicepassword VARCHAR(36),
    classifierid VARCHAR(20),
    projectid CHAR(36) NOT NULL,
    userid CHAR(36) NOT NULL,
    classid CHAR(36) NOT NULL
);

CREATE INDEX scratchkeys_updateScratchKey on scratchkeys(id, userid, projectid, classid) using HASH;
CREATE INDEX scratchkeys_findScratchKeys on scratchkeys(projectid, userid, classid) using HASH;


-- ------------------------------------------------------------------

CREATE TABLE tenants (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    projecttypes VARCHAR(25) NOT NULL DEFAULT 'text',
    maxusers TINYINT UNSIGNED NOT NULL DEFAULT 8,
    maxprojectsperuser TINYINT UNSIGNED NOT NULL DEFAULT 3,
    maxnlcclassifiers TINYINT UNSIGNED NOT NULL DEFAULT 10,
    nlcexpirydays TINYINT UNSIGNED NOT NULL DEFAULT 14
);

INSERT INTO tenants (id) VALUES ("apple");
INSERT INTO tenants (id, projecttypes) VALUES ("TESTTENANT", "text,images,numbers");
