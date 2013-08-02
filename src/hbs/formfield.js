/*global define*/
define(function(require) {
    'use strict';

    var _ = require('underscore'),
        Backbone = require('backbone'),
        Handlebars = require('handlebars'),
        viewHelper = require('./view'),
        fieldTemplates = {},
        View, unregister, register;

    View = Backbone.View.extend({
        events: {
            'change input': 'inputChanged',
            'change select': 'inputChanged'
        },

        initialize: function(options) {
            Backbone.View.prototype.initialize.apply(this, arguments);

            _.bindAll(this, 'remove');
            this.field = options.field;
            this.template = options.template;
            this.config = options.config;
            this.$el.on('remove', this.remove);
        },

        inputChanged: function() {
            var val = this.$('[name=' + this.field + ']').val();
            this.model.set(this.field, val, {validate: true});
            // We want to ensure that the model value is really updated even
            // if validation fails in the previous step. However, it should be
            // silent and not trigger any change events since the previous step
            // will take care of that in the case of success.
            this.model.set(this.field, val, {silent: true});
        },

        render: function() {
            this.$el.html(this.template(this.config));
            return this;
        },

        remove: function() {
            this.$el.off('remove', this.remove);
            Backbone.View.prototype.remove.call(this);
        }
    });

    register = function(type, template, ViewClass) {
        ViewClass = ViewClass || View;
        fieldTemplates[type] = {
            template: template,
            view: ViewClass
        };
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

        var formfield = fieldTemplates[type],
            opts = options.hash || {};

        if (!formfield) {
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

        return viewHelper.call(this, formfield.view, {
            template: formfield.template,
            field: fieldName,
            model: model,
            config: opts
        });
    });

    return {
        register: register,
        unregister: unregister
    };
});
