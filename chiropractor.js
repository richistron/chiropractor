
/*global define*/
define('chiropractor/views',['require','underscore','jquery','backbone','handlebars'],function(require) {
    

    var _ = require('underscore'),
        $ = require('jquery'),
        Backbone = require('backbone'),
        Handlebars = require('handlebars'),
        removeHandlerTest = $('<span></span>'),
        removeHandlerExists = false,
        placeholderId,
        Base,
        Form;

    removeHandlerTest.on('remove', function() { removeHandlerExists = true; });
    removeHandlerTest.remove();

    if (!removeHandlerExists) {
        $.event.special.remove = {
            remove: function(e) {
                if (e.handler) {
                    e.handler.call(this, new $.Event('remove', {target: this}));
                }
            }
        };
    }

    placeholderId = function(view) {
        return 'chiropractorId' + view.cid;
    };

    Base = Backbone.View.extend({
        initialize: function(options) {
            options = options || {};
            Backbone.View.prototype.initialize.call(this, options);

            _.bindAll(this, 'remove');

            this._childViews = [];
            this._context = options.context || {};

            this.$el.on('remove', this.remove);
        },

        _addChild: function(view) {
            this._childViews.push(view);
            return '<' + view.el.tagName + ' id="' + placeholderId(view) + '">';
        },

        context: function() {
            return {
                model: this.model,
                collection: this.collection
            };
        },

        render: function() {
            var template = typeof(this.template) === 'string' ?
                    Handlebars.compile(this.template) : this.template,
                context = typeof(this.context) === 'function' ?
                    this.context() : this.context;

            context.declaringView = this;
            _.defaults(context, this._context);

            if (template) {
                this.$el.html(template(context));
            }

            _(this._childViews).each(function(view) {
                this.$('#' + placeholderId(view)).replaceWith(view.el);
            }, this);
            return this;
        },

        remove: function() {
            this.$el.off('remove', this.remove);
            _(this._childViews).each(function(view) {
                view.remove();
            });
            this._childViews = [];
            Backbone.View.prototype.remove.apply(this, arguments);
        }
    });

    Form = Base.extend({
        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);
            this.listenForErrors(this.model);
            this.listenForErrors(this.collection);
        },

        listenForErrors: function(obj) {
            if (obj) {
                if (obj instanceof Backbone.Model) {
                    this.listenTo(obj, 'invalid', this.renderFormErrors);
                }
                else if (obj instanceof Backbone.Collection) {
                    obj.each(function(model) {
                        this.listenTo(model, 'invalid', this.renderFormErrors);
                    }, this);
                }
                else {
                    throw new Error('Invalid object to associate errors with.');
                }
            }
        },

        renderFormErrors: function(model, errors) {
            _(errors).each(function(errorMessages, field) {
                var help;

                if (field === '__all__') {
                    help = $('<div class="errors"></div>');
                    this.$el.prepend(help);
                }
                else {
                    help = this.$('#container-' + model.fieldId(field))
                        .find('.help-inline');
                }

                help.html(errorMessages.join(', '));
            }, this);
        }
    });

    return {
        Base: Base,
        Form: Form
    };
});

/*global define,setTimeout,clearTimeout*/
define('chiropractor/models/auth',['require','backbone','jquery','underscore','jquery.cookie'],function(require) {
    

    var Backbone = require('backbone'),
        $ = require('jquery'),
        _ = require('underscore'),
        tokenCookie = 'wttoken',
        expirationWarningMinutes = 2,
        expirationWarningActive = false,
        expirationTimeoutId, expirationWarning,
        activeToken, getToken, setToken, clearToken;

    require('jquery.cookie');

    expirationWarning = function() {
        Backbone.Events.trigger('authentication:expiration');
        expirationWarningActive = true;

        expirationTimeoutId = setTimeout(
            function() {
                Backbone.Events.trigger('authentication:failure');
            },
            expirationWarningMinutes * 60 * 1000
        );
    };

    getToken = function() {
        if (typeof(activeToken) === 'undefined') {
            activeToken = $.cookie(tokenCookie);
        }
        return activeToken;
    };

    setToken = function(token) {
        var tokenComponents = token.split('::'),
            serverTime = tokenComponents[1],
            expireTime = tokenComponents[2],
            // We want an expiration alert to happen two minutes before the
            // token is going to expire.
            expirationTimeout = Math.max(
                0,
                expireTime - serverTime - (expirationWarningMinutes * 60)
            ) * 1000;

        activeToken = token;
        $.cookie(tokenCookie, token);

        if (expirationTimeoutId) {
            clearTimeout(expirationTimeoutId);
        }

        if (expirationWarningActive) {
            Backbone.Events.trigger('authentication:renewal');
            expirationWarningActive = false;
        }

        expirationTimeoutId = setTimeout(expirationWarning, expirationTimeout);
    };

    clearToken = function() {
        activeToken = undefined;
        $.removeCookie(tokenCookie);

        if (expirationTimeoutId) {
            clearTimeout(expirationTimeoutId);
        }
    };

    Backbone.Events.on(
        'authentication:logout authentication:failure',
        clearToken
    );

    return {
        sync: function(method, model, options) {
            var beforeSend = options.beforeSend,
                onError = options.error,
                onSuccess = options.success,
                self = this,
                opts = _(options).clone();

            options.success = function(model, data, xhr) {
                var token = xhr.getResponseHeader('Authorization');
                if (token) {
                    setToken(token);
                }
                return onSuccess.apply(self, arguments);
            };

            // This is a jQuery error handler.
            options.error = function(xhr, statusText, error) {
                if (xhr.status === 400) {
                    // TODO: add logic to only trigger unauthenticated if the
                    // bad request is due to malformed token
                    Backbone.Events.trigger('authentication:failure', self, xhr);
                }
                if (xhr.status === 401) {
                    Backbone.Events.trigger('authentication:failure', self, xhr);

                    self.listenToOnce(
                        Backbone.Events,
                        'authentication:success',
                        function() {
                            self.sync(method, model, opts);
                        }
                    );
                }

                // Call the original onError handler.
                if (onError) {
                    return onError.apply(self, arguments);
                }
            };

            options.beforeSend = function(xhr) {
                var token = getToken();
                if (!self.disableAuthToken && token) {
                    xhr.setRequestHeader(
                        'Authorization',
                        token
                    );
                }

                if (beforeSend) {
                    return beforeSend.apply(this, arguments);
                }
            };
        },
        cleanup: clearToken
    };
});

/*global define,setTimeout,clearTimeout*/
define('chiropractor/models',['require','backbone','underscore','./models/auth'],function(require) {
    

    var Backbone = require('backbone'),
        _ = require('underscore'),
        auth = require('./models/auth'),
        Base;

    Base = Backbone.Model.extend({
        sync: function(method, model, options) {
            // Setup the authentication handlers for the BaseModel
            auth.sync.call(this, method, model, options);

            return Backbone.Model.prototype.sync.call(
                this, method, model, options
            );
        },

        parse: function(resp, options) {
            options = options || {};
            // We need to unwrap the old WiserTogether API envelop format.
            if (resp.data && resp.meta) {
                if (parseInt(resp.meta.status, 10) >= 400) {
                    options.legacyError = true;
                    if (resp.meta.errors && resp.meta.errors.form) {
                        this.validationError = resp.meta.errors.form;
                        this.trigger(
                            'invalid',
                            this,
                            this.validationError,
                            _.extend(options || {}, {
                                validationError: this.validationError
                            })
                        );
                    }
                    else {
                        this.trigger('error', this, resp.data, options);

                        if (options.error) {
                            options.error(this, resp.data, options);
                        }
                    }
                    // We do not want an error response to update the model
                    // attributes (returning an empty object leaves the model
                    // state as it was
                    return {};
                }
                return resp.data;
            }
            return Backbone.Model.prototype.parse.apply(this, arguments);
        },

        fieldId: function(field, prefix) {
            prefix = prefix || 'formfield';
            return [prefix, field, this.cid].join('-');
        },

        set: function(attrs, options) {
            // We need to allow the legacy errors to short circuit the Backbone
            // success handler in the case of a legacy server error.
            if (options && options.legacyError) {
                delete options.legacyError;
                return false;
            }

            return Backbone.Model.prototype.set.apply(this, arguments);
        }
    });

    return {
        Base: Base,
        cleanup: auth.cleanup
    };
});

/*global define*/
define('chiropractor/collections',['require','backbone'],function(require) {
    

    var Backbone = require('backbone'),
        Base;

    Base = Backbone.Collection.extend({
    });

    return {
        Base: Base
    };
});

/*global define*/
define('chiropractor/routers',['require','backbone'],function(require) {
    

    var Backbone = require('backbone'),
        Base;

    Base = Backbone.Router.extend({
    });

    return {
        Base: Base
    };
});

/*global define*/
define('chiropractor/hbs/view',['require','underscore','backbone','handlebars'],function(require) {
    

    var _ = require('underscore'),
        Backbone = require('backbone'),
        Handlebars = require('handlebars'),
        view;

    view = function() {
        // template helper in the form of:
        //
        //      {{ view "path/to/require/module[|ViewName]" [context] }}
        var View, view, options, requirePath,
            viewName, attrs, requireBits, placeholder;

        options = arguments[arguments.length - 1];
        attrs = arguments[1] || {};

        if (typeof(arguments[0]) === 'string') {
            requireBits = arguments[0].split('|');
            requirePath = requireBits[0];
            viewName = requireBits[1];

            View = require(requirePath);
            if (typeof(viewName) === 'string') {
                View = View[viewName];
            }
        }
        else {
            View = arguments[0];
        }
        view = new View(attrs).render();

        placeholder = this.declaringView._addChild(view);

        // Return a placeholder that the Chiropractor.View can replace with
        // the child view appended above.
        return new Handlebars.SafeString(placeholder);
    };

    Handlebars.registerHelper('view', view);

    return view;
});

;
;
/**
 * @license handlebars hbs 0.4.0 - Alex Sexton, but Handlebars has it's own licensing junk
 *
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/require-cs for details on the plugin this was based off of
 */

/* Yes, deliciously evil. */
/*jslint evil: true, strict: false, plusplus: false, regexp: false */
/*global require: false, XMLHttpRequest: false, ActiveXObject: false,
define: false, process: false, window: false */
define('hbs',[
], function (
) {

      return {

        get: function () {
            return Handlebars;
        },

        write: function (pluginName, name, write) {

            if ( (name + customNameExtension ) in buildMap) {
                var text = buildMap[name + customNameExtension];
                write.asModule(pluginName + "!" + name, text);
            }
        },

        version: '0.4.0',

        load: function (name, parentRequire, load, config) {
                  }
      };
});
/* END_hbs_PLUGIN */
;
/* START_TEMPLATE */
define('hbs!chiropractor/hbs/templates/formfield/text',['hbs','handlebars'], function( hbs, Handlebars ){ 
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, foundHelper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"control-group\" id=\"container-";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\">\n    <label class=\"control-label\" for=\"";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\">";
  foundHelper = helpers.label;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.label; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "</label>\n    <div class=\"controls\">\n        <input type=\"text\" id=\"";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\" name=\"";
  foundHelper = helpers.name;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.name; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\" value=\"";
  foundHelper = helpers.value;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.value; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\" />\n        <span class=\"help-inline\">";
  foundHelper = helpers.help;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.help; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "</span>\n    </div>\n</div>\n";
  return buffer;});
Handlebars.registerPartial('chiropractor_hbs_templates_formfield_text', t);
return t;
});
/* END_TEMPLATE */
;
/* START_TEMPLATE */
define('hbs!chiropractor/hbs/templates/formfield/textarea',['hbs','handlebars'], function( hbs, Handlebars ){ 
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, foundHelper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"control-group\" id=\"container-";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\">\n    <label class=\"control-label\" for=\"";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\">";
  foundHelper = helpers.label;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.label; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "</label>\n    <div class=\"controls\">\n        <textarea id=\"";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\" name=\"";
  foundHelper = helpers.name;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.name; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\">";
  foundHelper = helpers.value;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.value; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "</textarea>\n        <span class=\"help-inline\">";
  foundHelper = helpers.help;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.help; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "</span>\n    </div>\n</div>\n";
  return buffer;});
Handlebars.registerPartial('chiropractor_hbs_templates_formfield_textarea', t);
return t;
});
/* END_TEMPLATE */
;
/* START_TEMPLATE */
define('hbs!chiropractor/hbs/templates/formfield/select',['hbs','handlebars'], function( hbs, Handlebars ){ 
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, foundHelper, functionType="function", escapeExpression=this.escapeExpression, self=this, helperMissing=helpers.helperMissing;

function program1(depth0,data) {
  
  var buffer = "", stack1, foundHelper;
  buffer += "\n                <option value=\"\">";
  foundHelper = helpers.blank;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.blank; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "</option>\n            ";
  return buffer;}

function program3(depth0,data,depth1) {
  
  var buffer = "", stack1, stack2, foundHelper;
  buffer += " \n                <option value=\"";
  foundHelper = helpers.value;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.value; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\"";
  stack1 = depth1.value;
  stack2 = depth0.value;
  foundHelper = helpers.ifequal;
  stack1 = foundHelper ? foundHelper.call(depth0, stack2, stack1, {hash:{},inverse:self.noop,fn:self.program(4, program4, data)}) : helperMissing.call(depth0, "ifequal", stack2, stack1, {hash:{},inverse:self.noop,fn:self.program(4, program4, data)});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += ">";
  foundHelper = helpers.label;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.label; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "</option>\n            ";
  return buffer;}
function program4(depth0,data) {
  
  
  return " selected=\"selected\"";}

  buffer += "<div class=\"control-group\" id=\"container-";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\">\n    <label class=\"control-label\" for=\"";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\">";
  foundHelper = helpers.label;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.label; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "</label>\n    <div class=\"controls\">\n        <select id=\"";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\" name=\"";
  foundHelper = helpers.name;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.name; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\">\n            ";
  stack1 = depth0.blank;
  stack1 = helpers['if'].call(depth0, stack1, {hash:{},inverse:self.noop,fn:self.program(1, program1, data)});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n            ";
  stack1 = depth0.options;
  stack1 = helpers.each.call(depth0, stack1, {hash:{},inverse:self.noop,fn:self.programWithDepth(program3, data, depth0)});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n        </select>\n        <span class=\"help-inline\">";
  foundHelper = helpers.help;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.help; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "</span>\n    </div>\n</div>\n";
  return buffer;});
Handlebars.registerPartial('chiropractor_hbs_templates_formfield_select', t);
return t;
});
/* END_TEMPLATE */
;
/* START_TEMPLATE */
define('hbs!chiropractor/hbs/templates/formfield/checkbox',['hbs','handlebars'], function( hbs, Handlebars ){ 
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, foundHelper, functionType="function", escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  var buffer = "", stack1, foundHelper;
  buffer += " \n            <input type=\"checkbox\" id=\"";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\" name=\"";
  foundHelper = helpers.name;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.name; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\" value=\"";
  foundHelper = helpers.value;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.value; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\" /> ";
  foundHelper = helpers.label;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.label; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\n        ";
  return buffer;}

  buffer += "<div class=\"control-group\" id=\"container-";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\">\n    <label class=\"control-label\" for=\"";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\">";
  foundHelper = helpers.label;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.label; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "</label>\n    <div class=\"controls\">\n        ";
  stack1 = depth0.options;
  stack1 = helpers.each.call(depth0, stack1, {hash:{},inverse:self.noop,fn:self.program(1, program1, data)});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n        <span class=\"help-inline\">";
  foundHelper = helpers.help;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.help; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "</span>\n    </div>\n</div>\n";
  return buffer;});
Handlebars.registerPartial('chiropractor_hbs_templates_formfield_checkbox', t);
return t;
});
/* END_TEMPLATE */
;
/* START_TEMPLATE */
define('hbs!chiropractor/hbs/templates/formfield/radio',['hbs','handlebars'], function( hbs, Handlebars ){ 
var t = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  helpers = helpers || Handlebars.helpers;
  var buffer = "", stack1, foundHelper, functionType="function", escapeExpression=this.escapeExpression, self=this;

function program1(depth0,data) {
  
  var buffer = "", stack1, foundHelper;
  buffer += " \n            <input type=\"radio\" id=\"";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\" name=\"";
  foundHelper = helpers.name;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.name; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\" value=\"";
  foundHelper = helpers.value;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.value; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\" /> ";
  foundHelper = helpers.label;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.label; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\n        ";
  return buffer;}

  buffer += "<div class=\"control-group\" id=\"container-";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\">\n    <label class=\"control-label\" for=\"";
  foundHelper = helpers.id;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.id; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "\">";
  foundHelper = helpers.label;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.label; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "</label>\n    <div class=\"controls\">\n        ";
  stack1 = depth0.options;
  stack1 = helpers.each.call(depth0, stack1, {hash:{},inverse:self.noop,fn:self.program(1, program1, data)});
  if(stack1 || stack1 === 0) { buffer += stack1; }
  buffer += "\n        <span class=\"help-inline\">";
  foundHelper = helpers.help;
  if (foundHelper) { stack1 = foundHelper.call(depth0, {hash:{}}); }
  else { stack1 = depth0.help; stack1 = typeof stack1 === functionType ? stack1() : stack1; }
  buffer += escapeExpression(stack1) + "</span>\n    </div>\n</div>\n";
  return buffer;});
Handlebars.registerPartial('chiropractor_hbs_templates_formfield_radio', t);
return t;
});
/* END_TEMPLATE */
;
/*global define*/
define('chiropractor/hbs/formfield',['require','underscore','backbone','handlebars','./view','hbs!./templates/formfield/text','hbs!./templates/formfield/textarea','hbs!./templates/formfield/select','hbs!./templates/formfield/checkbox','hbs!./templates/formfield/radio'],function(require) {
    

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
            this.model.set(this.field, this.$('[name=' + this.field + ']').val());
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

/*global define*/
define('chiropractor/hbs/ifequal',['require','handlebars'],function(require) {
    

    var Handlebars = require('handlebars');

    Handlebars.registerHelper('ifequal', function(val1, val2, options) {
        if (val1 === val2) {
            return options.fn(this);
        } else {
            return options.inverse(this);
        }
    });
});

/*global define*/
define('chiropractor/hbs',['require','./hbs/view','./hbs/formfield','./hbs/ifequal'],function(require) {
    

    require('./hbs/view');
    require('./hbs/formfield');
    require('./hbs/ifequal');
});

/*global define*/
define('chiropractor/main',['require','backbone','backbone.subroute','./views','./models','./collections','./routers','./hbs'],function(require) {
    

    var Backbone = require('backbone'),
        SubRoute = require('backbone.subroute'),
        View = require('./views').Base,
        Model = require('./models').Base,
        Collection = require('./collections').Base,
        Router = require('./routers').Base;

    require('./hbs');

    return {
        Collection: Collection,
        Events: Backbone.Events,
        history: Backbone.history,
        Model: Model,
        Router: Router,
        SubRoute: SubRoute,
        View: View
    };
});

define('chiropractor', ['chiropractor/main'], function (main) { return main; });
