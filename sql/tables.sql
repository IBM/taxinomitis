-- local
-- \connect mysql://root:lO7BforYiu9x@localhost:3306

-- dev
-- \connect mysql://admin:AHTQFXRUIQKHYNLJ@bluemix-sandbox-dal-9-portal.6.dblayer.com:28940/compose

-- prod
-- \connect mysql://admin:ZLLIDCRHUXXAISWD@bluemix-sandbox-dal-9-portal.8.dblayer.com:28820/compose


-- \sql

use mlforkidsdb;

-- ------------------------------------------------------------------

CREATE TABLE projects (
    id CHAR(36) NOT NULL PRIMARY KEY,
    userid CHAR(36) NOT NULL,
    classid CHAR(36) NOT NULL,
    typeid TINYINT NOT NULL,
    name VARCHAR(36) NOT NULL,
    language CHAR(6),
    labels VARCHAR(500) NOT NULL,
    numfields TINYINT NOT NULL
);

CREATE INDEX projects_getCurrentLabels on projects(id, userid, classid) using HASH;
CREATE INDEX projects_getProjectsByUserId on projects(classid, userid) using HASH;



CREATE TABLE numbersprojectsfields (
    id CHAR(36) NOT NULL PRIMARY KEY,
    userid CHAR(36) NOT NULL,
    classid CHAR(36) NOT NULL,
    projectid CHAR(36) NOT NULL,
    name VARCHAR(12) NOT NULL,
    fieldtype TINYINT NOT NULL,
    choices VARCHAR(50)
);

CREATE INDEX numbersprojectsfields_getByProjectId on numbersprojectsfields(userid, classid, projectid) using HASH;

-- ------------------------------------------------------------------

CREATE TABLE texttraining (
    id CHAR(36) NOT NULL PRIMARY KEY,
    projectid CHAR(36) NOT NULL,
    textdata VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    label VARCHAR(100)
);

-- we use utf-8 instead of the default Latin for this column so we can store accented characters

CREATE INDEX texttraining_renameTextTraining on texttraining(projectid, label) using HASH;
CREATE INDEX texttraining_getTrainingLabels on texttraining(projectid) using HASH;


CREATE TABLE numbertraining (
    id CHAR(36) NOT NULL PRIMARY KEY,
    projectid CHAR(36) NOT NULL,
    numberdata VARCHAR(1024) NOT NULL,
    label VARCHAR(100)
);

CREATE INDEX numbertraining_getNumberTraining on numbertraining(projectid, label) using BTREE;


CREATE TABLE imagetraining (
    id CHAR(36) NOT NULL PRIMARY KEY,
    projectid CHAR(36) NOT NULL,
    imageurl VARCHAR(1024) NOT NULL,
    label VARCHAR(100)
);

CREATE INDEX imagetraining_getImageTraining on imagetraining(projectid, label, imageurl) using BTREE;
CREATE INDEX imagetraining_getTrainingLabels on imagetraining(projectid) using HASH;

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

INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('72a73ed6-6da2-11e7-907b-a6006ad3dba0', 'demo', 'conv', 'https://gateway.watsonplatform.net/conversation/api', '8a2f768a-665e-48ee-8dbf-48dce24148aa', 'JWJ4kSwrWyHr');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('21da1a33-8f22-4897-b3f1-0285ed65572e', 'demo', 'conv', 'https://gateway.watsonplatform.net/conversation/api', 'f271d2b7-a222-418d-a0af-be11af5fb105', 'JhfYyBBEDm5r');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password, notes)
    VALUES ('8a41757e-048a-4c59-aaaa-0b32f45b6a2c', 'demo', 'conv', 'https://gateway.watsonplatform.net/conversation/api', '04ee421c-f20a-446b-81e6-26adce6c9612', 'YvjeeFVHaEFw', 'us dale.lane ml-for-kids-prod mlforkids-demo-03');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password, notes)
    VALUES ('48cb2124-37f4-4040-8027-db6153f4ee79', 'demo', 'conv', 'https://gateway.watsonplatform.net/conversation/api', '94fea431-bd7f-4565-891d-ac45e945be61', 'vvttkHe3XgZU', 'us dale.lane ml-for-kids-prod mlforkids-demo-04');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('0ee0778f-aa88-44b0-9b9b-7610a83e078c', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '1d6947bd5a5390f71374', '898de44983d621dc331f');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('0a6d0d84-7cfa-11e7-bb31-be2e44b06b34', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', 'f94181fa0607c47282ec', '544ecdb38c693ce0f127');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('79b25d90-619b-47fd-8d0f-93a460439f92', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '66e4464a9d30426ff685', 'c7e6e645fe4398b37212');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('f3b5fbaf-a1b0-46e0-93fb-3e9a7b6d7be6', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '0ed2a91a88d7940b14d7', 'a27e5a49703b7dae9ef6');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('6f00d0d0-72a6-428f-a4cd-e6f08d7f925f', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '60055e307e2760555188', '113a84c0693ecc535e5d');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('bd3e8cc7-5e59-47af-a706-91298be9c8ad', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '16977f335748b73b7e41', 'd5c976dbbe6094884889');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('41f14dbe-fd50-4891-b65b-e33d979a0091', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '96f709a720f477cde355', 'a97498932d8cae5a410c');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('b02ec247-1cd8-4d75-8b62-6ffad4fcfd32', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '018553eb0ab9f51974d6', '0fab7a7e3614d0042532');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('1441579c-4d35-4072-994f-d0feecc8b54c', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', 'f61b9fdb368d637798a7', '9cd84991fcedd8d4fc65');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('e722c78a-2991-40cf-b578-8d3efe1a874b', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '469e2ff825c25eee8f9e', 'd96dd9a507ed223c37f7');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('41427781-99ab-4a49-8174-a70b4ecb4572', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '4b9dd10867fa7de770c5', 'c75dcb19271e8334d528');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('31444d49-feb1-4b37-bcd7-f4d46d438eaf', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '1af02c2aa0067a207833', '0da03bb9e342ca9726a8');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('94c9db60-1a36-46c6-a9d6-ab9d4c9c6287', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', 'b61cfa3bb8cc6b97e040', '5b7c5efc11606c144d62');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('5558d5eb-c06b-4eb8-b2e8-12655a03e0e7', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', 'd421d8bf9b59ba2ee938', '89c8c55d4d27c9130abb');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('0e4cc484-9449-455d-bf6b-6e8308712769', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '4096770995c986b2f448', 'bf0ce8e7f3a32952e236');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('56385a7b-e043-4c35-8c9f-47d82818763f', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '42ba3913193010b20b55', 'b2ab422e9a2fea55b631');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('131ed829-ea05-4e50-9d43-dfdd5033f5ec', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', 'c9538a4b1dd644dae43e', 'ecb54b03e420bc097671');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('11f9f37d-6db4-4374-a3e8-344af67ce722', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '42914ef5e41c002a97f0', 'f248c75d36c21f746b2b');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES ('3f485b45-90ed-4315-a54d-7e394dd780fb', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '6755554187de9449c07f', '1bb66fe8636f252a82ba');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password, notes)
    VALUES ('9df4dd29-d019-407f-858c-01e53a93a7cb', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '18728e0eb607336a9fcb', '0f567f352acf5c59f8a5', 'knolleary-1');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password, notes)
    VALUES ('edc5fe67-44d7-48a6-ad65-14d22de9c5bb', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '7baeab033c2ffbf9621a', '7442ae269252be1dca1e', 'knolleary-2');
INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password, notes)
    VALUES ('2c5344c4-6f61-4cfc-bf39-f807ec35f418', 'demo', 'visrec', 'https://gateway-a.watsonplatform.net/visual-recognition/api', '066f2255ce318c42d462', '3db105211d205b3fbb2c', 'knolleary-3');





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
    created DATETIME NOT NULL,
    expiry DATETIME NOT NULL
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
    projecttypes VARCHAR(25) NOT NULL DEFAULT 'text,numbers',
    maxusers TINYINT UNSIGNED NOT NULL DEFAULT 8,
    maxprojectsperuser TINYINT UNSIGNED NOT NULL DEFAULT 3,
    textclassifiersexpiry TINYINT UNSIGNED NOT NULL DEFAULT 2,
    imageclassifiersexpiry TINYINT UNSIGNED NOT NULL DEFAULT 1,
    ismanaged BOOLEAN DEFAULT true
);

INSERT INTO tenants (id, projecttypes) VALUES ("TESTTENANT", "text,images,numbers");
