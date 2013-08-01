/*global define*/
define(function(require) {
    'use strict';

    var $ = require('jquery'),
        _ = require('underscore'),
        expect = require('expect'),
        afterEach = require('mocha').afterEach,
        beforeEach = require('mocha').beforeEach,
        describe = require('mocha').describe,
        it = require('mocha').it,
        Chiropractor = require('chiropractor'),
        Handlebars = require('handlebars'),
        formfield = require('chiropractor/hbs/formfield');

    return function() {
        beforeEach(function() {
            this.model = new Chiropractor.Model();
        });

        afterEach(function() {
            this.view.remove();
        });

        describe('core', function() {
            beforeEach(function() {
                formfield.register('foo', Handlebars.compile(
                    '<input type="foo" ' +
                        'name="{{ name }}" ' +
                        'value="{{ value }}" ' +
                        'id="{{ id }}" />'
                    ));
            });

            afterEach(function() {
                formfield.unregister('foo');
            });

            it('should take three required arguments and render the ' +
                'specified form field.', function() {
                   var template = Handlebars.compile(
                           '{{ formfield "foo" model "field1" }}'
                       ),
                       $el;

                    this.model.set('field1', 'test');

                   this.dom.html(template({model: this.model}));
                   $el = this.dom.find('input');

                   expect($el.length).to.equal(1);
                   expect($el.val()).to.equal('test');
                   expect($el.attr('type')).to.equal('foo');
                   expect($el.attr('name')).to.equal('field1');
                   expect($el.attr('id')).to.equal(this.model.fieldId('field1'));
               });

            it('should throw an error if the provided field type is not ' +
                'registerd with the system.', function() {
                   var template = Handlebars.compile(
                           '{{ formfield "missingfieldtype" model "field1" }}'
                       );

                    expect(_(function() {
                        $(template({model: this.model}));
                    }).bind(this)).to.throwError();
               });
        });

        describe('select', function() {
            var opts = [
                {value: '1', label: 'One'},
                {value: 'test', label: 'Two'},
                {value: '3', label: 'Three'}
            ];

            it('should render as a select element', function() {
                var template = Handlebars.compile(
                    '{{ formfield "select" model "field1" }}'
                    ),
                    $el;

                this.dom.html(template({model: this.model}));

                $el = this.dom.find('select');

                expect($el.length).to.equal(1);
                expect($el.find('option').length).to.equal(0);
                expect($el.val()).to.equal(null);
            });

            it('should allow specifying the blank options to insert an empty ' +
               'blank option at the start of the list.', function() {
                   var template = Handlebars.compile(
                       '{{ formfield "select" model "field1" blank="-----" }}'
                       ),
                       $el;

                   this.dom.html(template({model: this.model, opts: opts}));

                   $el = this.dom.find('select');

                   expect($el.find('option').length).to.equal(1);
                   expect($el.val()).to.equal('');
               });

            it('should render all of the provided options', function() {
                var template = Handlebars.compile(
                    '{{ formfield "select" model "field1" options=opts }}'
                    ),
                    $el;

                this.dom.html(template({model: this.model, opts: opts}));

                $el = this.dom.find('select');

                expect($el.find('option').length).to.equal(3);
                expect($el.val()).to.equal('1');
            });

            it('should select the currently selected value.', function() {
                var template = Handlebars.compile(
                    '{{ formfield "select" model "field1" options=opts }}'
                    ),
                    $el;

                this.model.set('field1', 'test');

                this.dom.html(template({model: this.model, opts: opts}));

                $el = this.dom.find('select');

                expect($el.find('option').length).to.equal(3);
                expect($el.val()).to.equal('test');
            });
        });
    };
});
