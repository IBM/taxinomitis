function preloadMachineLearningProjectTemplate(name) {
    var preloadLink = document.createElement("link");
    preloadLink.href = "./templates/" + name;
    preloadLink.rel = "preload";
    preloadLink.as = "fetch";
    document.head.appendChild(preloadLink);
}

$(document).on("editor:ready",  function(e) {
    var templates = [
        "smart-classroom.sbx",
        "smart-classroom-easy.sbx",
        "tourist-info-easy.sbx",
        "headlines.sbx",
        "owl.sbx",
        "snap.sbx",
        "facelock.sbx",
        "mailman-max.sbx",
        "car-or-cup.sbx",
        "rock-paper-scissors.sbx",
        "judge-a-book.sbx",
        "locate-larry.sbx",
        "confused.sbx",
        "pacman.sbx",
        "noughts-and-crosses.sbx",
        "top-trumps.sbx"
    ];

    for (var i=0; i<templates.length; i++) {
        preloadMachineLearningProjectTemplate(templates[i]);
    }
});
