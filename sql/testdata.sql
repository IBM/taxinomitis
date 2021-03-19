INSERT INTO bluemixcredentials (id, classid, servicetype, url, username, password, credstypeid)
    VALUES
    -- This is a placeholder row used for unit tests - it's obviously not a real username/password.
    ('01cf0343-6bd7-4732-95f0-8c8dbc0be922', 'testing', 'conv', 'https://gateway.watsonplatform.net/conversation/api', '00000000-1111-2222-3333-444444444444', '56789abcdef0', 0),
    -- This is a placeholder row used for unit tests - it's obviously not a real API key.
    ('3a9a71ab-de77-4912-b0b0-f0c9698d9245', 'testing', 'visrec', 'https://gateway.watsonplatform.net/visual-recognition/api', 'AbCdEfGhIjKlMnOpQrStUv', 'WxYz0123456789AbCdEfGh', 0);

INSERT INTO tenants (id, projecttypes, maxusers, maxprojectsperuser, textclassifiersexpiry, ismanaged)
    VALUES
        ('TESTTENANT', 'text,images,numbers,sounds,imgtfjs', 8, 3, 2, 1),
        ('UNIQUECLASSID', 'text,numbers', 8, 3, 2, 1),
        ('BETA', 'imgtfjs', 10, 5, 1, 0);
