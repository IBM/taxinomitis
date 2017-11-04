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
* Refactoring store.ts to remove duplicate code across text/images/numbers
* Remove dupes from image training?
* drag/drop on IE is more broken than Safari. Damn you IE.
* Add Training Data is missing from Scratch page
* Scratch is capturing images as 8 bits of color per pixel which visrec chokes on - use 24bpp
* auth errors cant be displayed as they're inside isAuthenticated
* Deal with Auth0 changing shit. Again. FFS. 
* Need blue-green deploys. Really.
* Check what happens if a classifier is deleted outside of MLforKids
* Put coverage back into task runner... maybe by moving to grunt?
* Strict checking for TS code

Longer term goals
* Restore sprites library to scratch-flash

Worksheets
* Restructure worksheets to demonstrate small ground truth makes crap classifiers
* Shakespeare or Dahl (text)
* School Prospectus (text)
* Movie titles (text) - classify by genre
* Song lyrics - genre (text)
* Pac Man (https://www.youtube.com/watch?v=ENP236BVzq0)
