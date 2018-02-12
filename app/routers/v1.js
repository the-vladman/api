// Enable strict syntax mode
'use strict';

// Dependencies
var express = require('express');
var router = new express.Router();

module.exports = function(options) {
  // Load required controller
  var api = require('../controllers/api.v1')(options);
  // DCAT metadata
  router.get('/catalog.json', api.catalogInfo);

  // Data CRUD operations
  router.get('/:dataCollection', api.runQuery);
  router.get('/:dataCollection/:docId', api.getDocument);
  router.post('/:dataCollection', api.forbidden);
  router.put('/:dataCollection/:docId', api.forbidden);
  router.patch('/:dataCollection/:docId', api.forbidden);
  router.delete('/:dataCollection/:docId', api.forbidden);

  return router;
};
