# Templates for emails sent to users

| template | subject line | sent by | when |
| --- | --- | --- | --- |
| email-verification.html | | auth0 | This email will be sent whenever a user signs up or logs in for the first time. | 
| welcome.html | Getting started with Machine Learning for Kids | auth0 | This email will be sent once the user verifies their email address. |
| password.html | |  auth0 | This email will be sent whenever a user requests a password change. The password will not be changed until the user follows the verification link in the email. |
| managed-signup.txt |  | manual | This email will be sent when someone asks for a new managed tenant | 
| unmanaged-conv-classifier.txt | Unrecognised Watson Conversation workspace | mlforkids | This email will be sent when an unknown Conversation classifier is found in an unmanaged tenant | 
| unmanaged-visrec-classifier.txt | Unrecognised Watson Visual Recognition classifier | mlforkids | This email will be sent when an unknown Visual Recognition classifier is found in an unmanaged tenant | 
| invalid-apikey.txt | Invalid IBM Cloud credentials | mlforkids | This email will be sent when an invalid API key is identified | 
