//load node modules
const express = require('express');
const hbs = require('express-handlebars');
const mysql = require('mysql');

//load config files

//set tunables
const PORT = parseInt(process.argv[2] || 3000);
const filmsPerPage = 12;

//sql query strings
const sqlSelectFilm = 'select film_id, title, description from film;'
const sqlSelectFilmById = 'select * from film where film_id = ?';
const sqlSelectFilmSearchTitle = `select film_id, title, description from film where title like ? limit ${filmsPerPage} offset ?`;
const sqlCountFilmSearchTitle = 'select count(*) from film where title like ?';

//create mysql connection pool
const pool = mysql.createPool(
    require('./config.json')
);

app = express();

//initialise handlebars stuff
app.engine('hbs', hbs({defaultLayout : 'main.hbs'}));
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');

//helper functions
const getFilmSearchCount = async function(title) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, conn) => {
            if (err) {
                res.status(500);
                res.type('text/plain');
                res.send(err);
                reject(0);
            }

            conn.query(sqlCountFilmSearchTitle,
                [`%${title}%`],
                (err, result) => {
                    conn.release();

                    if (err) {
                        res.status(500);
                        res.type('text/plain');
                        res.send(err);
                        reject(0);
                    }

                    resolve(result[0]['count(*)']);
                }
            )
        })
    })
}

const getFilmSearchTitle = async function(title, offset) {
    return new Promise((resolve, reject) => {
        pool.getConnection((err, conn) => {
            if (err) {
                res.status(500);
                res.type('text/plain');
                res.send(err);
                reject (err);
            }

            conn.query(sqlSelectFilmSearchTitle,
                [`%${title}%`, offset],
                (err, result) => {
                    conn.release();
                    if (err) {
                        res.status(500);
                        res.type('text/plain');
                        res.send(err);
                        reject (err);
                    }

                    resolve(result);
                }
            )
        });
    })
}

//implement routes
app.get('/search', (req, res) => {
    let title = req.query['title'];

    let page = parseInt(req.query['page']);
    if (!page){
        page = 0;
    }

    Promise.all([getFilmSearchCount(title), getFilmSearchTitle(title, page * filmsPerPage)])
    .then(result => {
        let numFilms = result[0];
        let filmList = result[1];

        let splitResult = [];
        for (let i = 0; i < filmList.length; i += 4)
        {
            splitResult.push(filmList.slice(i, i + 4));
        }

        res.status(200);
        res.type('text/html');
        res.render('search_tiles', 
        // res.render('search',
            {
                hasResult: filmList.length > 0,
                query: title,
                films: splitResult,
                numFilms: numFilms,
                noPrevious: page <= 0,
                previousPage: page - 1,
                noNext: page >= Math.floor((numFilms / filmsPerPage)),
                nextPage: page + 1,
                firstNum: page * filmsPerPage + 1,
                lastNum: Math.min((page + 1) * filmsPerPage, numFilms)
            }
        );
    })
    .catch(err => {
        console.log(err);
    })
});

app.get('/film/:filmid', (req, res) => {
    let filmid = req.params['filmid'];

    pool.getConnection((err, conn) => {
        if (err) {
            res.status(500);
            res.type('text/plain');
            res.send(err);
            return;
        }

        conn.query(sqlSelectFilmById, 
            filmid,
            (err, result) => {
                conn.release();
                if (err) {
                    res.status(500);
                    res.type('text/plain');
                    res.send(err);
                    return;
                }

                res.status(200);
                res.type('text/plain');
                res.send(result);
            }
        );
    });
});

app.get(['/', '/index.html'], (req, res) => {
    res.status(200);
    res.type('text/html');
    res.render('query');
});

//serve public files
app.get(/.*/, express.static(__dirname + '/public'));

//start the server
app.listen(PORT, () => {
    console.info(`App started on port ${PORT} at ${new Date()}`);
});