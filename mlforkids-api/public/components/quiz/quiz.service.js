(function () {

    angular
        .module('app')
        .service('quizService', quizService);

    quizService.$inject = ['$translate'];


    function quizService($translate) {

        var allQuestions = [];
        $translate([
            'MODELS.QUIZ.QUESTION_1.QUESTION',
                'MODELS.QUIZ.QUESTION_1.ANSWER_1', 'MODELS.QUIZ.QUESTION_1.ANSWER_2',
                'MODELS.QUIZ.QUESTION_1.NOTES_1',
            'MODELS.QUIZ.QUESTION_2.QUESTION',
                'MODELS.QUIZ.QUESTION_2.ANSWER_1', 'MODELS.QUIZ.QUESTION_2.ANSWER_2', 'MODELS.QUIZ.QUESTION_2.ANSWER_3', 'MODELS.QUIZ.QUESTION_2.ANSWER_4',
                'MODELS.QUIZ.QUESTION_2.NOTES_1', 'MODELS.QUIZ.QUESTION_2.NOTES_2',
            'MODELS.QUIZ.QUESTION_3.QUESTION',
                'MODELS.QUIZ.QUESTION_3.ANSWER_1', 'MODELS.QUIZ.QUESTION_3.ANSWER_2', 'MODELS.QUIZ.QUESTION_3.ANSWER_3',
                'MODELS.QUIZ.QUESTION_3.NOTES_1', 'MODELS.QUIZ.QUESTION_3.NOTES_2',
            'MODELS.QUIZ.QUESTION_4.QUESTION',
                'MODELS.QUIZ.QUESTION_4.ANSWER_1', 'MODELS.QUIZ.QUESTION_4.ANSWER_2', 'MODELS.QUIZ.QUESTION_4.ANSWER_3', 'MODELS.QUIZ.QUESTION_4.ANSWER_4', 'MODELS.QUIZ.QUESTION_4.ANSWER_5', 'MODELS.QUIZ.QUESTION_4.ANSWER_6',
                'MODELS.QUIZ.QUESTION_4.NOTES_1', 'MODELS.QUIZ.QUESTION_4.NOTES_2',
            'MODELS.QUIZ.QUESTION_5.QUESTION',
                'MODELS.QUIZ.QUESTION_5.ANSWER_1', 'MODELS.QUIZ.QUESTION_5.ANSWER_2',
                'MODELS.QUIZ.QUESTION_5.NOTES_1', 'MODELS.QUIZ.QUESTION_5.NOTES_2', 'MODELS.QUIZ.QUESTION_5.NOTES_3', 'MODELS.QUIZ.QUESTION_5.NOTES_4',
            'MODELS.QUIZ.QUESTION_6.QUESTION',
                'MODELS.QUIZ.QUESTION_6.ANSWER_1', 'MODELS.QUIZ.QUESTION_6.ANSWER_2', 'MODELS.QUIZ.QUESTION_6.ANSWER_3', 'MODELS.QUIZ.QUESTION_6.ANSWER_4', 'MODELS.QUIZ.QUESTION_6.ANSWER_5',
            'MODELS.QUIZ.QUESTION_7.QUESTION',
                'MODELS.QUIZ.QUESTION_7.ANSWER_1', 'MODELS.QUIZ.QUESTION_7.ANSWER_2', 'MODELS.QUIZ.QUESTION_7.ANSWER_3',
                'MODELS.QUIZ.QUESTION_7.NOTES_1', 'MODELS.QUIZ.QUESTION_7.NOTES_2', 'MODELS.QUIZ.QUESTION_7.NOTES_3',
            'MODELS.QUIZ.QUESTION_8.QUESTION',
                'MODELS.QUIZ.QUESTION_8.ANSWER_1', 'MODELS.QUIZ.QUESTION_8.ANSWER_2',
                'MODELS.QUIZ.QUESTION_8.NOTES_1', 'MODELS.QUIZ.QUESTION_8.NOTES_2', 'MODELS.QUIZ.QUESTION_8.NOTES_4', 'MODELS.QUIZ.QUESTION_8.NOTES_5',
            'MODELS.QUIZ.QUESTION_9.QUESTION',
                'MODELS.QUIZ.QUESTION_9.ANSWER_1', 'MODELS.QUIZ.QUESTION_9.ANSWER_2',
                'MODELS.QUIZ.QUESTION_9.NOTES_1', 'MODELS.QUIZ.QUESTION_9.NOTES_3', 'MODELS.QUIZ.QUESTION_9.NOTES_4',
            'MODELS.QUIZ.QUESTION_10.QUESTION',
                'MODELS.QUIZ.QUESTION_10.ANSWER_1', 'MODELS.QUIZ.QUESTION_10.ANSWER_2', 'MODELS.QUIZ.QUESTION_10.ANSWER_3', 'MODELS.QUIZ.QUESTION_10.ANSWER_4',
                'MODELS.QUIZ.QUESTION_10.NOTES_1', 'MODELS.QUIZ.QUESTION_10.NOTES_2',
            'MODELS.QUIZ.QUESTION_11.QUESTION',
                'MODELS.QUIZ.QUESTION_11.ANSWER_1', 'MODELS.QUIZ.QUESTION_11.ANSWER_2', 'MODELS.QUIZ.QUESTION_11.ANSWER_3',
                'MODELS.QUIZ.QUESTION_11.NOTES_1', 'MODELS.QUIZ.QUESTION_11.NOTES_2',
            'MODELS.QUIZ.QUESTION_12.QUESTION',
                'MODELS.QUIZ.QUESTION_12.ANSWER_1', 'MODELS.QUIZ.QUESTION_12.ANSWER_2', 'MODELS.QUIZ.QUESTION_12.ANSWER_3',
                'MODELS.QUIZ.QUESTION_12.NOTES_1', 'MODELS.QUIZ.QUESTION_12.NOTES_2', 'MODELS.QUIZ.QUESTION_12.NOTES_3',
            'MODELS.QUIZ.QUESTION_13.QUESTION',
                'MODELS.QUIZ.QUESTION_13.ANSWER_1', 'MODELS.QUIZ.QUESTION_13.ANSWER_2',
                'MODELS.QUIZ.QUESTION_13.NOTES_1'
        ]).then(function (translations) {
            allQuestions = [
                {
                    question : translations['MODELS.QUIZ.QUESTION_1.QUESTION'],
                    attempted : false,
                    answers : [
                        { text : translations['MODELS.QUIZ.QUESTION_1.ANSWER_1'], correct : true },
                        { text : translations['MODELS.QUIZ.QUESTION_1.ANSWER_2'], correct : false }
                    ],
                    notes : [
                        translations['MODELS.QUIZ.QUESTION_1.NOTES_1']
                    ]
                },
                {
                    question : translations['MODELS.QUIZ.QUESTION_2.QUESTION'],
                    attempted : false,
                    answers : [
                        { text : translations['MODELS.QUIZ.QUESTION_2.ANSWER_1'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_2.ANSWER_2'], correct : true },
                        { text : translations['MODELS.QUIZ.QUESTION_2.ANSWER_3'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_2.ANSWER_4'], correct : false }
                    ],
                    notes : [
                        translations['MODELS.QUIZ.QUESTION_2.NOTES_1'],
                        translations['MODELS.QUIZ.QUESTION_2.NOTES_2']
                    ]
                },
                {
                    question : translations['MODELS.QUIZ.QUESTION_3.QUESTION'],
                    attempted : false,
                    answers : [
                        { text : translations['MODELS.QUIZ.QUESTION_3.ANSWER_1'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_3.ANSWER_2'], correct : true },
                        { text : translations['MODELS.QUIZ.QUESTION_3.ANSWER_3'], correct : false }
                    ],
                    notes : [
                        translations['MODELS.QUIZ.QUESTION_3.NOTES_1'],
                        translations['MODELS.QUIZ.QUESTION_3.NOTES_2']
                    ]
                },
                {
                    question : translations['MODELS.QUIZ.QUESTION_4.QUESTION'],
                    attempted : false,
                    answers : [
                        { text : translations['MODELS.QUIZ.QUESTION_4.ANSWER_1'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_4.ANSWER_2'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_4.ANSWER_3'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_4.ANSWER_4'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_4.ANSWER_5'], correct : true },
                        { text : translations['MODELS.QUIZ.QUESTION_4.ANSWER_6'], correct : false }
                    ],
                    notes : [
                        translations['MODELS.QUIZ.QUESTION_4.NOTES_1'],
                        translations['MODELS.QUIZ.QUESTION_4.NOTES_2']
                    ]
                },
                {
                    question : translations['MODELS.QUIZ.QUESTION_5.QUESTION'],
                    attempted : false,
                    answers : [
                        { text : translations['MODELS.QUIZ.QUESTION_5.ANSWER_1'], correct : true },
                        { text : translations['MODELS.QUIZ.QUESTION_5.ANSWER_2'], correct : false }
                    ],
                    notes : [
                        translations['MODELS.QUIZ.QUESTION_5.NOTES_1'],
                        translations['MODELS.QUIZ.QUESTION_5.NOTES_2'],
                        translations['MODELS.QUIZ.QUESTION_5.NOTES_3'],
                        translations['MODELS.QUIZ.QUESTION_5.NOTES_4']
                    ]
                },
                {
                    question : translations['MODELS.QUIZ.QUESTION_6.QUESTION'],
                    attempted : false,
                    answers : [
                        { text : translations['MODELS.QUIZ.QUESTION_6.ANSWER_1'], correct : true },
                        { text : translations['MODELS.QUIZ.QUESTION_6.ANSWER_2'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_6.ANSWER_3'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_6.ANSWER_4'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_6.ANSWER_5'], correct : false }
                    ]
                },
                {
                    question : translations['MODELS.QUIZ.QUESTION_7.QUESTION'],
                    attempted : false,
                    answers : [
                        { text : translations['MODELS.QUIZ.QUESTION_7.ANSWER_1'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_7.ANSWER_2'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_7.ANSWER_3'], correct : true }
                    ],
                    notes : [
                        translations['MODELS.QUIZ.QUESTION_7.NOTES_1'],
                        translations['MODELS.QUIZ.QUESTION_7.NOTES_2'],
                        translations['MODELS.QUIZ.QUESTION_7.NOTES_3']
                    ]
                },
                {
                    question : translations['MODELS.QUIZ.QUESTION_8.QUESTION'],
                    attempted : false,
                    answers : [
                        { text : translations['MODELS.QUIZ.QUESTION_8.ANSWER_1'], correct : true },
                        { text : translations['MODELS.QUIZ.QUESTION_8.ANSWER_2'], correct : false }
                    ],
                    notes : [
                        translations['MODELS.QUIZ.QUESTION_8.NOTES_1'],
                        translations['MODELS.QUIZ.QUESTION_8.NOTES_2'],
                        ' ',
                        translations['MODELS.QUIZ.QUESTION_8.NOTES_4'],
                        translations['MODELS.QUIZ.QUESTION_8.NOTES_5']
                    ]
                },
                {
                    question : translations['MODELS.QUIZ.QUESTION_9.QUESTION'],
                    attempted : false,
                    answers : [
                        { text : translations['MODELS.QUIZ.QUESTION_9.ANSWER_1'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_9.ANSWER_2'], correct : true }
                    ],
                    notes : [
                        translations['MODELS.QUIZ.QUESTION_9.NOTES_1'],
                        ' ',
                        translations['MODELS.QUIZ.QUESTION_9.NOTES_3'],
                        translations['MODELS.QUIZ.QUESTION_9.NOTES_4']
                    ]
                },
                {
                    question : translations['MODELS.QUIZ.QUESTION_10.QUESTION'],
                    attempted : false,
                    answers : [
                        { text : translations['MODELS.QUIZ.QUESTION_10.ANSWER_1'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_10.ANSWER_2'], correct : true },
                        { text : translations['MODELS.QUIZ.QUESTION_10.ANSWER_3'], correct : false }
                    ],
                    notes : [
                        translations['MODELS.QUIZ.QUESTION_10.NOTES_1'],
                        translations['MODELS.QUIZ.QUESTION_10.NOTES_2']
                    ]
                },
                {
                    question : translations['MODELS.QUIZ.QUESTION_11.QUESTION'],
                    attempted : false,
                    answers : [
                        { text : translations['MODELS.QUIZ.QUESTION_11.ANSWER_1'], correct : true },
                        { text : translations['MODELS.QUIZ.QUESTION_11.ANSWER_2'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_11.ANSWER_3'], correct : false }
                    ],
                    notes : [
                        translations['MODELS.QUIZ.QUESTION_11.NOTES_1'],
                        translations['MODELS.QUIZ.QUESTION_11.NOTES_2']
                    ]
                },
                {
                    question : translations['MODELS.QUIZ.QUESTION_12.QUESTION'],
                    attempted : false,
                    answers : [
                        { text : translations['MODELS.QUIZ.QUESTION_12.ANSWER_1'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_12.ANSWER_2'], correct : true },
                        { text : translations['MODELS.QUIZ.QUESTION_12.ANSWER_3'], correct : false }
                    ],
                    notes : [
                        translations['MODELS.QUIZ.QUESTION_12.NOTES_1'],
                        translations['MODELS.QUIZ.QUESTION_12.NOTES_2'],
                        translations['MODELS.QUIZ.QUESTION_12.NOTES_3']
                    ]
                },
                {
                    question : translations['MODELS.QUIZ.QUESTION_13.QUESTION'],
                    attempted : false,
                    answers : [
                        { text : translations['MODELS.QUIZ.QUESTION_13.ANSWER_1'], correct : false },
                        { text : translations['MODELS.QUIZ.QUESTION_13.ANSWER_2'], correct : true }
                    ],
                    notes : [
                        translations['MODELS.QUIZ.QUESTION_13.NOTES_1']
                    ]
                }
            ];
        });


        function random(numChoices) {
            return Math.floor(Math.random() * (numChoices + 1));
        }

        function getQuestion() {
            if (allQuestions.length > 0) {
                var randomChoiceIdx = random(allQuestions.length - 1);
                var randomChoice = allQuestions.splice(randomChoiceIdx, 1);
                var question = randomChoice[0];
                question.answers.forEach(function (answer) {
                    answer.selected = false;
                });
                return question;
            }
        }

        function restoreQuestion(question) {
            question.attempted = true;
            allQuestions.push(question);
        }

        return {
            getQuestion : getQuestion,
            restoreQuestion : restoreQuestion
        };
    }
})();
