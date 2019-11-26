-- CREATE DATABASE mlforkidsdb CHARACTER SET latin1 COLLATE latin1_swedish_ci;

-- ------------------------------------------------------------------

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
    numfields TINYINT NOT NULL,
    iscrowdsourced BOOLEAN DEFAULT false
);

CREATE INDEX projects_getCurrentLabels on projects(id, userid, classid);
CREATE INDEX projects_getProjectsByUserId on projects(classid, userid, iscrowdsourced);



CREATE TABLE numbersprojectsfields (
    id CHAR(36) NOT NULL PRIMARY KEY,
    userid CHAR(36) NOT NULL,
    classid CHAR(36) NOT NULL,
    projectid CHAR(36) NOT NULL,
    name VARCHAR(12) NOT NULL,
    fieldtype TINYINT NOT NULL,
    choices VARCHAR(50)
);

CREATE INDEX numbersprojectsfields_getByProjectId on numbersprojectsfields(userid, classid, projectid);

-- ------------------------------------------------------------------

CREATE TABLE texttraining (
    id CHAR(36) NOT NULL PRIMARY KEY,
    projectid CHAR(36) NOT NULL,
    textdata VARCHAR(1024) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    label VARCHAR(100)
);

-- we use utf-8 instead of the default Latin for this column so we can store accented characters

CREATE INDEX texttraining_renameTextTraining on texttraining(projectid, label);
CREATE INDEX texttraining_getTrainingLabels on texttraining(projectid);


CREATE TABLE numbertraining (
    id CHAR(36) NOT NULL PRIMARY KEY,
    projectid CHAR(36) NOT NULL,
    numberdata VARCHAR(1024) NOT NULL,
    label VARCHAR(100)
);

CREATE INDEX numbertraining_getNumberTraining on numbertraining(projectid, label);


CREATE TABLE imagetraining (
    id CHAR(36) NOT NULL PRIMARY KEY,
    projectid CHAR(36) NOT NULL,
    imageurl VARCHAR(1024) NOT NULL,
    label VARCHAR(100),
    isstored BOOLEAN DEFAULT false
);

CREATE INDEX imagetraining_getImageTraining on imagetraining(projectid, label, imageurl(250));
CREATE INDEX imagetraining_getTrainingLabels on imagetraining(projectid);


CREATE TABLE soundtraining (
    id CHAR(36) NOT NULL PRIMARY KEY,
    projectid CHAR(36) NOT NULL,
    label VARCHAR(100),
    audiourl VARCHAR(185)
);

CREATE INDEX soundtraining_getSoundTraining on soundtraining(projectid, label);
CREATE INDEX soundtraining_getTrainingLabels on soundtraining(projectid);


-- ------------------------------------------------------------------

CREATE TABLE bluemixcredentials (
    id CHAR(36) NOT NULL PRIMARY KEY,
    classid CHAR(36) NOT NULL,
    servicetype VARCHAR(8) NOT NULL,
    url VARCHAR(200) NOT NULL,
    username VARCHAR(36),
    password VARCHAR(36),
    credstypeid TINYINT NOT NULL DEFAULT 0,
    notes VARCHAR(50)
);

CREATE INDEX bluemixcredentials_getBluemixCredentials on bluemixcredentials(classid, servicetype);

INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password)
    VALUES
    -- This is a placeholder row used for unit tests - it's obviously not a real username/password.
    ('01cf0343-6bd7-4732-95f0-8c8dbc0be922', 'testing', 'conv', 'https://gateway.watsonplatform.net/conversation/api', '00000000-1111-2222-3333-444444444444', '56789abcdef0'),
    -- This is a placeholder row used for unit tests - it's obviously not a real API key.
    ('3a9a71ab-de77-4912-b0b0-f0c9698d9245', 'testing', 'visrec', 'https://gateway.watsonplatform.net/visual-recognition/api', 'AbCdEfGhIjKlMnOpQrStUv', 'WxYz0123456789AbCdEfGh');

-- ------------------------------------------------------------------

CREATE TABLE bluemixclassifiers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    credentialsid VARCHAR(36) NOT NULL,
    userid CHAR(36) NOT NULL,
    projectid CHAR(36) NOT NULL,
    classid CHAR(36) NOT NULL,
    servicetype VARCHAR(8) NOT NULL,
    classifierid VARCHAR(52) NOT NULL,
    url VARCHAR(200) NOT NULL,
    name VARCHAR(100),
    language VARCHAR(5),
    created DATETIME NOT NULL,
    expiry DATETIME NOT NULL
);

CREATE INDEX bluemixclassifiers_getServiceCredentials on bluemixclassifiers(servicetype, classifierid, projectid, classid, userid);
CREATE INDEX bluemixclassifiers_deleteNLCClassifier on bluemixclassifiers(projectid, userid, classid, classifierid);
CREATE INDEX bluemixclassifiers_countNLCClassifiers on bluemixclassifiers(classid);
CREATE INDEX bluemixclassifiers_getClassifier on bluemixclassifiers(projectid, classifierid);


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
    classifierid VARCHAR(52),
    projectid CHAR(36) NOT NULL,
    userid CHAR(36) NOT NULL,
    classid CHAR(36) NOT NULL,
    updated DATETIME NOT NULL
);

CREATE INDEX scratchkeys_updateScratchKey on scratchkeys(id, userid, projectid, classid);
CREATE INDEX scratchkeys_findScratchKeys on scratchkeys(projectid, userid, classid);
CREATE INDEX scratchkeys_resetExpiredScratchKey on scratchkeys(classifierid, projectid);


-- ------------------------------------------------------------------

CREATE TABLE pendingjobs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    jobtype TINYINT UNSIGNED NOT NULL,
    jobdata VARCHAR(512) NOT NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    lastattempt DATETIME
);


-- ------------------------------------------------------------------

CREATE TABLE knownsyserrors (
    id CHAR(36) NOT NULL PRIMARY KEY,
    type TINYINT UNSIGNED NOT NULL,
    servicetype VARCHAR(8) NOT NULL,
    objid VARCHAR(50) NOT NULL
);


-- ------------------------------------------------------------------

CREATE TABLE notificationoptouts (
    id CHAR(36) NOT NULL PRIMARY KEY
);

CREATE TABLE disruptivetenants (
    id CHAR(36) NOT NULL PRIMARY KEY
);


-- ------------------------------------------------------------------

CREATE TABLE tenants (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    projecttypes VARCHAR(26) NOT NULL DEFAULT 'text,numbers,sounds',
    maxusers TINYINT UNSIGNED NOT NULL DEFAULT 8,
    maxprojectsperuser TINYINT UNSIGNED NOT NULL DEFAULT 3,
    textclassifiersexpiry TINYINT UNSIGNED NOT NULL DEFAULT 2,
    imageclassifiersexpiry TINYINT UNSIGNED NOT NULL DEFAULT 1,
    ismanaged BOOLEAN DEFAULT true
);

INSERT INTO tenants (id, projecttypes, maxusers, maxprojectsperuser, textclassifiersexpiry, ismanaged)
    VALUES
        ('TESTTENANT', 'text,images,numbers,sounds', 8, 3, 2, true),
        ('UNIQUECLASSID', 'text,numbers', 8, 3, 2, true),
        ('session-users', 'text,numbers,sounds', 5, 1, 4, true);

-- ------------------------------------------------------------------

CREATE TABLE sessionusers (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    token VARCHAR(36) NOT NULL,
    sessionexpiry DATETIME
);

-- ------------------------------------------------------------------

CREATE TABLE sitealerts (
    timestamp DATETIME NOT NULL PRIMARY KEY,
    severityid TINYINT UNSIGNED NOT NULL,
    audienceid TINYINT UNSIGNED NOT NULL,
    message VARCHAR(280) NOT NULL,
    url VARCHAR(280) NOT NULL,
    expiry DATETIME NOT NULL
);
