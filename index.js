const Sequelize = require('sequelize');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const COOKIE_SECRET = 'cookie secret';


const db = new Sequelize('sondage', 'root', '', {
    host: 'localhost',
    dialect: 'mysql'
});
const User = db.define('user', {
    firstname: { type: Sequelize.STRING },
    lastname: { type: Sequelize.STRING },
    email: { type: Sequelize.STRING },
    password: { type: Sequelize.STRING }
});

const Survey = db.define('survey', {
    question: { type: Sequelize.STRING }
});

const PossibleAnswer = db.define('possibleanswer', {
    answer: { type: Sequelize.STRING}
});

const UserAnswer = db.define('useranswer', {
        answer: { type: Sequelize.STRING }
    });

Survey.hasMany(UserAnswer);
UserAnswer.belongsTo(Survey);

User.hasMany(UserAnswer);
UserAnswer.belongsTo(User);

Survey.hasMany(PossibleAnswer);
PossibleAnswer.belongsTo(Survey);

User.hasMany(Survey);
Survey.belongsTo(User);

function isAnswered(userId) {
    UserAnswer
        .findOne({where: {userId: userId}})
        .then((useranswer) => {
            if(!useranswer){
                return false;
            }
            else{
                return true;
            }
    })
}

function getPercentage(currentVote){
    let percentage;
    let totalSurveyAnswers;
    let totalCurrentVote;

    return UserAnswer
        .findAll({where: { answer: currentVote.id}})
        .then((useranswers) => {
            totalCurrentVote = useranswers.length;
        })
        .then(() => {
            return UserAnswer
                .findAll({where: { surveyId: currentVote.surveyId }})
                .then((useranswers) => {
                totalSurveyAnswers = useranswers.length;
                if(totalSurveyAnswers > 0 && totalCurrentVote >= 0){
                    percentage = (totalCurrentVote * 100)/totalSurveyAnswers;
                }
                else{
                    percentage = 0;
                }
                console.log(percentage);
                console.log(totalSurveyAnswers);
                console.log(totalCurrentVote);
                    console.log("----------------------------------");
                return percentage;
            })
        });
}

const app = express();

app.set('view engine', 'pug');
app.use(cookieParser(COOKIE_SECRET));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: COOKIE_SECRET,
    resave: false,
    saveUninitialized: false
}));

// Initialize passport, it must come after Express' session() middleware
app.use(passport.initialize());
app.use(passport.session());

//----------------Authentification------------------

passport.use(new LocalStrategy((email, password, cb) => {

    // Find a user with the provided username (which is an email address in our case)
    User
        .findOne({ where: {
            email,
            password
            }
        })
        .then((user) => {
            if(user){
                return cb(null, user);
            }
            else{
                return cb(null, false, {
                    message: "email ou mot de passe inconnu."
                });
            }
        });
}));

// Save the user's email address in the cookie
passport.serializeUser((user, cb) => {
    cb(null, user.email);
});

passport.deserializeUser((username, cb) => {
    // Fetch the user record corresponding to the provided email address
    User
        .findOne({ where: {
            email: username
        }})

        .then((user) =>{
        cb(null, user);
        })
});
//----------------------- Fin authentification---------------------------

//---------------Création utilisateurs--------------

app.get('/api/signup', (req, res) => {
    res.render('signup');
});

app.post('/api/signup', (req, res) => {
    const firstname = req.body.firstname;
    const lastname = req.body.lastname;
    const email = req.body.email;
    const password = req.body.password;

    if(firstname !== null && lastname !== null && email !== null && password !== null){
        User
            .create({
                firstname: firstname,
                lastname: lastname,
                email: email,
                password: password
            })
            .then((user) => {
                req.login(user, () => {
                res.redirect('/');
                });
            })
            .catch((error) =>{
                    res.render('500', {error: error})
            });
    }
    else{
        console.log("L'utilisateur n'a pas pu être créé.")
    }
});

//--------------------------------------------------

//??????????????????????????Question????????????????????????????????
app.get('/api/createSurvey/question', (req, res) => {
    // Render the create question page
    res.render('createquestionsurvey');
});


app.post('/api/createSurvey/question', (req, res) => {

    if(req.user){
        const question = req.body.question;
        Survey
            .create({ question: question, userId: req.user.id })

            .then((survey) => {
                res.redirect('/api/createSurvey/' + survey.id + '/answer');
            })
            .catch((error) =>{
                res.render('500', {error: error})
            });
    }
    else{
        res.redirect('/api/login');
    }
});

//!!!!!!!!!!!!!!!!!!!!!Réponse!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
app.get('/api/createSurvey/:surveyId/answer', (req, res) => {
    // Render the create answer page
    res.render('createanswersurvey', { surveyId: req.params.surveyId});
});

app.post('/api/createSurvey/:surveyId/answer', (req, res) => {
    const answer = req.body.answer;
    const surveyId = req.params.surveyId;
    PossibleAnswer
        .create({ answer: answer, surveyId: surveyId })
        .then(() => {
            res.redirect('/api/createSurvey/' + surveyId + '/answer');
        })
        .catch((error) =>{
            res.render('500', {error: error})
        });
});
//::::::::::::::::::::::::::::::

app.get('/api/login', (req, res) => {
    // Render the login page
    res.render('login');
});

app.post('/api/login',
    // Authenticate user when the login form is submitted
    passport.authenticate('local', {
        // If authentication succeeded, redirect to the home page
        successRedirect: '/',
        // If authentication failed, redirect to the login page
        failureRedirect: '/api/login'
    })
);

app.get('/api/logout', function(req, res){
    req.logout();
    res.redirect('/');
});

app.get('/api/survey/:surveyId', (req, res) => {
    if(req.user){

        UserAnswer
            .findOne({where: {userId: req.user.id, surveyId: req.params.surveyId}})
            .then((useranswer) => {
                let isAnswered;
                if (!useranswer) {
                    isAnswered = false;
                }
                else {
                    isAnswered = true;
                }
            });
        Survey
            .findOne({
            where: { id: req.params.surveyId },
            include:  [PossibleAnswer]
            })
            .then((survey) =>{
                return Promise
                    .all(survey.possibleanswers.map((answer) => {
                        return getPercentage(answer)
                            .then((percentage) =>{
                                answer.setDataValue("percentage", percentage);
                                return answer;
                            })
                    }))
                    .then((answers) =>{
                        console.log(answers);
                        survey.setDataValue("possibleanswers", answers);
                        return survey;
                    })
            })
            .then((survey) => {
                res.render('surveyanswer', { survey: survey, isAnswered });
            });



    }
    else{
        res.redirect('/api/login');
    }
});

app.post('/api/surveyanswer/submit/:surveyId/', (req, res) => {

    const surveyId = req.params.surveyId;
    const userAnswer = req.body.surveyanswer;
    UserAnswer
        .create({ answer: userAnswer, surveyId: surveyId, userId: req.user.id })
        .then(() => {
            res.redirect('/');
        })
        .catch((error) =>{
            res.render('500', {error: error})
        });
});

app.get('/', (req, res) => {
    Survey
        .findAll({ include: [PossibleAnswer] })
        .then(surveys => res.render('homepage', { surveys, user: req.user }));
});

db
    .sync()
    .then(() =>{
        app.listen(3000, () => {
        console.log('Listening on port 3000');
    });
});
