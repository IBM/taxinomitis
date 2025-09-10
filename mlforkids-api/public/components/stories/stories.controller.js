(function () {

    angular
        .module('app')
        .controller('StoriesController', StoriesController);

    StoriesController.$inject = [
        '$stateParams', '$state', '$scope', '$window', '$timeout', '$document', '$mdDialog', '$translate', '$sce'
    ];

    function StoriesController($stateParams, $state, $scope, $window, $timeout, $document, $mdDialog, $translate, $sce) {

        $scope.worksheets = {};

        var pageIds = [
            'ml-hasnt-replaced-coding',
            'ml-workflow',
            'correlation-of-quantity-with-accuracy',
            'crowdsourcing-and-gamification',
            'variety-of-training-data',
            'separation-of-training-and-test-data',
            'not-just-intents',
            'adding-errors-to-training',
            'confidence-scores',
            'black-box-challenge',
            'learning-the-wrong-thing',
            'testing-with-data-not-represented-in-training',
            'bias',
            'assembling-ml-solutions',
            'models-learn-to-do-specific-jobs',
            'invisible-ai'
        ];

        $scope.pageId = $stateParams.storyId;
        $scope.pageNum = pageIds.indexOf($stateParams.storyId);

        if ($scope.pageNum < 0) {
            $scope.pageNum = -1;
            $scope.pageId = 'intro';
        }

        $scope.datestring = new Date().toDateString();

        $scope.isPrinting = false;

        $scope.print = function () {
            $scope.isPrinting = true;
            $timeout(function () {
                $window.print();
            });
        };
        addEventListener('afterprint', () => {
            $scope.isPrinting = false;
        });

        $scope.changePage = function (pageNum) {
            scrollToId('topofstory');
            $state.transitionTo('stories', { storyId: pageIds[pageNum] }, {
                location: true,  // update URL
                inherit: true,
                relative: $state.$current,
                notify: false    // don't reload page
            });
        };


        $scope.displayStories = function (ev) {
            $mdDialog.show({
                controller : function ($scope) {
                    $scope.hide = function() {
                        $mdDialog.hide();
                    };
                    $scope.confirm = function(resp) {
                        $mdDialog.hide(resp);
                    };
                    $scope.cancel = function() {
                        $mdDialog.cancel();
                    };
                },
                templateUrl : 'static/components/stories/storieslist.tmpl.html',
                targetEvent : ev,
                clickOutsideToClose : true
            })
            .then(
                function (newPageNum) {
                    $scope.changePage(newPageNum);
                },
                function() {}
            );
        };


        $scope.downloadWorksheet = function (ev, worksheetid) {
            $mdDialog.show({
                locals : {
                    worksheet : $scope.worksheets[worksheetid]
                },
                controller : function ($scope, locals) {
                    if (locals.worksheet.video) {
                        $scope.video = $sce.trustAsResourceUrl('https://www.youtube.com/embed/' + locals.worksheet.video + '?rel=0&loop=1&playlist=' + locals.worksheet.video);
                    }
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


        function scrollToId(itemId) {
            $timeout(function () {
                var newItem = document.getElementById(itemId);
                $document.duScrollToElementAnimated(angular.element(newItem));
            }, 0);
        }
        $scope.scrollToVideo = function () {
            scrollToId('storyvideo');
        };


        $translate([
            'WORKSHEETS.FACEFINDER.TITLE', 'WORKSHEETS.FACEFINDER.SUMMARY', 'WORKSHEETS.FACEFINDER.DESCRIPTION',
            'WORKSHEETS.FACEFINDER.WORKSHEET_1.URL',
            'WORKSHEETS.FACEFINDER.TEACHERSNOTES_URL',

            'WORKSHEETS.CHATBOTS.TITLE', 'WORKSHEETS.CHATBOTS.SUMMARY', 'WORKSHEETS.CHATBOTS.DESCRIPTION',
            'WORKSHEETS.CHATBOTS.WORKSHEET_1.DESCRIPTION', 'WORKSHEETS.CHATBOTS.WORKSHEET_1.URL',
            'WORKSHEETS.CHATBOTS.WORKSHEET_2.DESCRIPTION', 'WORKSHEETS.CHATBOTS.WORKSHEET_2.URL',
            'WORKSHEETS.CHATBOTS.TEACHERSNOTES_URL',

            'WORKSHEETS.PACMAN.TITLE', 'WORKSHEETS.PACMAN.SUMMARY', 'WORKSHEETS.PACMAN.DESCRIPTION',
            'WORKSHEETS.PACMAN.WORKSHEET_1.URL',
            'WORKSHEETS.PACMAN.TEACHERSNOTES_URL',
            'WORKSHEETS.NOUGHTSANDCROSSES.TITLE', 'WORKSHEETS.NOUGHTSANDCROSSES.SUMMARY', 'WORKSHEETS.NOUGHTSANDCROSSES.DESCRIPTION',
            'WORKSHEETS.NOUGHTSANDCROSSES.WORKSHEET_1.DESCRIPTION', 'WORKSHEETS.NOUGHTSANDCROSSES.WORKSHEET_1.URL',
            'WORKSHEETS.NOUGHTSANDCROSSES.WORKSHEET_2.DESCRIPTION', 'WORKSHEETS.NOUGHTSANDCROSSES.WORKSHEET_2.URL',
            'WORKSHEETS.NOUGHTSANDCROSSES.WORKSHEET_3.DESCRIPTION', 'WORKSHEETS.NOUGHTSANDCROSSES.WORKSHEET_3.URL',
            'WORKSHEETS.NOUGHTSANDCROSSES.TEACHERSNOTES_URL',

            'WORKSHEETS.NEWSPAPERSHELVES.TITLE', 'WORKSHEETS.NEWSPAPERSHELVES.SUMMARY', 'WORKSHEETS.NEWSPAPERSHELVES.DESCRIPTION',
            'WORKSHEETS.NEWSPAPERSHELVES.WORKSHEET_1.URL',
            'WORKSHEETS.NEWSPAPERSHELVES.TEACHERSNOTES_URL',

            'WORKSHEETS.MAKEMEHAPPY.TITLE', 'WORKSHEETS.MAKEMEHAPPY.SUMMARY', 'WORKSHEETS.MAKEMEHAPPY.DESCRIPTION',
            'WORKSHEETS.MAKEMEHAPPY.WORKSHEET_1.DESCRIPTION', 'WORKSHEETS.MAKEMEHAPPY.WORKSHEET_1.URL',
            'WORKSHEETS.MAKEMEHAPPY.WORKSHEET_2.DESCRIPTION', 'WORKSHEETS.MAKEMEHAPPY.WORKSHEET_2.URL',
            'WORKSHEETS.MAKEMEHAPPY.WORKSHEET_3.DESCRIPTION', 'WORKSHEETS.MAKEMEHAPPY.WORKSHEET_3.URL',
            'WORKSHEETS.MAKEMEHAPPY.TEACHERSNOTES_URL',

            'WORKSHEETS.SMARTCLASSROOM.TITLE', 'WORKSHEETS.SMARTCLASSROOM.SUMMARY', 'WORKSHEETS.SMARTCLASSROOM.DESCRIPTION',
            'WORKSHEETS.SMARTCLASSROOM.WORKSHEET_1.DESCRIPTION', 'WORKSHEETS.SMARTCLASSROOM.WORKSHEET_1.URL',
            'WORKSHEETS.SMARTCLASSROOM.WORKSHEET_2.DESCRIPTION', 'WORKSHEETS.SMARTCLASSROOM.WORKSHEET_2.URL',
            'WORKSHEETS.SMARTCLASSROOM.WORKSHEET_3.DESCRIPTION', 'WORKSHEETS.SMARTCLASSROOM.WORKSHEET_3.URL',
            'WORKSHEETS.SMARTCLASSROOM.TEACHERSNOTES_URL',

            'WORKSHEETS.EXPLAINABILITY.TITLE', 'WORKSHEETS.EXPLAINABILITY.SUMMARY', 'WORKSHEETS.EXPLAINABILITY.DESCRIPTION',
            'WORKSHEETS.EXPLAINABILITY.WORKSHEET_1.URL',
            'WORKSHEETS.EXPLAINABILITY.TEACHERSNOTES_URL',

            'WORKSHEETS.ROCKPAPERSCISSORS.TITLE', 'WORKSHEETS.ROCKPAPERSCISSORS.SUMMARY', 'WORKSHEETS.ROCKPAPERSCISSORS.DESCRIPTION',
            'WORKSHEETS.ROCKPAPERSCISSORS.WORKSHEET_1.URL',
            'WORKSHEETS.ROCKPAPERSCISSORS.TEACHERSNOTES_URL',

            'WORKSHEETS.TOURISTINFO.TITLE', 'WORKSHEETS.TOURISTINFO.SUMMARY', 'WORKSHEETS.TOURISTINFO.DESCRIPTION',
            'WORKSHEETS.TOURISTINFO.WORKSHEET_1.URL',
            'WORKSHEETS.TOURISTINFO.TEACHERSNOTES_URL',

            'WORKSHEETS.SECRETCODE.TITLE', 'WORKSHEETS.SECRETCODE.SUMMARY', 'WORKSHEETS.SECRETCODE.DESCRIPTION',
            'WORKSHEETS.SECRETCODE.WORKSHEET_1.URL',
            'WORKSHEETS.SECRETCODE.TEACHERSNOTES_URL',

            'WORKSHEETS.LASEREYES.TITLE', 'WORKSHEETS.LASEREYES.SUMMARY', 'WORKSHEETS.LASEREYES.DESCRIPTION',
            'WORKSHEETS.LASEREYES.WORKSHEET_1.URL',
            'WORKSHEETS.LASEREYES.TEACHERSNOTES_URL',

            'WORKSHEETS.INKBLOTS.TITLE', 'WORKSHEETS.INKBLOTS.SUMMARY', 'WORKSHEETS.INKBLOTS.DESCRIPTION',
            'WORKSHEETS.INKBLOTS.WORKSHEET_1.URL',
            'WORKSHEETS.INKBLOTS.TEACHERSNOTES_URL',

            'WORKSHEETS.MAILMANMAX.TITLE', 'WORKSHEETS.MAILMANMAX.SUMMARY', 'WORKSHEETS.MAILMANMAX.DESCRIPTION',
            'WORKSHEETS.MAILMANMAX.WORKSHEET_1.URL',
            'WORKSHEETS.MAILMANMAX.TEACHERSNOTES_URL'

        ]).then(function (translations) {
            $scope.worksheets = {
                facefinder : {
                    title : translations['WORKSHEETS.FACEFINDER.TITLE'],
                    summary : translations['WORKSHEETS.FACEFINDER.SUMMARY'],
                    description : translations['WORKSHEETS.FACEFINDER.DESCRIPTION'],
                    difficulty : 1,
                    type : 'faces',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-facefinder.png',
                    tags : [ 'face detection' ],
                    teachersnotes : translations['WORKSHEETS.FACEFINDER.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.FACEFINDER.WORKSHEET_1.URL']
                        }
                    ],
                    featured : [
                        "Use a pretrained machine learning model that has been trained to recognise the location of faces in photos.",
                        "Learn about <strong>face detection</strong> by creating animated face filters in <strong>Scratch</strong>."
                    ],
                    video : 'OSVEelf9Ksk'
                },
                chatbots : {
                    title : translations['WORKSHEETS.CHATBOTS.TITLE'],
                    summary : translations['WORKSHEETS.CHATBOTS.SUMMARY'],
                    description : translations['WORKSHEETS.CHATBOTS.DESCRIPTION'],
                    difficulty : 2,
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
                pacman : {
                    title : translations['WORKSHEETS.PACMAN.TITLE'],
                    summary : translations['WORKSHEETS.PACMAN.SUMMARY'],
                    description : translations['WORKSHEETS.PACMAN.DESCRIPTION'],
                    difficulty : 3,
                    type : 'numbers',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-pacman.png',
                    tags : [ 'decision tree learning' ],
                    teachersnotes : translations['WORKSHEETS.PACMAN.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.PACMAN.WORKSHEET_1.URL']
                        }
                    ],
                    featured : [
                        "Train a <strong>decision tree classifier</strong> to avoid the ghost.",
                        "Learn about artificial intelligence in games by making a machine learning model-controlled Pac-Man in <strong>Scratch</strong>."
                    ],
                    video : '5oNjvYEEvDo'
                },
                noughtsandcrosses : {
                    title : translations['WORKSHEETS.NOUGHTSANDCROSSES.TITLE'],
                    summary : translations['WORKSHEETS.NOUGHTSANDCROSSES.SUMMARY'],
                    description : translations['WORKSHEETS.NOUGHTSANDCROSSES.DESCRIPTION'],
                    difficulty : 3,
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
                newspapers : {
                    title : translations['WORKSHEETS.NEWSPAPERSHELVES.TITLE'],
                    summary : translations['WORKSHEETS.NEWSPAPERSHELVES.SUMMARY'],
                    description : translations['WORKSHEETS.NEWSPAPERSHELVES.DESCRIPTION'],
                    difficulty : 2,
                    type : 'text',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-headlines-easy.png',
                    tags : [ 'text classification', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.NEWSPAPERSHELVES.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.NEWSPAPERSHELVES.WORKSHEET_1.URL']
                        }
                    ],
                    featured : [
                        "Train a machine learning model to recognise the use of language in different newspapers.",
                        "Learn about <strong>text classifiers</strong> by making a game in <strong>Scratch</strong> that predicts the newspaper that new headlines came from."
                    ],
                    video : 'Rv2BumNSxEo'
                },
                makemehappy : {
                    title : translations['WORKSHEETS.MAKEMEHAPPY.TITLE'],
                    summary : translations['WORKSHEETS.MAKEMEHAPPY.SUMMARY'],
                    description : translations['WORKSHEETS.MAKEMEHAPPY.DESCRIPTION'],
                    difficulty : 1,
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
                    ],
                    featured : [
                        "Train a machine learning model to recognise compliments and insults.",
                        "Learn about <strong>sentiment analysis</strong> by making a character in <strong>Scratch</strong> that reacts to what you say to it."
                    ],
                    video : 'IdU4EVTBpjA'
                },
                smartclassroom : {
                    title : translations['WORKSHEETS.SMARTCLASSROOM.TITLE'],
                    summary : translations['WORKSHEETS.SMARTCLASSROOM.SUMMARY'],
                    description : translations['WORKSHEETS.SMARTCLASSROOM.DESCRIPTION'],
                    difficulty : 1,
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
                    ],
                    featured : [
                        "Train a machine learning model to recognise commands.",
                        "Learn how <strong>virtual assistants</strong> such as Siri and Alexa work by making one in <strong>Scratch</strong>."
                    ],
                    video : 'PNKGAMBGVWg'
                },
                explainability : {
                    title : translations['WORKSHEETS.EXPLAINABILITY.TITLE'],
                    summary : translations['WORKSHEETS.EXPLAINABILITY.SUMMARY'],
                    description : translations['WORKSHEETS.EXPLAINABILITY.DESCRIPTION'],
                    difficulty : 2,
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
                rockpaperscissors : {
                    title : translations['WORKSHEETS.ROCKPAPERSCISSORS.TITLE'],
                    summary : translations['WORKSHEETS.ROCKPAPERSCISSORS.SUMMARY'],
                    description : translations['WORKSHEETS.ROCKPAPERSCISSORS.DESCRIPTION'],
                    difficulty : 2,
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
                touristinfo : {
                    title : translations['WORKSHEETS.TOURISTINFO.TITLE'],
                    summary : translations['WORKSHEETS.TOURISTINFO.SUMMARY'],
                    description : translations['WORKSHEETS.TOURISTINFO.DESCRIPTION'],
                    difficulty : 2,
                    type : 'text',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-touristinfo.png',
                    tags : [ 'training bias', 'recommendations', 'supervised learning' ],
                    teachersnotes : translations['WORKSHEETS.TOURISTINFO.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.TOURISTINFO.WORKSHEET_1.URL']
                        }
                    ],
                    featured : [
                        "Train a machine learning model to make holiday recommendations.",
                        "Learn about <strong>training bias</strong> and <strong>ethics in AI</strong> by intentionally making a biased app in <strong>Scratch</strong>."
                    ],
                    video : 'Afu7k3x61wA'
                },
                secretcode : {
                    title : translations['WORKSHEETS.SECRETCODE.TITLE'],
                    summary : translations['WORKSHEETS.SECRETCODE.SUMMARY'],
                    description : translations['WORKSHEETS.SECRETCODE.DESCRIPTION'],
                    difficulty : 2,
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
                lasereyes : {
                    title : translations['WORKSHEETS.LASEREYES.TITLE'],
                    summary : translations['WORKSHEETS.LASEREYES.SUMMARY'],
                    description : translations['WORKSHEETS.LASEREYES.DESCRIPTION'],
                    difficulty : 2,
                    type : 'sounds',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-lasereyes.png',
                    tags : [ 'speech recognition', 'face detection' ],
                    teachersnotes : translations['WORKSHEETS.LASEREYES.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.LASEREYES.WORKSHEET_1.URL']
                        }
                    ],
                    featured : [
                        "Learn about machine learning by making a voice-powered laser eyes game in <strong>Scratch</strong>.",
                        "Train a <strong>speech recognition</strong> model to activate the lasers, and use a pretrained <strong>face detection</strong> model to aim the laser."
                    ],
                    video : 'bv-QAAebBa4'
                },
                inkblots : {
                    title : translations['WORKSHEETS.INKBLOTS.TITLE'],
                    summary : translations['WORKSHEETS.INKBLOTS.SUMMARY'],
                    description : translations['WORKSHEETS.INKBLOTS.DESCRIPTION'],
                    difficulty : 3,
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
                mailmanmax : {
                    title : translations['WORKSHEETS.MAILMANMAX.TITLE'],
                    summary : translations['WORKSHEETS.MAILMANMAX.SUMMARY'],
                    description : translations['WORKSHEETS.MAILMANMAX.DESCRIPTION'],
                    difficulty : 1,
                    type : 'images',
                    maketypes : [ 'scratch3' ],
                    image : 'static/images/project-mailmanmax.png',
                    tags : [ 'optical character recognition', 'handwriting recognition', 'image classification' ],
                    teachersnotes : translations['WORKSHEETS.MAILMANMAX.TEACHERSNOTES_URL'],
                    downloads : [
                        {
                            worksheet : translations['WORKSHEETS.MAILMANMAX.WORKSHEET_1.URL']
                        }
                    ],
                    featured : [
                        "Train a machine learning model to recognise postcodes / zip codes.",
                        "Learn about <strong>handwriting recognition</strong> by making a letter sorter in <strong>Scratch</strong>."
                    ],
                    video : 'vQPFEWFzVIY'
                }
            };
        });
    }
}());
