export 
```
mysqldbexport --server=admin:ZLLIDCRHUXXAISWD@bluemix-sandbox-dal-9-portal.8.dblayer.com:28820 --export=both --output-file=04-Nov-2017-1100.sql --skip-gtid mlforkidsdb
```

import 
```
mysqldbimport --server=admin:OESBMDFNIEQNHVID@bluemix-sandbox-dal-9-portal.8.dblayer.com:30359 --import=both 04-Nov-2017-1100.sql
```
