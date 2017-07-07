UI clean-up needed
* Validation for usernames in create-user dialog
* Create/Cancel buttons shouldn't be equal prominence - flip left/right and make cancel buttons into a link
* sub-nav-bar for Train/Models/Test/Scratch to avoid need to go back to project page
* Document differences with regular Scratch
* Replace Angular material with something that looks better

New features
* Expiry for models
* Images training - built around a WikiMedia library?
* Editing examples

Code / engineering work
* Test coverage for DB errors
* Set up DB and Auth0 for prod vs dev use
* Fix the UI for browsers other than Chrome
* Scratch keys should use project id as primary key so REPLACE is more efficient
* Google Analytics
* max limit on training items per project
* handle errors that Conversation returns on duplicate examples

Longer term goals
* Restore sprites library
* Support for languages other than English

Worksheets
* Control Your Home (text)
* Shakespeare or Dahl (text)
* Top Trumps (numbers)
* Journey to school (numbers)
