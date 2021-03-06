(function () {
    'use strict';

    var root = this,
        require = root.require;

    require.config({
        packages: [{
            name: 'chiropractor',
            location: 'src'
        }],

        hbs: {
            disableI18n: true,
            disableHelpers: true
        },

        paths: {
            'handlebars': 'bower_components/require-handlebars-plugin/Handlebars',
            'hbs': 'bower_components/require-handlebars-plugin/hbs',
            'i18nprecompile': 'bower_components/require-handlebars-plugin/hbs/i18nprecompile',
            'text': 'bower_components/requirejs-plugins/lib/text',
            'json': 'bower_components/requirejs-plugins/src/json',
            'json2': 'bower_components/require-handlebars-plugin/hbs/json2',
            'json3': 'bower_components/json3/lib/json3',
            'underscore': 'bower_components/underscore/underscore',
            'backbone': 'bower_components/backbone-amd/backbone',
            'jquery': 'bower_components/jquery/jquery',
            'jquery.cookie': 'bower_components/jquery.cookie/jquery.cookie',
            'backbone.subroute': 'bower_components/backbone.subroute/backbone.subroute',
            'backbone.validation': 'bower_components/backbone-validation/dist/backbone-validation-amd',
            'backbone.deep.model': 'bower_components/backbone-deep-model/src/deep-model',
            'underscore.mixin.deepextend': '/lib/underscore.mixin.deepExtend',
            'jquery.ie.cors':         './lib/jquery.ie.cors',
            'chiropractor': 'src/main',
            'json-ie7':'./lib/JSON'
        },
        urlArgs: "bust="+(new Date()).getTime(),
        skipModuleInsertion: false,
        wrap: true,

        pragmasOnSave: {
            excludeHbsParser: true,
            excludeHbs: true,
            excludeAfterBuild: true
        },

        shim: {
            'backbone': {
                deps: ['jquery', 'underscore'],
                exports: 'Backbone'
            },
            'underscore': {
                exports: '_'
            },
            'underscore.mixin.deepextend': {

            },
            'backbone.deep.model': {
                deps: ['backbone', 'underscore'],
                exports: 'Backbone.DeepModel'
            },
            'json-ie7': {
                exports: 'JSON'
            },
            'jquery.ie.cors': {
                deps: ['jquery']
            },
            'jquery': {
                deps: ['json-ie7'],
                exports: 'jQuery'
            },
            'jquery.cookie': {
                deps: ['jquery'],
                exports: 'jQuery.cookie'
            }
        },

        deps: [
            //'jquery',
            'hbs',
            'jquery',
            'jquery.ie.cors'
        ],

        enforceDefine: true
    });



    define(function (require) {
        var example = require('src/example');
    });
}).call(this);

