(function () {

    angular
        .module('app')
        .service('quizService', quizService);

    quizService.$inject = [];


    function quizService() {

        var allQuestions = [
            {
                question : 'In general, what will help machines to learn better?',
                attempted : false,
                answers : [
                    { text : 'More examples', correct : true },
                    { text : 'Fewer examples', correct : false }
                ],
                notes : [
                    'That isn\'t the only thing that has an effect. But in general, the more examples it has to learn from, the better it should learn.'
                ]
            },
            {
                question : 'Which of these would probably be best for training a computer to recognise a photo of an apple?',
                attempted : false,
                answers : [
                    { text : 'Photos of dogs', correct : false },
                    { text : 'Varied photos of different types of apples in different places', correct : true },
                    { text : 'Identical photos of an apple', correct : false },
                    { text : 'Very, very similar photos of the same apple in the same place', correct : false }
                ],
                notes : [
                    'The more varied the examples you can collect, the more the system can learn about how to recognise different pictures of an apple.',
                    'If every example you give it is the same apple on the same brown wooden table, it might learn that something is only an apple if it\'s on a brown wooden table.'
                ]
            },
            {
                question : 'Which of these would be a good use of machine learning?',
                attempted : false,
                answers : [
                    { text : 'Adding big numbers together', correct : false },
                    { text : 'Recognising if an email is spam', correct : true },
                    { text : 'Counting the number of times a button is pressed', correct : false }
                ],
                notes : [
                    'Spam filters are a good example of machine learning.',
                    'With enough examples of legitimate emails, and enough examples of spam emails, a computer can start to learn how to recognise a spam email.'
                ]
            },
            {
                question : 'Which of these is NOT a good use of machine learning?',
                attempted : false,
                answers : [
                    { text : 'Sentiment analysis - recognising the mood, tone or emotion in text', correct : false },
                    { text : 'Translating text from one language to another', correct : false },
                    { text : 'Face recognition - recognising a face in a photo and identifying who it is', correct : false },
                    { text : 'Self-driving cars', correct : false },
                    { text : 'Calculating the cost of something in different countries based on exchange rates', correct : true },
                    { text : 'Recommending a movie based on films you\'ve watched before', correct : false }
                ],
                notes : [
                    'Tasks that involve following rules which can be worked out are not a good use for machine learning.',
                    'A computer isn\'t going to learn how to apply an exchange rate from examples - we can just tell it what to do.'
                ]
            },
            {
                question : 'Which of these would be more likely to be successful?',
                attempted : false,
                answers : [
                    { text : 'Collect a small set of examples, train a system, test to see how good it is. Add more examples, train again, and then test again. Repeat until it gets good enough.', correct : true },
                    { text : 'More examples is better, so decide you must need millions of examples. Start collecting a massive set of examples, and spend months collecting more and more and more.', correct : false }
                ],
                notes : [
                    'More examples is generally better, but be practical.',
                    'Pragmatism is important. Regular testing is useful to let you know how things are going, and help you know when you\'ve done enough.',
                    'When you\'ve only got ten examples, another ten examples will probably make a huge difference.',
                    'When you\'ve got 100,000 examples, another ten examples probably won\'t have a noticeable impact.'
                ]
            },
            {
                question : 'Which of these statements is correct?',
                attempted : false,
                answers : [
                    { text : 'Machine learning is a technique where computers can be trained to perform tasks instead of needing to be given an explicit set of steps to follow', correct : true },
                    { text : 'Machine learning is magic', correct : false },
                    { text : 'Machine learning means we don\'t need to think about problems any more because computers will think for us', correct : false },
                    { text : 'Machine learning has replaced the need for us to learn how to code', correct : false },
                    { text : 'Machine learning can only be done on massive supercomputers', correct : false }
                ]
            },
            {
                question : 'A machine learning system trained to recognise pictures with a tree in should be good at which of the following tasks:',
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
                question : 'Alice and Bob both want to train a machine learning system to recognise if text is happy/positive or sad/negative. Which of them will probably train the best system?',
                attempted : false,
                answers : [
                    { text : 'Alice. She has collected 10 varied examples of happy text, and 10 varied examples of sad text', correct : true },
                    { text : 'Bob. He has collected 1000 examples of happy writing and 10 examples of sad writing', correct : false }
                ],
                notes : [
                    'Collecting a roughly similar number of examples for each label is a useful technique.',
                    'If nearly every example of writing you train a system with is happy, you might end up training the system to assume that sad writing is very unlikely, and that it should assume happy more often.',
                    '',
                    'But, you might want it to do this.',
                    'If you\'re training a system to recognise text where text is happy 98% of the time, training it with that realistic experience might be worth a try.'
                ]
            },
            {
                question : 'Advanced machine learning technology will always give correct answers. Incorrect answers mean the machine learning technology isn\'t very good',
                attempted : false,
                answers : [
                    { text : 'True', correct : false },
                    { text : 'False', correct : true }
                ],
                notes : [
                    'Not necessarily.',
                    '',
                    'The technology and algorithms are important. BUT machine learning systems are only as accurate and reliable as the training they are given.',
                    'Simple machine learning algorithms with a lot of high quality training can do better than the most advanced machine learning algorithms with a small amount of poor quality training.'
                ]
            },
            {
                question : 'How can you make sure your collection of animal pictures is good quality for training a machine and doesn\'t contain human mistakes?',
                attempted : false,
                answers : [
                    { text : 'Manually inspect all of the pictures of animals yourself and make sure you agree with all of the labels', correct : false },
                    { text : 'Ask lots of people to label all the images and keep the training labels that people generally agree on', correct : true },
                    { text : 'Trick question! Humans are always right - machines make mistakes!', correct : false }
                ],
                notes : [
                    'Even humans make mistakes and you won\'t always have time to double check all the training data!',
                    'If the task is tricky it can be a good idea to get more than one person to label each image and keep the label that the most humans agree is the right one.'
                ]
            },
            {
                question : 'A machine trained to identify pictures of "food" or "not food" gives inconsistent results for sandwiches, often putting them in the "not food" class. Which of the following could explain that?',
                attempted : false,
                answers : [
                    { text : 'The human who trained the system doesn\'t like sandwiches and didn\'t put any in the training data', correct : true },
                    { text : 'The machine has to be in the right mood for a sandwich so it changes its mind a lot', correct : false },
                    { text : 'Sandwiches are not food. The system is right to be unsure', correct : false }
                ],
                notes : [
                    'Machine learning models can only learn from the examples we show them.',
                    'It is very easy for humans to accidentally introduce their likes and dislikes into machine learning models so we should be very careful about what training data we use.'
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
