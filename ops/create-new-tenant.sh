classname=NEWCLASS
numstudents=10

./ops/tenant.sh $classname $numstudents
./ops/conv-creds.sh $classname
./ops/visrec-creds.sh $classname
