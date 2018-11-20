(function () {

    angular
        .module('app')
        .controller('WorksheetsController', WorksheetsController);

    WorksheetsController.$inject = [
        '$stateParams',
        '$translate',
        '$mdDialog', '$scope'
    ];

    function WorksheetsController($stateParams, $translate, $mdDialog, $scope) {

        var vm = this;

        vm.worksheets = [];
        $translate([
            'WORKSHEETS.SMARTCLASSROOM.TITLE', 'WORKSHEETS.SMARTCLASSROOM.SUMMARY', 'WORKSHEETS.SMARTCLASSROOM.DESCRIPTION',
            'WORKSHEETS.MAKEMEHAPPY.TITLE', 'WORKSHEETS.MAKEMEHAPPY.SUMMARY', 'WORKSHEETS.MAKEMEHAPPY.DESCRIPTION',
            'WORKSHEETS.SNAP.TITLE', 'WORKSHEETS.SNAP.SUMMARY', 'WORKSHEETS.SNAP.DESCRIPTION',
            'WORKSHEETS.CHAMELEON.TITLE', 'WORKSHEETS.CHAMELEON.SUMMARY', 'WORKSHEETS.CHAMELEON.DESCRIPTION',
            'WORKSHEETS.MAILMANMAX.TITLE', 'WORKSHEETS.MAILMANMAX.SUMMARY', 'WORKSHEETS.MAILMANMAX.DESCRIPTION',
            'WORKSHEETS.CARORCUP.TITLE', 'WORKSHEETS.CARORCUP.SUMMARY', 'WORKSHEETS.CARORCUP.DESCRIPTION',
            'WORKSHEETS.FACELOCK.TITLE', 'WORKSHEETS.FACELOCK.SUMMARY', 'WORKSHEETS.FACELOCK.DESCRIPTION',
            'WORKSHEETS.JOURNEYTOSCHOOL.TITLE', 'WORKSHEETS.JOURNEYTOSCHOOL.SUMMARY', 'WORKSHEETS.JOURNEYTOSCHOOL.DESCRIPTION',
            'WORKSHEETS.SHYPANDA.TITLE', 'WORKSHEETS.SHYPANDA.SUMMARY', 'WORKSHEETS.SHYPANDA.DESCRIPTION',
            'WORKSHEETS.VIRTUALPET.TITLE', 'WORKSHEETS.VIRTUALPET.SUMMARY', 'WORKSHEETS.VIRTUALPET.DESCRIPTION',
            'WORKSHEETS.PACMAN.TITLE', 'WORKSHEETS.PACMAN.SUMMARY', 'WORKSHEETS.PACMAN.DESCRIPTION',
            'WORKSHEETS.CHATBOTS.TITLE', 'WORKSHEETS.CHATBOTS.SUMMARY', 'WORKSHEETS.CHATBOTS.DESCRIPTION',
            'WORKSHEETS.TOURISTINFO.TITLE', 'WORKSHEETS.TOURISTINFO.SUMMARY', 'WORKSHEETS.TOURISTINFO.DESCRIPTION',
            'WORKSHEETS.SORTINGHAT.TITLE', 'WORKSHEETS.SORTINGHAT.SUMMARY', 'WORKSHEETS.SORTINGHAT.DESCRIPTION',
            'WORKSHEETS.ROCKPAPERSCISSORS.TITLE', 'WORKSHEETS.ROCKPAPERSCISSORS.SUMMARY', 'WORKSHEETS.ROCKPAPERSCISSORS.DESCRIPTION',
            'WORKSHEETS.JUDGEABOOK.TITLE', 'WORKSHEETS.JUDGEABOOK.SUMMARY', 'WORKSHEETS.JUDGEABOOK.DESCRIPTION',
            'WORKSHEETS.LOCATELARRY.TITLE', 'WORKSHEETS.LOCATELARRY.SUMMARY', 'WORKSHEETS.LOCATELARRY.DESCRIPTION',
            'WORKSHEETS.CONFUSED.TITLE', 'WORKSHEETS.CONFUSED.SUMMARY', 'WORKSHEETS.CONFUSED.DESCRIPTION',
            'WORKSHEETS.SCHOOLLIBRARY.TITLE', 'WORKSHEETS.SCHOOLLIBRARY.SUMMARY', 'WORKSHEETS.SCHOOLLIBRARY.DESCRIPTION',
            'WORKSHEETS.WHATTWITTERTHINKS.TITLE', 'WORKSHEETS.WHATTWITTERTHINKS.SUMMARY', 'WORKSHEETS.WHATTWITTERTHINKS.DESCRIPTION',
            'WORKSHEETS.NOUGHTSANDCROSSES.TITLE', 'WORKSHEETS.NOUGHTSANDCROSSES.SUMMARY', 'WORKSHEETS.NOUGHTSANDCROSSES.DESCRIPTION',
            'WORKSHEETS.TOPTRUMPS.TITLE', 'WORKSHEETS.TOPTRUMPS.SUMMARY', 'WORKSHEETS.TOPTRUMPS.DESCRIPTION',
            'WORKSHEETS.HEADLINES.TITLE', 'WORKSHEETS.HEADLINES.SUMMARY', 'WORKSHEETS.HEADLINES.DESCRIPTION'
        ]).then(function (translations) {
            vm.worksheets = [
                {
                    title : translations['WORKSHEETS.SMARTCLASSROOM.TITLE'],
                    summary : translations['WORKSHEETS.SMARTCLASSROOM.SUMMARY'],
                    description : translations['WORKSHEETS.SMARTCLASSROOM.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'text',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-smartclassroom.png',
                    tags : [ 'digital assistants', 'supervised learning' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-smartclassroom.pdf',
                    downloads : [
                        {
                            description : 'Full version of the project, where the students make a non-machine learning version first',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-smartclassroom.pdf'
                        },
                        {
                            description : 'Shorter version of the project, where the students only make a machine learning version of the assistant',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-smartclassroom-easy.pdf'
                        },
                        {
                            description : 'Quick simplified version of the project, ideal for use as a first introduction to the tool',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-smartclassroom-tryitnow.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.MAKEMEHAPPY.TITLE'],
                    summary : translations['WORKSHEETS.MAKEMEHAPPY.SUMMARY'],
                    description : translations['WORKSHEETS.MAKEMEHAPPY.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'text',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-makemehappy.png',
                    tags : [ 'sentiment analysis', 'supervised learning' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-makemehappy.pdf',
                    downloads : [
                        {
                            description : 'Full version of the project, where the students make a non-machine learning version of the project first',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-makemehappy.pdf'
                        },
                        {
                            description : 'Shorter version of the project, where the students only make a machine learning version of the assistant',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-makemehappy-easy.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.SNAP.TITLE'],
                    summary : translations['WORKSHEETS.SNAP.SUMMARY'],
                    description : translations['WORKSHEETS.SNAP.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'images',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-snap.png',
                    tags : [ 'image classification', 'supervised learning' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-snap.pdf',
                    downloads : [
                        {
                            description : 'Full version of the project, where the students make their own cards that they will train the computer to recognise',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-snap.pdf'
                        },
                        {
                            description : 'Shorter version of the project, providing children with pre-made cards that you will need to print out, to save the students time having to make them',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-snap-easy.pdf',
                            resources : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/resources-snap-easy.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.CHAMELEON.TITLE'],
                    summary : translations['WORKSHEETS.CHAMELEON.SUMMARY'],
                    description : translations['WORKSHEETS.CHAMELEON.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'images',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-chameleon.png',
                    tags : [ 'image classification', 'supervised learning' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-chameleon.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-chameleon.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.MAILMANMAX.TITLE'],
                    summary : translations['WORKSHEETS.MAILMANMAX.SUMMARY'],
                    description : translations['WORKSHEETS.MAILMANMAX.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'images',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-mailmanmax.png',
                    tags : [ 'optical character recognition', 'handwriting recognition', 'image classification' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-mailmanmax.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-mailmanmax.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.CARORCUP.TITLE'],
                    summary : translations['WORKSHEETS.CARORCUP.SUMMARY'],
                    description : translations['WORKSHEETS.CARORCUP.DESCRIPTION'],
                    difficulty : 'Beginner',
                    type : 'images',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-carorcup.png',
                    tags : [ 'image classification', 'supervised learning', 'crowd sourcing' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-carorcup.pdf',
                    downloads : [
                        {
                            description : 'Individual version of the project, where each student trains their own machine learning model independently',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-carorcup.pdf'
                        },
                        {
                            description : 'Group version of the project, where all students in the class work together to train a shared machine learning model',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-carorcup-crowd.pdf'
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
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-facelock.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-facelock.pdf'
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
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-journeytoschool.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-journeytoschool.pdf'
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
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-shypanda.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-shypanda.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.PACMAN.TITLE'],
                    summary : translations['WORKSHEETS.PACMAN.SUMMARY'],
                    description : translations['WORKSHEETS.PACMAN.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'numbers',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-pacman.png',
                    tags : [ 'decision tree learning' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-pacman.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-pacman.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.CHATBOTS.TITLE'],
                    summary : translations['WORKSHEETS.CHATBOTS.SUMMARY'],
                    description : translations['WORKSHEETS.CHATBOTS.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'text',
                    maketypes : [ 'scratch2', 'python' ],
                    image : 'static/images/project-chatbots.png',
                    tags : [ 'sentiment analysis', 'supervised learning' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-chatbots.pdf',
                    downloads : [
                        {
                            description : 'Scratch project - for making a chat bot in Scratch',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-chatbots.pdf'
                        },
                        {
                            description : 'Python project - for making a chat bot using Python',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-chatbots-python.pdf'
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
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-virtualpet.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-virtualpet.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.TOURISTINFO.TITLE'],
                    summary : translations['WORKSHEETS.TOURISTINFO.SUMMARY'],
                    description : translations['WORKSHEETS.TOURISTINFO.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'text',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-touristinfo.png',
                    tags : [ 'training bias', 'recommendations', 'supervised learning' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-touristinfo.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-touristinfo.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.SORTINGHAT.TITLE'],
                    summary : translations['WORKSHEETS.SORTINGHAT.SUMMARY'],
                    description : translations['WORKSHEETS.SORTINGHAT.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'text',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-sortinghat.png',
                    tags : [ 'text classification', 'supervised learning', 'crowd sourcing' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-sortinghat.pdf',
                    downloads : [
                        {
                            description : 'Individual version of the project, where each student trains their own machine learning model independently',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-sortinghat.pdf'
                        },
                        {
                            description : 'Group version of the project, where all students in the class work together to train a shared machine learning model',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-sortinghat-crowd.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.ROCKPAPERSCISSORS.TITLE'],
                    summary : translations['WORKSHEETS.ROCKPAPERSCISSORS.SUMMARY'],
                    description : translations['WORKSHEETS.ROCKPAPERSCISSORS.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'images',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-rockpaperscissors.png',
                    tags : [ 'image classification', 'supervised learning' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-rockpaperscissors.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-rockpaperscissors.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.JUDGEABOOK.TITLE'],
                    summary : translations['WORKSHEETS.JUDGEABOOK.SUMMARY'],
                    description : translations['WORKSHEETS.JUDGEABOOK.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'images',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-judgeabook.png',
                    tags : [ 'image classification', 'supervised learning' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-judgeabook.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-judgeabook.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.LOCATELARRY.TITLE'],
                    summary : translations['WORKSHEETS.LOCATELARRY.SUMMARY'],
                    description : translations['WORKSHEETS.LOCATELARRY.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'images',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-locatelarry.png',
                    tags : [ 'image classification', 'supervised learning', 'image pre-processing' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-locatelarry.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-locatelarry.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.CONFUSED.TITLE'],
                    summary : translations['WORKSHEETS.CONFUSED.SUMMARY'],
                    description : translations['WORKSHEETS.CONFUSED.DESCRIPTION'],
                    difficulty : 'Intermediate',
                    type : 'images',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-confused.png',
                    tags : [ 'image classification', 'supervised learning', 'overfitting' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-confused.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-confused.pdf'
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
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-schoollibrary.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-schoollibrary.pdf'
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
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-whattwitterthinks.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-whattwitterthinks.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.NOUGHTSANDCROSSES.TITLE'],
                    summary : translations['WORKSHEETS.NOUGHTSANDCROSSES.SUMMARY'],
                    description : translations['WORKSHEETS.NOUGHTSANDCROSSES.DESCRIPTION'],
                    difficulty : 'Advanced',
                    type : 'numbers',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-noughtsandcrosses.png',
                    tags : [ 'decision tree learning', 'reinforcement learning', 'categorical data' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-noughtsandcrosses.pdf',
                    downloads : [
                        {
                            description : 'Classroom version, where each student makes the game themselves',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-noughtsandcrosses.pdf'
                        },
                        {
                            description : 'Demo version, for events like Science Fairs where each child has a minute or two to try something',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-noughtsandcrosses-event.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.TOPTRUMPS.TITLE'],
                    summary : translations['WORKSHEETS.TOPTRUMPS.SUMMARY'],
                    description : translations['WORKSHEETS.TOPTRUMPS.DESCRIPTION'],
                    difficulty : 'Advanced',
                    type : 'numbers',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-toptrumps.png',
                    tags : [ 'decision tree learning', 'reinforcement learning', 'categorical data' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-toptrumps.pdf',
                    downloads : [
                        {
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-toptrumps.pdf'
                        }
                    ]
                },
                {
                    title : translations['WORKSHEETS.HEADLINES.TITLE'],
                    summary : translations['WORKSHEETS.HEADLINES.SUMMARY'],
                    description : translations['WORKSHEETS.HEADLINES.DESCRIPTION'],
                    difficulty : 'Advanced',
                    type : 'text',
                    maketypes : [ 'scratch2' ],
                    image : 'static/images/project-headlines.png',
                    tags : [ 'text classification', 'supervised learning', 'testing' ],
                    teachersnotes : 'https://github.com/IBM/taxinomitis-docs/raw/master/teachers-notes/pdf/teachersnotes-headlines.pdf',
                    downloads : [
                        {
                            description : 'Simplified version of the project, where students make a simple project to put newspapers on the right shelves',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-headlines-easy.pdf'
                        },
                        {
                            description : 'Advanced version of the project, where students make a testing framework to analyse the performance of their model',
                            worksheet : 'https://github.com/IBM/taxinomitis-docs/raw/master/project-worksheets/pdf/worksheet-headlines.pdf'
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
                templateUrl : 'static/components-' + $stateParams.VERSION + '/worksheets/download.tmpl.html',
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
                         (($scope.projectmaketype === 'scratch') && (item.maketypes.indexOf('scratch2') >= 0 ||
                                                                     item.maketypes.indexOf('scratch3') >= 0)));
            }
            return match;
        };

    }
}());
