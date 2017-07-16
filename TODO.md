UI clean-up needed
* Validation for usernames in create-user dialog
* sub-nav-bar for Train/Models/Test/Scratch to avoid need to go back to project page
* Document differences with regular Scratch

New features
* Images training - built around a WikiMedia library?
* Editing examples

Code / engineering work
* Set up DB and Auth0 for prod vs dev use
* Scratch keys should use project id as primary key so REPLACE is more efficient
* Figure out logging for prod
* Set up cfbot for prod monitoring
* Delete entire project is actually calling taxinomitis-numbers during tests
* Some sort of admin controls for me so I'm not SQL'ing in a prod DB
* fix the flicking when delete button are shown on examples
* aggressive caching of API responses on IE fucks things up

Longer term goals
* Restore sprites library
* Support for languages other than English

Worksheets
* Shakespeare or Dahl (text)
