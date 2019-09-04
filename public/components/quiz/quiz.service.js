(function () {

    angular
        .module('app')
        .service('quizService', quizService);

    quizService.$inject = [];


    function quizService() {

        var allQuestions = [
            {
                question : 'Waarmee help je een machine warschijnlijk het meest om beter te leren?',
                attempted : false,
                answers : [
                    { text : 'Meer voorbeelden', correct : true },
                    { text : 'Minder voorbeelden', correct : false }
                ],
                notes : [
                    'Dat is niet het enige dat effect heeft. Maar in het algemeen: hoe meer voorbeelden, hoe beter de machine leert.'
                ]
            },
            {
                question : 'Waarmee kan je een computer waarschijnlijk het beste trainen om een foto van een appel te herkennen?',
                attempted : false,
                answers : [
                    { text : 'Foto\'s van honden', correct : false },
                    { text : 'Foto\'s van appels op verschillende plaatsen', correct : true },
                    { text : 'Foto\'s van dezelfde appel op verschillende plaatsen', correct : false },
                    { text : 'Foto\'s van dezelfde appel vanuit verschillende standpunten', correct : false }
                ],
                notes : [
                    'Hoe meer verschillende voorbeelden je verzameld, hoe beter het systeem ze kan leren herkennen.',
                    'Als je bijvoorbeeld steeds een appel op een bruine tafel laat zien, dan is er een kans dat het systeem leert dat iets alleen een appel is als deze op een bruine tafel ligt.'
                ]
            },
            {
                question : 'Wat is een goed voorbeeld van machine learning?',
                attempted : false,
                answers : [
                    { text : 'Grote getallen bij elkaar optellen', correct : false },
                    { text : 'Spam-berichten herkennen', correct : true },
                    { text : 'Tellen hoe vaak een knop is ingedrukt', correct : false }
                ],
                notes : [
                    'Een spamfilter is een goed voorbeeld van machine learning.',
                    'Met voldoende voorbeelden van legitieme e-mails en spam-e-mails, kan een leren om spam-berichten te herkennen.'
                ]
            },
            {
                question : 'Wat is GEEN goed voorbeeld van machine learning?',
                attempted : false,
                answers : [
                    { text : 'Tekstanalyse - herkennen of een tekst vrolijk of droevig is', correct : false },
                    { text : 'Tekst vertalen naar een andere taal', correct : false },
                    { text : 'Gezichtsherkenning - herkennen wie er op een foto staat', correct : false },
                    { text : 'Zelfrijdende auto\'s', correct : false },
                    { text : 'Prijsbepaling van producten in verschillende landen op basis van financiële wisselkoersen', correct : true },
                    { text : 'Aanbeveling voor bepaalde films op basis van films die je eerder hebt bekeken', correct : false }
                ],
                notes : [
                    'Taken die op een vooraf beschreven manier worden gedaan zijn niet echt geschit voor machine learning',
                    'De computer zal niet zelf leren hoe wisselkoersen werken, je moet de computer gewoon vertellen wat deze moet doen.'
                ]
            },
            {
                question : 'Which of these would be more likely to be successful?',
                attempted : false,
                answers : [
                    { text : 'Verzamel een paar voorbeelden, train een systeem, test om te zien hoe goed het is. Voeg meer voorbeelden toe, train opnieuw en test opnieuw. Herhaal dit totdat het goed genoeg is.', correct : true },
                    { text : 'Hoe meer voorbeelden, hoe beter. Begin met het verzamelen van miljoenen voorbeelden en besteed dan maanden om de computer te leren wat ieder voorbeeld is.', correct : false }
                ],
                notes : [
                    'Meer voorbeelden zijn inderdaad beter, maar het moet ook praktisch zijn.',
                    'Door telkens te testen bepaal je of de computer genoeg heeft geleerd.',
                    'Als je maar 10 voorbeelden hebt, dan maken tien aextra voorbeelden een groot verschil.',
                    'Als je al 100.000 voorbeelden hebt, dan maken 10 extra voorbeelden waarschijnlijk weinig verschil.'
                ]
            },
            {
                question : 'Welke stelling is correct?',
                attempted : false,
                answers : [
                    { text : 'Machine learning is een techniek waarbij computers worden getraind om taken uit te voeren in plaats van een voorgeschreven reeks stappen te moeten volgen.', correct : true },
                    { text : 'Machine learning is magisch', correct : false },
                    { text : 'Machine learning betekent dat we niet meer hoeven na te denken, dat doet de computer voor ons.', correct : false },
                    { text : 'Dankzij machine learning hoef je niet meer te leren programmeren', correct : false },
                    { text : 'Machine learning kan alleen met hele grote krachtige supercomputers', correct : false }
                ]
            },
            {
                question : 'Een machine-leersysteem dat is getraind om afbeeldingen met een boom te herkennen, moet goed zijn in het herkennen van:',
                attempted : false,
                answers : [
                    { text : 'foto\'s met fruit'., correct : false },
                    { text : 'vrolijke en droevige teksten.', correct : false },
                    { text : 'foto\'s van bomen.', correct : true }
                ],
                notes : [
                    'Machine learning betekent niet dat computers op een magische manier van alles kunnen leren.',
                    'Het betekent dat ze leren hoe ze een specifieke taak kunnen uitvoeren door voorbeelden van die specifieke taak te zien.',
                    'Als je wilt dat de machine iets anders doet, moet je deze ook trainen om dat te doen, door daarvan voorbeelden te geven.'
                ]
            },
            {
                question : 'Alice and Bob willen een computer leren om vrolijke/positieve em droevige/negatieve teksten te herkennen. Wie van hun zal waarschijnlijk het beste resultaat opleveren?',
                attempted : false,
                answers : [
                    { text : 'Alice. Zij heeft 10 verschillende voorbeelden van positieve en 10 verschillende voorbeelden van negatieve teksten verzameld', correct : true },
                    { text : 'Bob. Hij heeft 1000 voorbeelden van positieve teksten en 10 voorbeelden van negatieve teksten verzameld.', correct : false }
                ],
                notes : [
                    'Het verzamelen van een ongeveer gelijk aantal voorbeelden voor elk label is een goede techniek.',
                    'Als bijna elk tekstvoorbeeld positief is, zou je uiteindelijk het systeem kunnen leren dat negatieve teksten zeer onwaarschijnlijk is, en dat teksten dus vaker positief zijn.',
                    '',
                    'Maar misschien is dit juist de bedoeling.',
                    'Als je een systeem traint om tekst te herkennen die in 98% van de gevallen positief is, kan het de moeite waard zijn om het systeem te trainen met minder voorbeelden van negatieve teksten.'
                ]
            },
            {
                question : 'Geavanceerde machine learning-technologie geeft altijd juiste antwoorden. Onjuiste antwoorden betekenen dat de technologie niet erg goed is',
                attempted : false,
                answers : [
                    { text : 'Waar', correct : false },
                    { text : 'Niet waar', correct : true }
                ],
                notes : [
                    'Niet altijd.',
                    '',
                    'De technologie en algoritmes zijn belangrijk. MAAR machine learning systemen zijn net zo nauwkeurig en betrouwbaar als de training die ze hebben gehad.',
                    'Eenvoudige algoritmen en een goede training kunnen beter zijn dan de meest geavanceerde machine learning-algoritmen met weinig of slechte training.'
                ]
            },
            {
                question : 'Hoe zorg je ervoor dat jouw verzameling dierenfoto\'s geschikt is voor het trainen van een machine zonder menselijke fouten?',
                attempted : false,
                answers : [
                    { text : 'Controleer zelf alle foto\'s en bepaal zelf de labels.', correct : false },
                    { text : 'Vraag verschillende mensen om de foto\'s te labelen en houd hierbij labels aan die algemeen worden herkend.', correct : true },
                    { text : 'Ja duhh! Mensen hebben altijd gelijk - machines maken de fouten!', correct : false }
                ],
                notes : [
                    'Zelfs mensen maken fouten en je zal niet altijd de tijd hebben om alle voorbeelden te controleren!',
                    'Als een klus lastig is, kan het een goed idee zijn om meer dan één persoon elke afbeelding te laten labelen en het label aan te houden dat door de meeste mensen wordt gekozen.'
                ]
            },
            {
                question : 'Machines die getraind zijn om foto\'s van "voedsel" of "geen voedsel" te identificeren, geven vaak inconsistente resultaten voor sandwiches, waardoor ze onder het label "geen voedsel" worden ingedeeld. Hoe zou dat kunnen komen?',
                attempted : false,
                answers : [
                    { text : 'De mens die het systeem heeft getraind, hield niet van sandwiches en heeft deze ook niet in de trainingsgegevens opgenomen.', correct : true },
                    { text : 'De machine moet in de juiste stemming zijn voor een sandwich.', correct : false },
                    { text : 'Sandwiches zijn geen eten. Het systeem heeft dus gelijk.', correct : false }
                ],
                notes : [
                    'Machine learning modellen leren alleen van de voorbeelden die we ze geven.',
                    'Het is heel gemakkelijk voor mensen om per ongeluk hun voorkeuren en antipathieën in modellen voor machine learning te introduceren, dus we moeten heel voorzichtig zijn met welke trainingsgegevens we gebruiken.'
                ]
            },
            {
                question : 'Wat is zelfstandig (unsupervised) learning?',
                attempted : false,
                answers : [
                    { text : 'Een computer programma met heel veel als/dan opdrachten om het juiste resultaat te bepalen.', correct : false },
                    { text : 'Een machine learning algoritme dat nog niet gelabelde data gebruikt en deze classificeert op basis van een andere set data.', correct : true },
                    { text : 'Een machine learning algoritme dat gelabelde dat gebruikt en deze classificeert op basis van de training van voorbeeld data.', correct : false }
                ],
                notes : [
                    'Zelfstandig (unsupervised) learning is een vorm van machine learning, het uitsluitend gebruiken van als/dan opdrachten is dit niet.',
                    'Zelfstandige leeralgoritmen werken nog steeds op basis van training, maar de ingevoerde gegevens zijn niet gelabeld of geclassificeerd.',
                    'Als de gegevens zijn gelabeld, noemen we dit begeleid leren.'
                ]
            },
            {
                question : 'Zonder machine learning zouden zoekmachines als Google niet kunnen bestaan.',
                attempted : false,
                answers : [
                    { text : 'Waar', correct : false },
                    { text : 'Niet waar', correct : true }
                ],
                notes : [
                    'Hoewel veel moderne zoekmachines machine learning gebruiken, is het mogelijk om ook zonder machine learning een zoekmachine te maken. Een eenvoudige zoekmachine zoekt alleen naar documenten (webpagina\'s) met de woorden waarnaar de gebruiker zoekt.',
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
