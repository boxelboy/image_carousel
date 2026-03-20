import express from "express";
import session from "cookie-session";
import bodyParser  from'body-parser';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import multer from 'multer';
import sharp from 'sharp';
import 'dotenv/config';
import crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import cors from 'cors';
import helmet from 'helmet';

//console.log(crypto.createHash('sha256').update('E5m0').digest('hex'));

const app = express();
let { PORT, ADMIN, PASSWORD } = process.env;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, __dirname + '/images/')
    },
    /*filename: (req, file, callback) => {
        callback(null, file.originalname);
    }*/

    filename: function (req, file, callback) {
        callback(null, 'newimage');
    }
})

const upload = multer({ storage: storage })

const compressFile = async (req) => {
    const extension = req.file.mimetype.split('/')[1];
    if (extension === 'jpeg' || extension === 'jpg') {
        return await sharp(__dirname + '/images/newimage').resize().jpeg({
            quality: 80
        }).toFile(__dirname + '/images/' + req.file.originalname);
    } else {
        return await sharp(__dirname + '/images/newimage').resize().png({
            quality: 80
        }).toFile(__dirname + '/images/' + req.file.originalname);
    }
}

const processFile = async (req, res) => {
    let compressed = await compressFile(req);
    if (compressed.hasOwnProperty('format') && compressed.hasOwnProperty('size')) {
        let jsonFile = fs.readFileSync("uploads.json","utf-8");
        let jsonArr = JSON.parse(jsonFile);
        jsonArr.push({"img": req.file.originalname,"duration":"3","code":""});
        jsonFile = JSON.stringify(jsonArr);
        fs.writeFileSync("uploads.json",jsonFile,"utf-8");
        res.set('Content-Type', 'text/html');
        res.send('File successfully uploaded<br><button onclick="resetForm()" class="btn btn-warning">Reset</button>');
        fs.unlinkSync(__dirname + '/images/newimage');
    } else {
        res.status(500).send('Upload failed');
    }

}

const corsOptions = {
    origin:'*',
    credentials:true,
    //access-control-allow-credentials:true
    optionSuccessStatus:200
}

app.use(express.static(path.join(__dirname,'images')));
app.use(express.static(path.join(__dirname,'js')));
app.use(express.static(path.join(__dirname,'dashboard/assets')));

app.use(cors(corsOptions));
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            "script-src": ["'unsafe-inline'", "'self'"],
            "script-src-elem": ["'unsafe-inline'", "'self'", "buttons.github.io", "cdn.jsdelivr.net", "esm.run", "unpkg.com"],
            "style-src": ["'self'", "'unsafe-inline'","*.googleapis.com"],
            "font-src": ["*.googleapis.com", "*.gstatic.com", "*.azurewebsites.net"],
            "default-src": ["'self'", "*.azurewebsites.net"],
            "frame-ancestors": ["*.azurewebsites.net"]
        },
    }),
    helmet.crossOriginOpenerPolicy(),
    helmet.crossOriginResourcePolicy(),
    helmet.dnsPrefetchControl(),
    helmet.hidePoweredBy(),
    helmet.hsts(),
    helmet.ieNoOpen(),
    helmet.noSniff(),
    helmet.originAgentCluster(),
    helmet.referrerPolicy(),
    helmet.xssFilter(),
    helmet.xFrameOptions(),
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
    name: 'session',
    secret: 'mysecret',
    maxAge: 1000 * 60 * 60 * 2,
    secure: false
}));

/* GET Routes */
app.get('/', (req, res) => {
    res.sendFile('index.html', {root: __dirname});
});

app.get('/dashboard/display', (req, res) => {
    if (req.session.user !== 'admin') {
        res.redirect('/login');
    } else {
        res.sendFile('/dashboard/display.html', {root: __dirname});
    }
});

app.get('/dashboard/manage', (req, res) => {
    if (req.session.user !== 'admin') {
        res.redirect('/login');
    } else {
        res.sendFile('/dashboard/manage.html', {root: __dirname});
    }
});

app.get('/dashboard/profile', (req, res) => {
    if (req.session.user !== 'admin') {
        res.redirect('/login');
    } else {
        res.sendFile('/dashboard/profile.html', {root: __dirname});
    }
});

app.get('/dashboard/upload', (req, res) => {
    if (req.session.user !== 'admin') {
        res.redirect('/login');
    } else {
        res.sendFile('/dashboard/upload.html', {root: __dirname});
    }
});

app.get("/json", function(req, res, next) {
    res.header("Content-Type",'application/json');
    fs.readFile('uploads.json', 'utf8', function (err, data) {
        if (err) throw err;
        const obj = JSON.parse(data);
        res.send(JSON.stringify(obj));
    });
});

app.get('/login', (req, res) => {
    res.sendFile('login.html', {root: __dirname});
});

app.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/login');
});

app.get('/reset', (req, res) => {
    fs.unlinkSync(__dirname + '/images/newimage');
    res.redirect('/dashboard/upload');
})

app.get('/upload', (req, res) => {
    if (req.session.user !== 'admin') {
        res.redirect('/login');
    } else {
        res.sendFile('upload.html', {root: __dirname});
    }
});

app.get("/zoom", function(req, res, next) {
    res.header("Content-Type",'application/json');
    fs.readFile('zoom.json', 'utf8', function (err, data) {
        if (err) throw err;
        const obj = JSON.parse(data);
        res.send(JSON.stringify(obj));
    });
});

/* POST Routes */
app.post('/changePwd', (req, res) => {
    PASSWORD = crypto.createHash('sha256').update(req.body.password).digest('hex');
    let envFile = fs.readFileSync(".env","utf-8");
    let newEnvFile = envFile.substring(0, envFile.lastIndexOf("\n"));
    newEnvFile += "\nPASSWORD='" + PASSWORD + "'";
    fs.writeFileSync(".env",newEnvFile,"utf-8");
    res.set('Content-Type', 'text/html');
    res.send('Password has been successfully changed');
});

app.post('/login', (req, res) => {
    let username = req.body.username;
    let password = crypto.createHash('sha256').update(req.body.password).digest('hex');
    if (username === ADMIN && password === PASSWORD) {
        req.session.user = username;
        res.redirect('/dashboard/upload');
    } else {
        res.redirect('/login');
    }
});

app.post('/recreate', (req, res) => {
    let jsonArr = [];
    req.body.item.forEach((item, key) => {
        jsonArr.push({"img": item.split(':')[1], "duration": req.body.duration[key]});
    })
    fs.writeFileSync("uploads.json",JSON.stringify(jsonArr),"utf-8");
    res.set('Content-Type', 'text/html');
    res.send('<strong>Order successfully changed.</strong>');
})

app.post("/upload", upload.single("file"), processFile);

app.post("/zoom", (req, res) => {
    let jsonArr = [];
    jsonArr.push({"zoom": req.body.hiddenSliderValue});
    jsonArr.push({"pos": req.body.selected});
    const jsonFile = JSON.stringify(jsonArr);
    fs.writeFileSync("zoom.json",jsonFile,"utf-8");
    res.set('Content-Type', 'text/html');
    res.send('<strong>Values successfully changed. </strong>');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


