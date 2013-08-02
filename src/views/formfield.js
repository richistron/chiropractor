/*global define*/
define(function(require) {
    'use strict';

    var $ = require('jquery'),
        _ = require('underscore'),
        Handlebars = require('handlebars'),
        viewHelper = require('../hbs/view'),
        Base = require('./base'),
        fieldTemplates = {},
        View, register;

    require('select2');

    View = Base.extend({
        events: {
            'change input': 'inputChanged',
            'blur input': 'inputChanged',
            'change select': 'inputChanged',
            'blur select': 'inputChanged',
            'change textarea': 'inputChanged',
            'blur textarea': 'inputChanged'
        },

        initialize: function(options) {
            Base.prototype.initialize.apply(this, arguments);
            this.config = options.context;
            this.field = options.field;
        },

        inputChanged: function() {
            var val = this.$('[name=' + this.field + ']').val();
            this.model.set(this.field, val, {validate: true});
            // We want to ensure that the model value is really updated even
            // if validation fails in the previous step. However, it should be
            // silent and not trigger any change events since the previous step
            // will take care of that in the case of success.
            this.model.set(this.field, val, {silent: true});
        }
    });

    View.register = function(type, def) {
        var SubClass = fieldTemplates[type] = View.extend(def);
        SubClass.register = function(type, def) {
            return fieldTemplates[type] = this.__super__.extend.call(this, def);
        };
        return SubClass;
    };

    View.unregister = function(type) {
        if (fieldTemplates[type]) {
            delete fieldTemplates[type];
        }
    };


    View.register('text', {
        template: require('hbs!./templates/formfield/text')
    });

    View.register('textarea', {
        template: require('hbs!./templates/formfield/textarea')
    });

    View.register('select', {
        template: require('hbs!./templates/formfield/select')
    });

    View.register('checkbox', {
        template: require('hbs!./templates/formfield/checkbox')
    });

    View.register('radio', {
        template: require('hbs!./templates/formfield/radio')
    });

    View.register('select2', {
        template: require('hbs!./templates/formfield/select2'),
        initialize: function(options) {
            View.prototype.initialize.call(this, options);
            this.select2 = {
                width: this.config.width || 'resolve',
                allowClear: this.config.blank,
                dropdownAutoWidth: true
            };

            if (!_(this.config.options).isEmpty()) {
                this.select2.data = this.config.options;
            }
            else if (this.config.url && this.config.optName, this.config.optValue) {
                var url = this.config.url,
                    optRoot = this.config.optRoot,
                    optName = this.config.optName,
                    optValue = this.config.optValue,
                    getNestedAttr = function(obj, attrs) {
                        if (!_(attrs).isEmpty()) {
                            _(attrs.split('.')).each(function(attr) {
                                if (obj && obj[attr]) {
                                    obj = obj[attr];
                                }
                                else {
                                    return undefined;
                                }
                            });
                        }
                        return obj;
                    };

                _(this.select2).defaults({
                    minimumInputLength: 1,
                    query: function(query) {
                        require([url + query.term], function(data) {
                            var results = getNestedAttr(data, optRoot);
                            results = _(results).map(function(record) {
                                return {
                                    id: getNestedAttr(record, optName),
                                    text: getNestedAttr(record, optValue)
                                };
                            }, this);

                            query.callback({
                                results: results,
                                more: false
                            });
                        });
                    }
                });
            }
        },

        render: function() {
            View.prototype.render.apply(this, arguments);
            this.$('[name=' + this.field + ']').select2(this.select2);

            return this;
        }
    });

    Handlebars.registerHelper('formfield', function(type, model, fieldName) {
        // template helper in the form of:
        //
        //      {{ formfield 'text' model 'fieldname' [attrName="attrValue"]*}}
        var FormField = fieldTemplates[type],
            options = arguments[arguments.length - 1],
            opts = options.hash || {};

        if (!FormField) {
            throw new Error('Unregistered formfield template: ' + type);
        }

        _.defaults(opts, {
            id: model.fieldId(fieldName),
            label: fieldName,
            name: fieldName,
            options: [],
            blank: false,
            value: model.get(fieldName) || '',
            help: ''
        });

        return viewHelper.call(this, FormField, {
            field: fieldName,
            model: model,
            context: opts
        });
    });

    return View;
});
