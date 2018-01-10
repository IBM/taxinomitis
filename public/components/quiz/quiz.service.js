(function () {

    angular
        .module('app')
        .service('quizService', quizService);

    quizService.$inject = [];


    function quizService() {

        var allQuestions = [
            {
                question : 'In general, machines learn better with:',
                attempted : false,
                answers : [
                    { text : 'More examples', correct : true },
                    { text : 'Fewer examples', correct : false }
                ],
                notes : [
                    'That isn\'t the only factor that affects things, but in general, the more examples it has to learn from, the better.'
                ]
            },
            {
                question : 'Which of these sets of examples will probably do the best job of training a computer to recognise a photo of an apple?',
                attempted : false,
                answers : [
                    { text : 'A collection of photos of dogs', correct : false },
                    { text : 'Varied photos of different types of apples in different places', correct : true },
                    { text : 'Identical photos of an apple', correct : false },
                    { text : 'Very, very similar photos of the same apple', correct : false }
                ],
                notes : [
                    'The more varied the examples you can collect, the more the system can learn about how to recognise different pictures of an apple.',
                    'If every example you give it is the same apple on the same brown wooden table, it might learn that something is only an apple if it\'s on a brown wooden table.'
                ]
            },
            {
                question : 'Which of these would be a good use case for machine learning?',
                attempted : false,
                answers : [
                    { text : 'Adding big numbers together', correct : false },
                    { text : 'Storing and retrieving customer records', correct : false },
                    { text : 'Recognising if an email is spam or not', correct : true },
                    { text : 'Counting the number of times a button is pressed', correct : false }
                ],
                notes : [
                    'Spam filters are a good example of machine learning.',
                    'With enough examples of legitimate emails, and enough examples of spam emails, a computer can start to learn how to recognise a spam email - without someone needing to manually define a set of rules first.'
                ]
            },
            {
                question : 'Which of these is NOT a good use case for machine learning?',
                attempted : false,
                answers : [
                    { text : 'Sentiment analysis - recognising the mood, tone or emotion in text', correct : false },
                    { text : 'Translating text from one language to another', correct : false },
                    { text : 'Face recognition - recognising a face in a photo and identifying who it is', correct : false },
                    { text : 'Self-driving cars', correct : false },
                    { text : 'Predicting if a credit card transaction is fraudulent', correct : false },
                    { text : 'Calculating the current cost of a product in different countries based on exchange rates', correct : true },
                    { text : 'Recommending a movie based on films you\'ve previously watched', correct : false }
                ],
                notes : [
                    'Tasks which involve following rules that can be worked out are not a good use for machine learning.',
                    'A computer isn\'t going to learn how to apply an exchange rate from examples - we can just tell it what to do.'
                ]
            },
            {
                question : 'Which of the following approaches would be more likely to be successful?',
                attempted : false,
                answers : [
                    { text : 'Collect a small set of examples, train a system, test to see how good it is. Add more examples, train and test again. Repeat until it gets good enough for your needs.', correct : true },
                    { text : 'More examples is better, so decide you must need millions. Start collecting a massive set of examples, and spend months continually collecting more and more and more.', correct : false }
                ],
                notes : [
                    'More examples is generally better, but be practical.',
                    'Pragmatism is important, so regular testing is useful to let you know how things are going, and when you\'ve done enough.',
                    'When you\'ve only got ten examples, another ten will probably make a huge difference.',
                    'When you\'ve got 100,000 examples, another ten probably won\'t have a noticeable impact.'
                ]
            },
            {
                question : 'Which of these statements is correct?',
                attempted : false,
                answers : [
                    { text : 'Machine learning is a technique where computers can be trained to perform tasks instead of needing to be given an explicit set of steps to follow', correct : true },
                    { text : 'Machine learning is magic', correct : false },
                    { text : 'Machine learning means we don\'t need to think about problems any more because computers will think for us', correct : false },
                    { text : 'Machine learning has replaced the need to learn how to code', correct : false },
                    { text : 'Machine learning can only be done on massive supercomputers', correct : false }
                ]
            },
            {
                question : 'A machine learning system which has been trained to recognise pictures which have a tree in them should be effective at which of the following tasks:',
                attempted : false,
                answers : [
                    { text : 'Identifying pictures of fruit', correct : false },
                    { text : 'Recognising the emotion in a piece of writing', correct : false },
                    { text : 'Recognising pictures of trees', correct : true }
                ],
                notes : [
                    'Machine learning does not mean computers magically learn to do everything.',
                    'It means they learn how to do a specific task by being shown examples of that specific task.',
                    'If you want it to do something else, you need to train it to do that as well, by giving it examples of that.'
                ]
            },
            {
                question : 'Alice and Bob both want to train a machine learning system to recognise if some text is happy/positive or sad/negative. Which of them will probably train the best system?',
                attempted : false,
                answers : [
                    { text : 'Alice - who has collected 10 varied examples of happy text, and 10 varied examples of sad text', correct : true },
                    { text : 'Bob - who has collected 1000 examples of happy writing and 20 examples of sad writing', correct : false }
                ],
                notes : [
                    'Collecting a roughly similar number of examples for each label is a useful technique.',
                    'If nearly every example of writing you train a system with is happy, you might end up training the system to assume that sad writing is very unlikely, and that it should assume happy more often.',
                    '',
                    'But, you might want it to do this.',
                    'If you\'re training a system to recognise text where it is happy 98% of the time, then training it with that realistic experience might be worth a try.'
                ]
            }
        ];

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
