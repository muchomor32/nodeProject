const express = require('express');
const session = require('express-session');
const ejs = require('ejs');
const bcrypt = require('bcrypt');
const mysql = require('mysql');
const dotenv = require('dotenv');
const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 8;
var hashedPassword = "", passData, nicknameData;

dotenv.config({path: './.env'}); 

const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE,
    multipleStatements: true
});

db.connect((error) => {
    if (error) {
        console.log(error);
    } else {
        console.log("Connected to MySQL DB");
    }
});

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', ejs.renderFile);
app.use(express.static('public'));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    loggedin: false,
    cookie: {} 
}) );


app.get('/', (req, res) => {
    res.render('index.html', { loggedin: req.session.loggedin, nickname: req.session.nickname});
});

app.get("/login", (req, res) => {
    res.render('login.html', { message: '', loggedin: req.session.loggedin});
});

app.get("/register", (req, res) => {
    res.render('register.html', {message: '', loggedin: req.session.loggedin});
});

app.post("/register", (req, res) => {
    const { nickname, email, password, passwordconf} = req.body;

    // queries for checking if user already exists

    db.query(`SELECT nick FROM userdata WHERE nick = "${nickname}";SELECT email from userdata WHERE email = "${email}";`, async (err, result) => {

        if (err) {
            console.error("Error fetching data from db", err);
        };
        

        if (result[0].length > 0) {
            return res.render("register.html", { message: "This username is already in use", loggedin: false});
        };

        if (result[1].length > 0) {
            return res.render("register.html", { message: "This email is already in use", loggedin: false});
        } else if (password != passwordconf) {
            return res.render("register.html", { message: "The passwords do not match", loggedin: false});
        };

        // after checks hashing and salting password before inserting
        
        bcrypt.genSalt(saltRounds, (err, salt) => {
            bcrypt.hash(password, salt, (err, hash) => {
                if (err) throw err;
                db.query(`INSERT INTO userdata(nick, email, password) VALUES ("${nickname}","${email}","${hash}");`, (err, ress) => {
                    if (err) {
                        console.error("Error inserting data into db:", err)
                    } else {
                        res.render("register.html", { message: "User successfully registered", loggedin: false});
                    };
                });
            })
        });
    });
});

app.post("/login", (req, res) => {
    const {name, password} = req.body;

    // queries for checking if data exists and passwords match

    db.query(`SELECT nick FROM userdata WHERE nick = "${name}";
            SELECT nick FROM userdata WHERE email = "${name}";
            SELECT password FROM userdata WHERE nick = "${name}";
            SELECT password FROM userdata WHERE email = "${name}";`, (err, result) => {

        if (err) {
            console.error("Error fetching email or username from db:", err);
        };

        if ((result[0][0] == undefined)&&(result[1][0] == undefined)){
            return res.render("login.html", { message: "This user does not exist", loggedin: false});
        };

        if (result[2].length > 0) {
            passData = JSON.stringify(result[2]);
            passData = JSON.parse(passData);
            hashedPassword = passData[0].password;
        } else if (result[3].length > 0) {
            passData = JSON.stringify(result[3]);
            passData = JSON.parse(passData);
            hashedPassword = passData[0].password;
        } else {
            return res.render("login.html", { message: "Password not found in database", loggedin: false});
        };
 

        bcrypt.compare(password,hashedPassword, (err, results) => {
            if (err) {
                console.error("Error comparing passwords:", err);
            } 

            if (results) {
                req.session.loggedin = true;
                if(result[0][0] != undefined){
                    nicknameData = JSON.stringify(result[0]);
                    nicknameData = JSON.parse(nicknameData);
                    req.session.nickname = nicknameData[0].nick; 
                } else {
                    nicknameData = JSON.stringify(result[1]);
                    nicknameData = JSON.parse(nicknameData);
                    req.session.nickname = nicknameData[0].nick; 
                }
                res.render("index.html", { nickname: req.session.nickname, loggedin: true });
            } else {
                res.render("login.html", { message: "Passwords do not match", loggedin: false});
            }
        });
    });
});

app.post("/auth/logout", (req, res) => {
    req.session.loggedin = false;
    req.session.nickname = undefined;
    return res.render('index.html', { nickname: req.session.nickname, loggedin: req.session.loggedin });
});

app.listen(port, () => {
    console.log(`The server is running on port ${port}`);
});

