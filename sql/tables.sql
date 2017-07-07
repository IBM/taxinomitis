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
    VALUES ('7f22d1eb-4802-4579-bb05-2d2272130caf', 'apple', 'conv', 'https://gateway.watsonplatform.net/conversation/api', 'e39cac0a-c475-413e-b59c-b257bf143990', 'yPtMkysDr0nU');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('22629408-6333-11e7-907b-a6006ad3dba0', 'apple', 'conv', 'https://gateway.watsonplatform.net/conversation/api', '8b85ef88-a91c-4da3-bf68-66d6b6597b35', 'JBSO3rsBlTiZ');

CREATE INDEX bluemixcredentials_getBluemixCredentials on bluemixcredentials(classid, servicetype) using HASH;


-- ------------------------------------------------------------------

CREATE TABLE bluemixclassifiers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    credentialsid VARCHAR(36) NOT NULL,
    userid CHAR(36) NOT NULL,
    projectid CHAR(36) NOT NULL,
    classid CHAR(36) NOT NULL,
    servicetype VARCHAR(8) NOT NULL,
    classifierid VARCHAR(36) NOT NULL,
    url VARCHAR(200) NOT NULL,
    name VARCHAR(100),
    language VARCHAR(5),
    created DATETIME NOT NULL
);

CREATE INDEX bluemixclassifiers_getServiceCredentials on bluemixclassifiers(servicetype, classifierid, projectid, classid, userid) using HASH;
CREATE INDEX bluemixclassifiers_deleteNLCClassifier on bluemixclassifiers(projectid, userid, classid, classifierid) using HASH;
CREATE INDEX bluemixclassifiers_countNLCClassifiers on bluemixclassifiers(classid) using HASH;


-- ------------------------------------------------------------------

CREATE TABLE taxinoclassifiers (
    projectid CHAR(36) NOT NULL PRIMARY KEY,
    userid CHAR(36) NOT NULL,
    classid CHAR(36) NOT NULL,
    created DATETIME NOT NULL,
    status TINYINT NOT NULL
);



-- ------------------------------------------------------------------

CREATE TABLE scratchkeys (
    id CHAR(72) NOT NULL PRIMARY KEY,
    projectname VARCHAR(36) NOT NULL,
    projecttype VARCHAR(8) NOT NULL,
    serviceurl VARCHAR(200),
    serviceusername VARCHAR(36),
    servicepassword VARCHAR(36),
    classifierid VARCHAR(36),
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
    maxprojectsperuser TINYINT UNSIGNED NOT NULL DEFAULT 3
);

INSERT INTO tenants (id) VALUES ("apple");
INSERT INTO tenants (id, projecttypes) VALUES ("TESTTENANT", "text,images,numbers");
