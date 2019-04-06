classname=$1
numstudents=$2

echo "INSERT INTO tenants (id, projecttypes, maxusers, maxprojectsperuser, textclassifiersexpiry, imageclassifiersexpiry, ismanaged) "
echo "VALUES "
echo "('$classname', 'text,images,numbers,sounds', $numstudents, 2, 24, 24, true);"
