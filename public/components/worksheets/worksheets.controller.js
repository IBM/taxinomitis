(function () {

    angular
        .module('app')
        .controller('WorksheetsController', WorksheetsController);

    WorksheetsController.$inject = [
        '$stateParams',
        '$mdDialog', '$scope'
    ];

    function WorksheetsController($stateParams, $mdDialog, $scope) {

        var vm = this;

        vm.worksheets = [
            {
                title : 'Smart classroom',
                summary : 'Teach a computer to recognise the meaning of your commands',
                description : 'Create a smart assistant in Scratch that lets you control virtual devices.',
                difficulty : 'Beginner',
                type : 'text',
                image : 'static/images/project-smartclassroom.png',
                tags : [ 'digital assistants', 'supervised learning' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-smartclassroom.pdf',
                downloads : [
                    {
                        description : 'Full version of the project, where the students make a non-machine learning version first to experience the value of using machine learning to do this',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-smartclassroom.pdf'
                    },
                    {
                        description : 'Shorter version of the project, where the students only make a machine learning version of the assistant',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-smartclassroom-easy.pdf'
                    }
                ]
            },
            {
                title : 'Make me happy',
                summary : 'Teach a computer to recognise compliments and insults',
                description : 'Create a character in Scratch that smiles if you say nice things to it and cries if you say mean things to it.',
                difficulty : 'Beginner',
                type : 'text',
                image : 'static/images/project-makemehappy.png',
                tags : [ 'sentiment analysis', 'supervised learning' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-makemehappy.pdf',
                downloads : [
                    {
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-makemehappy.pdf'
                    }
                ]
            },
            {
                title : 'Snap!',
                summary : 'Teach a computer to recognise what icons look like',
                description : 'Make a card game in Scratch that learns to recognise pictures of your card.',
                difficulty : 'Beginner',
                type : 'images',
                image : 'static/images/project-snap.png',
                tags : [ 'image classification', 'supervised learning' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-snap.pdf',
                downloads : [
                    {
                        description : 'Full version of the project, where the students make their own cards that they will train the computer to recognise',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-snap.pdf'
                    },
                    {
                        description : 'Shorter version of the project, providing children with pre-made cards that you will need to print out, to save the students time having to make them',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-snap-easy.pdf',
                        resources : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/resources-snap-easy.pdf'
                    }
                ]
            },
            {
                title : 'Mailman Max',
                summary : 'Teach a computer to recognise handwriting',
                description : 'Make a postal sorting office in Scratch that can recognise handwritten postcodes on envelopes.',
                difficulty : 'Beginner',
                type : 'images',
                image : 'static/images/project-mailmanmax.png',
                tags : [ 'optical character recognition', 'handwriting recognition', 'image classification', 'supervised learning' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-mailmanmax.pdf',
                downloads : [
                    {
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-mailmanmax.pdf'
                    }
                ]
            },
            {
                title : 'Car or cup',
                summary : 'Teach a computer to recognise pictures of objects',
                description : 'Train the computer to be able to sort photos into groups.',
                difficulty : 'Beginner',
                type : 'images',
                image : 'static/images/project-carorcup.png',
                tags : [ 'image classification', 'supervised learning', 'crowd sourcing' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-carorcup.pdf',
                downloads : [
                    {
                        description : 'Individual version of the project, where each student trains their own machine learning model independently',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-carorcup.pdf'
                    },
                    {
                        description : 'Group version of the project, where all students in the class work together to train a shared machine learning model',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-carorcup-crowd.pdf'
                    }
                ]
            },
            {
                title : 'Face Lock',
                summary : 'Teach a computer to recognise faces',
                description : 'Make a phone in Scratch that unlocks if it recognises your face.',
                difficulty : 'Beginner',
                type : 'images',
                image : 'static/images/project-facelock.png',
                tags : [ 'facial recognition', 'biometrics', 'image classification', 'supervised learning' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-facelock.pdf',
                downloads : [
                    {
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-facelock.pdf'
                    }
                ]
            },
            {
                title : 'Journey to school',
                summary : 'Teach a computer to make predictions',
                description : 'Train the computer to be able to predict how you travel to school in the morning.',
                difficulty : 'Beginner',
                type : 'numbers',
                image : 'static/images/project-journeytoschool.png',
                tags : [ 'predictive model', 'testing and accuracy', 'supervised learning' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-journeytoschool.pdf',
                downloads : [
                    {
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-journeytoschool.pdf'
                    }
                ]
            },
            {
                title : 'Pac-Man',
                summary : 'Teach a computer to play a game',
                description : 'Create a Pac-Man game in Scratch that learns how to avoid the ghost.',
                difficulty : 'Intermediate',
                type : 'numbers',
                image : 'static/images/project-pacman.png',
                tags : [ 'decision tree learning' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-pacman.pdf',
                downloads : [
                    {
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-pacman.pdf'
                    }
                ]
            },
            {
                title : 'Chatbots',
                summary : 'Teach a computer to recognise questions',
                description : 'Create a chatbot that can answer questions about a topic of your choice.',
                difficulty : 'Intermediate',
                type : 'text',
                image : 'static/images/project-chatbots.png',
                tags : [ 'sentiment analysis', 'supervised learning' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-chatbots.pdf',
                downloads : [
                    {
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-chatbots.pdf'
                    }
                ]
            },
            {
                title : 'Tourist Info',
                summary : 'Teach a computer to make recommendations',
                description : 'Create a mobile app in Scratch that recommends tourist attractions based on people\'s interests.',
                difficulty : 'Intermediate',
                type : 'text',
                image : 'static/images/project-touristinfo.png',
                tags : [ 'training bias', 'recommendations', 'supervised learning' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-touristinfo.pdf',
                downloads : [
                    {
                        description : 'Full version of the project',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-touristinfo.pdf'
                    },
                    {
                        description : 'Shorter version of the project, where students make less of the Scratch project themselves, with more of the scripting provided in the starter project file',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-touristinfo-easy.pdf'
                    }
                ]
            },
            {
                title : 'Sorting Hat',
                summary : 'Teach a computer to recognise use of language',
                description : 'Create a Sorting Hat like in Harry Potter, that puts you in a school House based on what you say.',
                difficulty : 'Intermediate',
                type : 'text',
                image : 'static/images/project-sortinghat.png',
                tags : [ 'text classification', 'supervised learning', 'crowd sourcing' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-sortinghat.pdf',
                downloads : [
                    {
                        description : 'Individual version of the project, where each student trains their own machine learning model independently',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-sortinghat.pdf'
                    },
                    {
                        description : 'Group version of the project, where all students in the class work together to train a shared machine learning model',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-sortinghat-crowd.pdf'
                    }
                ]
            },
            {
                title : 'Rock, Paper, Scissors',
                summary : 'Teach a computer to recognise shapes',
                description : 'Make a Rock, Paper, Scissors game in Scratch that learns to recognise hand shapes.',
                difficulty : 'Intermediate',
                type : 'images',
                image : 'static/images/project-rockpaperscissors.png',
                tags : [ 'image classification', 'supervised learning' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-rockpaperscissors.pdf',
                downloads : [
                    {
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-rockpaperscissors.pdf'
                    }
                ]
            },
            {
                title : 'Judge a book',
                summary : 'Teach a computer to recognise visual style',
                description : 'Make a game in Scratch to test whether it really is possible to judge a book by its cover.',
                difficulty : 'Intermediate',
                type : 'images',
                image : 'static/images/project-judgeabook.png',
                tags : [ 'image classification', 'supervised learning' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-judgeabook.pdf',
                downloads : [
                    {
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-judgeabook.pdf'
                    }
                ]
            },
            {
                title : 'Locate Larry',
                summary : 'Teach a computer to find something in a picture',
                description : 'Make a "Where\'s Wally?"-style game in Scratch, and teach the computer to find your character.',
                difficulty : 'Intermediate',
                type : 'images',
                image : 'static/images/project-locatelarry.png',
                tags : [ 'image classification', 'supervised learning', 'image pre-processing' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-locatelarry.pdf',
                downloads : [
                    {
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-locatelarry.pdf'
                    }
                ]
            },
            {
                title : 'Confused',
                summary : 'Teach a computer to recognise fruit',
                description : 'Learn about how computers can be confused and can make mistakes if they\'re trained badly.',
                difficulty : 'Intermediate',
                type : 'images',
                image : 'static/images/project-confused.png',
                tags : [ 'image classification', 'supervised learning', 'overfitting' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-confused.pdf',
                downloads : [
                    {
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-confused.pdf'
                    }
                ]
            },
            {
                title : 'School Library',
                summary : 'Teach a computer to make recommendations',
                description : 'Create a school librarian in Scratch that suggests who a reading book might be suitable for.',
                difficulty : 'Intermediate',
                type : 'numbers',
                image : 'static/images/project-schoollibrary.png',
                tags : [ 'predictive model', 'recommendations', 'supervised learning' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-schoollibrary.pdf',
                downloads : [
                    {
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-schoollibrary.pdf'
                    }
                ]
            },
            {
                title : 'Noughts & Crosses',
                summary : 'Teach a computer to play a game',
                description : 'Create a noughts and crosses game in Scratch that learns how to beat you.',
                difficulty : 'Advanced',
                type : 'numbers',
                image : 'static/images/project-noughtsandcrosses.png',
                tags : [ 'decision tree learning', 'reinforcement learning', 'categorical data' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-noughtsandcrosses.pdf',
                downloads : [
                    {
                        description : 'Classroom version, where each student makes the game themselves',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-noughtsandcrosses.pdf'
                    },
                    {
                        description : 'Demo version, for events like Science Fairs where each child has a minute or two to try something',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-noughtsandcrosses-event.pdf'
                    }
                ]
            },
            {
                title : 'Top Trumps',
                summary : 'Teach a computer to play a game',
                description : 'Train a computer to be able to play the Top Trumps card game in Scratch.',
                difficulty : 'Advanced',
                type : 'numbers',
                image : 'static/images/project-toptrumps.png',
                tags : [ 'decision tree learning', 'reinforcement learning', 'categorical data' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-toptrumps.pdf',
                downloads : [
                    {
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-toptrumps.pdf'
                    }
                ]
            },
            {
                title : 'Headlines',
                summary : 'Test the computer\'s ability to recognise use of language',
                description : 'Train a computer to recognise headlines from national newspapers.',
                difficulty : 'Advanced',
                type : 'text',
                image : 'static/images/project-headlines.png',
                tags : [ 'text classification', 'supervised learning', 'testing' ],
                teachersnotes : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/teachersnotes-headlines.pdf',
                downloads : [
                    {
                        description : 'Simplified version of the project, where students make a simple project to put newspapers on the right shelves',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-headlines-easy.pdf'
                    },
                    {
                        description : 'Advanced version of the project, where students make a testing framework to analyse the performance of their model',
                        worksheet : 'https://github.com/dalelane/ml-for-kids/raw/master/worksheets/worksheet-headlines.pdf'
                    }
                ]
            },
        ];


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
        $scope.filterWorksheets = function (item) {
            var match = true;

            if (($scope.projecttype !== 'ALL') && match) {
                match = (item.type === $scope.projecttype);
            }
            if (($scope.projectdifficulty != 'ALL') && match) {
                match = (item.difficulty === $scope.projectdifficulty);
            }
            return match;
        };

    }
}());
