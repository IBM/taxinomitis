SELECT pg_catalog.set_config('search_path', '', false);

CREATE SCHEMA mlforkidsdb;

CREATE TABLE mlforkidsdb.bluemixclassifiers (
    id character varying(36) NOT NULL PRIMARY KEY,
    credentialsid character varying(36) NOT NULL,
    userid character varying(36) NOT NULL,
    projectid character varying(36) NOT NULL,
    classid character varying(36) NOT NULL,
    servicetype character varying(8) NOT NULL,
    classifierid character varying(52) NOT NULL,
    url character varying(200) NOT NULL,
    name character varying(100),
    language character varying(5),
    created timestamp with time zone NOT NULL,
    expiry timestamp with time zone NOT NULL
);

CREATE TABLE mlforkidsdb.bluemixcredentials (
    id character varying(36) NOT NULL PRIMARY KEY,
    classid character varying(36) NOT NULL,
    servicetype character varying(8) NOT NULL,
    url character varying(200) NOT NULL,
    username character varying(36),
    password character varying(36),
    credstypeid smallint NOT NULL,
    notes character varying(50)
);

CREATE TABLE mlforkidsdb.bluemixcredentialspool (
    id character varying(36) NOT NULL PRIMARY KEY,
    servicetype character varying(8) NOT NULL,
    url character varying(200) NOT NULL,
    username character varying(36),
    password character varying(36),
    credstypeid smallint DEFAULT '0'::smallint NOT NULL,
    notes character varying(50) NOT NULL,
    lastfail timestamp with time zone NOT NULL
);

CREATE TABLE mlforkidsdb.imagetraining (
    id character(36) NOT NULL PRIMARY KEY,
    projectid character varying(36) NOT NULL,
    imageurl character varying(1024) NOT NULL,
    label character varying(100),
    isstored boolean DEFAULT false
);

CREATE TABLE mlforkidsdb.knownsyserrors (
    id character(36) NOT NULL PRIMARY KEY,
    type smallint NOT NULL,
    servicetype character varying(8) NOT NULL,
    objid character varying(50) NOT NULL
);

CREATE TABLE mlforkidsdb.numbersprojectsfields (
    id character(36) NOT NULL PRIMARY KEY,
    userid character varying(36) NOT NULL,
    classid character varying(36) NOT NULL,
    projectid character varying(36) NOT NULL,
    name character varying(12) NOT NULL,
    fieldtype smallint NOT NULL,
    choices character varying(125)
);
-- update (27 Dec 2022)
-- ALTER TABLE numbersprojectsfields ALTER COLUMN choices TYPE character varying(125);

CREATE TABLE mlforkidsdb.numbertraining (
    id character(36) NOT NULL PRIMARY KEY,
    projectid character varying(36) NOT NULL,
    numberdata character varying(1024) NOT NULL,
    label character varying(100)
);

CREATE TABLE mlforkidsdb.pendingjobs (
    id character(36) NOT NULL PRIMARY KEY,
    jobtype smallint NOT NULL,
    jobdata character varying(512) NOT NULL,
    attempts smallint DEFAULT '0'::smallint NOT NULL,
    lastattempt timestamp with time zone
);

CREATE TABLE mlforkidsdb.projects (
    id character varying(36) NOT NULL PRIMARY KEY,
    userid character varying(36) NOT NULL,
    classid character varying(36) NOT NULL,
    typeid smallint NOT NULL,
    name character varying(36) NOT NULL,
    language character varying(6),
    labels character varying(500) NOT NULL,
    numfields smallint NOT NULL,
    iscrowdsourced boolean DEFAULT false,

    fields character varying(500)
);

CREATE TABLE mlforkidsdb.scratchkeys (
    id character(72) NOT NULL PRIMARY KEY,
    projectname character varying(36) NOT NULL,
    projecttype character varying(8) NOT NULL,
    serviceurl character varying(200),
    serviceusername character varying(36),
    servicepassword character varying(36),
    classifierid character varying(52),
    projectid character varying(36) NOT NULL,
    userid character varying(36) NOT NULL,
    classid character varying(36) NOT NULL,
    updated timestamp with time zone
);

CREATE TABLE mlforkidsdb.sessionusers (
    id character varying(36) NOT NULL PRIMARY KEY,
    token character varying(36) NOT NULL,
    sessionexpiry timestamp with time zone
);

CREATE TABLE mlforkidsdb.sitealerts (
    "timestamp" timestamp with time zone NOT NULL PRIMARY KEY,
    severityid smallint NOT NULL,
    audienceid smallint NOT NULL,
    message character varying(280) NOT NULL,
    url character varying(280) NOT NULL,
    expiry timestamp with time zone NOT NULL
);

CREATE TABLE mlforkidsdb.soundtraining (
    id character(36) NOT NULL PRIMARY KEY,
    projectid character varying(36) NOT NULL,
    label character varying(100),
    audiourl character varying(185)
);

CREATE TABLE mlforkidsdb.taxinoclassifiers (
    projectid character varying(36) NOT NULL PRIMARY KEY,
    userid character varying(36) NOT NULL,
    classid character varying(36) NOT NULL,
    created timestamp with time zone NOT NULL,
    status smallint NOT NULL
);

CREATE TABLE mlforkidsdb.tenants (
    id character varying(36) NOT NULL PRIMARY KEY,
    projecttypes character varying(34) DEFAULT 'text,imgtfjs,numbers,sounds'::character varying NOT NULL,
    maxusers smallint DEFAULT '8'::smallint NOT NULL,
    maxprojectsperuser smallint DEFAULT '3'::smallint NOT NULL,
    textclassifiersexpiry smallint DEFAULT '2'::smallint NOT NULL,
    ismanaged smallint DEFAULT '2'::smallint NOT NULL
);
-- update (2 Jan 2023)
-- ALTER TABLE tenants DROP COLUMN imageclassifiersexpiry;


CREATE TABLE mlforkidsdb.texttraining (
    id character(36) NOT NULL PRIMARY KEY,
    projectid character varying(36) NOT NULL,
    textdata character varying(1024) NOT NULL,
    label character varying(100)
);

CREATE INDEX bluemixclassifiers_countnlcclassifiers ON mlforkidsdb.bluemixclassifiers USING btree (classid);
CREATE INDEX bluemixclassifiers_deletenlcclassifier ON mlforkidsdb.bluemixclassifiers USING btree (projectid, userid, classid, classifierid);
CREATE INDEX bluemixclassifiers_getclassifier ON mlforkidsdb.bluemixclassifiers USING btree (projectid, classifierid);
CREATE INDEX bluemixclassifiers_getservicecredentials ON mlforkidsdb.bluemixclassifiers USING btree (servicetype, classifierid, projectid, classid, userid);
CREATE INDEX bluemixcredentials_getbluemixcredentials ON mlforkidsdb.bluemixcredentials USING btree (classid, servicetype);
CREATE INDEX bluemixcredentialspool_getbluemixcredentials ON mlforkidsdb.bluemixcredentialspool USING btree (servicetype, lastfail);
CREATE INDEX imagetraining_getimagetraining ON mlforkidsdb.imagetraining USING btree (projectid, label, substr(imageurl, 250));
CREATE INDEX imagetraining_gettraininglabels ON mlforkidsdb.imagetraining USING btree (projectid);
CREATE INDEX numbersprojectsfields_getbyprojectid ON mlforkidsdb.numbersprojectsfields USING btree (userid, classid, projectid);
CREATE INDEX numbertraining_getnumbertraining ON mlforkidsdb.numbertraining USING btree (projectid, label);
CREATE INDEX projects_getcurrentlabels ON mlforkidsdb.projects USING btree (id, userid, classid);
CREATE INDEX projects_getprojectsbyuserid ON mlforkidsdb.projects USING btree (classid, userid, iscrowdsourced);
CREATE INDEX scratchkeys_findscratchkeys ON mlforkidsdb.scratchkeys USING btree (projectid, userid, classid);
CREATE INDEX scratchkeys_resetexpiredscratchkey ON mlforkidsdb.scratchkeys USING btree (classifierid, projectid);
CREATE INDEX scratchkeys_updatescratchkey ON mlforkidsdb.scratchkeys USING btree (id, userid, projectid, classid);
CREATE INDEX soundtraining_getsoundtraining ON mlforkidsdb.soundtraining USING btree (projectid, label);
CREATE INDEX soundtraining_gettraininglabels ON mlforkidsdb.soundtraining USING btree (projectid);
CREATE INDEX texttraining_gettraininglabels ON mlforkidsdb.texttraining USING btree (projectid);
CREATE INDEX texttraining_renametexttraining ON mlforkidsdb.texttraining USING btree (projectid, label);

ALTER DATABASE mlforkidsdb SET search_path to mlforkidsdb;

INSERT INTO mlforkidsdb.tenants (id, projecttypes, maxusers, maxprojectsperuser, textclassifiersexpiry, ismanaged)
    VALUES
        ('session-users', 'text,imgtfjs,numbers,sounds', 5, 1, 4, 0);
