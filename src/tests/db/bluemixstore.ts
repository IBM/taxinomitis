/*eslint-env mocha */
import * as assert from 'assert';
import * as randomstring from 'randomstring';
import * as sinon from 'sinon';
import { v1 as uuid } from 'uuid';

import * as store from '../../lib/db/store';
import * as projectObjects from '../../lib/db/projects';
import * as conversation from '../../lib/training/conversation';
import * as Types from '../../lib/training/training-types';
import * as DbTypes from '../../lib/db/db-types';

import * as request from 'request-promise';


describe('DB store', () => {

    let testTenant: DbTypes.ClassTenant;

    before(() => {
        return store.init()
            .then(() => {
                return store.getClassTenant(uuid());
            })
            .then((tenant) => {
                testTenant = tenant;
            });
    });
    after(() => {
        return store.deleteClassTenant(testTenant.id)
            .then(() => {
                return store.disconnect();
            });
    });


    describe('Bluemix credentials', () => {

        it('should retrieve all conv Bluemix credentials', async () => {
            const retrieved = await store.getAllBluemixCredentials('conv');
            assert(retrieved.length > 0);
            for (const cred of retrieved) {
                assert.strictEqual(cred.servicetype, 'conv');
            }
        });

        it('should store and retrieve lite Bluemix credentials', async () => {
            const credsinfo = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/classifiers',
                classid : testTenant.id,
            };

            const creds: Types.BluemixCredentialsDbRow = {
                ...credsinfo,
                credstypeid : 1,
            };

            await store.storeBluemixCredentials(testTenant.id, creds);

            const retrieved = await store.getBluemixCredentials(testTenant, 'conv');
            assert.deepStrictEqual(retrieved, [ {
                ...credsinfo,
                credstype : 'conv_lite',
            } ]);

            const counts = await store.countGlobalBluemixCredentials();
            assert.deepStrictEqual(counts[testTenant.id], { conv : 1, total : 1 });

            await store.deleteBluemixCredentials(creds.id);

            const countsAfter = await store.countGlobalBluemixCredentials();
            assert.strictEqual(countsAfter[testTenant.id], undefined);
        });

        it('should store and retrieve standard Bluemix credentials', async () => {
            const countBefore = await store.countBluemixCredentialsByType(testTenant.id);
            assert.deepStrictEqual(countBefore, { conv : 0 });

            const credsinfo = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/classifiers',
                classid : testTenant.id,
            };

            const creds: Types.BluemixCredentialsDbRow = {
                ...credsinfo,
                credstypeid : projectObjects.credsTypesByLabel.conv_standard.id,
            };

            await store.storeBluemixCredentials(testTenant.id, creds);

            const countAfter = await store.countBluemixCredentialsByType(testTenant.id);
            assert.deepStrictEqual(countAfter, { conv : 20 });

            const retrieved = await store.getBluemixCredentials(testTenant, 'conv');
            assert.deepStrictEqual(retrieved, [ {
                ...credsinfo,
                credstype : 'conv_standard',
            } ]);

            await store.deleteBluemixCredentials(creds.id);
        });

        it('should store Bluemix credentials with notes', async () => {
            const creds: Types.BluemixCredentialsDbRow = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/classifiers',
                classid : testTenant.id,
                notes : uuid(),
                credstypeid : projectObjects.credsTypesByLabel.conv_standard.id,
            };

            await store.storeBluemixCredentials(testTenant.id, creds);

            const retrievedList = await store.getBluemixCredentials(testTenant, 'conv');
            const retrieved = retrievedList[0];
            assert.strictEqual(retrieved.id, creds.id);

            await store.deleteBluemixCredentials(creds.id);
        });

        it('should count the number of models from Bluemix credentials', async () => {
            const classid = uuid();

            const ids = [ uuid(), uuid(), uuid(), uuid(), uuid() ];

            await store.storeBluemixCredentials(classid, {
                id : ids[0],
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/classifiers',
                classid,
                credstypeid : projectObjects.credsTypesByLabel.conv_standard.id,
            });
            await store.storeBluemixCredentials(classid, {
                id : ids[1],
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/classifiers',
                classid,
                credstypeid : projectObjects.credsTypesByLabel.conv_lite.id,
            });
            await store.storeBluemixCredentials(classid, {
                id : ids[2],
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/classifiers',
                classid,
                credstypeid : projectObjects.credsTypesByLabel.conv_lite.id,
            });
            await store.storeBluemixCredentials(classid, {
                id : ids[3],
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/classifiers',
                classid,
                credstypeid : projectObjects.credsTypesByLabel.unknown.id,
            });

            const countAfter = await store.countBluemixCredentialsByType(classid);
            assert.deepStrictEqual(countAfter, { conv : 35 });

            for (const id of ids) {
                await store.deleteBluemixCredentials(id);
            }
        });

        it('should throw an error when fetching non-existent credentials', async () => {
            const credsinfo = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/classifiers',
                classid : testTenant.id,
            };

            const creds: Types.BluemixCredentialsDbRow = {
                ...credsinfo,
                credstypeid : 2,
            };

            await store.storeBluemixCredentials(testTenant.id, creds);

            const retrieved = await store.getBluemixCredentials(testTenant, 'conv');
            assert.deepStrictEqual(retrieved, [ {
                ...credsinfo,
                credstype : 'conv_standard',
            } ]);

            await store.deleteBluemixCredentials(creds.id);

            return store.getBluemixCredentials(testTenant, 'conv')
                .then(() => {
                    assert.fail('Should not reach here');
                })
                .catch((err) => {
                    assert.strictEqual(err.message, 'Unexpected response when retrieving service credentials');
                });
        });

        it('should retrieve credentials for a classifier', async () => {
            const classid = uuid();
            const projectid = uuid();
            const userid = uuid();

            const credsinfo = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/workspaces',
                classid,
            };

            const creds: Types.BluemixCredentialsDbRow = {
                ...credsinfo,
                credstypeid : 2,
            };

            const storedcreds = await store.storeBluemixCredentials(classid, creds);

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : randomstring.generate({ length : 32 }),
                credentialsid : creds.id,
                created,
                expiry: created,
                language : 'en',
                name : randomstring.generate({ length : 12 }),
                url : uuid(),
            };

            const project: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name : classifierInfo.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };

            await store.storeConversationWorkspace(storedcreds, project, classifierInfo);

            const retrievedCreds = await store.getBluemixCredentialsById(DbTypes.ClassTenantType.UnManaged, creds.id);
            assert.deepStrictEqual(retrievedCreds, {
                ...credsinfo,
                credstype : 'conv_standard',
            });

            await store.deleteBluemixCredentials(creds.id);
            await store.deleteConversationWorkspacesByProjectId(projectid);
        });


        it('should modify Conversation Bluemix credentials', async () => {

            const before = projectObjects.credsTypesByLabel.conv_lite;
            const after  = projectObjects.credsTypesByLabel.conv_standard;

            const classid = uuid();

            const credsinfo = {
                id : uuid(),
                username : randomstring.generate({ length : 8 }),
                password : randomstring.generate({ length : 20 }),
                servicetype : 'conv',
                url : 'http://conversation.service/api/classifiers',
                classid,
            };

            const creds: Types.BluemixCredentialsDbRow = {
                ...credsinfo,
                credstypeid : before.id,
            };

            await store.storeBluemixCredentials(classid, creds);

            const verifyBefore = await store.getBluemixCredentialsById(DbTypes.ClassTenantType.UnManaged, creds.id);

            await store.setBluemixCredentialsType(classid, credsinfo.id, 'conv', after.label);

            const verifyAfter = await store.getBluemixCredentialsById(DbTypes.ClassTenantType.UnManaged, creds.id);

            await store.deleteBluemixCredentials(creds.id);

            assert.strictEqual(verifyBefore.credstype, before.label);
            assert.strictEqual(verifyAfter.credstype, after.label);
        });


        it('should reject modifications for invalid credentials types', async () => {
            try {
                await store.setBluemixCredentialsType('classid', 'credsid', 'conv',
                    'fish' as Types.BluemixCredentialsTypeLabel);
                assert.fail('Should not reach here');
            }
            catch (err) {
                assert.strictEqual(err.message, 'Unrecognised credentials type');
            }
        });
    });


    describe('Conversation classifiers', () => {

        it('should return 0 for unknown users', async () => {
            const unknownClass = uuid();
            const count = await store.countConversationWorkspaces(unknownClass);
            assert.strictEqual(count, 0);
        });


        it('should retrieve expired classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();

            const now = new Date();
            now.setMilliseconds(0);

            const future = new Date();
            future.setDate(future.getDate() + 1);
            future.setMilliseconds(0);

            const past = new Date();
            past.setDate(past.getDate() - 1);
            past.setMilliseconds(0);

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate(36),
                password : randomstring.generate(12),
                servicetype : 'conv',
                url : uuid(),
                classid,
                credstype : 'conv_standard',
            };
            const expired: Types.ConversationWorkspace = {
                id : uuid(),
                name : 'ONE',
                workspace_id : uuid(),
                credentialsid : credentials.id,
                url : uuid(),
                language : 'en',
                created : now,
                expiry : past,
            };
            const current: Types.ConversationWorkspace = {
                id : uuid(),
                name : 'TWO',
                workspace_id : uuid(),
                credentialsid : credentials.id,
                url : uuid(),
                language : 'en',
                created : now,
                expiry : future,
            };

            const alreadyExpired = await store.getExpiredConversationWorkspaces();

            const projectExpired: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name : expired.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };
            const projectCurrent: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name : current.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };

            await store.storeConversationWorkspace(credentials, projectExpired, expired);
            await store.storeConversationWorkspace(credentials, projectCurrent, current);

            const retrievedAll = await store.getConversationWorkspaces(projectid);
            assert.deepStrictEqual(retrievedAll, [ expired, current ]);

            const retrievedExpired = await store.getExpiredConversationWorkspaces();
            assert.deepStrictEqual(retrievedExpired.sort(sortWorkspaces),
                             alreadyExpired.concat([ expired ]).sort(sortWorkspaces));
        });


        function sortWorkspaces(a: Types.ConversationWorkspace, b: Types.ConversationWorkspace): number {
            if (a.id < b.id) {
                return -1;
            }
            else if (a.id > b.id) {
                return 1;
            }
            return 0;
        }


        it('should delete expired classifiers', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();

            const now = new Date();
            now.setMilliseconds(0);

            const past = new Date();
            past.setDate(past.getDate() - 1);
            past.setMilliseconds(0);

            const credentials: Types.BluemixCredentialsDbRow = {
                id : uuid(),
                username : randomstring.generate(36),
                password : randomstring.generate(12),
                servicetype : 'conv',
                url : uuid(),
                classid,
                credstypeid : 1,
            };
            const storedcreds = await store.storeBluemixCredentials(classid, credentials);

            const expired: Types.ConversationWorkspace = {
                id : uuid(),
                name : 'ONE',
                workspace_id : uuid(),
                credentialsid : credentials.id,
                url : uuid(),
                language : 'en',
                created : now,
                expiry : past,
            };

            const projectExpired: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name : expired.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };

            await store.storeConversationWorkspace(storedcreds, projectExpired, expired);

            const verifyBefore = await store.getConversationWorkspace(projectid, expired.workspace_id);
            assert.deepStrictEqual(verifyBefore, expired);

            const countBefore = await store.getExpiredConversationWorkspaces();
            assert(countBefore.length >= 0);

            const deleteStub = sinon.stub(request, 'delete').resolves();
            await conversation.cleanupExpiredClassifiers();
            assert(deleteStub.called);
            deleteStub.restore();

            const countAfter = await store.getExpiredConversationWorkspaces();
            assert.strictEqual(countAfter.length, 0);

            try {
                await store.getConversationWorkspace(projectid, expired.workspace_id);
                assert.fail('should not reach here');
            }
            catch (err) {
                assert(err);
            }

            await store.deleteBluemixCredentials(credentials.id);
        });


        it('should update Conversation workspace expiry', async () => {
            const classid = uuid();
            const projectid = uuid();
            const userid = uuid();

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate(36),
                password : randomstring.generate(12),
                servicetype : 'conv',
                url : uuid(),
                classid,
                credstype : 'conv_standard',
            };

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : randomstring.generate({ length : 32 }),
                credentialsid : credentials.id,
                created,
                expiry : created,
                language : 'en',
                name : 'DUMMY',
                url : uuid(),
            };

            const project: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name : classifierInfo.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };

            await store.storeConversationWorkspace(credentials, project, classifierInfo);

            const updatedDate = new Date();
            updatedDate.setMonth(updatedDate.getMonth() + 6);
            updatedDate.setMilliseconds(0);

            classifierInfo.expiry = updatedDate;

            await store.updateConversationWorkspaceExpiry(classifierInfo);

            const retrieve = await store.getConversationWorkspace(projectid, classifierInfo.workspace_id);
            assert.deepStrictEqual(retrieve.expiry, updatedDate);
        });

        it('should default to English if no language is stored', async () => {
            const classid = uuid();
            const userid = uuid();
            const projectid = uuid();

            const name = 'testname';

            const project: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name,
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            } as DbTypes.Project;

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate(36),
                password : randomstring.generate(12),
                servicetype : 'conv',
                url : uuid(),
                classid,
                credstype : 'conv_lite',
            };

            const created = new Date();
            created.setMilliseconds(0);

            const language = '' as DbTypes.TextProjectLanguage;
            const classifierInfo: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : randomstring.generate({ length : 32 }),
                credentialsid : credentials.id,
                language,
                created,
                expiry : created,
                name,
                url : uuid(),
            } as Types.ConversationWorkspace;

            await store.storeConversationWorkspace(credentials, project, classifierInfo);

            const retrieved = await store.getConversationWorkspace(projectid, classifierInfo.workspace_id);
            assert.strictEqual(retrieved.language, 'en');

            await store.deleteConversationWorkspace(classifierInfo.id);
        });

        it('should store and retrieve Conversation classifiers', async () => {
            const classid = uuid();
            const projectid = uuid();

            const before = await store.getConversationWorkspaces(projectid);
            assert.strictEqual(before.length, 0);

            const countBefore = await store.countConversationWorkspaces(classid);
            assert.strictEqual(countBefore, 0);

            const credentials: Types.BluemixCredentials = {
                id : uuid(),
                username : randomstring.generate(36),
                password : randomstring.generate(12),
                servicetype : 'conv',
                url : uuid(),
                classid,
                credstype : 'conv_lite',
            };
            const userid = uuid();

            const created = new Date();
            created.setMilliseconds(0);

            const classifierInfo: Types.ConversationWorkspace = {
                id : uuid(),
                workspace_id : randomstring.generate({ length : 32 }),
                credentialsid : credentials.id,
                created,
                expiry : created,
                language : 'en',
                name : 'DUMMY',
                url : uuid(),
            };

            const project: DbTypes.Project = {
                id : projectid,
                userid,
                classid,
                type : 'text',
                name : classifierInfo.name,
                language : 'en',
                labels : ['a'],
                numfields : 0,
                isCrowdSourced : false,
            };

            await store.storeConversationWorkspace(credentials, project, classifierInfo);

            const after = await store.getConversationWorkspaces(projectid);
            assert.strictEqual(after.length, 1);

            const countAfter = await store.countConversationWorkspaces(classid);
            assert.strictEqual(countAfter, 1);


            const retrieved = after[0];

            assert.deepStrictEqual(retrieved, classifierInfo);

            await store.deleteConversationWorkspace(classifierInfo.id);

            const empty = await store.getConversationWorkspaces(projectid);
            assert.strictEqual(empty.length, 0);

            const countEmpty = await store.countConversationWorkspaces(classid);
            assert.strictEqual(countEmpty, 0);
        });

    });



    describe('Image classifiers', () => {

        // let setTimeoutStub: sinon.SinonStub<any, any>;

        // before(() => {
        //     setTimeoutStub = sinon.stub(global, 'setTimeout');
        // });
        // beforeEach(() => {
        //     setTimeoutStub.resetHistory();
        // });
        // after(() => {
        //     setTimeoutStub.restore();
        // });


        // function sortClassifiers(a: Types.VisualClassifier, b: Types.VisualClassifier): number {
        //     if (a.id < b.id) {
        //         return -1;
        //     }
        //     else if (a.id > b.id) {
        //         return 1;
        //     }
        //     return 0;
        // }

        it.skip('should retrieve expired classifiers', async () => {
            // const classid = uuid();
            // const userid = uuid();
            // const projectid = uuid();

            // const now = new Date();
            // now.setMilliseconds(0);

            // const future = new Date();
            // future.setDate(future.getDate() + 1);
            // future.setMilliseconds(0);

            // const past = new Date();
            // past.setDate(past.getDate() - 1);
            // past.setMilliseconds(0);

            // const credentials: Types.BluemixCredentials = {
            //     id : uuid(),
            //     username : uuid(),
            //     password : uuid(),
            //     servicetype : 'visrec',
            //     url : 'https://gateway-a.watsonplatform.net/visual-recognition/api',
            //     classid,
            //     credstype : 'visrec_lite',
            // };
            // const expired: Types.VisualClassifier = {
            //     id : uuid(),
            //     name : 'ONE',
            //     classifierid : uuid(),
            //     credentialsid : credentials.id,
            //     url : 'https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classifiers/' + uuid(),
            //     created : now,
            //     expiry : past,
            // };
            // const current: Types.VisualClassifier = {
            //     id : uuid(),
            //     name : 'TWO',
            //     classifierid : uuid(),
            //     credentialsid : credentials.id,
            //     url : uuid(),
            //     created : now,
            //     expiry : future,
            // };

            // const alreadyExpired = await store.getExpiredImageClassifiers();

            // const projectExpired: DbTypes.Project = {
            //     id : projectid,
            //     userid,
            //     classid,
            //     type : 'images',
            //     name : expired.name,
            //     language : 'en',
            //     labels : ['a'],
            //     numfields : 0,
            //     isCrowdSourced : false,
            // };
            // const projectCurrent: DbTypes.Project = {
            //     id : projectid,
            //     userid,
            //     classid,
            //     type : 'images',
            //     name : current.name,
            //     language : 'en',
            //     labels : ['a'],
            //     numfields : 0,
            //     isCrowdSourced : false,
            // };

            // await store.storeImageClassifier(credentials, projectExpired, expired);
            // await store.storeImageClassifier(credentials, projectCurrent, current);

            // const retrievedAll = await store.getImageClassifiers(projectid);
            // assert.deepStrictEqual(retrievedAll, [ expired, current ]);

            // const retrievedExpired = await store.getExpiredImageClassifiers();
            // assert.deepStrictEqual(retrievedExpired.sort(sortClassifiers),
            //                  alreadyExpired.concat([ expired ]).sort(sortClassifiers));
        });



        it.skip('should delete expired classifiers', async () => {
            // const classid = uuid();
            // const userid = uuid();
            // const projectid = uuid();

            // const now = new Date();
            // now.setMilliseconds(0);

            // const past = new Date();
            // past.setDate(past.getDate() - 1);
            // past.setMilliseconds(0);

            // const credentials: Types.BluemixCredentialsDbRow = {
            //     id : uuid(),
            //     username : uuid(),
            //     password : uuid(),
            //     servicetype : 'visrec',
            //     url : 'https://gateway-a.watsonplatform.net/visual-recognition/api',
            //     classid,
            //     credstypeid : 4,
            // };
            // const storedcreds = await store.storeBluemixCredentials(classid, credentials);

            // const counts = await store.countBluemixCredentialsByType(classid);
            // assert.deepStrictEqual(counts, { conv : 0, visrec : 2 });
            // const allCounts = await store.countGlobalBluemixCredentials();
            // assert.deepStrictEqual(allCounts[classid], { conv : 0, visrec : 1, total : 1 });

            // const expired: Types.VisualClassifier = {
            //     id : uuid(),
            //     name : 'ONE',
            //     classifierid : uuid(),
            //     credentialsid : credentials.id,
            //     url : 'https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classifiers/' + uuid(),
            //     created : now,
            //     expiry : past,
            // };

            // const projectExpired: DbTypes.Project = {
            //     id : projectid,
            //     userid,
            //     classid,
            //     type : 'images',
            //     name : expired.name,
            //     language : 'en',
            //     labels : ['a'],
            //     numfields : 0,
            //     isCrowdSourced : false,
            // };

            // await store.storeImageClassifier(storedcreds, projectExpired, expired);

            // const verifyBefore = await store.getImageClassifier(projectid, expired.classifierid);
            // assert.deepStrictEqual(verifyBefore, expired);

            // const countBefore = await store.getExpiredImageClassifiers();
            // assert(countBefore.length >= 0);

            // const deleteStub = sinon.stub(request, 'delete').resolves();
            // await visualrecog.cleanupExpiredClassifiers();
            // assert(deleteStub.called);
            // deleteStub.restore();

            // assert(setTimeoutStub.called);

            // const countAfter = await store.getExpiredImageClassifiers();
            // assert.strictEqual(countAfter.length, 0);

            // try {
            //     await store.getImageClassifier(projectid, expired.classifierid);
            //     assert.fail('should not reach here');
            // }
            // catch (err) {
            //     assert(err);
            // }

            // await store.deleteBluemixCredentials(credentials.id);
        });


        it.skip('should store and retrieve classifiers', async () => {
            // const classid = uuid();
            // const projectid = uuid();

            // const before = await store.getImageClassifiers(projectid);
            // assert.strictEqual(before.length, 0);

            // const credentials: Types.BluemixCredentials = {
            //     id : uuid(),
            //     username : uuid(),
            //     password : uuid(),
            //     servicetype : 'visrec',
            //     url : 'https://gateway-a.watsonplatform.net/visual-recognition/api',
            //     classid,
            //     credstype : 'visrec_lite',
            // };
            // const userid = uuid();

            // const created = new Date();
            // created.setMilliseconds(0);

            // const classifierInfo: Types.VisualClassifier = {
            //     id : uuid(),
            //     classifierid : randomstring.generate({ length : 32 }),
            //     credentialsid : credentials.id,
            //     created,
            //     expiry : created,
            //     name : 'DUMMY',
            //     url : 'https://gateway-a.watsonplatform.net/visual-recognition/api/v3/classifiers/' + uuid(),
            // };

            // const project: DbTypes.Project = {
            //     id : projectid,
            //     userid,
            //     classid,
            //     type : 'images',
            //     name : classifierInfo.name,
            //     language : 'en',
            //     labels : ['a'],
            //     numfields : 0,
            //     isCrowdSourced : false,
            // };

            // await store.storeImageClassifier(credentials, project, classifierInfo);

            // const after = await store.getImageClassifiers(projectid);
            // assert.strictEqual(after.length, 1);


            // const retrieved = after[0];

            // assert.deepStrictEqual(retrieved, classifierInfo);

            // await store.deleteImageClassifier(classifierInfo.id);

            // const empty = await store.getImageClassifiers(projectid);
            // assert.strictEqual(empty.length, 0);
        });

    });


});
