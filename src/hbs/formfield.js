/*global define*/
define(function(require) {
    'use strict';

    var _ = require('underscore'),
        Backbone = require('backbone'),
        Handlebars = require('handlebars'),
        fieldTemplates = {},
        unregister, register;

    register = function(type, template) {
        fieldTemplates[type] = template;
    };

    unregister = function(type) {
        if (fieldTemplates[type]) {
            delete fieldTemplates[type];
        }
    };

    register('text', require('hbs!./templates/formfield/text'));
    register('textarea', require('hbs!./templates/formfield/textarea'));
    register('select', require('hbs!./templates/formfield/select'));
    register('checkbox', require('hbs!./templates/formfield/checkbox'));
    register('radio', require('hbs!./templates/formfield/radio'));

    Handlebars.registerHelper('formfield', function(type, model, fieldName, options) {
        // template helper in the form of:
        //
        //      {{ formfield 'text' model 'fieldname' [attrName="attrValue"]*}}
        options = options || {};

        var template = fieldTemplates[type],
            opts = options.hash || {};

        if (!template) {
            throw new Error('Unregistered formfield template: ' + type);
        }

        _.defaults(opts, {
            id: model.fieldId(fieldName),
            label: fieldName,
            name: fieldName,
            options: [],
            value: model.get(fieldName) || '',
            help: ''
        });

        return new Handlebars.SafeString(template(opts));
    });

    return {
        register: register,
        unregister: unregister
    };
});
