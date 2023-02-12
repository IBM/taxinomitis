(function () {

    angular
        .module('app')
        .controller('WorksheetsController', WorksheetsController);

    WorksheetsController.$inject = [
        '$translate',
        '$mdDialog', '$scope'
    ];

    function WorksheetsController($translate, $mdDialog, $scope) {

        var vm = this;

        vm.worksheets = [];
        $translate([
            'WORKSHEETS.DESCRIBETHEGLASS.TITLE', 'WORKSHEETS.DESCRIBETHEGLASS.SUMMARY', 'WORKSHEETS.DESCRIBETHEGLASS.DESCRIPTION',
            'WORKSHEETS.DESCRIBETHEGLASS.WORKSHEET_1.URL',
            'WORKSHEETS.DESCRIBETHEGLASS.TEACHERSNOTES_URL',

            'WORKSHEETS.SMARTCLASSROOM.TITLE', 'WORKSHEETS.SMARTCLASSROOM.SUMMARY', 'WORKSHEETS.SMARTCLASSROOM.DESCRIPTION',
            'WORKSHEETS.SMARTCLASSROOM.WORKSHEET_1.DESCRIPTION', 'WORKSHEETS.SMARTCLASSROOM.WORKSHEET_1.URL',
            'WORKSHEETS.SMARTCLASSROOM.WORKSHEET_2.DESCRIPTION', 'WORKSHEETS.SMARTCLASSROOM.WORKSHEET_2.URL',
            'WORKSHEETS.SMARTCLASSROOM.WORKSHEET_3.DESCRIPTION', 'WORKSHEETS.SMARTCLASSROOM.WORKSHEET_3.URL',
            'WORKSHEETS.SMARTCLASSROOM.TEACHERSNOTES_URL',

            'WORKSHEETS.MAKEMEHAPPY.TITLE', 'WORKSHEETS.MAKEMEHAPPY.SUMMARY', 'WORKSHEETS.MAKEMEHAPPY.DESCRIPTION',
            'WORKSHEETS.MAKEMEHAPPY.WORKSHEET_1.DESCRIPTION', 'WORKSHEETS.MAKEMEHAPPY.WORKSHEET_1.URL',
            'WORKSHEETS.MAKEMEHAPPY.WORKSHEET_2.DESCRIPTION', 'WORKSHEETS.MAKEMEHAPPY.WORKSHEET_2.URL',
            'WORKSHEETS.MAKEMEHAPPY.WORKSHEET_3.DESCRIPTION', 'WORKSHEETS.MAKEMEHAPPY.WORKSHEET_3.URL',
            'WORKSHEETS.MAKEMEHAPPY.TEACHERSNOTES_URL',

            'WORKSHEETS.SNAP.TITLE', 'WORKSHEETS.SNAP.SUMMARY', 'WORKSHEETS.SNAP.DESCRIPTION',
            'WORKSHEETS.SNAP.WORKSHEET_1.DESCRIPTION', 'WORKSHEETS.SNAP.WORKSHEET_1.URL',
            'WORKSHEETS.SNAP.WORKSHEET_2.DESCRIPTION', 'WORKSHEETS.SNAP.WORKSHEET_2.URL', 'WORKSHEETS.SNAP.WORKSHEET_2.RESOURCES',
            'WORKSHEETS.SNAP.TEACHERSNOTES_URL',

            'WORKSHEETS.CHAMELEON.TITLE', 'WORKSHEETS.CHAMELEON.SUMMARY', 'WORKSHEETS.CHAMELEON.DESCRIPTION',
            'WORKSHEETS.CHAMELEON.WORKSHEET_1.URL',
            'WORKSHEETS.CHAMELEON.TEACHERSNOTES_URL',

            'WORKSHEETS.QUIZSHOW.TITLE', 'WORKSHEETS.QUIZSHOW.SUMMARY', 'WORKSHEETS.QUIZSHOW.DESCRIPTION',
            'WORKSHEETS.QUIZSHOW.WORKSHEET_1.URL',
            'WORKSHEETS.QUIZSHOW.TEACHERSNOTES_URL',

            'WORKSHEETS.MAILMANMAX.TITLE', 'WORKSHEETS.MAILMANMAX.SUMMARY', 'WORKSHEETS.MAILMANMAX.DESCRIPTION',
            'WORKSHEETS.MAILMANMAX.WORKSHEET_1.URL',
            'WORKSHEETS.MAILMANMAX.TEACHERSNOTES_URL',

            'WORKSHEETS.SHOOTTHEBUG.TITLE', 'WORKSHEETS.SHOOTTHEBUG.SUMMARY', 'WORKSHEETS.SHOOTTHEBUG.DESCRIPTION',
            'WORKSHEETS.SHOOTTHEBUG.WORKSHEET_1.URL',
            'WORKSHEETS.SHOOTTHEBUG.TEACHERSNOTES_URL',

            'WORKSHEETS.CARORCUP.TITLE', 'WORKSHEETS.CARORCUP.SUMMARY', 'WORKSHEETS.CARORCUP.DESCRIPTION',
            'WORKSHEETS.CARORCUP.WORKSHEET_1.DESCRIPTION', 'WORKSHEETS.CARORCUP.WORKSHEET_1.URL',
            'WORKSHEETS.CARORCUP.WORKSHEET_2.DESCRIPTION', 'WORKSHEETS.CARORCUP.WORKSHEET_2.URL',
            'WORKSHEETS.CARORCUP.TEACHERSNOTES_URL',

            'WORKSHEETS.FACELOCK.TITLE', 'WORKSHEETS.FACELOCK.SUMMARY', 'WORKSHEETS.FACELOCK.DESCRIPTION',
            'WORKSHEETS.FACELOCK.WORKSHEET_1.URL',
            'WORKSHEETS.FACELOCK.TEACHERSNOTES_URL',

            'WORKSHEETS.JOURNEYTOSCHOOL.TITLE', 'WORKSHEETS.JOURNEYTOSCHOOL.SUMMARY', 'WORKSHEETS.JOURNEYTOSCHOOL.DESCRIPTION',
            'WORKSHEETS.JOURNEYTOSCHOOL.WORKSHEET_1.URL',
            'WORKSHEETS.JOURNEYTOSCHOOL.TEACHERSNOTES_URL',

            'WORKSHEETS.SHYPANDA.TITLE', 'WORKSHEETS.SHYPANDA.SUMMARY', 'WORKSHEETS.SHYPANDA.DESCRIPTION',
            'WORKSHEETS.SHYPANDA.WORKSHEET_1.URL',
            'WORKSHEETS.SHYPANDA.TEACHERSNOTES_URL',

            'WORKSHEETS.ALIENLANGUAGE.TITLE', 'WORKSHEETS.ALIENLANGUAGE.SUMMARY', 'WORKSHEETS.ALIENLANGUAGE.DESCRIPTION',
            'WORKSHEETS.ALIENLANGUAGE.WORKSHEET_1.URL',
            'WORKSHEETS.ALIENLANGUAGE.TEACHERSNOTES_URL',

            'WORKSHEETS.SECRETCODE.TITLE', 'WORKSHEETS.SECRETCODE.SUMMARY', 'WORKSHEETS.SECRETCODE.DESCRIPTION',
            'WORKSHEETS.SECRETCODE.WORKSHEET_1.URL',
            'WORKSHEETS.SECRETCODE.TEACHERSNOTES_URL',

            'WORKSHEETS.VIRTUALPET.TITLE', 'WORKSHEETS.VIRTUALPET.SUMMARY', 'WORKSHEETS.VIRTUALPET.DESCRIPTION',
            'WORKSHEETS.VIRTUALPET.WORKSHEET_1.URL',
            'WORKSHEETS.VIRTUALPET.TEACHERSNOTES_URL',

            'WORKSHEETS.PACMAN.TITLE', 'WORKSHEETS.PACMAN.SUMMARY', 'WORKSHEETS.PACMAN.DESCRIPTION',
            'WORKSHEETS.PACMAN.WORKSHEET_1.URL',
            'WORKSHEETS.PACMAN.TEACHERSNOTES_URL',

            'WORKSHEETS.CHATBOTS.TITLE', 'WORKSHEETS.CHATBOTS.SUMMARY', 'WORKSHEETS.CHATBOTS.DESCRIPTION',
            'WORKSHEETS.CHATBOTS.WORKSHEET_1.DESCRIPTION', 'WORKSHEETS.CHATBOTS.WORKSHEET_1.URL',
            'WORKSHEETS.CHATBOTS.WORKSHEET_2.DESCRIPTION', 'WORKSHEETS.CHATBOTS.WORKSHEET_2.URL',
            'WORKSHEETS.CHATBOTS.TEACHERSNOTES_URL',

            'WORKSHEETS.TOURISTINFO.TITLE', 'WORKSHEETS.TOURISTINFO.SUMMARY', 'WORKSHEETS.TOURISTINFO.DESCRIPTION',
            'WORKSHEETS.TOURISTINFO.WORKSHEET_1.URL',
            'WORKSHEETS.TOURISTINFO.TEACHERSNOTES_URL',

            'WORKSHEETS.SORTINGHAT.TITLE', 'WORKSHEETS.SORTINGHAT.SUMMARY', 'WORKSHEETS.SORTINGHAT.DESCRIPTION',
            'WORKSHEETS.SORTINGHAT.WORKSHEET_1.DESCRIPTION', 'WORKSHEETS.SORTINGHAT.WORKSHEET_1.URL',
            'WORKSHEETS.SORTINGHAT.WORKSHEET_2.DESCRIPTION', 'WORKSHEETS.SORTINGHAT.WORKSHEET_2.URL',
            'WORKSHEETS.SORTINGHAT.TEACHERSNOTES_URL',

            'WORKSHEETS.ROCKPAPERSCISSORS.TITLE', 'WORKSHEETS.ROCKPAPERSCISSORS.SUMMARY', 'WORKSHEETS.ROCKPAPERSCISSORS.DESCRIPTION',
            'WORKSHEETS.ROCKPAPERSCISSORS.WORKSHEET_1.URL',
            'WORKSHEETS.ROCKPAPERSCISSORS.TEACHERSNOTES_URL',

            'WORKSHEETS.JUDGEABOOK.TITLE', 'WORKSHEETS.JUDGEABOOK.SUMMARY', 'WORKSHEETS.JUDGEABOOK.DESCRIPTION',
            'WORKSHEETS.JUDGEABOOK.WORKSHEET_1.DESCRIPTION', 'WORKSHEETS.JUDGEABOOK.WORKSHEET_1.URL',
            'WORKSHEETS.JUDGEABOOK.WORKSHEET_2.DESCRIPTION', 'WORKSHEETS.JUDGEABOOK.WORKSHEET_2.URL',
            'WORKSHEETS.JUDGEABOOK.WORKSHEET_3.DESCRIPTION', 'WORKSHEETS.JUDGEABOOK.WORKSHEET_3.URL',
            'WORKSHEETS.JUDGEABOOK.TEACHERSNOTES_URL',

            'WORKSHEETS.FOOLED.TITLE', 'WORKSHEETS.FOOLED.SUMMARY', 'WORKSHEETS.FOOLED.DESCRIPTION',
            'WORKSHEETS.FOOLED.WORKSHEET_1.URL',
            'WORKSHEETS.FOOLED.TEACHERSNOTES_URL',

            'WORKSHEETS.SCHOOLLIBRARY.TITLE', 'WORKSHEETS.SCHOOLLIBRARY.SUMMARY', 'WORKSHEETS.SCHOOLLIBRARY.DESCRIPTION',
            'WORKSHEETS.SCHOOLLIBRARY.WORKSHEET_1.URL',
            'WORKSHEETS.SCHOOLLIBRARY.TEACHERSNOTES_URL',

            'WORKSHEETS.WHATTWITTERTHINKS.TITLE', 'WORKSHEETS.WHATTWITTERTHINKS.SUMMARY', 'WORKSHEETS.WHATTWITTERTHINKS.DESCRIPTION',
            'WORKSHEETS.WHATTWITTERTHINKS.WORKSHEET_1.URL',
            'WORKSHEETS.WHATTWITTERTHINKS.TEACHERSNOTES_URL',

            'WORKSHEETS.NOUGHTSANDCROSSES.TITLE', 'WORKSHEETS.NOUGHTSANDCROSSES.SUMMARY', 'WORKSHEETS.NOUGHTSANDCROSSES.DESCRIPTION',
            'WORKSHEETS.NOUGHTSANDCROSSES.WORKSHEET_1.DESCRIPTION', 'WORKSHEETS.NOUGHTSANDCROSSES.WORKSHEET_1.URL',
            'WORKSHEETS.NOUGHTSANDCROSSES.WORKSHEET_2.DESCRIPTION', 'WORKSHEETS.NOUGHTSANDCROSSES.WORKSHEET_2.URL',
            'WORKSHEETS.NOUGHTSANDCROSSES.WORKSHEET_3.DESCRIPTION', 'WORKSHEETS.NOUGHTSANDCROSSES.WORKSHEET_3.URL',
            'WORKSHEETS.NOUGHTSANDCROSSES.TEACHERSNOTES_URL',

            'WORKSHEETS.TOPTRUMPS.TITLE', 'WORKSHEETS.TOPTRUMPS.SUMMARY', 'WORKSHEETS.TOPTRUMPS.DESCRIPTION',
            'WORKSHEETS.TOPTRUMPS.WORKSHEET_1.URL',
            'WORKSHEETS.TOPTRUMPS.TEACHERSNOTES_URL',

            'WORKSHEETS.NEWSPAPERSHELVES.TITLE', 'WORKSHEETS.NEWSPAPERSHELVES.SUMMARY', 'WORKSHEETS.NEWSPAPERSHELVES.DESCRIPTION',
            'WORKSHEETS.NEWSPAPERSHELVES.WORKSHEET_1.URL',
            'WORKSHEETS.NEWSPAPERSHELVES.TEACHERSNOTES_URL',

            'WORKSHEETS.HEADLINETESTING.TITLE', 'WORKSHEETS.HEADLINETESTING.SUMMARY', 'WORKSHEETS.HEADLINETESTING.DESCRIPTION',
            'WORKSHEETS.HEADLINETESTING.WORKSHEET_1.URL',
            'WORKSHEETS.HEADLINETESTING.TEACHERSNOTES_URL',

            'WORKSHEETS.FINDIT.TITLE', 'WORKSHEETS.FINDIT.SUMMARY', 'WORKSHEETS.FINDIT.DESCRIPTION',
            'WORKSHEETS.FINDIT.WORKSHEET_1.URL',
            'WORKSHEETS.FINDIT.TEACHERSNOTES_URL',

            'WORKSHEETS.JARGONBUSTER.TITLE', 'WORKSHEETS.JARGONBUSTER.SUMMARY', 'WORKSHEETS.JARGONBUSTER.DESCRIPTION',
            'WORKSHEETS.JARGONBUSTER.WORKSHEET_1.URL',
            'WORKSHEETS.JARGONBUSTER.TEACHERSNOTES_URL',

            'WORKSHEETS.TITANIC.TITLE', 'WORKSHEETS.TITANIC.SUMMARY', 'WORKSHEETS.TITANIC.DESCRIPTION',
            'WORKSHEETS.TITANIC.WORKSHEET_1.URL',
            'WORKSHEETS.TITANIC.TEACHERSNOTES_URL',

            'WORKSHEETS.ZOMBIEESCAPE.TITLE', 'WORKSHEETS.ZOMBIEESCAPE.SUMMARY', 'WORKSHEETS.ZOMBIEESCAPE.DESCRIPTION',
            'WORKSHEETS.ZOMBIEESCAPE.WORKSHEET_1.URL',
            'WORKSHEETS.ZOMBIEESCAPE.TEACHERSNOTES_URL',

            'WORKSHEETS.PHISHING.TITLE', 'WORKSHEETS.PHISHING.SUMMARY', 'WORKSHEETS.PHISHING.DESCRIPTION',
            'WORKSHEETS.PHISHING.WORKSHEET_1.URL',
            'WORKSHEETS.PHISHING.TEACHERSNOTES_URL',

            // 'WORKSHEETS.KIWIORSTOAT.TITLE', 'WORKSHEETS.KIWIORSTOAT.SUMMARY', 'WORKSHEETS.KIWIORSTOAT.DESCRIPTION',
            // 'WORKSHEETS.KIWIORSTOAT.WORKSHEET_1.URL',
            // 'WORKSHEETS.KIWIORSTOAT.TEACHERSNOTES_URL',

            'WORKSHEETS.INKBLOTS.TITLE', 'WORKSHEETS.INKBLOTS.SUMMARY', 'WORKSHEETS.INKBLOTS.DESCRIPTION',
            'WORKSHEETS.INKBLOTS.WORKSHEET_1.URL',
            'WORKSHEETS.INKBLOTS.TEACHERSNOTES_URL',

            'WORKSHEETS.FACEFINDER.TITLE', 'WORKSHEETS.FACEFINDER.SUMMARY', 'WORKSHEETS.FACEFINDER.DESCRIPTION',
            'WORKSHEETS.FACEFINDER.WORKSHEET_1.URL',
            'WORKSHEETS.FACEFINDER.TEACHERSNOTES_URL',

            'WORKSHEETS.EMOJIMASK.TITLE', 'WORKSHEETS.EMOJIMASK.SUMMARY', 'WORKSHEETS.EMOJIMASK.DESCRIPTION',
            'WORKSHEETS.EMOJIMASK.WORKSHEET_1.URL',
            'WORKSHEETS.EMOJIMASK.TEACHERSNOTES_URL',

            'WORKSHEETS.LASEREYES.TITLE', 'WORKSHEETS.LASEREYES.SUMMARY', 'WORKSHEETS.LASEREYES.DESCRIPTION',
            'WORKSHEETS.LASEREYES.WORKSHEET_1.URL',
            'WORKSHEETS.LASEREYES.TEACHERSNOTES_URL',

            'WORKSHEETS.SEMAPHORES.TITLE', 'WORKSHEETS.SEMAPHORES.SUMMARY', 'WORKSHEETS.SEMAPHORES.DESCRIPTION',
            'WORKSHEETS.SEMAPHORES.WORKSHEET_1.URL',
            'WORKSHEETS.SEMAPHORES.TEACHERSNOTES_URL',

            'WORKSHEETS.HANDGESTURES.TITLE', 'WORKSHEETS.HANDGESTURES.SUMMARY', 'WORKSHEETS.HANDGESTURES.DESCRIPTION',
            'WORKSHEETS.HANDGESTURES.WORKSHEET_1.URL',
            'WORKSHEETS.HANDGESTURES.TEACHERSNOTES_URL',

            'WORKSHEETS.EXPLAINABILITY.TITLE', 'WORKSHEETS.EXPLAINABILITY.SUMMARY', 'WORKSHEETS.EXPLAINABILITY.DESCRIPTION',
            'WORKSHEETS.EXPLAINABILITY.WORKSHEET_1.URL',
            'WORKSHEETS.EXPLAINABILITY.TEACHERSNOTES_URL',

            'WORKSHEETS.POKEMONIMAGES.TITLE', 'WORKSHEETS.POKEMONIMAGES.SUMMARY', 'WORKSHEETS.POKEMONIMAGES.DESCRIPTION',
            'WORKSHEETS.POKEMONIMAGES.WORKSHEET_1.URL',
            'WORKSHEETS.POKEMONSTATS.TITLE', 'WORKSHEETS.POKEMONSTATS.SUMMARY', 'WORKSHEETS.POKEMONSTATS.DESCRIPTION',
            'WORKSHEETS.POKEMONSTATS.WORKSHEET_1.URL',

            'WORKSHEETS.ISPY.TITLE', 'WORKSHEETS.ISPY.SUMMARY', 'WORKSHEETS.ISPY.DESCRIPTION',
            'WORKSHEETS.ISPY.WORKSHEET_1.URL'

        ]).then(function (translations) {
            vm.worksheets = [
                {
                    title : translations['WORKSHEETS.DESCRIBETHEGLASS.TITLE'],
                    summary : translations['WORKSHEETS.DESCRIBETHEGLASS.SUMMARY'],
                    description : translations['WORKSHEETS.DESCRIBETHEGLASS.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'numbers',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-describetheglass.png',
                    tags : [ 'decision tree learning' ],
                    teachersnotes : translations['WORKSHEETS.DESCRIBETHEGLASS.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.DESCRIBETHEGLASS.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.POKEMONIMAGES.TITLE'],
                    summary : translations['WORKSHEETS.POKEMONIMAGES.SUMMARY'],
                    description : translations['WORKSHEETS.POKEMONIMAGES.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'images',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-pokemonimages.png',
                    tags : [ 'image classification', 'supervised learning' ],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.POKEMONIMAGES.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.SMARTCLASSROOM.TITLE'],
                    summary : translations['WORKSHEETS.SMARTCLASSROOM.SUMMARY'],
                    description : translations['WORKSHEETS.SMARTCLASSROOM.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'text',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-smartclassroom.png',
                    tags : [ 'digital assistants', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.SMARTCLASSROOM.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            description : translations['WORKSHEETS.SMARTCLASSROOM.WORKSHEET_1.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.SMARTCLASSROOM.WORKSHEET_1.URL']
                        },
                        {
                            description : translations['WORKSHEETS.SMARTCLASSROOM.WORKSHEET_2.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.SMARTCLASSROOM.WORKSHEET_2.URL']
                        },
                        {
                            description : translations['WORKSHEETS.SMARTCLASSROOM.WORKSHEET_3.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.SMARTCLASSROOM.WORKSHEET_3.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.ISPY.TITLE'],
                    summary : translations['WORKSHEETS.ISPY.SUMMARY'],
                    description : translations['WORKSHEETS.ISPY.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'images',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-ispy.png',
                    tags : [ 'image recognition', 'pretrained models' ],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.ISPY.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.MAKEMEHAPPY.TITLE'],
                    summary : translations['WORKSHEETS.MAKEMEHAPPY.SUMMARY'],
                    description : translations['WORKSHEETS.MAKEMEHAPPY.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'text',
                    maketypes : [ 'scratch3', 'python' ],
                    image : 'static/images/project-makemehappy.png',
                    tags : [ 'sentiment analysis', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.MAKEMEHAPPY.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            description : translations['WORKSHEETS.MAKEMEHAPPY.WORKSHEET_1.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.MAKEMEHAPPY.WORKSHEET_1.URL']
                        },
                        {
                            description : translations['WORKSHEETS.MAKEMEHAPPY.WORKSHEET_2.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.MAKEMEHAPPY.WORKSHEET_2.URL']
                        },
                        {
                            description : translations['WORKSHEETS.MAKEMEHAPPY.WORKSHEET_3.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.MAKEMEHAPPY.WORKSHEET_3.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.POKEMONSTATS.TITLE'],
                    summary : translations['WORKSHEETS.POKEMONSTATS.SUMMARY'],
                    description : translations['WORKSHEETS.POKEMONSTATS.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'numbers',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-pokemonstatistics.png',
                    tags : [ 'predictive model', 'supervised learning' ],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.POKEMONSTATS.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.SNAP.TITLE'],
                    summary : translations['WORKSHEETS.SNAP.SUMMARY'],
                    description : translations['WORKSHEETS.SNAP.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'images',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-snap.png',
                    tags : [ 'image classification', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.SNAP.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            description : translations['WORKSHEETS.SNAP.WORKSHEET_1.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.SNAP.WORKSHEET_1.URL']
                        },
                        {
                            description : translations['WORKSHEETS.SNAP.WORKSHEET_2.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.SNAP.WORKSHEET_2.URL'],
                            resources : translations['WORKSHEETS.SNAP.WORKSHEET_2.RESOURCES']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.QUIZSHOW.TITLE'],
                    summary : translations['WORKSHEETS.QUIZSHOW.SUMMARY'],
                    description : translations['WORKSHEETS.QUIZSHOW.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'text',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-quizshow.png',
                    tags : [ 'question answering' ],
                    teachersnotes : translations['WORKSHEETS.QUIZSHOW.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.QUIZSHOW.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.CHAMELEON.TITLE'],
                    summary : translations['WORKSHEETS.CHAMELEON.SUMMARY'],
                    description : translations['WORKSHEETS.CHAMELEON.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'images',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-chameleon.png',
                    tags : [ 'image classification', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.CHAMELEON.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.CHAMELEON.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.TITANIC.TITLE'],
                    summary : translations['WORKSHEETS.TITANIC.SUMMARY'],
                    description : translations['WORKSHEETS.TITANIC.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'numbers',
                    maketypes : [ 'python' ],
                    image : 'static/images/project-titanic.png',
                    tags : [ 'predictive model', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.TITANIC.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.TITANIC.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.MAILMANMAX.TITLE'],
                    summary : translations['WORKSHEETS.MAILMANMAX.SUMMARY'],
                    description : translations['WORKSHEETS.MAILMANMAX.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'images',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-mailmanmax.png',
                    tags : [ 'optical character recognition', 'handwriting recognition', 'image classification' ],
                    teachersnotes : translations['WORKSHEETS.MAILMANMAX.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.MAILMANMAX.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.SHOOTTHEBUG.TITLE'],
                    summary : translations['WORKSHEETS.SHOOTTHEBUG.SUMMARY'],
                    description : translations['WORKSHEETS.SHOOTTHEBUG.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'numbers',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-shootthebug.png',
                    tags : [ 'decision tree learning' ],
                    teachersnotes : translations['WORKSHEETS.SHOOTTHEBUG.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.SHOOTTHEBUG.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.CARORCUP.TITLE'],
                    summary : translations['WORKSHEETS.CARORCUP.SUMMARY'],
                    description : translations['WORKSHEETS.CARORCUP.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'images',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-carorcup.png',
                    tags : [ 'image classification', 'supervised learning', 'crowd sourcing' ],
                    teachersnotes : translations['WORKSHEETS.CARORCUP.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            description : translations['WORKSHEETS.CARORCUP.WORKSHEET_1.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.CARORCUP.WORKSHEET_1.URL']
                        },
                        {
                            description : translations['WORKSHEETS.CARORCUP.WORKSHEET_2.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.CARORCUP.WORKSHEET_2.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.FACELOCK.TITLE'],
                    summary : translations['WORKSHEETS.FACELOCK.SUMMARY'],
                    description : translations['WORKSHEETS.FACELOCK.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'images',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-facelock.png',
                    tags : [ 'facial recognition', 'biometrics', 'image classification', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.FACELOCK.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.FACELOCK.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.JOURNEYTOSCHOOL.TITLE'],
                    summary : translations['WORKSHEETS.JOURNEYTOSCHOOL.SUMMARY'],
                    description : translations['WORKSHEETS.JOURNEYTOSCHOOL.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'numbers',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-journeytoschool.png',
                    tags : [ 'predictive model', 'testing and accuracy', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.JOURNEYTOSCHOOL.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.JOURNEYTOSCHOOL.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.SHYPANDA.TITLE'],
                    summary : translations['WORKSHEETS.SHYPANDA.SUMMARY'],
                    description : translations['WORKSHEETS.SHYPANDA.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'images',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-shypanda.png',
                    tags : [ 'image classification', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.SHYPANDA.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.SHYPANDA.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.ALIENLANGUAGE.TITLE'],
                    summary : translations['WORKSHEETS.ALIENLANGUAGE.SUMMARY'],
                    description : translations['WORKSHEETS.ALIENLANGUAGE.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'sounds',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-alienlanguage.png',
                    tags : [ 'sound recognition', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.ALIENLANGUAGE.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.ALIENLANGUAGE.WORKSHEET_1.URL']
                        }
                    ]
                },
                // {
                //     title : translations['WORKSHEETS.KIWIORSTOAT.TITLE'],
                //     summary : translations['WORKSHEETS.KIWIORSTOAT.SUMMARY'],
                //     description : translations['WORKSHEETS.KIWIORSTOAT.DESCRIPTION'],
                //     difficulty : 'Beginner',
                //     type : 'images',
                //     maketypes : [ 'scratch3' ],
                //     image : 'static/images/project-kiwiorstoat.png',
                //     tags : [ 'image classification', 'supervised learning' ],
                //     downloads : [
                //         {
                //             worksheet : translations['WORKSHEETS.KIWIORSTOAT.WORKSHEET_1.URL']
                //         }
                //     ],
                //     providedby : {
                //         name: 'Wildlife.ai',
                //         url: 'https://www.wildlife.ai/about-us/',
                //         embed: $sce.trustAsHtml('<div class="worksheetcardembeddiv"><iframe src="https://player.vimeo.com/video/378414131?byline=0&portrait=0" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>')
                //     }
                // },
                {
                    title : translations['WORKSHEETS.PACMAN.TITLE'],
                    summary : translations['WORKSHEETS.PACMAN.SUMMARY'],
                    description : translations['WORKSHEETS.PACMAN.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'numbers',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-pacman.png',
                    tags : [ 'decision tree learning' ],
                    teachersnotes : translations['WORKSHEETS.PACMAN.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.PACMAN.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.CHATBOTS.TITLE'],
                    summary : translations['WORKSHEETS.CHATBOTS.SUMMARY'],
                    description : translations['WORKSHEETS.CHATBOTS.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'text',
                    maketypes : [ 'scratch3', 'python' ],
                    image : 'static/images/project-chatbots.png',
                    tags : [ 'sentiment analysis', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.CHATBOTS.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            description : translations['WORKSHEETS.CHATBOTS.WORKSHEET_1.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.CHATBOTS.WORKSHEET_1.URL']
                        },
                        {
                            description : translations['WORKSHEETS.CHATBOTS.WORKSHEET_2.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.CHATBOTS.WORKSHEET_2.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.ZOMBIEESCAPE.TITLE'],
                    summary : translations['WORKSHEETS.ZOMBIEESCAPE.SUMMARY'],
                    description : translations['WORKSHEETS.ZOMBIEESCAPE.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'numbers',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-zombieescape.png',
                    tags : [ 'supervised learning', 'feature selection', 'decision tree learning' ],
                    teachersnotes : translations['WORKSHEETS.ZOMBIEESCAPE.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.ZOMBIEESCAPE.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.VIRTUALPET.TITLE'],
                    summary : translations['WORKSHEETS.VIRTUALPET.SUMMARY'],
                    description : translations['WORKSHEETS.VIRTUALPET.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'images',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-virtualpet.png',
                    tags : [ 'image classification', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.VIRTUALPET.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.VIRTUALPET.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.TOURISTINFO.TITLE'],
                    summary : translations['WORKSHEETS.TOURISTINFO.SUMMARY'],
                    description : translations['WORKSHEETS.TOURISTINFO.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'text',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-touristinfo.png',
                    tags : [ 'training bias', 'recommendations', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.TOURISTINFO.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.TOURISTINFO.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.INKBLOTS.TITLE'],
                    summary : translations['WORKSHEETS.INKBLOTS.SUMMARY'],
                    description : translations['WORKSHEETS.INKBLOTS.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'images',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-inkblots.png',
                    tags : [ 'image classification', 'supervised learning', 'AI research' ],
                    teachersnotes : translations['WORKSHEETS.INKBLOTS.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.INKBLOTS.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.SECRETCODE.TITLE'],
                    summary : translations['WORKSHEETS.SECRETCODE.SUMMARY'],
                    description : translations['WORKSHEETS.SECRETCODE.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'sounds',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-secretcode.png',
                    tags : [ 'speech recognition', 'sound recognition', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.SECRETCODE.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.SECRETCODE.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.SORTINGHAT.TITLE'],
                    summary : translations['WORKSHEETS.SORTINGHAT.SUMMARY'],
                    description : translations['WORKSHEETS.SORTINGHAT.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'text',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-sortinghat.png',
                    tags : [ 'text classification', 'supervised learning', 'crowd sourcing' ],
                    teachersnotes : translations['WORKSHEETS.SORTINGHAT.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            description : translations['WORKSHEETS.SORTINGHAT.WORKSHEET_1.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.SORTINGHAT.WORKSHEET_1.URL']
                        },
                        {
                            description : translations['WORKSHEETS.SORTINGHAT.WORKSHEET_2.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.SORTINGHAT.WORKSHEET_2.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.ROCKPAPERSCISSORS.TITLE'],
                    summary : translations['WORKSHEETS.ROCKPAPERSCISSORS.SUMMARY'],
                    description : translations['WORKSHEETS.ROCKPAPERSCISSORS.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'images',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-rockpaperscissors.png',
                    tags : [ 'image classification', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.ROCKPAPERSCISSORS.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.ROCKPAPERSCISSORS.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.NEWSPAPERSHELVES.TITLE'],
                    summary : translations['WORKSHEETS.NEWSPAPERSHELVES.SUMMARY'],
                    description : translations['WORKSHEETS.NEWSPAPERSHELVES.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'text',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-headlines-easy.png',
                    tags : [ 'text classification', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.NEWSPAPERSHELVES.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.NEWSPAPERSHELVES.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.JUDGEABOOK.TITLE'],
                    summary : translations['WORKSHEETS.JUDGEABOOK.SUMMARY'],
                    description : translations['WORKSHEETS.JUDGEABOOK.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'images',
                    maketypes : [ 'scratch3', 'appinventor' ],
                    image : 'static/images/project-judgeabook.png',
                    tags : [ 'image classification', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.JUDGEABOOK.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            description : translations['WORKSHEETS.JUDGEABOOK.WORKSHEET_1.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.JUDGEABOOK.WORKSHEET_1.URL']
                        },
                        {
                            description : translations['WORKSHEETS.JUDGEABOOK.WORKSHEET_2.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.JUDGEABOOK.WORKSHEET_2.URL']
                        },
                        {
                            description : translations['WORKSHEETS.JUDGEABOOK.WORKSHEET_3.DESCRIPTION'],
                            worksheet : translations['WORKSHEETS.JUDGEABOOK.WORKSHEET_3.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.FOOLED.TITLE'],
                    summary : translations['WORKSHEETS.FOOLED.SUMMARY'],
                    description : translations['WORKSHEETS.FOOLED.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'images',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-fooled.png',
                    tags : [ 'image classification', 'supervised learning', 'overfitting' ],
                    teachersnotes : translations['WORKSHEETS.FOOLED.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.FOOLED.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.SCHOOLLIBRARY.TITLE'],
                    summary : translations['WORKSHEETS.SCHOOLLIBRARY.SUMMARY'],
                    description : translations['WORKSHEETS.SCHOOLLIBRARY.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'numbers',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-schoollibrary.png',
                    tags : [ 'predictive model', 'recommendations', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.SCHOOLLIBRARY.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.SCHOOLLIBRARY.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.JARGONBUSTER.TITLE'],
                    summary : translations['WORKSHEETS.JARGONBUSTER.SUMMARY'],
                    description : translations['WORKSHEETS.JARGONBUSTER.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'sounds',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-jargonbuster.png',
                    tags : [ 'speech recognition', 'sound recognition', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.JARGONBUSTER.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.JARGONBUSTER.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.EXPLAINABILITY.TITLE'],
                    summary : translations['WORKSHEETS.EXPLAINABILITY.SUMMARY'],
                    description : translations['WORKSHEETS.EXPLAINABILITY.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'images',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-explainability.png',
                    tags : [ 'image recognition', 'explainable AI', 'xai' ],
                    teachersnotes : translations['WORKSHEETS.EXPLAINABILITY.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.EXPLAINABILITY.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.WHATTWITTERTHINKS.TITLE'],
                    summary : translations['WORKSHEETS.WHATTWITTERTHINKS.SUMMARY'],
                    description : translations['WORKSHEETS.WHATTWITTERTHINKS.DESCRIPTION'],
                    difficulty : 'Advanced',
                    type : 'text',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-whattwitterthinks.png',
                    tags : [ 'sentiment analysis', 'social media analysis', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.WHATTWITTERTHINKS.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.WHATTWITTERTHINKS.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.NOUGHTSANDCROSSES.TITLE'],
                    summary : translations['WORKSHEETS.NOUGHTSANDCROSSES.SUMMARY'],
                    description : translations['WORKSHEETS.NOUGHTSANDCROSSES.DESCRIPTION'],
                    difficulty : 'Advanced',
                    type : 'numbers',
                    maketypes : [ 'python' ],
                    image : 'static/images/project-noughtsandcrosses.png',
                    tags : [ 'decision tree learning', 'reinforcement learning', 'categorical data' ],
                    teachersnotes : translations['WORKSHEETS.NOUGHTSANDCROSSES.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.NOUGHTSANDCROSSES.WORKSHEET_2.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.TOPTRUMPS.TITLE'],
                    summary : translations['WORKSHEETS.TOPTRUMPS.SUMMARY'],
                    description : translations['WORKSHEETS.TOPTRUMPS.DESCRIPTION'],
                    difficulty : 'Advanced',
                    type : 'numbers',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-toptrumps.png',
                    tags : [ 'decision tree learning', 'reinforcement learning', 'categorical data' ],
                    teachersnotes : translations['WORKSHEETS.TOPTRUMPS.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.TOPTRUMPS.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.HEADLINETESTING.TITLE'],
                    summary : translations['WORKSHEETS.HEADLINETESTING.SUMMARY'],
                    description : translations['WORKSHEETS.HEADLINETESTING.DESCRIPTION'],
                    difficulty : 'Advanced',
                    type : 'text',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-headlines.png',
                    tags : [ 'text classification', 'supervised learning', 'testing' ],
                    teachersnotes : translations['WORKSHEETS.HEADLINETESTING.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.HEADLINETESTING.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.FINDIT.TITLE'],
                    summary : translations['WORKSHEETS.FINDIT.SUMMARY'],
                    description : translations['WORKSHEETS.FINDIT.DESCRIPTION'],
                    difficulty : 'Advanced',
                    type : 'images',
                    maketypes : [ 'appinventor' ],
                    image : 'static/images/project-findit.png',
                    tags : [ 'image classification', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.FINDIT.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.FINDIT.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.PHISHING.TITLE'],
                    summary : translations['WORKSHEETS.PHISHING.SUMMARY'],
                    description : translations['WORKSHEETS.PHISHING.DESCRIPTION'],
                    difficulty : 'Advanced',
                    type : 'numbers',
                    maketypes : [ 'python' ],
                    image : 'static/images/dataset-phishing.png',
                    tags : [ 'decision tree learning', 'AI research', 'categorical data' ],
                    teachersnotes : translations['WORKSHEETS.PHISHING.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.PHISHING.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.FACEFINDER.TITLE'],
                    summary : translations['WORKSHEETS.FACEFINDER.SUMMARY'],
                    description : translations['WORKSHEETS.FACEFINDER.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'faces',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-facefinder.png',
                    tags : [ 'face detection' ],
                    teachersnotes : translations['WORKSHEETS.FACEFINDER.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.FACEFINDER.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.EMOJIMASK.TITLE'],
                    summary : translations['WORKSHEETS.EMOJIMASK.SUMMARY'],
                    description : translations['WORKSHEETS.EMOJIMASK.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'faces',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-emojimask.png',
                    tags : [ 'face detection' ],
                    teachersnotes : translations['WORKSHEETS.EMOJIMASK.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.EMOJIMASK.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.LASEREYES.TITLE'],
                    summary : translations['WORKSHEETS.LASEREYES.SUMMARY'],
                    description : translations['WORKSHEETS.LASEREYES.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'sounds',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-lasereyes.png',
                    tags : [ 'speech recognition', 'face detection' ],
                    teachersnotes : translations['WORKSHEETS.LASEREYES.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.LASEREYES.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.SEMAPHORES.TITLE'],
                    summary : translations['WORKSHEETS.SEMAPHORES.SUMMARY'],
                    description : translations['WORKSHEETS.SEMAPHORES.DESCRIPTION'],
                    difficulty : 'Advanced',
                    type : 'sounds',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-semaphores.png',
                    tags : [ 'speech recognition', 'pose detection' ],
                    teachersnotes : translations['WORKSHEETS.SEMAPHORES.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.SEMAPHORES.WORKSHEET_1.URL']
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.HANDGESTURES.TITLE'],
                    summary : translations['WORKSHEETS.HANDGESTURES.SUMMARY'],
                    description : translations['WORKSHEETS.HANDGESTURES.DESCRIPTION'],
                    difficulty : 'Advanced',
                    type : 'numbers',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-handgestures.png',
                    tags : [ 'image recognition', 'pretrained models' ],
                    teachersnotes : translations['WORKSHEETS.HANDGESTURES.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.HANDGESTURES.WORKSHEET_1.URL']
                        }
                    ]
                }
            ];
        });

        vm.downloadWorksheet = function (ev, worksheet) {
            $mdDialog.show({
                locals : {
                    worksheet : worksheet
                },
                controller : function ($scope, locals) {
                    $scope.worksheet = locals.worksheet;
                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                },
                templateUrl : 'static/components/worksheets/download.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            });
        };


        $scope.projecttype = 'ALL';
        $scope.projectdifficulty = 'ALL';
        $scope.projectmaketype = 'ALL';

        $scope.filterWorksheets = function (item) {
            var match = true;

            if (($scope.projecttype !== 'ALL') && match) {
                match = (item.type === $scope.projecttype);
            }
            if (($scope.projectdifficulty !== 'ALL') && match) {
                match = (item.difficulty === $scope.projectdifficulty);
            }
            if (($scope.projectmaketype !== 'ALL') && match) {
                match = (($scope.projectmaketype === 'python' && item.maketypes.indexOf('python') >= 0) ||
                         ($scope.projectmaketype === 'appinventor' && item.maketypes.indexOf('appinventor') >= 0) ||
                         (($scope.projectmaketype === 'scratch') && (item.maketypes.indexOf('scratch2') >= 0 ||
                                                                     item.maketypes.indexOf('scratch3') >= 0)));
            }
            return match;
        };

    }
}());
