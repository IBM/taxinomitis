
# Deploying in prod

To deploy:
    (using plugin from https://github.com/bluemixgaragelondon/cf-blue-green-deploy)

cf blue-green-deploy machinelearningforkids -f manifest-prod.yml


# Environment variables

* `manifest.yml`
  * Choose the environment by modifying `cf push` to choose the correct file:
    * Dev/Test - `manifest-dev.yml`
    * Prod - `manifest-prod.yml`
* `public/auth0-variables.js`
  * Choose the environment at the build phase
    * `gulp build` will pack `public/auth0-variables.js` into the minified js
    * `gulp buildprod` will pack `public/auth0-prod-variables.js` into the minified js


# Deploying a whole new stack

Environment variables will need to be set up as above.

The MySQL database will need to be created, and tables in the DB need to be created. This isn't done automatically.

But the SQL commands needed can be found in `sql/tables.sql`.


# Creating a new tenant

## 1. Create the administrator

Create a teacher's account in the auth0 dashboard

Add this to the `app_metadata`:
```
{
  "tenant": "TENANTID",
  "role": "supervisor"
}
```


## 2. Specify restrictions (optional)

Insert the restrictions into the tenants DB
```
INSERT INTO tenants
    (id, projecttypes, maxusers, maxprojectsperuser, textclassifiersexpiry)
    VALUES
    ("TENANTID", "text,numbers", NUMUSERS, NUMPROJECTS, NUMHOURS);
```

_If omitted, default restrictions will be applied._


## 3. Set up Watson APIs

Create an instance of Watson Conversation

Store the credentials in the DB:
```
INSERT INTO bluemixcredentials
    (id, classid, servicetype, url, username, password)
    VALUES
    ("some-unique-uuid", "TENANTID", "conv", "https://gateway.watsonplatform.net/conversation/api", "conversation-creds-username", "conversation-creds-password");
```

If multiple credentials are created (and multiple rows inserted) then all of these will be available for use by students in this tenant.

_If omitted, students will be able to collect training data, but not train models for text projects. Numbers projects will work as normal._
