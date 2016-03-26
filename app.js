'use strict';

const port = process.env.PORT || '8080';
const url = process.env.VIRTUAL_HOST || `localhost:${port}`;
const dbhost = process.env.DBHOST || 'mongo';
const dbname = process.env.MONGO_DB_NAME || 'ourjson';
const protocol = process.env.HTTP_PROTOCOL || 'https';
const restify = require('restify');
const mongojs = require('mongojs');
const shortid = require('shortid');
const key = require('mongo-key-escape');

// Functions
function filterkeys(json) {
  const finalObj = (Array.isArray(json)) ? [] : {};
  if (Array.isArray(json)) {
    json.forEach((item, index) => {
      finalObj[index] = (typeof item === 'object' && json[item] !== null) ? filterkeys(item) : item;
    });
  } else {
    Object.keys(json).forEach((item) => {
      finalObj[key.escape(item)] = (typeof json[item] === 'object' && json[item] !== null) ? filterkeys(json[item]) : json[item];
    });
  }
  return finalObj;
}

function unfilterkeys(json) {
  const finalObj = (Array.isArray(json)) ? [] : {};
  if (Array.isArray(json)) {
    json.forEach((item, index) => {
      finalObj[index] = (typeof item === 'object' && json[item] !== null) ? unfilterkeys(item) : item;
    });
  } else {
    Object.keys(json).forEach((item) => {
      finalObj[key.unescape(item)] = (typeof json[item] === 'object' && json[item] !== null) ? unfilterkeys(json[item]) : json[item];
    });
  }
  return finalObj;
}

function filterKeys(req, res, next) {
  if (req.body) {
    if (req.is('json')) {
      req.origBody = req.body;
      req.body = filterkeys(req.body);
      next();
    } else {
      res.json(400, {
        status: 400,
        message: 'Bad Request Body',
        description: 'The request content type is not JSON',
      });
    }
  } else {
    res.json(400, {
      status: 400,
      message: 'Empty Request Body',
      description: 'You sent a POST request without a body',
    });
  }
}


const server = restify.createServer();
server.pre(restify.pre.sanitizePath());
server.use(restify.bodyParser({ mapParams: false }));

const db = mongojs(`${dbhost}/${dbname}`, ['bins']);

server.get('/', (req, res, next) => {
  res.json(200, {
    status: 200,
    message: 'Welcome to OurJSON API v1.0.2',
    version: 1,
    description: 'This API emulates http://myjson.com/api',
  });
  next();
});
server.get('/healthz', (req, res, next) => {
  res.json(200, {
    status: '200',
    message: 'Server is up',
  });
  next();
});

server.get('/loaderio-65eefbac14d4627c0ae97b938fcdd8ea/', (req, res, next) => {
  res.send('loaderio-65eefbac14d4627c0ae97b938fcdd8ea');
  next();
});

server.post('/bins', filterKeys, (req, res, next) => {
  // Generate ID
  const binId = shortid.generate();
  db.bins.save({
    binId,
    json: req.body,
  }, (err, doc) => {
    if (err) {
      res.json(500, {
        status: 500,
        message: 'Internal Server Error',
        description: 'Your data was not saved',
      });
    } if (doc) {
      res.header('Bin-ID', binId);
      res.json(201, { uri: `${protocol}://${url}/bins/${binId}` });
    } else {
      res.json(500, {
        status: 500,
        message: 'Internal Server Error',
        description: 'Your data was not saved',
      });
    }
  });
  next();
});

server.get('/bins/:binId', (req, res, next) => {
  const binId = req.params.binId;
  if (binId === '') {
    res.json(404, {
      status: 404,
      message: 'Not Found',
      Description: 'There was no bin ID sent',
    });
  }
  db.bins.find().limit(1);
  db.bins.find({
    binId,
  }, (err, doc) => {
    if (err) {
      res.json(500, {
        status: 500,
        message: 'Internal Server Error',
        Description: 'The server failed to retrieve that ID',
      });
    } if (doc.length > 0) {
      res.json(200, unfilterkeys(doc[0].json));
    } else if (doc.length === 0) {
      res.json(404, {
        status: 404,
        message: 'Not Found',
        Description: `We could not find a bin with the ID (${binId}) in our system`,
      });
    }
  });
  next();
});

server.put('/bins/:binId', filterKeys, (req, res, next) => {
  const binId = req.params.binId;
  if (binId === '') {
    res.json(404, {
      status: 404,
      message: 'Not Found',
      Description: 'There was no bin ID sent',
    });
  }
  db.bins.update({
    binId,
  }, {
    $set: {
      json: req.body,
    },
  }, (err, doc) => {
    if (err) {
      res.json(500, {
        status: 500,
        message: 'Internal Server Error',
        Description: 'The server failed to retrieve that ID',
      });
    } if (doc.n !== 1) {
      res.json(404, {
        status: 404,
        message: 'Not Found',
        Description: `We could not find a bin with the ID (${binId}) in our system`,
      });
    } else {
      res.json(200, unfilterkeys(req.origBody));
    }
  });
  next();
});

// Session export
server.post('/export', (req, res, next) => {
  const selectedIds = req.body;
  const errArray = selectedIds;
  res.set('Content-Type', 'application/json');
  const retval = [];
  db.bins.find().limit(selectedIds.length);
  db.bins.find({ binId: { $in: selectedIds } }, (err, doc) => {
    if (err) {
      res.json(500, {
        status: 500,
        message: 'Internal Server Error',
        Description: 'The server failed to retrieve that information',
      });
    } if (doc.length <= selectedIds.length) {
      doc.forEach((item) => {
        retval.push(item.json);
        errArray.splice(errArray.indexOf(item.binId), 1);
      });
      if (errArray.length > 0) {
        res.json(200, {
          data: unfilterkeys(retval),
          err: errArray,
        });
      } else {
        res.json(200, {
          data: unfilterkeys(retval),
        });
      }
    } else if (doc.length === 0) {
      res.json(404, {
        status: 404,
        message: 'Not Found',
        Description: `None of the Ids ${JSON.stringify(selectedIds)} were found.`,
      });
    }
  });
  next();
});

server.listen(port, () => {
  console.log(`server listening on port ${port}`);
});
