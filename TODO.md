UI clean-up needed
* Logo
* Add a sub-nav-bar for Train/Learn/Scratch to avoid need to go back to project page
* Document differences with regular Scratch

Code / engineering work
* What happens if the access token expires while you're using it. Can we refresh/replace it?
   https://github.com/auth0/auth0.js#api look at renewAuth
   According to https://github.com/auth0/angular-lock/issues/26 it's okay to use this as well as lock
   NOTE: Tokens expire after 24 hours. Unlikely to be a problem in schools!
* Delete entire project is actually calling taxinomitis-numbers during tests
* Some sort of admin controls for me so I'm not SQL'ing in a prod DB
* Compose dashboard supports MySQL backups - need to set a reminder to do this
* Refactoring store.ts to remove duplicate code across text/images/numbers
* Remove dupes from image training?
* Plan for renewing the Let's Encrypt cert
* drag/drop on IE is more broken than Safari. Damn you IE.
* Need tests for image classifier code

Longer term goals
* Restore sprites library to scratch-flash
* Support for training text in languages other than English

Worksheets
* Restructure worksheets to demonstrate small ground truth makes crap classifiers
* Shakespeare or Dahl (text)
* School Prospectus (text)
* Newspaper headlines - classify by paper
* Movie titles (text) - classify by genre
* Song lyrics - genre (text)
* Noughts and crosses (numbers)
