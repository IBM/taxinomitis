function changeImageDisplay(showAsThumbnail) {
    var sets = document.getElementsByClassName('dataset');
    for (var i = 0; i < sets.length; i++) {
        var set = sets[i];
        if (showAsThumbnail) {
            set.className = 'dataset thumbnails';
        }
        else {
            set.className = 'dataset';
        }
    }
}
