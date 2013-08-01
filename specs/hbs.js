/*global define*/
define(function(require) {
    'use strict';

    var describe = require('mocha').describe;

    return function() {
        describe('view', function() {
            require('specs/hbs/view')();
        });

        describe('formfield', function() {
            require('specs/hbs/formfield')();
        });

        describe('ifequal', function() {
            require('specs/hbs/ifequal')();
        });
    };
});
