URGENT & HIGH PRIORITY
* max limit on training items per project

UI clean-up needed
* Validation for usernames in create-user dialog
* Create/Cancel buttons shouldn't be equal prominence - flip left/right and make cancel buttons into a link
* sub-nav-bar for Train/Models/Test/Scratch to avoid need to go back to project page
* Document differences with regular Scratch
* Replace Angular material with something that looks better

New features
* Images training - built around a WikiMedia library?
* Editing examples

Code / engineering work
* Get test coverage back under control
* Set up DB and Auth0 for prod vs dev use
* Scratch keys should use project id as primary key so REPLACE is more efficient
* Figure out logging for prod
* UI updates for creating labels
* Set up cfbot for prod monitoring
* Delete entire project is actually calling taxinomitis-numbers during tests
* Catch DB errors so we can describe more generic read/write failure in UI and hide the MySQL error in a <detail>

Longer term goals
* Restore sprites library
* Support for languages other than English

Worksheets
* Shakespeare or Dahl (text)
* Top Trumps (numbers)
