CREATE DATABASE mlforkidsdb ENCODING latin1



-- ----------------------------------------------------

ALTER TABLE tenants

ALTER COLUMN ismanaged
DROP DEFAULT,

ALTER COLUMN ismanaged
TYPE SMALLINT
USING CASE
WHEN ismanaged THEN 2
ELSE 0 END,

ALTER COLUMN ismanaged
SET DEFAULT '2'::smallint,

ALTER COLUMN ismanaged
SET NOT NULL
;

-- ----------------------------------------------------

ALTER TABLE projects

ALTER COLUMN id
TYPE character varying(36),

ALTER COLUMN userid
TYPE character varying(36),

ALTER COLUMN classid
TYPE character varying(36),

ALTER COLUMN language
TYPE character varying(6);

-- ----------------------------------------------------

ALTER TABLE bluemixclassifiers

ALTER COLUMN id
TYPE character varying(36),

ALTER COLUMN userid
TYPE character varying(36),

ALTER COLUMN projectid
TYPE character varying(36),

ALTER COLUMN classid
TYPE character varying(36);

-- ----------------------------------------------------

ALTER TABLE bluemixcredentials

ALTER COLUMN id
TYPE character varying(36),

ALTER COLUMN classid
TYPE character varying(36);

-- ----------------------------------------------------

ALTER TABLE bluemixcredentialspool

ALTER COLUMN id
TYPE character varying(36);

-- ----------------------------------------------------

ALTER TABLE imagetraining

ALTER COLUMN projectid
TYPE character varying(36);

-- ----------------------------------------------------

ALTER TABLE numbertraining

ALTER COLUMN projectid
TYPE character varying(36);

-- ----------------------------------------------------

ALTER TABLE texttraining

ALTER COLUMN projectid
TYPE character varying(36);

-- ----------------------------------------------------

ALTER TABLE soundtraining

ALTER COLUMN projectid
TYPE character varying(36);

-- ----------------------------------------------------

ALTER TABLE disruptivetenants

ALTER COLUMN id
TYPE character varying(36);

-- ----------------------------------------------------

ALTER TABLE notificationoptouts

ALTER COLUMN id
TYPE character varying(36);

-- ----------------------------------------------------

ALTER TABLE numbersprojectsfields

ALTER COLUMN userid
TYPE character varying(36),

ALTER COLUMN classid
TYPE character varying(36),

ALTER COLUMN projectid
TYPE character varying(36);

-- ----------------------------------------------------

ALTER TABLE scratchkeys

ALTER COLUMN userid
TYPE character varying(36),

ALTER COLUMN classid
TYPE character varying(36),

ALTER COLUMN projectid
TYPE character varying(36);

-- ----------------------------------------------------

ALTER TABLE taxinoclassifiers

ALTER COLUMN userid
TYPE character varying(36),

ALTER COLUMN classid
TYPE character varying(36),

ALTER COLUMN projectid
TYPE character varying(36);

-- ----------------------------------------------------

