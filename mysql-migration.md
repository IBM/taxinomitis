export 
```
mysqldbexport --server=admin:OESBMDFNIEQNHVID@bluemix-sandbox-dal-9-portal.8.dblayer.com:30359 --export=both --output-file=08-Dec-2017-0910.sql --skip-gtid mlforkidsdb
```

import 
```
mysqldbimport --server=admin:OESBMDFNIEQNHVID@bluemix-sandbox-dal-9-portal.8.dblayer.com:30359 --import=both 08-Dec-2017-0910.sql
```
